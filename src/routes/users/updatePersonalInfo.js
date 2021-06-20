"use strict";
const User = require("./models/User");
const pick = require("lodash/pick");
const sanitize = require("sanitize-html");
const guard = require("express-jwt-permissions")();
const { body, param } = require("express-validator");
const { validate } = require("$util");

const middleware = [
  validate([
    body("username")
      .optional()
      .notEmpty()
      .isAlphanumeric()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("first_name")
      .optional()
      .notEmpty()
      .isAlphanumeric()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("last_name")
      .optional()
      .notEmpty()
      .isAlphanumeric()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("location")
      .optional()
      .notEmpty()
      .isAlphanumeric()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("gender")
      .optional()
      .notEmpty()
      .isAlphanumeric()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("description")
      .optional()
      .notEmpty()
      .isString()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("birthday")
      .optional()
      .notEmpty()
      .isDate()
      .trim()
      .customSanitizer((v) => sanitize(v)),
  ]),
];

const updatePersonalInfo = async function (req, res, next) {
  const body = pick(req.body, [
    "username",
    "first_name",
    "last_name",
    "location",
    "gender",
    "description",
    "birthday",
  ]);

  const user = await User.query()
    .patch(req.body)
    .where("id", req.user.id)
    .first()
    .throwIfNotFound()
    .returning(["id", ...body]);

  res.status(200).send(user);
};

module.exports = {
  path: "/update",
  method: "PATCH",
  middleware,
  handler: updatePersonalInfo,
};
