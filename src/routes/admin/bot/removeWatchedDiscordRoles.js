"use strict";
const BotWatched = require("$models/BotWatched");
const {
  VIEW_ALL_ADMIN,
  UPDATE_ALL_SETTINGS,
  VIEW_ALL_SETTINGS,
} = require("$util/policies");
const { validate } = require("$util");
const redis = require("$services/redis");

const unwatchDiscordRoles = async (req, res, next) => {
  const trx = await BotWatched.startTransaction();
  try {
    const unwatched = await BotWatched.query()
      .where("id", req.params.id)
      .del()
      .returning("id");
    await trx.commit();

    res.status(200).send(unwatched);
  } catch (err) {
    await trx.rollback();
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/bot/watch/:id",
  method: "DELETE",
  middleware: [
    validate([VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS, VIEW_ALL_SETTINGS]),
  ],
  handler: unwatchDiscordRoles,
};
