"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const pick = require("lodash.pick");

const { deleteCacheByPattern } = require("$services/redis/helpers");
const { body, param } = require("express-validator");
const { validate, isUndefined } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN } = require("$util/policies");

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
  body("apply_roles_on_approval").optional().isBoolean(),
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

  if (!isUndefined(body.enable_recruitment)) {
    Object.assign(results, { enable_recruitment: body.enable_recruitment });
  }

  if (!isUndefined(body.apply_roles_on_approval)) {
    Object.assign(results, {
      apply_roles_on_approval: body.apply_roles_on_approval,
    });
  }

  if (!isUndefined(body.private)) {
    Object.assign(results, { private: body.private });
  }

  if (!isUndefined(is_disabled)) {
    Object.assign(results, { is_disabled: body.is_disabled });
  }

  if (!isUndefined(body.selectedForm)) {
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (!isUndefined(body.auto_approve)) {
    Object.assign(results, { auto_approve: body.auto_approve });
  }

  if (!isUndefined(body.use_fields_as_columns)) {
    Object.assign(results, {
      use_fields_as_columns: body.use_fields_as_columns,
    });
  }

  if (body.roles) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;
};

const updateRoster = async function (req, res, next) {
  const data = generateGraph(req.params.id, req.body);

  const columns = Object.keys(
    pick(req.body, [
      "icon",
      "banner",
      "enable_recruitment",
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
    // const roster = pick(
    //   await Roster.query(trx).upsertGraph(data, {
    //     noDelete: true,
    //     unrelate: ["roles", "form"],
    //     relate: ["roles", "form"],
    //   }),
    //   [
    //     "id",
    //     "name",
    //     "icon",
    //     "private",
    //     "enable_recruitment",
    //     "is_disabled",
    //     "roles",
    //     "form",
    //   ]
    // );

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

    await redis.del(`roster:${req.params.id}`);
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
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: updateRoster,
};
