"use strict";
const redis = require("$services/redis");
const User = require("$models/User");
const Settings = require("$models/Settings");
const sendEmail = require("$services/email");
const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");

const {
  differenceInSeconds,
  addMinutes,
  parseISO,
  subSeconds,
  formatDistanceStrict,
} = require("date-fns");

module.exports = async function (req, res, next) {
  if (req.params.code) return next();

  const password = req.body.password;

  let userQuery = User.query()
    .select("id", "username", "active", "email", "password")
    .first();

  /** if req.user is populated the user is logged in and requesting a password change. */
  userQuery =
    req.user && req.user.id
      ? userQuery.where("id", req.user.id)
      : userQuery.where("email", req.body.email);

  const [account, settings] = await Promise.all([
    userQuery,
    Settings.query()
      .where("id", 1)
      .select(["universal_request_ttl_in_minutes"])
      .first(),
  ]);

  if (!account) {
    return res
      .status(404)
      .send({ success: false, status: 1, message: "User doesn't exist." });
  }

  if (req.user) {
    if (!(await bcrypt.compare(password, account.password))) {
      return res.status(400).send("Incorrect password.");
    }
  }

  const key = req.user ? `pw:update:${account.id}` : `pw:reset:${account.id}`;

  if (await redis.exists(key)) {
    const json = JSON.parse(await redis.get(key));

    const expiry = parseISO(json.expiry);

    const time = subSeconds(expiry, differenceInSeconds(expiry, new Date()));

    const timeInMinutes = formatDistanceStrict(new Date(), expiry, {
      unit: "minute",
    });

    return res.status(400).send({
      resend: true,
      count: time.getTime() / 1000,
      message: `Request already exists. Please wait ${timeInMinutes} before performing another request for this account.`,
      awaitingConfirmation: true,
    });
  }

  const code = nanoid(32);
  const date = new Date().toISOString();

  const expiryDate = addMinutes(
    new Date(),
    settings.universal_request_ttl_in_minutes
  );

  const exp = settings.universal_request_ttl_in_minutes * 60;

  const data = {
    code,
    createdAt: date,
    expiry: expiryDate,
  };

  const EMAIL_TEMPLATE = req.user ? "UPDATE_PASSWORD" : "PASSWORD_RESET";
  const EMAIL_PAYLOAD = req.user
    ? { username: account.username, code }
    : {
        username: account.username,
        url: process.env.BASE_URL + `password-reset/${code}`,
        id: account.id,
      };

  await sendEmail(account.email, EMAIL_TEMPLATE, EMAIL_PAYLOAD);

  await redis.set(key, JSON.stringify(data), "NX", "EX", exp);

  res
    .status(200)
    .send({ status: 1, success: true, awaitingConfirmation: true });
};
