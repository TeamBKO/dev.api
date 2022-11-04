"use strict";
const client = require("$root/src/bot");
const DiscordApplicantForm = require("$models/DiscordApplicantForm");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RESTJSONErrorCodes,
} = require("discord.js");

class DiscordMessage {
  constructor() {
    this.messsage = null;
    this.embed = null;
    this.applicantId = null;
    this.formId = null;
    this.rosterId = null;
  }

  setForm(form) {
    let { applicant, fields } = form;

    let title = `${applicant.member.username}'s Application`;

    let status = applicant.status;

    let embedFields = fields.map((field) => {
      const answer = Array.isArray(field.answer.value)
        ? field.answer.value.join(" ,")
        : field.answer.value;

      const question = field.value;

      return { name: question, value: answer };
    });

    const embeded = {
      color: 0x0099ff,
      title,
      description: `Status: ${status.toUpperCase()}`,
      author: {
        name: applicant.member.username,
        icon_url: applicant.member.avatar,
      },
      fields: embedFields,
      timestamp: new Date().toISOString(),
    };

    this.embed = embeded;
    this.applicantId = applicant.id;
    this.formId = form.id;
    this.rosterId = form.roster_id;

    return this;
  }

  async send(channelId, id) {
    try {
      const customId = (status) =>
        `form:${status}:${this.applicantId}:${this.rosterId}`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId("approved"))
          .setLabel("APPROVE")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(customId("rejected"))
          .setLabel("REJECT")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(customId("removed"))
          .setLabel("REMOVE")
          .setStyle(ButtonStyle.Danger)
      );

      const message = await client.channels.cache
        .get(channelId)
        .send({ embeds: [this.embed], components: [row] });

      const data = {
        channel_id: message.channelId,
        guild_id: message.guildId,
        message_id: message.id,
        applicant_id: this.applicantId,
        roster_member_form_id: this.formId,
      };

      const trx = await DiscordApplicantForm.startTransaction();

      if (id) {
        Object.assign(data, { id });
      }

      try {
        await DiscordApplicantForm.query(trx).upsertGraph(data);

        await trx.commit();
      } catch (err) {
        console.log(err);
        await trx.rollback();
        message.delete();
      }
    } catch (err) {
      throw err;
    }

    return this;
  }

  async fetch(channelId, messageId) {
    try {
      this.message = await client.channels.cache
        .get(channelId)
        .messages.fetch(messageId);
    } catch (err) {
      throw err;
    }

    return this;
  }

  static async delete(id) {
    try {
      const form = await DiscordApplicantForm.query()
        .select(["channel_id", "message_id"])
        .where("applicant_id", id)
        .first();

      const message = await client.channels.cache
        .get(form.channel_id)
        .messages.fetch(form.message_id);

      message.delete();
    } catch (err) {
      throw err;
    }

    return this;
  }

  /**
   *
   * @param {*} messageId The snowflake id of the discord message to fetch.
   * @param {*} from The id of the channel the message currently resides in.
   * @param {*} to The id of the channel the message is going to be "moved" to.
   * @param {*} status The change in the status for the applicant to be applied.
   */

  async updateStatus(messageId, channelId, status) {
    try {
      const message = await client.channels.cache
        .get(channelId)
        .messages.fetch(messageId);

      message.embeds[0].data.description = `Status: ${status.toUpperCase()}`;

      await message.edit({ embeds: [message.embeds[0].data] });
    } catch (err) {
      if (err.code === RESTJSONErrorCodes.UnknownMessage) {
        await DiscordApplicantForm.query()
          .where("message_id", messageId)
          .delete();
      } else {
        throw err;
      }
    }

    return this;
  }

  static async remove(id) {
    try {
      const form = await DiscordApplicantForm.query()
        .select(["channel_id", "message_id"])
        .where("applicant_id", id)
        .first();

      const message = await client.channels.cache
        .get(form.channel_id)
        .messages.fetch(form.message_id);

      const messageEmbed = message.embeds[0].data;

      const embeded = {
        color: 0xff3348,
        description: `MEMBER REMOVED.`,
        author: {
          name: messageEmbed.author.name,
          icon_url: messageEmbed.author.icon_url,
        },

        timestamp: new Date(),
      };

      message.edit({ embeds: [embeded], components: [] });
    } catch (err) {
      if (err.code === RESTJSONErrorCodes.UnknownMessage) {
        await DiscordApplicantForm.query()
          .where("message_id", messageId)
          .delete();
      } else {
        throw err;
      }

      throw err;
    }

    return this;
  }

  edit() {
    this.message.edit({ embeds: [this.embed] });
    this.message = null;
    this.embed = null;
    return this;
  }

  clear() {
    this.message = null;
    this.applicantId = null;
    this.formId = null;
    this.embed = null;

    return this;
  }
}

module.exports = DiscordMessage;
