"use strict";
const Testimony = require("$models/Testimony");
const { query } = require("express-validator");
const { validate } = require("$util");

const columns = ["id", "author", "avatar", "text"];

const getTestimonies = async function (req, res) {
  const prevCursor = req.query.previous,
    nextCursor = req.query.next;

  const testimonies = Testimony.query()
    .orderBy("id")
    .select(columns)
    .limit(req.query.limit || 8);

  let query;

  if (nextCursor) {
    query = await testimonies.clone().cursorPage(nextCursor);
  } else if (prevCursor) {
    query = await testimonies.clone().previousCursorPage(prevCursor);
  } else {
    query = await testimonies.clone().cursorPage();
  }

  console.log(query);

  res.status(200).send(query);
};

module.exports = {
  path: "/testimonies",
  method: "GET",
  middleware: [
    validate([query("nextCursor").optional().isString().escape().trim()]),
  ],
  handler: getTestimonies,
};
