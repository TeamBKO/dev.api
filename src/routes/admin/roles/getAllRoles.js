"use strict";
const Role = require("$models/Role");

const guard = require("express-jwt-permissions")();
const pick = require("lodash.pick");

const filterQuery = require("$util/filterQuery");
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_ROLES } = require("$util/policies");
const {
  getCachedSettings,
  getCachedQuery,
} = require("$services/redis/helpers");

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

  const settings = await getCachedSettings();

  const roleQuery = filterQuery(
    Role.query()
      .where("level", ">=", req.user.level)
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
  const securityLevel = req.user.level;
  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    query = await getCachedQuery(
      `admin:roles:${securityLevel}:${next}`,
      roleQuery.clone().cursorPage(nextCursor),
      settings.cache_roles_on_fetch,
      filters
    );
  } else {
    query = await getCachedQuery(
      `admin:roles:${securityLevel}:first`,
      roleQuery.clone().cursorPage(),
      settings.cache_roles_on_fetch,
      filters
    );
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
