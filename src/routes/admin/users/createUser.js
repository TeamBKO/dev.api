"use strict";
const User = require("$models/User");
const pick = require("lodash.pick");
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12;
const sanitize = require("sanitize-html");
const guard = require("express-jwt-permissions")();
const filterQuery = require("$util/filterQuery");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, ADD_ALL_USERS } = require("$util/policies");

const validators = validate([
  body("username")
    .notEmpty()
    .isAlphanumeric()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("email").notEmpty().isEmail().escape().normalizeEmail().trim(),
  body("password")
    .notEmpty()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("avatar")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("active").isBoolean(),
  body("roles.*").optional().isNumeric(),
  body("policies.*").optional().isNumeric(),
]);

const consoleLog = (req, res, next) => {
  console.log(req.body);
  next();
};

// const insertFn = (credentials, roles, policies) => {
//   const data = {
//     "#id": "user",
//     ...credentials,
//   };

//   if (roles && roles.length) {
//     Object.assign(data, { roles: roles.map((id) => ({ id })) });
//   }

//   if (policies && policies.length) {
//     const _policies = policies.map((id) => ({ id }));
//     Object.assign(data, { policies: _policies });
//   }

//   return data;
// };

// const createUser = async function (req, res, next) {
//   const filters = req.body.filters;

//   const { email, active, policies, roles } = req.body;

//   const salt = await bcrypt.genSalt(SALT_ROUNDS);
//   const password = await bcrypt.hash(req.body.password, salt);

//   const creds = {
//     username: req.body.username,
//     active,
//     email,
//     password,
//   };

//   const insert = insertFn(creds, roles, policies);
//   const options = { relate: true, unrelate: true };

//   const { username, users } = await User.transaction(async (trx) => {
//     const user = await User.query(trx)
//       .insertGraph(insert, options)
//       .returning("*");

//     let query = User.query(trx)
//       .withGraphFetched("[roles(nameAndId), policies]")
//       .orderBy("id")
//       .select("id", "avatar", "username", "email", "created_at");

//     // if (filters && Object.keys(filters).length) {
//     //   console.log(filters);

//     //   query = query.whereExists(
//     //     User.relatedQuery("roles").whereIn("id", filters.id)
//     //   );
//     // }

//     return { username: user.username };
//   });

//   res.status(200).send({ username, users });
// };

const columns = [
  "users.id",
  "avatar",
  "username",
  "email",
  "active",
  "created_at",
  "updated_at",
];

const createUser = async function (req, res, next) {
  let data = pick(req.body, ["username", "email", "password", "avatar"]),
    roles = req.body.roles,
    policies = req.body.policies,
    filters = req.body.filters;

  const trx = await User.startTransaction();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    data.password = await bcrypt.hash(data.password, salt);

    const { id } = await User.createUser(data, roles, policies, trx);

    await trx.commit();

    const user = await filterQuery(
      User.query()
        .withGraphJoined("roles(nameAndId)")
        .where("users.id", id)
        .select(columns)
        .first(),
      filters
    );

    console.log("user", user);

    deleteCacheByPattern("users:");

    res.status(200).send(user);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "POST",
  middleware: [
    // consoleLog,
    guard.check([VIEW_ALL_ADMIN, ADD_ALL_USERS]),
    validators,
  ],
  handler: createUser,
};
