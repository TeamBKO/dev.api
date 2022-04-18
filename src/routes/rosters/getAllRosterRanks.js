"use strict";
const RosterRank = require("$models/RosterRank");
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
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = ["id", "icon", "name", "priority", "is_deletable"];

const getRosterRanks = async function (req, res, next) {
  const filters = req.query.exclude;
  const nextCursor = req.query.nextCursor;

  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select("rank.priority")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_ranks", true)
        .orWhere("rank:permissions.can_edit_ranks", true)
        .orWhere("permissions.can_add_ranks", true)
        .orWhere("rank:permissions.can_add_ranks", true)
        .orWhere("permissions.can_edit_member_ranks", true)
        .orWhere("rank:permissions.can_edit_member_ranks", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privileges");
  }

  const rankQuery = filterQuery(
    RosterRank.query()
      .select(select)
      .where("roster_id", req.params.id)
      .andWhere("priority", ">=", hasAccess.priority)
      .orderBy("roster_ranks.priority", "asc")
      .orderBy("roster_ranks.id", "asc")
      .limit(10),
    filters,
    "roster_ranks"
  );

  let query;

  if (nextCursor) {
    query = await rankQuery.clone().cursorPage(nextCursor);
  } else {
    query = await rankQuery.clone().cursorPage();
  }

  console.log(query);

  res.status(200).send(query);
};

module.exports = {
  path: "/:id/ranks",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log("query", req.query);
      next();
    },
    validators,
  ],
  handler: getRosterRanks,
};
