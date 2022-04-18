"use strict";
const RosterMember = require("$models/RosterMember");
const User = require("$models/User");
const sanitize = require("sanitize-html");
const { body, param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("members.*.id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("members.*.userID").optional().isNumeric().toInt(10),
  body("userID").optional().isNumeric().toInt(10),
  body("permissions.*").optional().isBoolean(),
  body("rank_id").optional().isUUID(),
  body("status").optional().isIn(["pending", "approved", "rejected"]),
]);

const graphFn = (id, permissionsID, permissions, rank_id, status) => {
  const result = {
    id: id,
  };

  if (permissions) {
    Object.assign(result, {
      permissions: {
        id: permissionsID,
        ...permissions,
      },
    });
  }

  if (rank_id) {
    Object.assign(result, {
      roster_rank_id: rank_id,
    });
  }

  if (status) {
    Object.assign(result, { status });
    if (status === "approved") {
      Object.assign(result, { approved_on: new Date().toISOString() });
    }
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
  const {
    permissions_id,
    permissions,
    rank_id,
    status,
    members,
    userID,
  } = req.body;

  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select(["roster_members.roster_id", "roster_members.roster_id"])
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .orWhere()
    .first();

  if (!hasAccess) {
    return res.status(403).send({ message: "Insufficient permissions" });
  }

  const {
    apply_roles_on_approval,
    roles,
  } = await Roster.query()
    .withGraphFetched("roles(default)")
    .select(["apply_roles_on_approval"])
    .where("id", hasAccess.roster_id)
    .first();

  if (status && status === "removed") {
    const canRemove = await RosterMember.query()
      .joinRelated("[permissions, rank.[permissions]]")
      .where("roster_members.member_id", req.user.id)
      .andWhere((qb) =>
        qb
          .where("permissions.can_remove_members", true)
          .orWhere("rank:permissions.can_remove_members", true)
      )
      .first();

    if (!canRemove) {
      return res.status(403).send({ message: "Insufficient permissions" });
    }
  }

  let query = RosterMember.query()
    .joinRelated("[member(defaultSelects)]")
    .withGraphFetched("[rank(default), form(default)]")
    .select(select);

  let upsert;

  if (req.params.id) {
    upsert = graphFn(
      req.params.id,
      permissions_id,
      permissions,
      rank_id,
      status
    );
    query = query.where("roster_members.id", req.params.id).first();
  }

  if (members && Array.isArray(members)) {
    upsert = members.map((member) =>
      graphFn(member.id, permissions_id, permissions, rank_id, status)
    );
    query = query.whereIn(
      "roster_members.id",
      members.map(({ id }) => id)
    );
  }

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(upsert);

    if (apply_roles_on_approval && roles && roles.length) {
      roles = roles.map(({ id }) => id);
      if (!req.params.id) {
        await User.relatedQuery("roles", trx)
          .for(members.map(({ userID }) => userID))
          .relate(roles);
      } else {
        await User.relatedQuery("roles", trx).for(userID).relate(roles);
      }
    }

    await trx.commit();
    const results = await query;
    res.status(200).send(results);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/members/:id?",
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