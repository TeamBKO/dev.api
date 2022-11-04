"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const hasScope = require("$util/hasScope");
const { param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const validators = validate([
  param("id")
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = [
  "id",
  "name",
  "icon",
  "banner",
  "enable_recruitment",
  "auto_approve",
  "apply_roles_on_approval",
  "private",
  "is_disabled",
  "show_fields_as_columns",
  "assign_discord_roles_on_approval",
  "applicant_form_channel_id",
  "link_to_discord",
  "created_at",
  "updated_at",
];

const checkPermissions = async function (req, res, next) {
  if (hasScope(req.user, [VIEW_ALL_ADMIN])) {
    return next();
  }

  try {
    const hasAccess = await RosterMember.query()
      .joinRelated("[rank.[permissions], permissions]")
      .where("roster_members.member_id", req.user.id)
      .andWhere((qb) => {
        qb.where("permissions.can_edit_roster_details", true).orWhere(
          "rank:permissions.can_edit_roster_details",
          true
        );
      })
      .first();

    if (!hasAccess) {
      const err = new Error();
      err.message = "Insufficient Permissions";
      err.statusCode = "403";
      return next(err);
    }
  } catch (err) {
    console.log(err);
    next(err);
  }

  next();
};

const getRoster = async function (req, res, next) {
  const roster = await Roster.query()
    .withGraphFetched("[roster_form, roles]")
    .select(select)
    .where("id", req.params.id)
    .first();

  console.log("roster", roster);

  res.status(200).send(roster);
};

module.exports = {
  path: "/:id/settings",
  method: "GET",
  middleware: [
    // (req, res, next) => {
    //   console.log(req.query);
    //   next();
    // },
    checkPermissions,
    validators,
  ],
  handler: getRoster,
};
