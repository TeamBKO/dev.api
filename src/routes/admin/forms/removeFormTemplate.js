"use strict";
const Form = require("$models/Form");

const guard = require("express-jwt-permissions")();
const redis = require("$services/redis");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, DELETE_ALL_FORMS } = require("$util/policies");

const removeForm = async function (req, res, next) {
  const trx = await Form.startTransaction();

  try {
    const deleted = await Form.query(trx)
      .whereIn("id", req.query.ids)
      .del()
      .returning("id");

    /** FLUSH THE CACHE */
    let keys = [];
    // const pipeline = redis.pipeline();

    req.query.ids.forEach((id) => {
      // pipeline.del(`form:${id}`);
      // pipeline.del(`admin:form:${id}`);
      keys.push(`form:${id}`);
      keys.push(`admin:form:${id}`);
    });

    await redis.unlink(keys);

    // pipeline.exec();

    deleteCacheByPattern("admin:forms:*");
    deleteCacheByPattern("forms:*");

    /** END OF CACHE FLUSH */

    await trx.commit();

    res.status(200).send(deleted);
  } catch (err) {
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    guard.check([VIEW_ALL_ADMIN, DELETE_ALL_FORMS]),
    validate([query("ids.*").isNumeric()]),
  ],
  handler: removeForm,
};
