"use strict";
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const DiscordMessage = require("$services/discord/classes/DiscordMessage");
const Settings = require("$models/Settings");
const Joi = require("$services/sockets/schemes");

const { deleteCacheByPattern } = require("$services/redis/helpers");

const schema = Joi.object({
  id: Joi.string()
    .sanitize()
    .trim()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .optional(),
  rosterId: Joi.string()
    .sanitize()
    .trim()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .required(),
  ids: Joi.array
    .items(
      Joi.string()
        .sanitize()
        .guid({
          version: ["uuidv4", "uuidv5"],
        })
    )
    .optional(),
  source: Joi.string().sanitize().required(),
});

module.exports = async function (payload, cb) {
  const socket = this;

  const { error, value } = schema.validate(payload, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return cb({
      errors: Errors.INVALID_PAYLOAD,
      errorDetails: error.details,
    });
  }

  const { id, rosterId, ids, source } = value;

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

  let query = RosterMember.query(trx)
    .where("is_deletable", true)
    .joinRelated("member(defaultSelects)")
    .del()
    .returning(["roster_members.id", "status", "member.username as username"]);

  query = id
    ? query.where("roster_members.id", id).first()
    : query.whereIn("roster_members.id", ids);

  const trx = await RosterMember.startTransaction();

  try {
    const items = await query;

    if (discordBotEnabled) {
      await DiscordMessage.remove(id);
    }

    await trx.commit();

    /** FLUCH CACHE */
    deleteCacheByPattern(`?(admin:rosters:*|rosters:*|roster:${rosterId}*)`);
    /**END OF CACHE */

    socket
      .to(`roster:${rosterId}`)
      .volatile.emit("remove:members", items, source);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    cb(err);
  }
};
