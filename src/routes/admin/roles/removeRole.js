"use strict";
const Role = require("$models/Role");
const guard = require("express-jwt-permissions")();

const redis = require("$services/redis");
const { query } = require("express-validator");
const { validate } = require("$util");
const { transaction } = require("objection");
const { VIEW_ALL_ADMIN, DELETE_ALL_ROLES } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const getUserSessionsByRoleID = require("$util/getUserSessionsByRoleID");

const middleware = [
  guard.check([VIEW_ALL_ADMIN, DELETE_ALL_ROLES]),
  validate([query("ids.*").isNumeric()]),
];

const removeRole = async function (req, res, next) {
  const trx = await Role.startTransaction();

  let deleted;

  try {
    deleted = await Role.query(trx)
      .whereIn("id", req.query.ids)
      .andWhere("is_deletable", true)
      .throwIfNotFound()
      .returning("id")
      .delete();

    if (deleted) {
      console.log("deleted", deleted);
      const pipeline = redis.pipeline();
      req.query.ids.forEach((id) => pipeline.del(`role_${id}`));

      const sessions = await getUserSessionsByRoleID(req.query.ids);
      if (sessions && sessions.length) await redis.multi(sessions).exec();

      pipeline.exec();
    }

    await trx.commit();
    deleteCacheByPattern("role:");
    deleteCacheByPattern("roles:");

    res.status(200).send(deleted);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    return next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware,
  handler: removeRole,
};
