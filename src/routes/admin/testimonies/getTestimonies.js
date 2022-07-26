"use strict";
const Testimony = require("$models/Testimony");

const guard = require("express-jwt-permissions")();

const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const select = ["id", "author", "avatar", "text"];

const getAllTestimonies = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;

  const testimonyQuery = Testimony.query()
    .select(select)
    .orderBy("created_at", "desc")
    .orderBy("id")
    .limit(50);

  let query;

  if (nextCursor) {
    query = await testimonyQuery.clone().cursorPage(nextCursor);
  } else {
    query = await testimonyQuery.clone().cursorPage();
  }

  res.status(200).send(query);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN]),
    validate([query("nextCursor").optional().isString().escape().trim()]),
  ],
  handler: getAllTestimonies,
};
