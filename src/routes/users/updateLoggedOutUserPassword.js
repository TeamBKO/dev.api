"use strict";
const updatePassword = require("$util/updatePassword");
const sanitize = require("sanitize-html");
const { body } = require("express-validator");
const { validate } = require("$util");

const validators = [
  validate([
    body("code").isString().escape().trim(),
    body("id").optional().isNumeric().toInt(10),
    body("password")
      .notEmpty()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("confirm")
      .notEmpty()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
  ]),
];

module.exports = {
  path: "/update/loggedout/password",
  method: "PATCH",
  middleware: [validators],
  handler: updatePassword,
};
