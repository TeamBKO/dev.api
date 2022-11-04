"use strict";
const Category = require("$models/Category");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const validators = validate([
  body("name")
    .optional()
    .isAlphanumeric()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("image")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("enable_recruitment").optional().isBoolean(),
  param("id").isNumeric().toInt(10),
]);

const editCategory = async function (req, res, next) {
  const trx = await Category.startTransaction();

  try {
    const category = await Category.query(trx)
      .patch(req.body.details)
      .where("id", req.params.id)
      .first()
      .returning("id", "name", "updated_at");

    await trx.commit();

    deleteCacheByPattern("categories*");
    res.status(200).send(category);
  } catch (err) {
    console.error(err);

    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:id",
  method: "PATCH",
  middleware: [guard.check(VIEW_ALL_ADMIN), validators],
  handler: editCategory,
};
