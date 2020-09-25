"use strict";
const User = require("$models/User");
const UserRole = require("$models/UserRole");
const guard = require("express-jwt-permissions")();
const { body, param } = require("express-validator");
const { validate } = require("$util");

const columns = [
  "id",
  "username",
  "email",
  "avatar",
  "created_at",
  "updated_at",
];

const upsert = (id, details, add) => {
  const data = { id, updated_at: new Date().toISOString() };

  if (details && Object.keys(details).length) {
    Object.assign(data, details);
  }

  if (add && add.length) {
    Object.assign(data, {
      user_roles: add.map((role) => ({ role_id: role })),
    });
  }

  return data;
};

const updateUser = async function (req, res, next) {
  const remove = req.body.remove || null,
    added = req.body.added || null,
    details = req.body.details || null;

  try {
    const user = await User.transaction(async (trx) => {
      if (details && Object.keys(details).length) {
        await User.query(trx).where("id", req.params.id).patch(details).first();
      }

      if (remove && remove.length) {
        await UserRole.query(trx)
          .delete()
          .where("user_id", req.params.id)
          .whereIn("role_id", remove);
      }

      if (added && added.length) {
        const roles = added.map((role) => ({
          user_id: req.params.id,
          role_id: role,
        }));

        await UserRole.query(trx).insert(roles).returning("*");
      }

      const results = await User.query(trx)
        .where("id", req.params.id)
        .withGraphFetched("roles(nameAndId)")
        .first()
        .columns(columns);

      return results;
    });

    res.status(200).send({ user });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "PUT",
  middleware: [
    guard.check(["view:admin", "update:users"]),
    validate([
      param("id").isNumeric().toInt(10),
      body("details.username").optional().isAlphanumeric().escape().trim(),
      body("details.email").optional().isEmail().normalizeEmail().escape(),
      body("added.*").optional().isNumeric(),
      body("remove.*").optional().isNumeric(),
    ]),
  ],
  handler: updateUser,
};
