"use strict";
const DiscordApplicantForm = require("$models/DiscordApplicantForm");
const DiscordMessage = require("$services/discord/classes/DiscordMessage");

async function updateDiscordMessages(ids, status) {
  let discord = await DiscordApplicantForm.query()
    .where("applicant_id", ids)
    .first();

  try {
    await new DiscordMessage().updateStatus(
      discord.message_id,
      discord.channel_id,
      status
    );
  } catch (err) {
    throw err;
  }
}

module.exports = updateDiscordMessages;
