"use strict";
const User = require("$models/User");
const Settings = require("$models/Settings");
const sanitize = require("sanitize-html");
const redis = require("$services/redis");

const { body, header } = require("express-validator");
const { validate } = require("$util");
const getCountTillNextRequest = require("$util/getCountTillNextRequest");

const activateAccount = async function (req, res) {
  const parsedID = parseInt(req.body.id, 10);

  const [account, settings] = await Promise.all([
    User.query()
      .where("id", parsedID)
      .returning(["active", "last_activation_email_sent"])
      .first(),
    Settings.query()
      .where("id", 1)
      .select(["universal_request_ttl_in_minutes"])
      .first(),
  ]);

  if (!account) {
    return res.status(200).send({
      resend: false,
      startTimer: false,
      status: 1,
      endTime: 0,
      message: "Credentials incorrect, or the requested account doesn't exist.",
    });
  }

  if (account.active) {
    return res.status(200).send({
      resend: false,
      startTimer: false,
      status: 0,
      endTime: 0,
      message: "Your account is already active.",
    });
  }

  if (await redis.exists(`activation:${req.body.id}`)) {
    const key = `activation:${req.body.id}`;
    const code = await redis.get(key);

    if (req.body.code === code) {
      await redis.del(key);
      await User.query().patch({ active: true }).where("id", parsedID);
      return res.status(200).send({
        resend: false,
        startTimer: false,
        endTime: 0,
        status: 0,
        message:
          "Thank you for registering with Blackout. Your account is now active.",
      });
    }
  }

  const message =
    "We've encountered a problem activating your account. The time has expired or the credentials were incorrect.";

  let response = Object.assign(
    { resend: true, status: 1, message },
    getCountTillNextRequest(
      account.last_activation_email_sent,
      settings.universal_request_ttl_in_minutes
    )
  );

  res.status(200).send(response);
};

module.exports = {
  path: "/activation",
  method: "POST",
  middleware: [
    validate([
      header("authorization").isEmpty(),
      body("id").isNumeric().toInt(10),
      body("code")
        .isString()
        .customSanitizer((v) => sanitize(v)),
    ]),
  ],
  handler: activateAccount,
};
