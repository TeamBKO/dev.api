"use strict";
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("$models/User");
const verifyRecaptcha = require("$services/recaptcha")(
  process.env.RECAPTCHA_SECRET
);
const addHours = require("date-fns/addHours");
const { nanoid } = require("nanoid");
const { validate } = require("$util");
const { body, header } = require("express-validator");

const consoleLogout = (req, res, next) => {
  console.log(req.body);
  next();
};

const login = async function (req, res, next) {
  try {
    const result = await User.query()
      .where({ email: req.body.email })
      .select("id", "username", "avatar", "password")
      .withGraphFetched("[roles.permissions]")
      .first()
      .throwIfNotFound();

    const match = await bcrypt.compare(req.body.password, result.password);

    if (!match) {
      return res
        .status(422)
        .send({ message: "User credentials do not match." });
    }

    const jti = nanoid();

    await User.query().patch({ token_id: jti }).where("id", result.id);

    const { roles, ...user } = result;

    const permissions = roles.flatMap(({ permissions }) =>
      permissions.map(({ action, resource }) => {
        return `${action}:${resource}`;
      })
    );

    const level = Math.min(roles.map(({ level }) => level));

    const data = {
      jti,
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      roles: roles.map(({ name }) => name),
      level,
      permissions,
    };

    const token = jwt.sign(data, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).send({ token });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  path: "/login",
  method: "POST",
  middleware: [
    validate([
      header("Authorization").isEmpty(),
      body("email").notEmpty().isEmail().trim().escape(),
      body("password").notEmpty().trim().escape(),
      body("gresponse").notEmpty(),
    ]),
    verifyRecaptcha,
  ],
  handler: login,
};
