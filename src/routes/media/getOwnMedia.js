"use strict";
const Media = require("$models/Media");
const Settings = require("$models/Settings");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { query } = require("express-validator");
const { VIEW_OWN_MEDIA } = require("$util/policies");

const middleware = [
  guard.check([VIEW_OWN_MEDIA]),
  query("nextCursor")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  query("exclude.*")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
];

const select = [
  "media.id",
  "media.mimetype",
  "media.url",
  "media.storage_key",
  "media.owner_id",
  "media.created_at",
  "media.updated_at",
];

const getOwnMedia = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;
  const filters = req.query.exclude;

  const { enable_account_media_sharing } = await Settings.query()
    .select("enable_account_media_sharing")
    .first();

  let query = filterQuery(
    Media.query()
      .joinRelated("media_shared_users")
      .select(select)
      .where("media.owner_id", req.user.id)
      .orderBy("media.id")
      .orderBy("media.owner_id")
      .limit(25),
    filters
  );

  if (enable_account_media_sharing) {
    query = query.orWhere("media_shared_users.id", req.user.id);
  }

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
  handler: getOwnMedia,
};
