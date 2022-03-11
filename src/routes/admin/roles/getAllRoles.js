"use strict";
const Role = require("$models/Role");
const DiscordRole = require("$models/DiscordRole");
const Settings = require("$models/Settings");
const Policy = require("$models/Policy");
const guard = require("express-jwt-permissions")();
const getCache = require("$util/getCache");
const filterQuery = require("$util/filterQuery");
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_ROLES } = require("$util/policies");
const pick = require("lodash.pick");

const select = [
  "id",
  "name",
  "level",
  "is_deletable",
  "is_removable",
  "created_at",
  "updated_at",
];

const getAllRoles = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;
  const filters = pick(req.query, ["limit", "exclude", "id"]);

  const roleQuery = filterQuery(
    Role.query()
      .select(
        select,
        Role.relatedQuery("users")
          .count("users.id")
          .as("members")
          .whereColumn("roles.id", "user_roles.role_id")
      )
      .orderBy("created_at", "desc")
      .orderBy("id"),
    filters,
    "roles" //column to lookup exclusion
  );

  let query = null;

  if (nextCursor) {
    query = await roleQuery.clone().cursorPage(nextCursor);
  } else {
    query = await roleQuery.clone().cursorPage();
  }

  // Object.assign(response, { roles: query });

  res.status(200).send(query);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_ROLES]),
    validate([query("nextCursor").optional().isString().escape().trim()]),
  ],
  handler: getAllRoles,
};
