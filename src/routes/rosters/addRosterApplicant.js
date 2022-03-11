"use strict";
const UserForm = require("$models/UserForm");
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { body } = require("express-validator");
const { validate } = require("$util");
const verifyRecaptcha = require("$services/recaptcha")(
  process.env.RECAPTCHA_SECRET
);
const { ADD_OWN_FORMS, ADD_ALL_FORMS } = require("$util/policies");

const validators = validate([
  body("form_id").isNumeric().toInt(10),
  body("roster_id").isUUID(),
  body("fields.*.id").isNumeric().toInt(10),
  // body("fields.*.value")
  //   .isString()
  //   .trim()
  //   .escape()
  //   .customSanitizer((v) => sanitize(v)),
  // body("gresponse").isString().escape().trim(),
]);

const insertFn = (form_id, roster_id, member_id, rank_id, fields) => {
  const result = {
    roster_id,
    member_id,
    roster_rank_id: rank_id,
    form: {
      form_id: form_id,
    },
    permissions: {
      can_add_members: false,
      can_edit_members: false,
      can_remove_members: false,
      can_edit_roster_details: false,
      can_delete_roster: false,
    },
  };

  if (fields && fields.length) {
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
  const { form_id, roster_id, fields } = req.body;

  const options = {
    relate: ["form", "form.form_fields", "permissions"],
  };

  const userAlreadySubmitted = await RosterMember.query()
    .where("roster_id", roster_id)
    .andWhere("member_id", req.user.id)
    .andWhere((qb) => {
      qb.where("status", "pending").orWhere("status", "approved");
    })
    .first();

  if (userAlreadySubmitted) {
    const message =
      "You've already submitted an application for this category. Please wait for review and a response";
    return res.status(422).send({
      message,
    });
  }

  const { id } = await RosterRank.query()
    .where("name", "Recruit")
    .andWhere("roster_id", roster_id)
    .returning("id");

  const insert = insertFn(form_id, roster_id, req.user.id, id, fields);

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(insert, options);
    await trx.commit();
    res.sendStatus(204);
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
    guard.check([[ADD_OWN_FORMS], [ADD_ALL_FORMS]]),
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validators,
    // verifyRecaptcha,
  ],
  handler: addRosterApplicant,
};
