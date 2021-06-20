"use strict";
const User = require("$models/User");
const Roles = require("$models/Roles");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const { buildQuery, validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_USERS } = require("$util/permissions");

const columns = ["id", "avatar", "username", "email", "active", "created_at"];

const getAllUsersForAdmin = async function (req, res, next) {
  console.log(req.query);

  const filters = req.query.filters || null;

  let query = User.query()
    .withGraphFetched("roles(nameAndId)")
    .orderBy("id")
    .select(columns);

  if (filters && Object.keys(filters).length) {
    query = query.whereExists(
      User.relatedQuery("roles").whereIn("id", filters.id)
    );
  }

  const [users, roles] = await Promise.all([
    buildQuery(query, req.query.page, req.query.limit),
    req.query.roles
      ? Roles.query().select("id", "name").where("level", ">=", req.user.level)
      : Promise.resolve(null),
  ]);

  res.status(200).send({ users, roles });
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_USERS]),
    validate([
      query("page").optional().isNumeric(),
      query("limit").optional().isNumeric(),
    ]),
  ],
  handler: getAllUsersForAdmin,
};
