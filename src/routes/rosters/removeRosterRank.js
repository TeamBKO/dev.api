"use strict";
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const redis = require("$services/redis");

const { param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const removeRank = async function (req, res, next) {
  const hasAccess = await RosterMember.query()
    .select("roster_id")
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_remove_ranks", true)
        .orWhere("rank:permissions.can_remove_ranks", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  const rosterId = hasAccess.roster_id;

  const trx = await RosterRank.startTransaction();

  try {
    const item = await RosterRank.query(trx)
      .where("id", req.params.id)
      .andWhere("is_deletable", true)
      .del()
      .first()
      .returning(["id", "name"]);
    await trx.commit();

    deleteCacheByPattern(`roster:${rosterId}*`);

    res.status(200).send(item);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/rank/:id",
  method: "DELETE",
  middleware: [validators],
  handler: removeRank,
};
