"use strict";
const Category = require("$models/Category");
const guard = require("express-jwt-permissions")();
const { query } = require("express-validator");
const filterQuery = require("$util/filterQuery");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_CATEGORIES } = require("$util/policies");
const pick = require("lodash.pick");

const getAllCategories = async function (req, res, next) {
  // const recruitment = req.query.recruitment || null;
  const nextCursor = req.query.nextCursor;
  const filters = pick(req.query, [
    "limit",
    "exclude",
    "searchByName",
    "enable_recruitment",
  ]);

  let query = filterQuery(
    Category.query().orderBy("created_at", "desc").orderBy("id"),
    req.query.filters,
    "categories"
  );

  let categories;

  if (nextCursor) {
    categories = await query.clone().cursorPage(nextCursor);
  } else {
    categories = await query.clone().cursorPage();
  }

  res.status(200).send(categories);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_CATEGORIES]),
    validate([query("nextCursor").optional().isString().trim().escape()]),
  ],
  handler: getAllCategories,
};
