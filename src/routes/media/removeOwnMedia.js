"use strict";
const Media = require("$models/Media");
const guard = require("express-jwt-permissions")();
const redis = require("$services/redis");
const { query } = require("express-validator");
const { deleteFiles } = require("$services/upload");
const { validate } = require("$util");
const { DELETE_OWN_MEDIA } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([query("keys.*").isString()]);

const removeOwnMedia = async (req, res, next) => {
  const trx = await Media.startTransaction();

  try {
    const s3 = await deleteFiles(process.env.AWS_BUCKET_NAME, req.query.keys);
    if (s3.Errors.length || !s3.Deleted.length) {
      return res
        .status(500)
        .send({ message: "Encountered an internal problem." });
    }

    const results = await Media.query(trx)
      .delete()
      .whereIn("storage_key", req.query.keys)
      .returning(["id"]);

    await trx.commit();
    deleteCacheByPattern(`media:${req.user.id}*`);

    const deleted = results.map(({ id }) => id);

    return res.status(200).send(deleted);
  } catch (err) {
    console.log(err);
    await trx.rollack();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "DELETE",
  middleware: [guard.check([DELETE_OWN_MEDIA]), validators],
  handler: removeOwnMedia,
};
