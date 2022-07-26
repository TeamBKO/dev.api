"use strict";
const Testimony = require("$models/Testimony");
const sanitize = require("sanitize-html");
const guard = require("express-jwt-permissions")();
const pick = require("lodash.pick");
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, ADD_OWN_POSTS } = require("$util/policies");

const guards = guard.check([VIEW_ALL_ADMIN, ADD_OWN_POSTS]);

const validators = validate([
  body("testimony.*")
    .notEmpty()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const middleware = [guards, validators];

const addTestimony = async function (req, res) {
  const { total } = await Testimony.query().count();

  const data = pick(req.body.testimony, ["author", "avatar", "text"]);

  const trx = await Testimony.startTransaction();

  const testimony = await Testimony.query(trx).insert(data).returning("id");

  res.status(200).send(testimony);
};

module.exports = {
  path: "/testimony",
  method: "POST",
  middleware,
  handler: addTestimony,
};
