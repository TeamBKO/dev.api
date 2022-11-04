"use strict";
const { DiscordMessageDraft } = require("$models/DiscordMessage");

const sanitize = require("sanitize-html");

const sanitizeHtml = (v) =>
  sanitize(v, {
    ALLOW_TAGS: [],
    ALLOW_ATTR: [],
  });

const { param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isString()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitizeHtml(v)),
]);

const getDraft = async function (req, res, next) {
  const draft = await DiscordMessageDraft.query()
    .where("id", req.params.id)
    .first();

  console.log(draft);

  res.status(200).send(draft);
};

module.exports = {
  path: "/drafts/:id",
  method: "GET",
  middleware: [validators],
  handler: getDraft,
};
