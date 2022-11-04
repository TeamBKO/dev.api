"use strict";
const discord = require("$root/src/bot");

const getEmoji = async function (req, res, next) {
  const emoji = discord.emojis.cache;
  console.log(emoji);
  res.sendStatus(200);
};

module.exports = {
  path: "/emoji",
  method: "GET",
  handler: getEmoji,
};
