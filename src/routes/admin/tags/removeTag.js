"use strict";
const Tag = require("$models/Tag");
const guard = require("express-jwt-permissions")();
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { query } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const validators = validate([query("ids.*").isNumeric().toInt(10)]);

const removeTag = async function (req, res, next) {
  const trx = await Tag.startTransaction();

  try {
    const deleted = await Tag.query(trx)
      .whereIn("id", req.query.ids)
      .delete()
      .returning("id");

    const ids = req.query.ids.map((id) => `tag:${id}`).join("|");

    deleteCacheByPattern(`?(tags*|${ids}`);

    res.status(200).send(deleted);
  } catch (err) {
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware: [guard.check([VIEW_ALL_ADMIN]), validators],
  handler: removeTag,
};
