"use strict";
const { verifyToken } = require("$util");
module.exports = async function verifySocketToken(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) {
    next(new Error("UNAUTHORIZED"));
  }
  try {
    const user = await verifyToken(token, process.env.JWT_REFRESH_SECRET);
    socket.user = user;
    socket.auth = true;
    next();
  } catch (err) {
    next(err);
  }
  // try {
  //   let verified;
  //   if (token) {
  //     verified = await verifyToken(token, process.env.JWT_REFRESH_SECRET);
  //   }

  //   if (!verified) {
  //     socket.leave(`user:${verified.id}`);
  //     const error = new Error("UNAUTHORIZED");
  //     error.data = { content: "Please retry later." };
  //     return next(error);
  //   }

  //   socket.user = verified;
  //   socket.auth = true;
  //   next();
  // } catch (err) {
  //   return next(err);
  // }
};
