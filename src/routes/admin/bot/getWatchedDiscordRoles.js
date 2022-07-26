"use strict";
const BotWatched = require("$models/BotWatched");
const {
  VIEW_ALL_ADMIN,
  UPDATE_ALL_SETTINGS,
  VIEW_ALL_SETTINGS,
} = require("$util/policies");
const { validate } = require("$util");

const getWatchedDiscordRoles = async (req, res, next) => {
  try {
    const results = await BotWatched.query()
      .joinRelated("discord_roles")
      .select(["id", "discord_roles.id", "discord_roles.name"]);

    res.status(200).send(results);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/bot/watch",
  method: "GET",
  middleware: [
    validate([VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS, VIEW_ALL_SETTINGS]),
  ],
  handler: getWatchedDiscordRoles,
};
