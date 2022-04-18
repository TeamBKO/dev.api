"use strict";
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const { param, query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("getRanks").optional().isBoolean(),
  query("roster_id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = [
  "roster_members.id",
  "roster_members.status",
  "roster_members.approved_on",
  "member.username as username",
  "member.avatar as avatar",
  "member.id as userID",
];

const getRosterRank = async function (req, res, next) {
  const getRanks = req.query.getRanks; //for fetch ranks on the initial request.
  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select("rank.priority")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  let ranks = [];

  if (getRanks && req.query.roster_id) {
    ranks = await RosterRank.query()
      .select(["id", "name", "icon", "priority"])
      .where("roster_id", req.query.roster_id)
      .andWhere("priority", ">=", hasAccess.priority)
      .orderBy("roster_ranks.priority", "asc")
      .orderBy("roster_ranks.id", "asc")
      .limit(10)
      .cursorPage();
  }

  const member = await RosterMember.query()
    .joinRelated("[member(defaultSelects)]")
    .select(select)
    .where("roster_members.id", req.params.id)
    .withGraphFetched("[rank(default), permissions(default)]")
    .first();

  console.log(member);

  res.status(200).send(Object.assign({}, { member, ranks }));
};

module.exports = {
  path: "/member/:id",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log("query", req.query);
      next();
    },
    validators,
  ],
  handler: getRosterRank,
};
