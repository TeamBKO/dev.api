"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");

const pick = require("lodash.pick");
const { body, param } = require("express-validator");
const { validate, isUndefined } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");
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
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (body.roles && body.roles.length) {
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
      "use_fields_as_columns",
      "assign_discord_roles_on_approval",
      "applicant_form_channel_id",
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
    deleteCacheByPattern(`?(rosters:*|roster:${req.params.id}:*)`);

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
    // (req, res, next) => {
    //   console.log(req.body);
    //   next();
    // },
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: updateRoster,
};
