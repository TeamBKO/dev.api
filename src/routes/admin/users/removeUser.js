"use strict";
const User = require("$models/User");
const guard = require("express-jwt-permissions")();
const redis = require("$services/redis");
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, DELETE_ALL_USERS } = require("$util/policies");
const getUserSessions = require("$util/getUserSessions");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const columns = ["id", "avatar", "username", "email", "created_at"];

const middleware = [
  guard.check([VIEW_ALL_ADMIN, DELETE_ALL_USERS]),
  validate([query("ids.*").isNumeric()]),
];

const removeUser = async function (req, res, next) {
  const trx = await User.startTransaction();

  try {
    const deleted = await User.query(trx)
      .whereIn("id", req.query.ids)
      .delete()
      .returning(["id", "username"]);
    await trx.commit();
    const sessions = await getUserSessions(req.query.ids);
    if (sessions && sessions.length) {
      await redis.multi(sessions).exec();
    }
    const pipeline = redis.pipeline();

    req.query.ids.forEach((id) => {
      pipeline.del(`user:${id}`);
      pipeline.del(`me:${id}`);
    });

    pipeline.exec();

    deleteCacheByPattern("users:");

    res.status(200).send(deleted);
  } catch (err) {
    await trx.rollback();
    return next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware,
  handler: removeUser,
};
