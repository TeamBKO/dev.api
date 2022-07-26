"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const redis = require("$services/redis");

const { param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const middleware = [
  validate([
    param("id")
      .isUUID()
      .trim()
      .escape()
      .customSanitizer((v) => sanitize(v)),
  ]),
];

const removeRoster = async function (req, res, next) {
  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) => {
      qb.where("permissions.can_delete_roster", true).orWhere(
        "rank:permissions.can_delete_roster",
        true
      );
    })
    .first();

  if (!hasAccess) {
    return res.status(403).send({ message: "Insufficient permissions." });
  }

  const trx = await Roster.startTransaction();

  try {
    const deleted = await Roster.query(trx)
      .where("id", req.params.id)
      .andWhere("is_deletable", true)
      .delete()
      .returning(["id", "name", "url"])
      .throwIfNotFound();

    await trx.commit();

    await redis.del(`roster:${req.params.id}`);
    deleteCacheByPattern(`members:${req.params.id}:`);
    deleteCacheByPattern("rosters:");

    await res.status(200).send(deleted);
  } catch (err) {
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "DELETE",
  middleware,
  handler: removeRoster,
};
