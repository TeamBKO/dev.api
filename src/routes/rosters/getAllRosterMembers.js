"use strict";
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const massageMemberData = require("$util/massageMemberData");
const pick = require("lodash.pick");
const { param, query } = require("express-validator");
const {
  getCachedQuery,
  getCachedSettings,
} = require("$services/redis/helpers");
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
  const status = req.query.status;

  const filters = pick(req.query, ["rank", "searchByMemberName", "exclude"]);

  const settings = await getCachedSettings();

  let eager = "[rank(default), forms(default).[fields(useAsColumn)]]";

  let rosterMemberQuery = RosterMember.query()
    .joinRelated("[member(defaultSelects)]")
    .select(select)
    .where("roster_members.roster_id", req.params.id)
    .andWhere("roster_members.status", status)
    .withGraphFetched(eager)
    .orderBy("roster_members.roster_rank_id", "asc")
    .orderBy("roster_members.id")
    .limit(25);

  const nextCursor = req.query.nextCursor;
  const memberQuery = filterQuery(rosterMemberQuery, filters, "roster_members");

  let query;
  const cacheID = req.params.id.split("-")[4];
  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    query = await getCachedQuery(
      `roster:${cacheID}:members:${status}:${next}`,
      memberQuery.clone().cursorPage(nextCursor),
      settings.cache_rosters_on_fetch,
      60
    );
  } else {
    query = await getCachedQuery(
      `roster:${cacheID}:members:${status}:first`,
      memberQuery.clone().cursorPage(),
      settings.cache_roster_on_fetch,
      120
    );
  }

  query.results = query.results.map(massageMemberData);

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
