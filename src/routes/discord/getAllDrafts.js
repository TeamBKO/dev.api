"use strict";
const { DiscordMessageDraft } = require("$models/DiscordMessage");

const { query } = require("express-validator");
const { validate } = require("$util");

const sanitize = require("sanitize-html");

const sanitizeHtml = (v) =>
  sanitize(v, {
    ALLOW_TAGS: [],
    ALLOW_ATTR: [],
  });

const validators = validate([
  query("nextCursor")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitizeHtml(v)),
]);

const getAllDrafts = async function (req, res, next) {
  const nextCursor = req.params.nextCursor;

  const drafts = DiscordMessageDraft.query()
    .withGraphFetched("author(defaultSelects)")
    .where("author_id", req.user.id)
    .orWhere("private", false)
    .limit(10);

  let query;

  if (nextCursor) {
    query = await drafts.clone().cursorPage(nextCursor);
  } else {
    query = await drafts.clone().cursorPage();
  }

  console.log(query);

  res.status(200).send(query);
};

module.exports = {
  path: "/drafts",
  method: "GET",
  middleware: [validators],
  handler: getAllDrafts,
};
