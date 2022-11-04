"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const emitter = require("$services/redis/emitter");
const redis = require("$services/redis");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const {
  getCachedQuery,
  getCachedSettings,
} = require("$services/redis/helpers");
const { NotFoundError } = require("objection");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function generateCustomId(status, applicantId, rosterId) {
  return `form:${status}:${applicantId}:${rosterId}`;
}

/**
 * Process the interaction from discord.
 * @param {Object} interaction The object holding all the interaction data
 */
async function processInteraction(interaction) {
  const customId = interaction.customId.split(":");
  const channelId = interaction.channelId;
  const embed = interaction.message.embeds[0].data;
  const status = customId[1];
  const applicantId = customId[2];
  const rosterId = customId[3];

  console.log(interaction);

  const select = [
    "roster_members.id as id",
    "member.username as username",
    "member.avatar as avatar",
    "roster_members.status",
    "roster_members.approved_on",
  ];

  const settings = await getCachedSettings();

  let rosterSettings;

  try {
    rosterSettings = await getCachedQuery(
      `roster:${rosterId}:settings`,
      Roster.query().where("id", rosterId).first().throwIfNotFound(),
      settings.cache_rosters_on_fetch,
      undefined,
      180
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      interaction.update();
      return;
    }
  }

  if (channelId !== rosterSettings.applicant_form_channel_id) {
    return;
  }

  // if (rosterSettings.require_discord_authentication) {
  //   const rosterMember = RosterMember.query().where("discord_id");
  // }

  if (status === "removed") {
    try {
      const embeded = {
        color: 0xff3348,
        description: `MEMBER REMOVED.`,
        author: {
          name: embed.author.name,
          icon_url: embed.author.icon_url,
        },

        timestamp: new Date(),
      };

      const result = await RosterMember.query()
        .joinRelated("member")
        .where("roster_members.id", applicantId)
        .del()
        .returning("roster_members.id", "status", "member.username as username")
        .first()
        .throwIfNotFound();

      deleteCacheByPattern(
        `?(roster:${rosterId}|rosters*|roster:${rosterId}:members*)`
      );

      emitter
        .of("/rosters")
        .to(`roster:${rosterId}`)
        .volatile.emit("remove:members", result, result.status);

      interaction.update({ embeds: [embeded], components: [] });
    } catch (err) {
      if (err instanceof NotFoundError) {
        interaction.update({ embeds: [embeded], components: [] });
      }
    }

    return;
  }

  try {
    // embed.color =
    //   status === "approved" ? ButtonStyle.Success : ButtonStyle.Secondary;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(generateCustomId("removed", applicantId, rosterId))
        .setLabel("REMOVE")
        .setStyle(ButtonStyle.Danger)
    );

    await RosterMember.query()
      .patch({ status, approved_on: new Date().toISOString() })
      .where("id", applicantId);

    const member = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched("[rank(default), form(default).fields(useAsColumn)]")
      .select(select)
      .where("roster_members.id", applicantId)
      .first();

    deleteCacheByPattern(
      `?(roster:${rosterId}|rosters*|roster:${rosterId}:members*)`
    );

    embed.description = `Status: ${status.toUpperCase()}`;
    emitter
      .of("/rosters")
      .to(`roster:${rosterId}`)
      .volatile.emit("update:members:status", member, "pending");

    interaction.update({ embeds: [embed], components: [row] });
  } catch (err) {
    console.log(err);
  }
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isButton()) return;
    const prefix = interaction.customId.split(":")[0];

    switch (prefix) {
      case "form":
        processInteraction(interaction);
        break;
      default:
        break;
    }
  },
};
