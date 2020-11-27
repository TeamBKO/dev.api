"use strict";
const UserRole = require("$models/UserRole");
const User = require("$models/User");

const guard = require("express-jwt-permissions")();
const { param, body } = require("express-validator");
const { validate } = require("$util");
const { Redshift } = require("aws-sdk");

const addUserToGroup = async function (req, res) {
  const userId = parseInt(req.params.id, 10),
    roleId = req.body.roleId;

  const hasRole = await UserRole.query()
    .where("user_id", userId)
    .andWhere("role_id", roleId)
    .first();

  if (hasRole) {
    return res.status(422).send("User already has role.");
  }

  const result = await UserRole.transaction(async (trx) => {
    const role = await UserRole.query(trx)
      .insert({
        user_id: userId,
        role_id: roleId,
      })
      .withGraphFetched("role(nameAndId)")
      .returning("*");

    const token = await User.query()
      .select("token_id")
      .where("id", userId)
      .first();

    return { role, token };
  });

  /** If any permission/role changes are made on the user we revoke the token and force the user to relog. */
  if (!(await req.redis.get(`blacklist:${result.token.token_id}`))) {
    await req.redis.set(
      `blacklist:${result.token.token_id}`,
      `blacklist:${result.token.token_id}`,
      "EX",
      60 * 60 * 24
    );
  }

  const user = {
    id: userId,
    role: result.role,
  };

  res.status(200).send({ user });
};

module.exports = {
  path: "/:id/role",
  method: "PUT",
  middleware: [
    guard.check("update:users"),
    validate([param("id").isNumeric(), body("roleId").isNumeric()]),
  ],
  handler: addUserToGroup,
};
