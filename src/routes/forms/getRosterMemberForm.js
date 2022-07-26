"use strict";
const RosterForm = require("$models/RosterForm");
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const sanitize = require("sanitize-html");
const { param } = require("express-validator");
const { validate } = require("$util");

const getRosterMemberForm = async (req, res, next) => {
  const rosterId = req.query.roster_id;

  const hasAccess = await RosterMember.query()
    .joinRelated("rank.[permissions]")
    .where("rank:permissions.can_edit_members", true)
    .orWhere("member_id", req.user.id)
    .first();

  if (!hasAccess) {
    return res.status(403).send("No access.");
  }

  const roster = await Roster.query()
    .select(["name", "banner"])
    .where("id", rosterId)
    .first();

  let form = await RosterForm.query()
    .withGraphJoined(
      "[fields(order), applicant(default).member(defaultSelects)]"
    )
    .select([
      "roster_member_forms.id",
      "roster_member_forms.created_at",
      "roster_member_forms.updated_at",
    ])
    .where("roster_member_forms.id", req.params.id)
    .first();

  console.log("roster_member", form);

  res.status(200).send({ form, roster });
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [
    validate([
      param("id")
        .isUUID()
        .trim()
        .escape()
        .customSanitizer((v) => sanitize(v)),
    ]),
  ],
  handler: getRosterMemberForm,
};
