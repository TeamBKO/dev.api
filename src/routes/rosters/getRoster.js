"use strict";

const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");

const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const { param } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ROSTERS } = require("$util/policies");

const validators = validate([
  param("id")
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = ["name", "icon", "enable_recruitment", "is_disabled", "private"];

const getRoster = async function (req, res, next) {
  const rosterQuery = Roster.query()
    .withGraphFetched("[creator(defaultSelects), ranks(default)]")
    .select(select)
    .where("id", req.params.id)
    .first();

  const membersQuery = RosterMember.query()
    .joinRelated("member(defaultSelects)")
    .select([
      "roster_members.id",
      "roster_members.status",
      "roster_members.approved_on",
      "member.username as username",
      "member.avatar as avatar",
    ])
    .where("status", "approved")
    .andWhere("roster_id", req.params.id)
    .withGraphFetched("[rank(default), form(default)]")
    .limit(25)
    .cursorPage();

  const memberQuery = RosterMember.query()
    .withGraphFetched("[rank(default).[permissions(default)]]")
    .select(["id"])
    .where("roster_id", req.params.id)
    .andWhere("member_id", req.user.id)
    .first();

  let [roster, members, member] = await Promise.all([
    rosterQuery,
    membersQuery,
    memberQuery,
  ]);

  roster = Object.assign(roster, { members, member });

  console.log(roster);

  res.status(200).send(roster);
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validators,
  ],
  handler: getRoster,
};
