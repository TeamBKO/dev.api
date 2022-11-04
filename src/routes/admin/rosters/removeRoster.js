"use strict";
const Roster = require("$models/Roster");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { query } = require("express-validator");
const { validate } = require("$util");

const { VIEW_ALL_ADMIN } = require("$util/policies");

const middleware = [
  guard.check([VIEW_ALL_ADMIN]),
  validate([
    query("ids.*")
      .isUUID()
      .trim()
      .escape()
      .customSanitizer((v) => sanitize(v)),
  ]),
];

const removeRoster = async function (req, res, next) {
  const trx = await Roster.startTransaction();

  try {
    const deleted = await Roster.query(trx)
      .whereIn("id", req.query.ids)
      .andWhere("is_deletable", true)
      .throwIfNotFound()
      .delete()
      .returning(["id", "name"]);

    await trx.commit();

    deleteCacheByPattern(`?(rosters*|roster*)`);

    res.status(200).send(deleted);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    return next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware,
  handler: removeRoster,
};
