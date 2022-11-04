"use strict";
const { DiscordMessageDraft } = require("$models/DiscordMessage");
const { nanoid } = require("nanoid");

const sanitize = require("sanitize-html");

const sanitizeHtml = (v) =>
  sanitize(v, {
    ALLOW_TAGS: [],
    ALLOW_ATTR: [],
  });

const { body } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  body("name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.author.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.author.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.author.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.thumbnail.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.image.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.footer.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.color")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.footer.text")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.timestamp")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.fields.*.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.fields.*.value")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.embeds.*.fields.*.inline").optional().isBoolean(),
  body("message.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.username")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
  body("message.author")
    .optional()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitizeHtml(v)),
]);

const saveDraft = async function (req, res, next) {
  console.log(req.body);
  const { name, ...b } = req.body;

  const trx = await DiscordMessageDraft.startTransaction();

  const json = JSON.stringify(b);

  try {
    const saved = await DiscordMessageDraft.query(trx)
      .insert({
        uid: nanoid(32),
        name,
        body: json,
        author_id: req.user.id,
      })
      .returning(["id"]);

    await trx.commit();

    const draft = await DiscordMessageDraft.query()
      .where("id", saved.id)
      .withGraphFetched("author(defaultSelects)")
      .first();

    res.status(200).send(draft);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/drafts",
  method: "POST",
  handler: saveDraft,
};
