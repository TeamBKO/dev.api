"use strict";
const Role = require("$models/Role");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const getUserSessionsByRoleID = require("$util/getUserSessionsByRoleID");

const { param, body } = require("express-validator");
const { validate, shouldRevokeToken } = require("$util");
const { VIEW_ALL_ADMIN, UPDATE_ALL_ROLES } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { transaction, raw } = require("objection");
const uniq = require("lodash.uniq");

const validators = validate([
  param("id").isNumeric().toInt(10),
  body("details.name")
    .optional()
    .isAlphanumeric()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("details.level")
    .optional()
    .isNumeric()
    .custom((v, { req }) => v >= req.user.level),
  body("addPolicies.*").optional().isNumeric(),
  body("removePolicies.*").optional().isNumeric(),
  body("addDiscordRoles.*").optional().isNumeric(),
  body("removeDiscordRoles.*").optional().isNumeric(),
  // body("discord_roles.*").optional().isNumeric(),
  // body("policies.*").optional().isNumeric(),
  body("altered").default(false).isBoolean(),
]);

const middleware = [
  guard.check([VIEW_ALL_ADMIN, UPDATE_ALL_ROLES]),
  validators,
];

const select = [
  "id",
  "name",
  "level",
  "is_deletable",
  "is_removable",
  "created_at",
  "updated_at",
];

const updateRole = async (req, res, next) => {
  let query = Role.query();
  const trx = await Role.startTransaction();

  try {
    await Role.updateRole(req.params.id, req.body, trx);

    if (shouldRevokeToken(req)) {
      const sessions = await getUserSessionsByRoleID(req.params.id);
      if (sessions && sessions.length) {
        console.log(sessions);
        await redis.multi(sessions).exec();
      }
      query = query.withGraphFetched("[policies, discord_roles]");
    }

    await trx.commit();
    deleteCacheByPattern(`?(admin:roles*|roles*|role:${req.params.id}*)`);

    const role = await query
      .where("id", req.params.id)
      .select(["name", "id", "updated_at", "level"])
      .first();

    res.status(200).send(role);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    return next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "PATCH",
  middleware,
  handler: updateRole,
};
