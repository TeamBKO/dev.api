"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN } = require("$util/policies");
const pick = require("lodash.pick");

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

  if (typeof body.enable_recruitment !== undefined) {
    Object.assign(results, { enable_recruitment: body.enable_recruitment });
  }

  if (typeof body.apply_roles_on_approval !== undefined) {
    Object.assign(results, {
      apply_roles_on_approval: body.apply_roles_on_approval,
    });
  }

  if (typeof body.private !== undefined) {
    Object.assign(results, { private: body.private });
  }

  if (typeof body.is_disabled !== undefined) {
    Object.assign(results, { is_disabled: body.is_disabled });
  }

  if (body.selectedForm) {
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (body.roles) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;
};

const addRoster = async function (req, res, next) {
  const data = generateGraph(req.params.id, req.body);

  const columns = Object.keys(
    pick(req.body, [
      "icon",
      "enable_recruitment",
      "private",
      "apply_roles_on_approval",
      "is_disabled",
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
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: addRoster,
};
