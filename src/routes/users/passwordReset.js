"use strict";
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const hasScope = require("$util/hasScope");

const verifyRecaptcha = require("$services/recaptcha")(
  process.env.RECAPTCHA_SECRET
);
const generatePasswordRequest = require("$util/generatePasswordRequest");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const {
  VIEW_ALL_ADMIN,
  VIEW_ALL_USERS,
  UPDATE_ALL_USERS,
} = require("$util/policies");

const verifyOrSkip = (req, res, next) => {
  const isAdmin =
    req.user &&
    hasScope(req.user, [VIEW_ALL_ADMIN, VIEW_ALL_USERS, UPDATE_ALL_USERS]);

  if (req.params.code || isAdmin) return next();
  verifyRecaptcha(req);
};

const passwordResetConfirm = async function (req, res, next) {
  const code = req.params.code,
    id = req.body.id,
    key = `pw:reset:${id}`;

  if (!(await redis.exists(key))) {
    return res
      .status(404)
      .send({ status: 1, message: "Password reset request expired." });
  }

  if (!code) {
    return res.status(400).send({ message: "Code missing." });
  }

  const json = JSON.parse(await redis.get(key));

  if (code !== json.code) {
    return res.status(200).send({ status: 1, message: "Incorrect code." });
  }

  res.status(200).send({ status: 0 });
};

module.exports = {
  path: "/password-reset/:code?",
  method: "POST",
  middleware: [
    validate([
      body("id")
        .optional()
        .isString()
        .trim()
        .escape()
        .customSanitizer((v) => sanitize(v)),
      param("code")
        .optional()
        .isString()
        .escape()
        .trim()
        .customSanitizer((v) => sanitize(v)),
      body("email")
        .optional()
        .isEmail()
        .customSanitizer((v) => sanitize(v)),
      body("gresponse").optional().isString().escape().trim(),
    ]),
    verifyOrSkip,
  ],
  handler: [generatePasswordRequest, passwordResetConfirm],
};
