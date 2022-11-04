"use strict";
const Testimony = require("$models/Testimony");
const guard = require("express-jwt-permissions")();
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { query } = require("express-validator");
const { validate } = require("$util");
const {
  VIEW_ALL_ADMIN,
  DELETE_ALL_POSTS,
  DELETE_OWN_POSTS,
} = require("$util/policies");

const guards = guard.check([
  VIEW_ALL_ADMIN,
  [DELETE_ALL_POSTS],
  [DELETE_OWN_POSTS],
]);

const validators = validate([query("ids.*").isNumeric()]);

const middleware = [guards, validators];

const removeTestimony = async function (req, res) {
  const deleted = await Testimony()
    .whereIn(req.query.ids)
    .returning("id")
    .delete();

  deleteCacheByPattern("?(admin:testimonies*|testimonies*)");
  res.status(200).send({ deleted });
};

module.exports = {
  path: "/testimony",
  method: "DELETE",
  middleware,
  handler: removeTestimony,
};
