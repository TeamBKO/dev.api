"use strict";
/*** DEPENDENCIES ***/
const express = require("express");
const app = express();
const helmet = require("helmet");
const cors = require("cors");
const aws = require("aws-sdk");
const expressJwt = require("express-jwt");
const pino = require("express-pino-logger")();
const Settings = require("$models/Settings");
const { getCachedSettings } = require("$services/redis/helpers");

/*** SETUP S3 CONFIG ***/
aws.config.update({
  secretAccessKey: process.env.AWS_SECRET,
  accessKeyId: process.env.AWS_ACCESS_ID,
  region: process.env.AWS_REGION,
});

/** SETUP PG TO USE RANGE */
const pg = require("pg");
require("pg-range").install(pg);

const apiVersion = "/api";

const bootstrapApp = async () => {
  if (
    process.env.NODE_ENV === "debug" ||
    process.env.NODE_ENV === "development"
  ) {
    app.use(pino);
  }

  /** SETUP HELMET */
  app.use(helmet());

  /*** SETUP CORS ***/
  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Content-Range", "Content-Length", "Authorization"],
    })
  );

  /*** SETUP KNEX AND OBJECTION ***/
  require("./util/setupDB")();

  /*** SETUP AUTHENTICATION FOR ROUTES ***/
  app.use(
    expressJwt({
      secret: process.env.JWT_SECRET,
      isRevoked: require("$util/revokeToken.js"),
      algorithms: ["HS256"],
    }).unless({
      path: [
        "/",
        `${apiVersion}/auth/login`,
        `${apiVersion}/auth/refresh`,
        `${apiVersion}/auth/discord`,
        `${apiVersion}/auth/logout`,
        `${apiVersion}/users/register`,
        `${apiVersion}/users/activation`,
        `${apiVersion}/posts/testimonies`,
        /^\/api\/users\/password-reset(?:\/([^\/]+?))?\/?$/i,
        `${apiVersion}/users/resend/activation`,
        `${apiVersion}/social/discord/link`,
        `${apiVersion}/users/update/loggedout/password`,
        `${apiVersion}/settings`,
      ],
    })
  );

  /*** SETUP BODY PARSER ***/
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  /*** SETUP INDEX ROUTE ***/
  app.get("/", (req, res) => {
    res.status(200).send("HELLO WORLD");
  });

  /** SETUP ROUTES */
  app.use(apiVersion, require("./routes"));

  /** START BOT IF ENABLED */

  const client = require("./bot");
  const settings = await getCachedSettings();
  // const settings = await Settings.query().select("enable_bot").first();

  if (settings.enable_bot) {
    client.login(process.env.DISCORD_BOT_TOKEN);
  }

  /*** SETUP ERROR HANDLING ***/
  app.use(require("./middleware/errors"));

  return app;
};

module.exports = bootstrapApp;
