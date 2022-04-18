"use strict";
const RosterRank = require("$models/RosterRank");
const RosterMember = require("$models/RosterMember");
const sanitize = require("sanitize-html");
const { param, query } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const select = ["id", "icon", "name"];

const getRosterRank = async function (req, res, next) {
  const hasAccess = await RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_ranks", true)
        .orWhere("rank:permissions.can_edit_ranks", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  const rank = await RosterRank.query()
    .select(select)
    .where("id", req.params.id)
    .withGraphFetched("[permissions(defaultWithID)]")
    .first();

  console.log(rank);

  res.status(200).send(rank);
};

module.exports = {
  path: "/rank/:id",
  method: "GET",
  middleware: [
    (req, res, next) => {
      console.log("query", req.query);
      next();
    },
    validators,
  ],
  handler: getRosterRank,
};
