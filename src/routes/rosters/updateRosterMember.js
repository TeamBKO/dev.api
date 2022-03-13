"use strict";
const RosterMember = require("$models/RosterMember");
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
  body("id.*")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("permissions.*").optional().isBoolean(),
  body("rank_id").optional().isUUID(),
  body("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "removed"]),
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

const updateRosterMember = async function (req, res, next) {
  const { permissions_id, permissions, rank_id, status, id } = req.body;

  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("No privilages");
  }

  let upsert;

  let query = RosterMember.query()
    .joinRelated("[member(defaultSelects)]")
    .withGraphFetched("[rank(default), form(default)]")
    .select([
      "roster_members.id as id",
      "member.username as username",
      "member.avatar as avatar",
      "roster_members.status",
      "roster_members.approved_on",
    ]);

  if (id && Array.isArray(id)) {
    upsert = id.map((_id) =>
      graphFn(_id, permissions_id, permissions, rank_id, status)
    );
    query = query.whereIn("roster_members.id", id);
  } else {
    upsert = graphFn(
      req.params.id,
      permissions_id,
      permissions,
      rank_id,
      status
    );
    query = query.where("roster_members.id", req.params.id).first();
  }

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(upsert);
    await trx.commit();
    const members = await query;
    console.log(members);
    res.status(200).send(members);
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
