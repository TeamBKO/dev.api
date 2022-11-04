"use strict";
const pick = require("lodash.pick");
const uniq = require("lodash.uniq");

const sanitize = require("sanitize-html");

const sanitizeHtml = (v) =>
  sanitize(v, {
    ALLOW_TAGS: [],
    ALLOW_ATTR: [],
  });

const { DiscordMessageDraft } = require("$models/DiscordMessage");

const { body, param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("id")
    .isString()
    .isUUID()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("private").optional().isBoolean(),
  body("body.embeds.*.author.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.author.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.author.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.thumbnail.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.image.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.footer.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.color")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.footer.text")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.timestamp")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.fields.*.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.fields.*.value")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.embeds.*.fields.*.inline").optional().isBoolean(),
  body("body.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("body.username")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  // body("author")
  //   .optional()
  //   .isURL()
  //   .escape()
  //   .trim()
  //   .customSanitizer((v) => sanitizeHtml(v)),
]);

const updatebody = async function (req, res, next) {
  const fields = pick(req.body, "name", "private", "body");

  if (fields.body) {
    fields.body = JSON.stringify(fields.body);
  }

  const trx = await DiscordMessageDraft.startTransaction();

  try {
    const saved = await DiscordMessageDraft.query(trx)
      .patch(fields)
      .where("id", req.params.id)
      .returning([
        "id",
        "updated_at",
        ...uniq(["name", ...Object.keys(fields)]),
      ])
      .first();

    console.log(saved);

    await trx.commit();

    res.status(200).send(saved);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/drafts/:id",
  method: "PATCH",
  handler: updatebody,
};
