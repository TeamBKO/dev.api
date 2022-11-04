"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const emitter = require("$services/redis/emitter");
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
  body("link_to_discord").optional().isBoolean(),
  body("assign_discord_roles_on_approval").optional().isBoolean(),
  body("applicant_form_channel_id")
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
    "link_to_discord",
    "applicant_form_channel_id",
  ];

  keys.forEach((key) => {
    if (!isUndefined(body[key])) {
      Object.assign(results, { [key]: body[key] });
    }
  });

  if (!isUndefined(body.selectedForm)) {
    if (body.selectedForm) {
      Object.assign(results, { roster_form: { id: body.selectedForm } });
    } else {
      Object.assign(results, { roster_form: null });
    }
  }

  if (!isUndefined(body.roles)) {
    const roles = body.roles.length ? body.roles.map((id) => ({ id })) : [];
    Object.assign(results, { roles });
  }

  // if (body.roles) {
  //   Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  // }

  return results;
};

const checkPermissions = async function (req, res, next) {
  if (hasScope(req.user, [VIEW_ALL_ADMIN])) {
    return next();
  }
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

  next();
};

const updateRoster = async function (req, res, next) {
  const data = generateGraph(req.params.id, req.body);

  const columns = Object.keys(
    pick(req.body, [
      "icon",
      "banner",
      "auto_approve",
      "enable_recruitment",
      "auto_approve",
      "apply_roles_on_approval",
      "show_fields_as_columns",
      "private",
      "is_disabled",
      "assign_discord_roles_on_approval",
      "link_to_discord",
      "applicant_form_channel_id",
    ])
  );

  const trx = await Roster.startTransaction();

  try {
    const { id } = await Roster.query(trx).upsertGraph(data, {
      noDelete: true,
      unrelate: ["roles", "roster_form"],
      relate: ["roles", "roster_form"],
    });

    // if (req.body.removeSelectedForm) {
    //   await Roster.relatedQuery("roster_form", trx)
    //     .for(req.params.id)
    //     .unrelate();
    // }

    await trx.commit();

    let query = Roster.query()
      .select(["id", "name", "url", "updated_at", ...columns])
      .withGraphFetched("[roles, roster_form(default).[fields(useAsColumn)]]")
      .where("id", id)
      .first();

    const roster = await query;

    deleteCacheByPattern(`?(rosters:*|roster:${query.id}*)`);

    emitter
      .of("/rosters")
      .to(`roster:${req.params.id}`)
      .emit("update:settings", roster);

    emitter.of("/rosters-index").emit("update:roster", roster);

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
      console.log("settings", req.body);
      next();
    },
    checkPermissions,
    validators,
  ],
  handler: updateRoster,
};
