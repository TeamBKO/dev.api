"use strict";
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const DiscordMessage = require("$services/discord/classes/DiscordMessage");
const emitter = require("$services/redis/emitter");
const Settings = require("$models/Settings");
const sanitize = require("sanitize-html");
const { param, query } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const removeRosterMember = async function (req, res, next) {
  const rosterId = req.params.id;

  const [settings, roster] = await Promise.all([
    Settings.query().select(["enable_bot", "bot_server_id"]).first(),
    Roster.query()
      .where("id", rosterId)
      .select("link_to_discord")
      .first()
      .throwIfNotFound(),
  ]);

  const discordBotEnabled =
    settings.enable_bot && settings.bot_server_id && roster.link_to_discord;

  const trx = await RosterMember.startTransaction();

  try {
    const rosterMember = await RosterMember.query(trx)
      .joinRelated("[member(defaultSelects)]")
      .withGraphJoined("rank")
      .where("member.id", req.user.id)
      .andWhere("roster_members.roster_id", rosterId)
      .andWhereNot("rank.priority", 1)
      .del()
      .returning([
        "roster_members.id",
        "status",
        "member.username as username",
      ]);

    if (!rosterMember) {
      return res.status(422).send({ message: "That action is prohibited." });
    }

    if (discordBotEnabled) {
      await DiscordMessage.remove(rosterMember.id);
    }

    await trx.commit();

    /** FLUCH CACHE */
    deleteCacheByPattern(`?(admin:rosters:*|rosters:*|roster:${rosterId}*)`);
    /**END OF CACHE */

    emitter
      .of("/rosters")
      .to(`roster:${rosterId}`)
      .volatile.emit("remove:members", rosterMember, req.body.source);

    res.status(200).send(rosterMember);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:id/leave",
  method: "DELETE",
  middleware: [validators],
  handler: removeRosterMember,
};
