"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const massageMemberData = require("$util/massageMemberData");

const { param } = require("express-validator");
const { validate } = require("$util");
const {
  getCachedQuery,
  getCachedObject,
  getCachedSettings,
} = require("$services/redis/helpers");

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
  "show_fields_as_columns",
  "enable_recruitment",
  "is_disabled",
  "private",
  "applicant_form_channel_id",
  "link_to_discord",
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
  let [settings, roster] = await Promise.all([
    getCachedSettings(),
    Roster.query()
      .withGraphFetched(
        "[roster_form(default).[fields(useAsColumn)], ranks(default), roles(nameAndId)]"
      )
      .select(select)
      .where("url", req.params.slug)
      .throwIfNotFound()
      .first(),
  ]);

  let eager = "[rank(default), forms(default).[fields(useAsColumn)]]";

  // let eager = "[rank(default), form(default).[fields(useAsColumn)]]";

  let membersQuery = RosterMember.query()
    .joinRelated("member(defaultSelects)")
    .select(memberSelect)
    .where("status", "approved")
    .andWhere("roster_id", roster.id)
    .withGraphFetched(eager)
    .orderBy("roster_members.roster_rank_id", "asc")
    .orderBy("roster_members.id")
    .limit(25)
    .cursorPage();

  const memberQuery = RosterMember.query()
    .withGraphFetched(
      "[rank(default).[permissions(default)], permissions(default)]"
    )
    .select(["id", "status"])
    .where("roster_id", roster.id)
    .andWhere("member_id", req.user.id)
    .first();

  const cacheID = roster.id.split("-")[4];

  let [members, member] = await Promise.all([
    getCachedQuery(
      `roster:${cacheID}:members:approved:first`,
      membersQuery,
      settings.cache_rosters_on_fetch
    ),
    memberQuery,
  ]);

  members.results = members.results.map(massageMemberData);

  console.log(roster);

  roster = Object.assign(roster, { members, member });

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
