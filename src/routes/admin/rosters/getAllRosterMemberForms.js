"use strict";
const RosterForm = require("$models/RosterForm");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const pick = require("lodash.pick");
const { query } = require("express-validator");
const { validate } = require("$util");
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
  "roster_member_forms.id as id",
  "roster.id as rosterID",
  "roster.name as rosterName",
  "form.name as formName",
  "applicant:member.username as username",
  "applicant:member.avatar as avatar",
  "roster_member_forms.created_at",
  "roster_member_forms.updated_at",
];

const getAllRosterMemberForms = async function (req, res) {
  const filters = pick(req.query, ["exclude", "searchByName", "limit"]);
  const nextCursor = req.query.nextCursor;

  const forms = filterQuery(
    RosterForm.query()
      .select(select)
      .joinRelated(
        "[roster, form, applicant(default).[member(defaultSelects)]]"
      )
      .orderBy("created_at", "desc")
      .orderBy("id"),
    filters,
    "roster"
  );

  let query;

  if (nextCursor) {
    query = await forms.clone().cursorPage(nextCursor);
  } else {
    query = await forms.clone().cursorPage();
  }

  res.status(200).send(query);
};

module.exports = {
  path: "/forms",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log(req.query);
      next();
    },
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: getAllRosterMemberForms,
};
