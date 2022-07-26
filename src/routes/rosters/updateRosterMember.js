"use strict";
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const redis = require("$services/redis");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("permissions.*.id").optional().isUUID(),
  body("permissions.*.can_add_members").optional().isBoolean(),
  body("permissions.*.can_edit_members").optional().isBoolean(),
  body("permissions.*.can_edit_member_ranks").optional().isBoolean(),
  body("permissions.*.can_remove_members").optional().isBoolean(),
  body("permissions.*.can_add_rank").optional().isBoolean(),
  body("permissions.*.can_edit_ranks").optional().isBoolean(),
  body("permissions.*.can_remove_ranks").optional().isBoolean(),
  body("permissions.*.can_edit_roster_details").optional().isBoolean(),
  body("permissions.*.can_delete_roster").optional().isBoolean(),
  body("roster_rank_id").optional().isUUID(),
]);

const graphFn = (id, permissions, roster_rank_id) => {
  const result = {
    id: id,
  };

  if (permissions) {
    Object.assign(result, { permissions });
  }

  if (roster_rank_id) {
    Object.assign(result, { roster_rank_id });
  }

  return result;
};

const select = [
  "roster_members.id as id",
  "member.username as username",
  "member.avatar as avatar",
  "roster_members.status",
  "roster_members.approved_on",
];

const updateRosterMember = async function (req, res, next) {
  const { permissions, roster_rank_id } = req.body;

  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select(["roster_members.roster_id", "roster_members.roster_id"])
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send({ message: "Insufficient permissions" });
  }

  const upsert = graphFn(req.params.id, permissions, roster_rank_id);

  const trx = await RosterMember.startTransaction();

  try {
    const { id } = await RosterMember.query(trx).upsertGraph(upsert);
    await trx.commit();
    const results = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched("[rank(default), form(default)]")
      .select(select)
      .where("roster_members.id", id)
      .first();

    await redis.del(`roster:${hasAccess.roster_id}`);
    deleteCacheByPattern(`members:${hasAccess.roster_id.split("-")[4]}:`);

    res.status(200).send(results);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/members/:id",
  method: "PATCH",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    // validators,
  ],
  handler: updateRosterMember,
};
