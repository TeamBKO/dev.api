"use strict";
const redis = require("$services/redis");
const User = require("$models/User");
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12;

/**
 * Process a password update/recovery request.
 * @param {object} req The request object.
 * @param {object} res The response object.
 * @param {function} next Moves request down the pipeline.
 */
module.exports = async function updatePassword(req, res, next) {
  const id = req.user ? req.user.id : req.body.id,
    code = req.user ? req.params.code : req.body.code,
    key = req.user ? `pw:update:${id}` : `pw:reset:${id}`;

  if (!id) {
    return res.status(400).send({ status: 1, message: "Missing credentials." });
  }

  if (!(await redis.exists(key))) {
    return res.status(200).send({
      status: 1,
      message: "Password reset request expired or doesn't exist.",
    });
  }

  const trx = await User.startTransaction();

  try {
    const info = JSON.parse(await redis.get(key));

    if (code !== info.code) {
      return res
        .status(200)
        .send({ status: 1, message: "Code was incorrect." });
    }

    if (req.body.password !== req.body.confirm) {
      return res.status(400).send({
        success: false,
        status: 1,
        message: "Passwords do not match.",
      });
    }

    const salted = await bcrypt.genSalt(SALT_ROUNDS);
    const hashed = await bcrypt.hash(req.body.password, salted);

    await User.query(trx)
      .patch({ password: hashed })
      .where("id", id)
      .returning("id");

    await redis.del(key);
    await redis.del(`login:user:${id}`);

    await trx.commit();

    res.status(200).send({
      success: true,
      status: 2,
      message:
        "Your password has been saved. You will be redirected back to the main page.",
    });
  } catch (err) {
    console.log(err);

    await trx.rollback();
    next(err);
  }
};
