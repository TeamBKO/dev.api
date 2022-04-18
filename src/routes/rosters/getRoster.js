"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const getCache = require("$util/getCache");
const sanitize = require("sanitize-html");

const { param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("slug")
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
  "banner",
  "auto_approve",
  "apply_roles_on_approval",
  "enable_recruitment",
  "is_disabled",
  "private",
];

const memberSelect = [
  "roster_members.id",
  "roster_members.status",
  "roster_members.approved_on",
  "roster_members.is_deletable",
  "member.username as username",
  "member.avatar as avatar",
  "member.id as userID",
];

const getRoster = async function (req, res, next) {
  let roster = await Roster.query()
    .withGraphFetched(
      "[roster_form(default), ranks(default), roles(nameAndId)]"
    )
    .select(select)
    .where("url", req.params.slug)
    .throwIfNotFound()
    .first();

  const membersQuery = RosterMember.query()
    .joinRelated("member(defaultSelects)")
    .select(memberSelect)
    .where("status", "approved")
    .andWhere("roster_id", roster.id)
    .withGraphFetched("[rank(default), form(default)]")
    .orderBy("roster_members.roster_rank_id", "asc")
    .orderBy("roster_members.id")
    .limit(25)
    .cursorPage();

  const memberQuery = RosterMember.query()
    // .joinRelated("member(defaultSelects")
    .withGraphFetched("[rank(default).[permissions(default)]]")
    .select(["id", "status"])
    .where("roster_id", roster.id)
    .andWhere("member_id", req.user.id)
    .first();

  let [members, member] = await Promise.all([membersQuery, memberQuery]);

  roster = Object.assign(roster, { members, member });

  console.log(roster);

  res.status(200).send(roster);
};

module.exports = {
  path: "/:slug",
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
