"use strict";
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const emitter = require("$services/redis/emitter");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  param("rosterId")
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
  "member.id as userId",
  "roster_members.status",
  "roster_members.approved_on",
];

const updateRosterMember = async function (req, res, next) {
  let { permissions, roster_rank_id, previous_rank } = req.body;

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

  const rosterId = hasAccess.roster_id;

  const upsert = graphFn(req.params.id, permissions, roster_rank_id);

  //do a check and make sure there will still be an owner attached to the roster.
  if (roster_rank_id) {
    const previousRank = await RosterMember.query()
      .joinRelated("rank")
      .select(["rank.id", "rank.name", "rank.priority"])
      .where("roster_members.roster_id", rosterId)
      .andWhere("roster_members.id", req.params.id)
      .first();

    console.log("previousRank", previousRank);

    if (previousRank.priority === 1) {
      const owners = await RosterMember.query()
        .joinRelated("rank")
        .where("rank.id", previousRank.id)
        .groupBy("rank.id")
        .first()
        .count();

      if (parseInt(owners.count, 10) === 1) {
        return res
          .status(422)
          .send({ message: "Rosters must have at least one owner." });
      }
    }

    previous_rank = previousRank;
  }

  const trx = await RosterMember.startTransaction();

  try {
    const { id } = await RosterMember.query(trx).upsertGraph(upsert);
    await trx.commit();
    const results = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched(
        "[rank(default).[permissions], forms(default), permissions]"
      )
      .select(select)
      .where("roster_members.id", id)
      .first();

    deleteCacheByPattern(`roster:${rosterId}*`);

    if (roster_rank_id && !permissions) {
      const { rank, id } = results;
      const { permissions, ...r } = rank;
      emitter
        .of("/rosters")
        .to(`roster:${rosterId}`)
        .volatile.emit(
          "update:member:rank",
          { id, username: results.username, rank: r },
          previous_rank
        );

      emitter
        .of("/rosters")
        .to(`roster:${rosterId}:user:${results.userId}`)
        .emit("update:member:permissions", id, { permissions: permissions });

      return res.sendStatus(200);
    }

    if (permissions && !roster_rank_id) {
      const { permissions, id } = results;

      emitter
        .of("/rosters")
        .to(`roster:${rosterId}:user:${results.userId}`)
        .volatile.emit("update:member:permissions", id, { permissions });

      return res.status(200).send({ permissions });
    }

    if (roster_rank_id && permissions) {
      const { rank, permissions, id } = results;

      const _rank = {
        id: rank.id,
        name: rank.name,
        priority: rank.priority,
        icon: rank.icon,
      };

      const p = Object.assign({}, rank.permissions, permissions);

      const payload = {
        rank: _rank,
        permissions: p,
      };

      emitter
        .of("/rosters")
        .to(`roster:${rosterId}:user:${results.userId}`)
        .volatile.emit("update:member:permissions", id, payload);

      emitter
        .of("/rosters")
        .to(`roster:${rosterId}`)
        .volatile.emit(
          "update:member:rank",
          { id, username: results.username, rank: _rank },
          previous_rank
        );

      return res.status(200).send(payload);
    }

    res.status(200).send(results);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:rosterId/members/:id",
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
