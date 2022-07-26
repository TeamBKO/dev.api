"use strict";
const DiscordRole = require("$models/DiscordRole");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_ROLES } = require("$util/policies");

const getAllRoles = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;

  const roleQuery = DiscordRole.query().orderBy("name").orderBy("id");

  let query = null;

  if (nextCursor) {
    query = await roleQuery.clone().cursorPage(nextCursor);
  } else {
    query = await roleQuery.clone().cursorPage();
  }

  res.status(200).send(query);
};

module.exports = {
  path: "/discord",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN]),
    validate([query("nextCursor").optional().isString().escape().trim()]),
  ],
  handler: getAllRoles,
};
