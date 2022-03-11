"use strict";
const User = require("$models/User");
const filterQuery = require("$util/filterQuery");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_USERS } = require("$util/policies");
const pick = require("lodash.pick");

const columns = [
  "users.id",
  "avatar",
  "username",
  "email",
  "active",
  "created_at",
  "updated_at",
];

const getAllUsers = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;
  const filters = pick(req.query, [
    "limit",
    "exclude",
    "searchByUsername",
    "active",
  ]);

  const roleIds = req.query["roles.id"];

  const userQuery = filterQuery(
    User.query()
      .withGraphFetched("roles(nameAndId)")
      .orderBy("users.created_at", "desc")
      .select(columns)
      .limit(50),
    filters,
    "users" //column to look up what records to exclude
  );

  if (roleIds && roleIds.length) {
    userQuery = userQuery.whereExists(
      User.relatedQuery("roles").whereIn("id", roleIds)
    );
  }

  let query;

  if (nextCursor) {
    query = await userQuery.clone().cursorPage(nextCursor).debug();
  } else {
    query = await userQuery.clone().cursorPage().debug();
  }

  console.log(query.results.length);

  res.status(200).send(query);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_USERS]),
    validate([
      query("nextCursor").optional().isString().escape().trim(),
      // query("isInitial").optional().isBoolean().default(false),
      query("limit").optional().isNumeric(),
    ]),
  ],
  handler: getAllUsers,
};
