"use strict";
const Roster = require("$models/Roster");
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const RosterForm = require("$models/RosterForm");
const User = require("$models/User");
const DiscordMessage = require("$services/discord/classes/DiscordMessage");
const Settings = require("$models/Settings");
const emitter = require("$services/redis/emitter");

const sanitize = require("sanitize-html");
const pick = require("lodash.pick");

const { body, param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("form_id").optional().isNumeric().toInt(10),
  body("fields.*.id").optional().isUUID(),
]);

const memberSelect = [
  "roster_members.id",
  "roster_members.status",
  "roster_members.approved_on",
  "roster_members.is_deletable",
  "member.username as username",
  "member.avatar as avatar",
  "member.id as userID",
];

const insertFn = (member_id, form_id, roster_id, rank_id, fields) => {
  const result = {
    roster_id,
    member_id,
    roster_rank_id: rank_id,

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

  let form = null;

  if (form_id) {
    form = { form_id, roster_id };
    Object.assign(result, { forms: [form] });
  }

  if (fields && fields.length) {
    if (form) {
      Object.assign(form, {
        form_fields: fields.map((field) => {
          return {
            field_id: field.id,
            answer: field.value ? JSON.stringify({ value: field.value }) : null,
          };
        }),
      });
    }
  }

  return result;
};

const addRosterApplicant = async function (req, res, next) {
  const { form_id, fields } = req.body;

  const options = {
    relate: ["rank", "forms", "forms.form_fields", "permissions"],
  };

  const { enable_bot } = await Settings.query().select("enable_bot").first();

  const settings = await Roster.query()
    .withGraphFetched("roles")
    .select([
      "auto_approve",
      "apply_roles_on_approval",
      "url",
      "link_to_discord",
      "applicant_form_channel_id",
    ])
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
      ["id", "roster_id", "status"]
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

    /** FLUSH THE CACHE FOR THE ROSTER(s) AND ASSOCIATED MEMBERS */
    deleteCacheByPattern(`(?admin:rosters|rosters:*|roster:*)`);

    if (enable_bot && settings.link_to_discord) {
      let form = await RosterForm.query()
        .withGraphJoined(
          "[fields(order), applicant(default).member(defaultSelects)]"
        )
        .select([
          "roster_member_forms.roster_id",
          "roster_member_forms.id",
          "roster_member_forms.created_at",
          "roster_member_forms.updated_at",
        ])
        .where("roster_member_id", member.id)
        .andWhere("roster_id", req.params.id)
        .first();

      const message = new DiscordMessage().setForm(form);

      await message.send(settings.applicant_form_channel_id);
    }

    const socketRosterMember = await RosterMember.query()
      .withGraphFetched(
        settings.auto_approve
          ? "[rank(default), forms(default).fields(useAsColumn)]"
          : "forms(default)"
      )
      .joinRelated("[member(defaultSelects)]")
      .select(memberSelect)
      .where("roster_members.roster_id", req.params.id)
      .andWhere("roster_members.id", member.id)
      .first();

    const roster = await Roster.query()
      .select(
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
      )
      .where("id", member.roster_id)
      .first();

    emitter
      .of("/rosters")
      .to(`roster:${roster.id}`)
      .emit(
        settings.auto_approve ? "update:members:status" : "add:applicant",
        socketRosterMember,
        null
      );

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
  ],
  handler: addRosterApplicant,
};
