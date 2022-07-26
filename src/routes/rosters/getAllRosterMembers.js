"use strict";
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const pick = require("lodash.pick");
const { param, query } = require("express-validator");
const { getCachedQuery } = require("$services/redis/helpers");
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
  "roster_members.is_deletable",
  "member.username as username",
  "member.avatar as avatar",
  "member.id as userID",
];

const getRosterMembers = async function (req, res, next) {
  const filters = pick(req.query, [
    "status",
    "rank",
    "searchByMemberName",
    "exclude",
  ]);
  const nextCursor = req.query.nextCursor;
  const memberQuery = filterQuery(
    RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .select(select)
      .where("roster_members.roster_id", req.params.id)
      .withGraphFetched("[rank, form(default).[fields(useAsColumn)]]")
      .orderBy("roster_members.roster_rank_id", "asc")
      .orderBy("roster_members.id")
      .limit(25),
    filters,
    "roster_members"
  );

  let query;
  const cacheID = req.params.id.split("-")[4];
  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    query = await getCachedQuery(
      `members:${cacheID}:${next}`,
      memberQuery.clone().cursorPage(nextCursor),
      60
    );
  } else {
    query = await getCachedQuery(
      `members:${cacheID}:first`,
      memberQuery.clone().cursorPage(),
      60
    );
  }

  // if (nextCursor) {
  //   query = await memberQuery.clone().cursorPage(nextCursor);
  // } else {
  //   query = await memberQuery.clone().cursorPage();
  // }

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
