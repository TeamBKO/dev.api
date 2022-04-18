"use strict";
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");

const { param, query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("ids.*")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const removeRosterMember = async function (req, res, next) {
  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_remove_members", true)
        .orWhere("rank:permissions.can_remove_members", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  const trx = await RosterMember.startTransaction();
  let query = RosterMember.query(trx)
    .del()
    .first()
    .returning(["id"])
    .where("is_deletable", true);
  query = req.params.id
    ? query.where("roster_members.id", req.params.id)
    : query.whereIn("roster_members.id", req.query.ids);

  try {
    const items = await query;
    await trx.commit();
    res.status(200).send(items);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/members/:id?",
  method: "DELETE",
  middleware: [validators],
  handler: removeRosterMember,
};
