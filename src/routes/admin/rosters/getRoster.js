"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { param } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
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
  "assign_discord_roles_on_approval",
  "approved_applicant_channel_id",
  "pending_applicant_channel_id",
  "rejected_applicant_channel_id",
  "display_applicant_forms_on_discord",
  "created_at",
  "updated_at",
];

const getRoster = async function (req, res, next) {
  const roster = await Roster.query()
    .withGraphFetched("[roster_form, roles]")
    .select(select)
    .where("id", req.params.id)
    .first();
  res.status(200).send(roster);
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log(req.query);
      next();
    },
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: getRoster,
};
