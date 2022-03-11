"use strict";
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const pick = require("lodash.pick");
const { param, query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("status")
    .isString()
    .trim()
    .escape()
    .isIn(["pending", "approved", "rejected"])
    .customSanitizer((v) => sanitize(v))
    .default("approved"),
  query("rank.*").optional().isNumeric().toInt(10),
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = [
  "roster_members.id",
  "roster_members.status",
  "roster_members.approved_on",
  // "members:member.name",
  // "members:member.avatar",
  // "members:member.id",
];

const getRosterMembers = async function (req, res, next) {
  const filters = pick(req.query, ["status", "rank", "searchByMemberName"]);
  const nextCursor = req.query.nextCursor;
  const memberQuery = filterQuery(
    RosterMember.query()
      .select(select)
      .where("roster_members.roster_id", req.params.id)
      .withGraphJoined("[member(defaultSelects), rank, form(default)]"),
    filters,
    "roster_members"
  );

  let query;

  if (nextCursor) {
    query = await memberQuery.clone().cursorPage(nextCursor);
  } else {
    query = await memberQuery.clone().cursorPage();
  }

  console.log(query);

  res.status(200).send(query);
};

module.exports = {
  path: "/:id/members",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log("query", req.query);
      next();
    },
    validators,
  ],
  handler: getRosterMembers,
};
