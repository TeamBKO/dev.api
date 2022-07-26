"use strict";
const Category = require("$models/Category");
const guard = require("express-jwt-permissions")();
const pick = require("lodash.pick");

const filterQuery = require("$util/filterQuery");
const { validate } = require("$util");
const { query } = require("express-validator");
const { VIEW_ALL_ADMIN, VIEW_ALL_CATEGORIES } = require("$util/policies");
const {
  getCachedSettings,
  getCachedQuery,
} = require("$services/redis/helpers");

const getAllCategories = async function (req, res, next) {
  // const recruitment = req.query.recruitment || null;
  const nextCursor = req.query.nextCursor;
  const filters = pick(req.query, [
    "limit",
    "exclude",
    "searchByName",
    "enable_recruitment",
  ]);

  const settings = await getCachedSettings();

  let categoryQuery = filterQuery(
    Category.query().orderBy("created_at", "desc").orderBy("id"),
    filters,
    "categories"
  );

  let categories;

  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    categories = await getCachedQuery(
      `categories:${next}`,
      categoryQuery.clone().cursorPage(nextCursor),
      settings.cache_categories_on_fetch,
      filters
    );
  } else {
    categories = await getCachedQuery(
      "categories:first",
      categoryQuery.clone().cursorPage(),
      settings.cache_categories_on_fetch,
      filters
    );
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
