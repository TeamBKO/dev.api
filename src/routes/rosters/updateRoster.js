"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const hasScope = require("$util/hasScope");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");
const pick = require("lodash.pick");

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
  body("apply_roles_on_approval").optional().isBoolean(),
  body("private").optional().isBoolean(),
  body("selectedForm").optional().isNumeric().toInt(10),
  body("roles.*").optional().isNumeric().toInt(10),
]);

const generateGraph = (rosterId, body) => {
  const results = { id: rosterId };

  if (!isUndefined(body.enable_recruitment)) {
    Object.assign(results, { enable_recruitment: body.enable_recruitment });
  }

  if (!isUndefined(body.auto_approve)) {
    Object.assign(results, { auto_approve: body.auto_approve });
  }

  if (!isUndefined(body.apply_roles_on_approval)) {
    Object.assign(results, {
      apply_roles_on_approval: body.apply_roles_on_approval,
    });
  }

  if (!isUndefined(body.private)) {
    Object.assign(results, { private: body.private });
  }

  if (!isUndefined(body.is_disabled)) {
    Object.assign(results, { is_disabled: body.is_disabled });
  }

  if (!isUndefined(body.selectedForm)) {
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (body.roles && body.roles.length) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;
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
      "private",
      "apply_roles_on_approval",
      "is_disabled",
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
      .select(["id", "name", "updated_at", ...columns])
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
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    checkPermissions,
    validators,
  ],
  handler: addRoster,
};
