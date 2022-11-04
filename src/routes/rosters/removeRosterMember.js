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
  param("rosterId")
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  query("ids.*")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

const removeRosterMember = async function (req, res, next) {
  const hasAccess = await RosterMember.query()
    .select("roster_members.roster_id")
    .joinRelated("[permissions, rank.[permissions]]")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_remove_members", true)
        .orWhere("rank:permissions.can_remove_members", true)
    )
    .first();

  if (!hasAccess) {
    return res.status(403).send("Insufficient privilages.");
  }

  const rosterId = req.params.rosterId;

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
  let query = RosterMember.query(trx)
    .where("is_deletable", true)
    .joinRelated("member(defaultSelects)")
    .del()
    .returning(["roster_members.id", "status", "member.username as username"]);

  query = req.params.id
    ? query.where("roster_members.id", req.params.id).first()
    : query.whereIn("roster_members.id", req.body.ids);

  try {
    const items = await query;

    if (discordBotEnabled) {
      await DiscordMessage.remove(req.params.id);
    }

    await trx.commit();

    /** FLUCH CACHE */
    deleteCacheByPattern(`?(admin:rosters:*|rosters:*|roster:${rosterId}*)`);
    /**END OF CACHE */

    emitter
      .of("/rosters")
      .to(`roster:${rosterId}`)
      .volatile.emit("remove:members", items, req.body.source);

    res.status(200).send(items);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:rosterId/members/:id?",
  method: "DELETE",
  middleware: [validators],
  handler: removeRosterMember,
};
