"use strict";
const generatePasswordRequest = require("$util/generatePasswordRequest");
const updatePassword = require("$util/updatePassword");
const sanitize = require("sanitize-html");
const { body, param } = require("express-validator");
const { validate } = require("$util");

const validators = [
  validate([
    param("code")
      .optional()
      .isString()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("password")
      .optional()
      .notEmpty()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
    body("confirm")
      .optional()
      .notEmpty()
      .escape()
      .trim()
      .customSanitizer((v) => sanitize(v)),
  ]),
];

module.exports = {
  path: "/update/loggedin/password/:code?",
  method: "PATCH",
  middleware: [validators],
  handler: [generatePasswordRequest, updatePassword],
};
