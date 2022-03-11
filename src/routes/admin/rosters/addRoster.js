"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { body } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const validators = validate([
  body("name")
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
  body("is_disabled").optional().isBoolean(),
  body("selectedForm").optional().isNumeric().toInt(10),
  body("selectedRoles.*").notEmpty().optional().isNumeric().toInt(10),
]);

const generateGraph = (userId, body) => {
  const results = {
    "#id": "roster",
    name: body.name,
    creator_id: userId,
    members: [
      {
        member_id: userId,
        status: "approved",
        approved_on: new Date().toISOString(),
        permissions: {
          can_add_members: false,
          can_edit_members: false,
          can_remove_members: false,
          can_edit_roster_details: false,
          can_delete_roster: false,
        },
        rank: {
          name: "Owner",
          roster_id: "#ref{roster.id}",
          is_deletable: false,
          permissions: [
            {
              can_add_members: true,
              can_edit_members: true,
              can_remove_members: true,
              can_edit_roster_details: true,
              can_delete_roster: true,
            },
          ],
        },
      },
    ],
    ranks: [
      {
        name: "Leader",
        permissions: [
          {
            can_add_members: true,
            can_edit_members: true,
            can_remove_members: true,
            can_edit_roster_details: true,
            can_delete_roster: false,
          },
        ],
      },
      {
        name: "Officer",
        permissions: [
          {
            can_add_members: true,
            can_edit_members: true,
            can_remove_members: true,
          },
        ],
      },
      {
        name: "Recruit",
        is_deletable: false,
        permissions: [
          {
            can_add_members: false,
            can_edit_members: false,
            can_remove_members: false,
            can_edit_roster_details: false,
            can_delete_roster: false,
          },
        ],
      },
      {
        name: "Member",
        permissions: [
          {
            can_add_members: false,
            can_edit_members: false,
            can_remove_members: false,
            can_edit_roster_details: false,
            can_delete_roster: false,
          },
        ],
      },
    ],
  };

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

  if (body.selectedRoles && body.selectedRoles.length) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;
};

const select = [];

const addRoster = async function (req, res, next) {
  const data = generateGraph(req.user.id, req.body);

  const trx = await Roster.startTransaction();

  try {
    const { id } = await Roster.query(trx).insertGraph(data, {
      relate: [
        "roster_form",
        "member.permissions",
        "roles",
        "rank",
        "rank.permissions",
      ],
      allowRefs: true,
    });
    await trx.commit();

    const roster = await Roster.query()
      .withGraphFetched("[roster_form, creator(defaultSelects)]")
      .where("id", id)
      .first();

    res.status(200).send(roster);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "POST",
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
