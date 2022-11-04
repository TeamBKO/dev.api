module.exports = function (socket) {
  socket.on("join:roster", (id) => {
    console.log("joining roster %s", id);
    if (socket.user) {
      socket.join(`roster:${id}:user:${socket.user.id}`);
    }
    socket.join(`roster:${id}`);
  });

  socket.on("leave:roster", (id) => {
    console.log("leaving roster %s", id);
    if (socket.user) {
      socket.leave(`roster:${id}:user:${socket.user.id}`);
    }
    socket.leave(`roster:${id}`);
  });

  socket.on("error", (err) => console.log(err));
};
