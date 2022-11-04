"use strict";
const RosterForm = require("$models/RosterForm");
const sanitize = require("sanitize-html");
const { query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = [
  "roster_member_forms.id",
  "applicant:member.id as userID",
  "applicant.status",
  "roster_member_forms.created_at",
  "roster_member_forms.updated_at",
];

const getOwnRosterMemberForms = async function (req, res) {
  const nextCursor = req.query.nextCursor;

  const rosterFormQuery = RosterForm.query()
    .joinRelated("[applicant.[member(defaultSelects)]]")
    .withGraphFetched("[roster(default), form(default)]")
    .select(select)
    .where("applicant:member.id", req.user.id);

  let query;

  if (nextCursor) {
    query = await rosterFormQuery.clone().cursorPage(nextCursor);
  } else {
    query = await rosterFormQuery.clone().cursorPage();
  }

  res.status(200).send(query);
};

module.exports = {
  path: "/member/forms",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log(req.query);
      next();
    },
    validators,
  ],
  handler: getOwnRosterMemberForms,
};
