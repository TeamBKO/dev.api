"use strict";
const Role = require("$models/Role");
const { query } = require("express-validator");
const { validate } = require("$util");
const {
  getCachedSettings,
  getCachedQuery,
} = require("$services/redis/helpers");
const select = ["id", "name", "level", "created_at", "updated_at"];

const getAllRoles = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;

  const settings = await getCachedSettings();

  const roleQuery = Role.query()
    .select([
      select,
      Role.relatedQuery("users")
        .count("users.id")
        .as("members")
        .whereColumn("roles.id", "user_roles.role_id"),
    ])
    .orderBy("created_at", "desc")
    .orderBy("id");

  let query = null;

  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    query = await getCachedQuery(
      `rosters:${next}`,
      roleQuery.clone().cursorPage(nextCursor),
      settings.cache_on_roles_fetch
    );
    roles;
  } else {
    query = await getCachedQuery(
      "rosters:first",
      roleQuery.clone().cursorPage(),
      settings.cache_on_roles_fetch
    );
  }

  // if (nextCursor) {
  //   query = await roleQuery.clone().cursorPage(nextCursor);
  // } else {
  //   query = await roleQuery.clone().cursorPage();
  // }

  res.status(200).send(query);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    validate([
      query("nextCursor").optional().isString().escape().trim(),
      query("limit").optional().isNumeric().toInt(10).default(50),
    ]),
  ],
  handler: getAllRoles,
};
