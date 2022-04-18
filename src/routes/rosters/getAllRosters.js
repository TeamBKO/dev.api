"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
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
  "id",
  "name",
  "url",
  "icon",
  "enable_recruitment",
  "private",
  "banner",
  "created_at",
  "updated_at",
  RosterMember.query()
    .whereColumn("roster_members.roster_id", "rosters.id")
    .count()
    .as("members"),
];

const getAllRosters = async function (req, res) {
  const nextCursor = req.query.nextCursor;
  console.log(req.user);
  const rosterQuery = Roster.query()
    .withGraphFetched("[roster_form(default), creator(defaultSelects)]")
    .select([
      ...select,
      RosterMember.query()
        .where("roster_members.member_id", req.user.id)
        .whereColumn("roster_id", "rosters.id")
        .count()
        .as("joined"),
    ])
    .orderBy("created_at", "desc")
    .orderBy("id");

  let query;

  if (nextCursor) {
    query = await rosterQuery.clone().cursorPage(nextCursor);
  } else {
    query = await rosterQuery.clone().cursorPage();
  }

  console.log(query);

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
    validators,
  ],
  handler: getAllRosters,
};
