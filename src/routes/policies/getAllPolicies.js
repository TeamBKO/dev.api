"use strict";
const Policy = require("$models/Policy");
const { query } = require("express-validator");
const { validate } = require("$util");

const getAllPolicies = async function (req, res, next) {
  const policies = await Policy.query();

  res.status(200).send(policies);
};

module.exports = {
  path: "/",
  method: "GET",

  handler: getAllPolicies,
};
