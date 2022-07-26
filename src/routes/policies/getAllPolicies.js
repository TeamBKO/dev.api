"use strict";
const Policy = require("$models/Policy");
const { getCachedQuery } = require("$services/redis/helpers");

const getAllPolicies = async function (req, res, next) {
  const policies = await getCachedQuery(
    "policies",
    Policy.query(),
    true,
    undefined,
    false
  );

  res.status(200).send(policies);
};

module.exports = {
  path: "/",
  method: "GET",
  handler: getAllPolicies,
};
