"use strict";
/*** REGISTER MODULES ***/
require("module-alias/register");

/*** SETUP AND STARTUP UP SERVER ***/
const bootstrapApp = require("./app");
const http = require("http");
const redis = require("$services/redis");
const sub = redis.duplicate();

const verifySocketToken = require("$services/sockets/verifySocketToken");
const authenticateSocketClient = require("$services/sockets/authenticateSocketClient");
const onSignal = require("$util/onSignal");

const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createTerminus } = require("@godaddy/terminus");

const startServer = async function () {
  const server = http.createServer(await bootstrapApp());

  const io = new Server(server, {
    cors: {
      origins: ["*"],
    },
  });

  io.adapter(createAdapter(redis, sub));

  const indexAdapter = io.of("/index").adapter;

  io.of("/index")
    .use(verifySocketToken)
    .on("connection", authenticateSocketClient);

  indexAdapter.on("create-room", (room) => {
    console.log(`room ${room} was created.`);
  });

  indexAdapter.on("join-room", (room, id) =>
    console.log(`socket ${id} has joined room ${room}`)
  );

  server.listen(process.env.PORT || 3000, (err) => {
    console.log("\u2713", `Server running at ${process.env.PORT}...`);
  });

  createTerminus(server, {
    signals: ["SIGTERM"],
    onSignal: onSignal.bind(null, server, redis, io, require("../knex")),
  });
};

startServer();
