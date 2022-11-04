"use strict";
const RosterMember = require("$models/RosterMember");
const Joi = require("$services/sockets/schemes");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const schema = Joi.object({
  id: Joi.string().sanitize().guid().trim().required(),
  rosterId: Joi.string().sanitize().guid().trim(),
  permissions: Joi.object({
    id: Joi.string().guid().sanitize().trim(),
    can_add_members: Joi.boolean().optional(),
    can_edit_members: Joi.boolean().optional(),
    can_edit_member_ranks: Joi.boolean().optional(),
    can_remove_members: Joi.boolean().optional(),
    can_add_rank: Joi.boolean().optional(),
    can_edit_ranks: Joi.boolean().optional(),
    can_remove_ranks: Joi.boolean().optional(),
    can_edit_roster_details: Joi.boolean().optional(),
    can_delete_roster: Joi.boolean().optional(),
  }).optional(),
  roster_rank_id: Joi.string().sanitize().guid().optional(),
});

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

module.exports = async function (payload, cb) {
  const { error, value } = schema.validate(payload, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return cb({
      errors: Errors.INVALID_PAYLOAD,
      errorDetails: error.details,
    });
  }

  const socket = this;
  const { permissions, roster_rank_id } = value;

  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select(["roster_members.roster_id", "roster_members.roster_id"])
    .where("roster_members.member_id", socket.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  if (!hasAccess) {
    return cb({ statusCode: 403, message: "Insufficient permissions" });
  }

  const data = graphFn(value.id, permissions, roster_rank_id);

  let previous_rank;

  if (roster_rank_id) {
    const previousRank = await RosterMember.query()
      .joinRelated("rank")
      .select(["rank.id", "rank.name", "rank.priority"])
      .where("roster_members.roster_id", value.rosterId)
      .andWhere("roster_members.id", value.id)
      .first();

    if (previousRank.priority === 1) {
      const owners = await RosterMember.query()
        .joinRelated("rank")
        .where("rank.id", previousRank.id)
        .groupBy("rank.id")
        .first()
        .count();

      if (parseInt(owners.count, 10) === 1) {
        return cb({ message: "Rosters must have at least one owner." });
      }
    }

    previous_rank = previousRank;
  }

  try {
    const { id } = await RosterMember.query(trx).upsertGraph(data);
    await trx.commit();
    const results = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched(
        "[rank(default).[permissions], form(default), permissions]"
      )
      .select(select)
      .where("roster_members.id", id)
      .first();

    deleteCacheByPattern(`roster:${rosterId}*`);

    if (roster_rank_id && !permissions) {
      const { rank, id } = results;
      const { permissions, ...r } = rank;

      socket
        .to(`roster:${rosterId}`)
        .volatile.emit(
          "update:member:rank",
          { id, username: results.username, rank: r },
          previous_rank
        );

      //   emitter
      //     .of("/rosters")
      //     .to(`roster:${rosterId}:user:${results.userId}`)
      //     .emit("update:member:permissions", id, { permissions: permissions });

      //   return res.sendStatus(200);

      return cb({ permissions });
    }

    if (permissions && !roster_rank_id) {
      const { permissions, id } = results;

      console.log("permissions", permissions);

      return cb({ permissions });

      //   socket
      //     .of("/rosters")
      //     .to(`roster:${rosterId}:user:${results.userId}`)
      //     .volatile.emit("update:member:permissions", id, { permissions });

      //   return res.status(200).send({ permissions });
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

      //   emitter
      //     .of("/rosters")
      //     .to(`roster:${rosterId}:user:${results.userId}`)
      //     .volatile.emit("update:member:permissions", id, payload);

      socket
        .to(`roster:${rosterId}`)
        .volatile.emit(
          "update:member:rank",
          { id, username: results.username, rank: _rank },
          previous_rank
        );

      return cb(payload);
    }
  } catch (err) {
    console.log(err);
    await trx.rollback();
    cb(err);
  }
};
