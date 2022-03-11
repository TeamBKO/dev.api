"use strict";
const UserForm = require("$models/UserForm");
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const { param } = require("express-validator");
const { validate } = require("$util");

const select = [
  "user_forms.id",
  "form_fields.field_id as id",
  "form_fields.answer",
  "form_fields.options",
  "form_fields.value",
  "form_fields.optional",
  "form_fields.type",
  "applicant:member.id",
  "applicant:member.username",
  "applicant:member.avatar",
];

const getRosterMemberForm = async (req, res, next) => {
  const rosterId = req.query.roster_id;

  console.log(req.query);

  const hasAccess = await RosterMember.query()
    .joinRelated("rank.[permissions]")
    .where("rank:permissions.can_edit_members", true)
    .orWhere("member_id", req.user.id)
    .first();

  if (!hasAccess) {
    return res.status(403).send("No access.");
  }

  const roster = await Roster.query()
    .select("name")
    .where("id", rosterId)
    .first();

  // const form = await UserForm.query()
  //   .withGraphFetched(
  //     "[fields(order), applicant(default).member(defaultSelects)]"
  //   )
  //   .select(["user_forms.id", "user_forms.created_at", "user_forms.updated_at"])
  //   .where("user_forms.id", req.params.id)
  //   .first();

  const form = await UserForm.query()
    .withGraphJoined(
      "[fields(order), applicant(default).member(defaultSelects)]"
    )
    .select(["user_forms.id", "user_forms.created_at", "user_forms.updated_at"])
    .where("user_forms.id", req.params.id)
    .first();

  console.log(form);

  res.status(200).send({ ...form, roster });
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [validate([param("id").isUUID()])],
  handler: getRosterMemberForm,
};
