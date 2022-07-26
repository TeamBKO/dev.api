"use strict";
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const pick = require("lodash.pick");
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
  body("rank.*.name")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("rank.*.icon")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("rank.*.priority").optional().isIn([5, 4, 3, 2, 1]).toInt(10),
]);

const select = ["id", "icon", "name", "is_deletable"];

const upsert = (id, rank, roster_id) => {
  const result = {};

  if (id) {
    Object.assign(result, { id });
  }

  if (rank.name) {
    Object.assign(result, { name: rank.name });
  }

  if (rank.icon) {
    Object.assign(result, { icon: rank.icon });
  }

  if (rank.priority) {
    Object.assign(result, { priority: rank.priority });
  }

  if (rank.permissions && Object.keys(rank.permissions).length) {
    Object.assign(result, { permissions: rank.permissions });
  }

  if (roster_id) {
    Object.assign(result, { roster_id });
  }

  return result;
};

const upsertRosterRank = async function (req, res, next) {
  const rank = pick(req.body, ["name", "icon", "priority", "permissions"]);
  const { roster_id } = req.body;
  const hasAccess = await RosterMember.query()
    .select("roster_id")
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where(
          req.params.id
            ? "permissions.can_edit_ranks"
            : "permissions.can_add_ranks",
          true
        )
        .orWhere(
          req.params.id
            ? "rank:permissions.can_edit_ranks"
            : "rank:permissions.can_add_ranks",
          true
        )
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  if (!req.params.id) {
    const { count } = await RosterRank.query()
      .where("roster_id", roster_id)
      .count("id");
    if (count === 10) {
      return res
        .status(422)
        .send({ message: "You can only have 10 ranks per roster." });
    }
  }

  const data = upsert(req.params.id, rank, roster_id);

  console.log(data);

  const trx = await RosterRank.startTransaction();

  try {
    const { id } = await RosterRank.query(trx).upsertGraph(data, {
      unrelate: false,
      noDelete: true,
    });

    await trx.commit();

    await redis.del(`roster:${hasAccess.roster_id}`);
    deleteCacheByPattern(`members:${hasAccess.roster_id.split("-")[4]}:`);

    const result = await RosterRank.query()
      .select(select)
      .where("id", id)
      .first();

    res.status(200).send(result);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/rank/:id?",
  method: "PATCH",
  middleware: [
    (req, res, next) => {
      console.log("body", req.body);
      next();
    },
    validators,
  ],
  handler: upsertRosterRank,
};
