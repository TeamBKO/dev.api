"use strict";
const Role = require("$models/Role");
const guard = require("express-jwt-permissions")();
const pick = require("lodash.pick");
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, ADD_ALL_ROLES } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const consoleLog = (req, res, next) => {
  console.log(req.body, req.query);
  next();
};

const middleware = [
  guard.check([VIEW_ALL_ADMIN, ADD_ALL_ROLES]),
  consoleLog,
  validate([
    body("details.name").isAlphanumeric().escape().trim(),
    body("details.level")
      .isNumeric()
      .custom((v, { req }) => v >= req.user.level),
    body("policies.*").optional().isNumeric(),
  ]),
];

const addRole = async function (req, res, next) {
  try {
    let role = await Role.createRole(
      pick(req.body, ["details", "policies", "discord_roles"]),
      ["id", "name", "level", "created_at", "updated_at", "is_deletable"]
    );

    role.members = 0;

    deleteCacheByPattrn("roles:");

    res.status(200).send(role);
  } catch (err) {
    console.log(err);
    // await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "POST",
  middleware,
  handler: addRole,
};
