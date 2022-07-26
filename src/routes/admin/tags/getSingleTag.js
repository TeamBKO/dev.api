"use strict";
const Tag = require("$models/Tag");
const guard = require("express-jwt-permissions")();
const {
  getCachedQuery,
  getCachedSettings,
} = require("$services/redis/helpers");
const { param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_TAGS } = require("$util/policies");

const columns = ["id", "name", "image", "enable_recruitment"];

const getSingleTag = async function (req, res) {
  const settings = await getCachedSettings();

  const tag = await getCachedQuery(
    `tag:${req.params.id}`,
    Tag.query()
      .where("id", req.params.id)
      .throwIfNotFound()
      .select(columns)
      .first(),
    settings.cache_tags_on_fetch,
    undefined,
    false
  );

  res.status(200).send(tag);
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_TAGS]),
    validate([param("id").isNumeric().toInt(10)]),
  ],
  handler: getSingleTag,
};
