"use strict";
const aws = require("aws-sdk");

module.exports = async function (address, template, templateData) {
  const params = {
    Destination: {
      ToAddresses: [address],
    },
    Source: "NOREPLY <noreply@blackout.team>",
    Template: template,
    TemplateData: JSON.stringify(templateData),
    ReplyToAddresses: ["noreply@blackout.team"],
  };

  try {
    await new aws.SES().sendTemplatedEmail(params).promise();
  } catch (err) {
    console.error(err, err.stack);
    return Promise.reject(err);
  }
};
