"use strict";
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const User = require("$models/User");
const Roster = require("$models/Roster");
const sanitize = require("sanitize-html");
const pick = require("lodash.pick");
const { body, param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("form_id").isNumeric().toInt(10),
  // body("roster_id")
  //   .isUUID()
  //   .trim()
  //   .escape()
  //   .customSanitizer((v) => sanitize(v)),
  body("fields.*.id").isNumeric().toInt(10),
]);

const insertFn = (member_id, form_id, roster_id, rank_id, fields) => {
  const result = {
    roster_id,
    member_id,
    roster_rank_id: rank_id,
    // form: {
    //   form_id: form_id,
    // },
    permissions: {
      can_add_members: false,
      can_edit_members: false,
      can_remove_members: false,
      can_add_ranks: false,
      can_edit_ranks: false,
      can_remove_ranks: false,
      can_edit_roster_details: false,
      can_delete_roster: false,
    },
  };

  if (form_id) {
    Object.assign(result, { form: { form_id } });
  }

  if (fields && fields.length) {
    if (!result.form) result.form = {};
    Object.assign(result.form, {
      form_fields: fields.map((field) => {
        return {
          field_id: field.id,
          answer: field.value ? JSON.stringify({ value: field.value }) : null,
        };
      }),
    });
  }

  return result;
};

const addRosterApplicant = async function (req, res, next) {
  const { form_id, fields } = req.body;

  const options = {
    relate: ["rank", "form", "form.form_fields", "permissions"],
  };

  const settings = await Roster.query()
    .withGraphFetched("roles")
    .select(["auto_approve", "apply_roles_on_approval"])
    .first();

  if (!req.query.edit) {
    const userAlreadySubmitted = await RosterMember.query()
      .where("roster_id", req.params.id)
      .andWhere("member_id", req.user.id)
      // .andWhere((qb) => {
      //   qb.where("status", "pending").orWhere("status", "approved");
      // })
      .first();

    if (userAlreadySubmitted) {
      const message =
        "You've already applied to this roster. Please wait for review and a response";
      return res.status(203).send({
        message,
      });
    }
  }

  const rank = await RosterRank.query()
    .select("id")
    .where("is_recruit", true)
    .andWhere("roster_id", req.params.id)
    .first();

  let insert = insertFn(req.user.id, form_id, req.params.id, rank.id, fields);

  if (settings.auto_approve) {
    Object.assign(insert, {
      status: "approved",
      approved_on: new Date().toISOString(),
    });
  }

  const trx = await RosterMember.startTransaction();

  try {
    const member = pick(
      await RosterMember.query(trx)
        .upsertGraph(insert, options)
        .returning("id", "status"),
      ["id", "status"]
    );

    if (
      settings.auto_approve &&
      settings.apply_roles_on_approval &&
      settings.roles &&
      settings.roles.length
    ) {
      const rolesToRelate = settings.roles.map((role) => role.id);

      await User.relatedQuery("roles", trx)
        .for(req.user.id)
        .relate(rolesToRelate);
    }
    await trx.commit();

    const roster = await Roster.query().select(
      "id",
      "name",
      RosterMember.query()
        .whereColumn("roster_members.roster_id", "rosters.id")
        .count()
        .as("members"),
      RosterMember.query()
        .whereColumn("roster_members.roster_id", "rosters.id")
        .andWhere("member_id", req.user.id)
        .count()
        .as("joined")
    );

    console.log("roster", roster);
    console.log("member", member);

    res.status(200).send({ roster, member });
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "POST",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validators,
    // verifyRecaptcha,
  ],
  handler: addRosterApplicant,
};
