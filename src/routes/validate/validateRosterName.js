"use strict";
const Roster = require("$models/Roster");
const sanitize = require("sanitize-html");
const { query } = require("express-validator");
const { validate } = require("$util");

const validateRosterName = async function (req, res, next) {
  const roster = await Roster.query().where("name", req.query.value).first();
  if (roster) return res.status(422).send("name already exists.");
  res.status(200).send();
};

module.exports = {
  path: "/categories",
  method: "GET",
  middleware: [
    validate([
      query("value")
        .notEmpty()
        .isString()
        .isLength({ min: 3, max: 30 })
        .withMessage("Roster name must be 3 to 30 in length.")
        .escape()
        .trim()
        .customSanitizer((v) => sanitize(v)),
    ]),
  ],
  handler: validateRosterName,
};
