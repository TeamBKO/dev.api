"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const redis = require("$services/redis");
const pick = require("lodash.pick");
const sanitize = require("sanitize-html");
const hasScope = require("$util/hasScope");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const isUndefined = (v) => v === undefined;

const validators = validate([
  param("id")
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("name")
    .optional()
    .isAlphanumeric()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("icon")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("enable_recruitment").optional().isBoolean(),
  body("show_fields_as_columns").optional().isBoolean(),
  body("apply_roles_on_approval").optional().isBoolean(),
  body("is_disabled").optional().isBoolean(),
  body("private").optional().isBoolean(),
  body("selectedForm").optional().isNumeric().toInt(10),
  body("roles.*").optional().isNumeric().toInt(10),
  body("display_applicant_forms_on_discord").optional().isBoolean(),
  body("assign_discord_roles_on_approval").optional().isBoolean(),
  body("approved_applicant_channel_id")
    .optional()
    .isString()
    .customSanitizer((v) => sanitize(v)),
  body("pending_applicant_channel_id")
    .optional()
    .isString()
    .customSanitizer((v) => sanitize(v)),
  body("rejected_applicant_channel_id")
    .optional()
    .isString()
    .customSanitizer((v) => sanitize(v)),
]);

const generateGraph = (rosterId, body) => {
  const results = { id: rosterId };
  const keys = [
    "enable_recruitment",
    "auto_approve",
    "apply_roles_on_approval",
    "show_fields_as_columns",
    "private",
    "is_disabled",
    "assign_discord_roles_on_approval",
    "display_applicant_forms_on_discord",
    "display_applicant_forms_on_discord",
    "approved_applicant_channel_id",
    "pending_applicant_channel_id",
    "rejected_applicant_channel_id",
  ];

  keys.forEach((key) => {
    if (!isUndefined(body[key])) {
      Object.assign(results, { [key]: body[key] });
    }
  });

  if (!isUndefined(body.selectedForm)) {
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (body.roles && body.roles.length) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;

  // if (!isUndefined(body.enable_recruitment)) {
  //   Object.assign(results, { enable_recruitment: body.enable_recruitment });
  // }

  // if (!isUndefined(body.auto_approve)) {
  //   Object.assign(results, { auto_approve: body.auto_approve });
  // }

  // if (!isUndefined(body.apply_roles_on_approval)) {
  //   Object.assign(results, {
  //     apply_roles_on_approval: body.apply_roles_on_approval,
  //   });
  // }

  // if (!isUndefined(body.show_fields_as_columns)) {
  //   Object.assign(results, {
  //     show_fields_as_columns: body.show_fields_as_columns,
  //   });
  // }

  // if (!isUndefined(body.private)) {
  //   Object.assign(results, { private: body.private });
  // }

  // if (!isUndefined(body.is_disabled)) {
  //   Object.assign(results, { is_disabled: body.is_disabled });
  // }

  // if (!isUndefined(body.selectedForm)) {
  //   Object.assign(results, { roster_form: { id: body.selectedForm } });
  // }

  // if (body.roles && body.roles.length) {
  //   Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  // }

  // if (!isUndefined(body.assign_discord_roles_on_approval)) {
  //   Object.assign(results, {
  //     assign_discord_roles_on_approval: body.assign_discord_roles_on_approval,
  //   });
  // }

  // if (!isUndefined(body.display_applicant_forms_on_discord)) {
  //   Object.assign(results, {
  //     display_applicant_forms_on_discord:
  //       body.display_applicant_forms_on_discord,
  //   });
  // }

  // if (!isUndefined(body.approved_applicant_channel_id)) {
  //   Object.assign(results, {
  //     approved_applicant_channel_id: body.approved_applicant_channel_id,
  //   });
  // }

  // if (!isUndefined(body.pending_applicant_channel_id)) {
  //   Object.assign(results, {
  //     pending_applicant_channel_id: body.pending_applicant_channel_id,
  //   });
  // }

  // if (!isUndefined(body.rejected_applicant_channel_id)) {
  //   Object.assign(results, {
  //     rejected_applicant_channel_id: body.rejected_applicant_channel_id,
  //   });
  // }
};

const checkPermissions = async function (req, res, next) {
  if (hasScope(req.user, [VIEW_ALL_ADMIN])) {
    return next();
  }
  const hasAccess = await RosterMember.query()
    .joinRelated("rank.[permissions], permissions")
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
    err.stautsCode = "403";
    return next(err);
  }

  next();
};

const addRoster = async function (req, res, next) {
  const data = generateGraph(req.params.id, req.body);

  const columns = Object.keys(
    pick(req.body, [
      "icon",
      "banner",
      "auto_approve",
      "enable_recruitment",
      "show_fields_as_columns",
      "private",
      "apply_roles_on_approval",
      "is_disabled",
      "assign_discord_roles_on_approval",
      "approved_applicant_channel_id",
      "pending_applicant_channel_id",
      "rejected_applicant_channel_id",
    ])
  );

  const trx = await Roster.startTransaction();

  try {
    const { id } = await Roster.query(trx).upsertGraph(data, {
      noDelete: true,
      unrelate: ["roles", "roster_form"],
      relate: ["roles", "roster_form"],
    });

    await trx.commit();

    let query = Roster.query()
      .select(["id", "name", "url", "updated_at", ...columns])
      .where("id", id)
      .first();

    if (req.body.roles) {
      query = query.withGraphFetched("[roles]");
    }

    if (req.body.selectedForm) {
      query = query.withGraphFetched("[roster_form(default)]");
    }

    const roster = await query;
    await redis.del(`roster:${query.id}`);
    deleteCacheByPattern("rosters:");

    res.status(200).send(roster);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "PATCH",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    checkPermissions,
    validators,
  ],
  handler: addRoster,
};
