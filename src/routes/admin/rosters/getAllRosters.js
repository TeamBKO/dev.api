"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const pick = require("lodash.pick");
const { query } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const validators = validate([
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("exclude.*").optional().isNumeric().toInt(),
  query("limit").optional().isNumeric().toInt().default(50),
  query("searchByName")
    .optional()
    .isAlphanumeric()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = [
  "id",
  "name",
  "icon",
  "enable_recruitment",
  "apply_roles_on_approval",
  "private",
  "is_disabled",
  "created_at",
  "updated_at",
];

const getAllRosters = async function (req, res) {
  const filters = pick(req.query, ["exclude", "searchByName", "limit"]);
  const nextCursor = req.query.nextCursor;

  const rosterQuery = filterQuery(
    Roster.query()
      .withGraphFetched("[roster_form(default), creator(defaultSelects)]")
      .select(select)
      .orderBy("created_at", "desc")
      .orderBy("id"),
    filters
  );

  let query;

  if (nextCursor) {
    query = await rosterQuery.clone().cursorPage(nextCursor);
  } else {
    query = await rosterQuery.clone().cursorPage();
  }

  res.status(200).send(query);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log(req.query);
      next();
    },
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: getAllRosters,
};
