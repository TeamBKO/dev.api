"use strict";
const { getCachedSettings } = require("$services/redis/helpers");

const getSettings = async (req, res) => {
  // let [settings, policies] = await Promise.all([
  //   Settings.query().where("id", 1).select(select).first(),
  //   Policies.query().select("action", "target", "resource"),
  // ]);

  // policies = policies.reduce((output, { action, target, resource }) => {
  //   const key = `${action.toUpperCase()}_${target.toUpperCase()}_${resource.toUpperCase()}`;
  //   const value = `${action}:${target}:${resource}`;

  //   output[key] = value;
  //   return output;
  // }, {});

  const settings = await getCachedSettings();

  res.status(200).send(settings);
};

module.exports = {
  path: "/",
  method: "GET",
  handler: getSettings,
};
