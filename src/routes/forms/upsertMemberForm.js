"use strict";
const UserForm = require("$models/UserForm");
const RosterMember = require("$models/RosterMember");
const getCache = require("$util/getCache");
const sanitize = require("sanitize-html");
const { param, body } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("member_id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("roster_id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const upsert = (id, member_id, form_id, fields) => {
  const result = {};

  if (id) {
    Object.assign(result, { id });
  }

  if (form_id) {
    Object.assign(result, { form_id });
  }

  if (member_id) {
    Object.assign(result, { roster_member_id: member_id });
  }

  if (fields && fields.length) {
    Object.assign(result, {
      form_fields: fields.map((f) => {
        const field = {
          answer: f.value ? JSON.stringify({ value: f.value }) : null,
        };
        if (f.id) {
          Object.assign(field, { id: f.id });
        } else {
          Object.assign(field, { field_id: f.field_id });
        }

        return field;
      }),
    });
  }

  return result;
};
const upsertMemberForm = async function (req, res, next) {
  const { form_id, member_id, roster_id, fields } = req.body;
  try {
    const member = await RosterMember.query()
      .where("roster_id", roster_id)
      .andWhere("member_id", req.user.id)
      .first();

    if (!member) {
      return res.status(404).send({ message: "That member doesn't exist." });
    }

    const data = upsert(req.params.id, member_id, form_id, fields);

    const trx = await UserForm.startTransaction();

    try {
      const result = await UserForm.query(trx)
        .upsertGraph(data, {
          relate: ["form", "form_fields"],
        })
        .returning(["id", "roster_member_id"]);

      await trx.commit();

      console.log(result);

      const member = await RosterMember.query()
        .joinRelated("member(defaultSelects)")
        .select(["member.id", "member.username"])
        .where("roster_members.member_id", result.roster_member_id)
        .first();
      res.status(200).send({ form: result.id, member });
    } catch (err) {
      console.log(err);
      await trx.rollback();
      next(err);
    }
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/:id?",
  method: "PUT",
  middleware: [
    validators,
    (req, res, next) => {
      console.log(req.body);
      next();
    },
  ],
  handler: upsertMemberForm,
};
