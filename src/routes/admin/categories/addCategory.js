"use strict";
const Category = require("$models/Category");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const pick = require("lodash.pick");
const { body } = require("express-validator");
const { validate } = require("$util");
const { deleteKeysByPattern } = require("$services/redis/helpers");

const validators = validate([
  body("name")
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
]);

const addCategory = async function (req, res, next) {
  const trx = await Category.startTransaction();

  const data = pick(req.body, ["name", "image", "enable_recruitment"]);

  try {
    const category = await Category.query(trx).insert(data).returning("*");

    await trx.commit();

    deleteKeysByPattern("categories:");

    res.status(200).send(category);
  } catch (err) {
    await trx.rollback();
    next(err);
  }

  // let categories;
  // if (nextCursor) {
  //   categories = await query.clone().cursorPage(nextCursor);
  // } else {
  //   categories = await query.clone().cursorPage();
  // }
};

module.exports = {
  path: "/",
  method: "POST",
  middleware: [guard.check("view:admin"), validators],
  handler: addCategory,
};
