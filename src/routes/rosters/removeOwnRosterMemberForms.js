"use strict";
const RosterForm = require("$models/RosterForm");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const emitter = require("$services/redis/emitter");
const massageMemberData = require("$util/massageMemberData");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { param, query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("ids.*")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const getOwnRosterMemberForms = async function (req, res, next) {
  const toBeDeleted = req.params.id ? [req.params.id] : req.query.ids;

  const trx = await RosterForm.startTransaction();

  try {
    const deleted = await RosterForm.query(trx)
      .joinRelated("applicant.[member(defaultSelects)]")
      .whereIn("roster_member_forms.id", toBeDeleted)
      .andWhere("applicant:member.id", req.user.id)
      .returning([
        "roster_member_forms.id",
        "roster_member_forms.roster_id as rid",
      ])
      .del();

    await trx.commit();

    const member = massageMemberData(
      await RosterMember.query()
        .joinRelated("member(defaultSelects)")
        .withGraphFetched("forms(default).[fields(useAsColumn)]")
        .select(["roster_members.id", "member.username"])
        .where("roster_members.member_id", req.user.id)
        .first()
    );

    emitter
      .of("/rosters")
      .to(deleted.map(({ rid }) => `roster:${rid}`))
      .emit("update:member", member);

    deleteCacheByPattern(`?(roster:*)`);
    res.status(200).send(deleted.map(({ id }) => id));
  } catch (err) {
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/member/forms/:id?",
  method: "DELETE",
  middleware: [validators],
  handler: getOwnRosterMemberForms,
};
