"use strict";
const Form = require("$models/Form");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const filterQuery = require("$util/filterQuery");
const {
  getCachedQuery,
  getCachedSettings,
} = require("$services/redis/helpers");
const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, VIEW_ALL_FORMS } = require("$util/policies");
const pick = require("lodash.pick");

const select = [
  "forms.id",
  "forms.name",
  "forms.is_deletable",
  "forms.created_at",
  "forms.updated_at",
];

const getAllFormTemplates = async function (req, res, next) {
  const settings = await getCachedSettings();
  const nextCursor = req.query.nextCursor;

  const filters = pick(req.query, [
    "limit",
    "exclude",
    "searchByName",
    "rosters.id",
  ]);

  let formQuery = filterQuery(
    Form.query()
      .withGraphJoined("[created_by(defaultSelects)]")
      .select(select)
      .orderBy("forms.created_at", "desc")
      .orderBy("forms.id"),
    filters,
    "forms"
  );

  // let formQuery = Form.query()
  //   .select(select)
  //   .orderBy("created_at", "desc")
  //   .orderBy("id");
  let forms;

  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    forms = await getCachedQuery(
      `admin:forms:${next}`,
      formQuery.clone().cursorPage(nextCursor),
      settings.cache_forms_on_fetch,
      filters
    );
  } else {
    forms = await getCachedQuery(
      "admin:forms:first",
      formQuery.clone().cursorPage(),
      settings.cache_forms_on_fetch,
      filters
    );
  }

  // if (nextCursor) {
  //   forms = await formQuery.clone().cursorPage(nextCursor);
  // } else {
  //   forms = await formQuery.clone().cursorPage();
  // }
  console.log(forms);

  res.status(200).send(forms);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_FORMS]),
    validate([
      // query("isInitial").isBoolean().default(true),
      query("nextCursor")
        .optional()
        .isString()
        .customSanitizer((v) => sanitize(v)),
      query("prevCursor")
        .optional()
        .isString()
        .customSanitizer((v) => sanitize(v)),
      query("orderBy").optional().isAlphanumeric(),
      query("sortBy").optional().isAlphanumeric(),
    ]),
  ],
  handler: getAllFormTemplates,
};
