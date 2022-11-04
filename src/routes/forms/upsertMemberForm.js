"use strict";
const RosterForm = require("$models/RosterForm");
const RosterMember = require("$models/RosterMember");
const massageMemberData = require("$util/massageMemberData");
const emitter = require("$services/redis/emitter");
const sanitize = require("sanitize-html");
const { param, body } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

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

const upsert = (id, member_id, form_id, roster_id, fields) => {
  const result = {};

  if (id) {
    Object.assign(result, { id });
  }

  if (roster_id) {
    Object.assign(result, { roster_id });
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

    const data = upsert(req.params.id, member_id, form_id, roster_id, fields);

    const trx = await RosterForm.startTransaction();

    try {
      const result = await RosterForm.query(trx).upsertGraph(data, {
        relate: ["form", "form_fields"],
        unrelate: ["form", "form_fields"],
      });

      await trx.commit();

      const { roster_member_id } = await RosterForm.query()
        .select("roster_member_id")
        .where("id", result.id)
        .first();

      const member = massageMemberData(
        await RosterMember.query()
          .joinRelated("member(defaultSelects)")
          .withGraphFetched("forms(default).[fields(useAsColumn)]")
          .select([
            "roster_members.id",
            "member.username",
            "roster_members.status",
          ])
          .where("roster_members.id", roster_member_id)
          .first()
      );

      deleteCacheByPattern(`roster:${roster_id}*`);

      emitter
        .of("/rosters")
        .to(`roster:${roster_id}`)
        .emit("update:member", member);

      res.status(200).send({ formID: result.id, member });
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
