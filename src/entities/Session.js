"use strict";
const DynamoDB = require("aws-sdk/clients/dynamodb");
const DocumentClient = new DynamoDB.DocumentClient();

const { Table, Entity } = require("dynamodb-toolbox");

const Sessions = new Table({
  name: "sessions",
  sortKey: "sk",
  DocumentClient,
});

const Session = new Entity({
  name: "Session",
  table: Sessions,
  attributes: {
    id: { partitionKey: true },
    sk: { hidden: true, sortKey: true },
    session_id: { type: "string", alias: "sid" },
    user_id: { type: "number", alias: "uid" },
    exp: { type: "number" },
  },
});

module.exports = Session;
