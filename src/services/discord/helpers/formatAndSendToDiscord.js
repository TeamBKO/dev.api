"use strict";
const client = require("$root/src/bot");
const Discord = require("discord.js");

const formatAndSendToDiscord = (form, channelID) => {
  let { applicant, fields } = form;

  let title = `${applicant.username}'s Application`;

  let status = applicant.status;

  let embedFields = fields.map((field, idx) => {
    const answer = Array.isArray(field.answer)
      ? field.answer.join(" ,")
      : field.answer;

    const question = field.value;

    return { name: question, value: answer };
  });

  const embeded = {
    color: 0x0099ff,
    title,
    description: `Status: ${status.toUpperCase()}`,
    author: {
      name: applicant.username,
      icon_url: applicant.avatar,
    },
    fields: embedFields,
    timestamp: new Date(),
  };

  client.channels.cache.get(channelID).send({ embeds: [embeded] });
};

module.exports = formatAndSendToDiscord;
