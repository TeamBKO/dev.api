"use strict";
const DiscordWatchedRole = require("$models/DiscordWatchedRole");
const {
  VIEW_ALL_ADMIN,
  UPDATE_ALL_SETTINGS,
  VIEW_ALL_SETTINGS,
} = require("$util/policies");
const { validate } = require("$util");

const addWatchedDiscordRoles = async (req, res, next) => {
  const trx = await DiscordWatchedRole.startTransaction();
  try {
    const watched = await DiscordWatchedRole.query()
      .insert(req.body.watched)
      .returning("id");
    await trx.commit();
    const results = await DiscordWatchedRole.query()
      .joinRelated("discord_roles")
      .select(["id", "discord_roles.id", "discord_roles.name"])
      .whereIn(
        "id",
        watched.map(({ id }) => id)
      );
    res.status(200).send(results);
  } catch (err) {
    await trx.rollback();
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/bot/watch",
  method: "POST",
  middleware: [
    validate([VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS, VIEW_ALL_SETTINGS]),
  ],
  handler: addWatchedDiscordRoles,
};
