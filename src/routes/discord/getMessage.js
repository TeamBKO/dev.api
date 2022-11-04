"use strict";
const { DiscordMessageDraft } = require("$models/DiscordMessage");
const { getCachedSettings } = require("$services/redis/helpers");
const discord = require("$root/src/bot");

const sanitize = require("sanitize-html");

const { param } = require("express-validator");
const { validate } = require("$util");

const validators = validate([
  param("channelID").isNumeric(),
  param("messageID").isNumeric(),
]);

const pick = require("lodash.pick");

const getMessage = async function (req, res, next) {
  const { enable_bot } = await getCachedSettings();
  if (!enable_bot) return res.status(400).send("Bot is not enabled.");

  let message = pick(
    await discord.channels.cache
      .get(req.params.channelID)
      .messages.fetch(req.params.messageID),
    [
      "channelId",
      "id",
      "content",
      "author",
      "embeds",
      "components",
      "attachments",
      "createTimestamp",
    ]
  );

  message.author = pick(message.author, [
    "id",
    "bot",
    "username",
    "discriminator",
    "avatar",
  ]);

  res.status(200).send(message);
};

module.exports = {
  path: "/message/:channelID/:messageID",
  method: "GET",
  middleware: [validators],
  handler: getMessage,
};
