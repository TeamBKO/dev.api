"use strict";
const redis = require("$services/redis");
const { verifyToken } = require("$util");
module.exports = async function verifySocketToken(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) {
    next(new Error("UNAUTHORIZED"));
  }
  try {
    const user = await verifyToken(token, process.env.JWT_REFRESH_SECRET);

    if (await redis.exists(`blacklist:${user.jti}`)) {
      next(new Error("Token revoked."));
    }

    socket.user = user;
    socket.auth = true;
    next();
  } catch (err) {
    next(err);
  }
};
