"use strict";
const Media = require("$models/Media");
const guard = require("express-jwt-permissions")();
const pick = require("lodash.pick");
const filterQuery = require("$util/filterQuery");
const { query } = require("express-validator");
const { VIEW_ALL_ADMIN, VIEW_ALL_MEDIA } = require("$util/policies");

const select = [
  "id",
  "mimetype",
  "url",
  "owner_id",
  "storage_key",
  "created_at",
  "updated_at",
];

const middleware = [
  guard.check([VIEW_ALL_ADMIN, VIEW_ALL_MEDIA]),
  query("nextCursor").optional().isString(),
];

const getAllMedia = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;
  const filters = req.body.exclude;

  console.log(nextCursor);

  const query = filterQuery(
    Media.query()
      .select(select)
      .withGraphFetched("uploader(defaultSelects)")
      .orderBy("id"),
    filters,
    "media"
  );

  let media;

  if (nextCursor) {
    media = await query.clone().cursorPage(nextCursor);
  } else {
    media = await query.clone().cursorPage();
  }

  console.log(media);

  res.status(200).send(media);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware,
  handler: getAllMedia,
};
