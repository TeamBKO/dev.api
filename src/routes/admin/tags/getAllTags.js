"use strict";
const Tag = require("$models/Tag");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const filterQuery = require("$util/filterQuery");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_TAGS } = require("$util/policies");
const {
  getCachedSettings,
  getCachedQuery,
} = require("$services/redis/helpers");

const getAllCategories = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;

  const settings = await getCachedSettings();

  let tagQuery = filterQuery(
    Tag.query().orderBy("created_at", "desc").orderBy("id"),
    req.query
  );

  let tags;

  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    tags = await getCachedQuery(
      `tags:${next}`,
      tagQuery.clone().cursorPage(nextCursor),
      settings.cache_tags_on_fetch,
      undefined
    );
  } else {
    tags = await getCachedQuery(
      "tags:first",
      tagQuery.clone().cursorPage(),
      settings.cache_tags_on_fetch,
      undefined
    );
  }

  res.status(200).send(tags);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_TAGS]),
    validate([query("nextCursor").optional().isString().trim().escape()]),
  ],
  handler: getAllCategories,
};
