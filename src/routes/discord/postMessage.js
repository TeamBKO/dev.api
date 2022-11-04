"use strict";
const Roster = require("$models/Roster");
const discord = require("$root/src/bot");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const sanitize = require("sanitize-html")({
  ALLOW_TAGS: [],
  ALLOW_ATTR: [],
});

const { body } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  body("webhookURL")
    .optional()
    .isString()
    .isURL()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.author.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.author.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.author.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.thumbnail.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.image.url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.footer.icon_url")
    .optional()
    .isString()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.color")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.footer.text")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.timestamp")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.fields.*.name")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.fields.*.value")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.embeds.*.fields.*.inline").optional().isBoolean(),
  body("message.description")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.title")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.username")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("message.author")
    .optional()
    .isURL()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
]);

const isString = (str) => typeof str === "string";

const beforeHandler = (req, res, next) => {
  if (isString(req.body.message)) {
    req.body.message = JSON.parse(req.body.message);
  }
  next();
};

/**
 *
 * @param {array} arr The array containing the rosters
 * @returns an array of ActionRowBuilder objects
 */
const buildButtonRows = (arr) => {
  const rowSize = 5;
  const rows = [];

  const buildButtons = (arr, start) => {
    const buttons = [];
    for (let col = start; col < arr.length && col < start + rowSize; col++) {
      buttons.push(
        new ButtonBuilder()
          .setLabel(arr[col].name)
          .setStyle(ButtonStyle.Link)
          .setURL(`http://www.blackout.team/rosters/${arr[col].url}`)
      );
    }
    return buttons;
  };

  for (let row = 0; row < arr.length / rowSize; row++) {
    const start = row * rowSize;
    const actionRow = new ActionRowBuilder().addComponents(
      ...buildButtons(arr, start)
    );
    rows.push(actionRow);
  }

  return rows;
};

const postMessage = async function (req, res, next) {
  const message = req.body.message;

  const { embeds, ...content } = message;

  const rosters = await Roster.query().select(["id", "name", "url"]).limit(25);

  const rows = buildButtonRows(rosters);

  const payload = {
    ...content,
    components: rows,
    files: req.files ? req.files.map((file) => file.buffer) : [],
  };

  if (embeds && embeds.length) {
    Object.assign(payload, { embeds });
  }

  console.log(payload);

  try {
    const channel = await discord.channels.cache
      .get(req.params.id)
      .send(payload);
    res.status(200).send("OK");
  } catch (err) {
    // if (err) {
    //   console.log(err.rawError.errors.embeds[0]._errors);
    // }
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/message/:id",
  method: "POST",
  middleware: [upload.any("files"), beforeHandler],
  handler: postMessage,
};
