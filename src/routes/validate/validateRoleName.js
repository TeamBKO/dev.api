"use strict";
const Role = require("$models/Role");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const { validate } = require("$util");

const validateRoleName = async function (req, res, next) {
  const role = await Role.query()
    .where("name", req.query.value)
    .select("id")
    .first();
  if (role) return res.status(422).send("name already exists.");
  res.status(200).send();
};

module.exports = {
  path: "/role",
  method: "GET",
  middleware: [
    validate(
      [
        query("value")
          .notEmpty()
          .withMessage("Name is required.")
          .isAlphanumeric()
          .withMessage("Name must be alphanumeric.")
          .isLength({ min: 3, max: 30 })
          .withMessage("Name must be 3 to 30 in length.")
          .escape()
          .trim(),
      ],
      422
    ),
  ],
  handler: validateRoleName,
};
