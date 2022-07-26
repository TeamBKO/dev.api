"use strict";
const Form = require("$models/Form");
const sanitize = require("sanitize-html");

const { query } = require("express-validator");
const { validate } = require("$util");
const {
  getCachedSettings,
  getCachedQuery,
} = require("$services/redis/helpers");

const select = [
  "forms.id",
  "forms.name",
  "forms.is_deletable",
  "forms.created_at",
  "forms.updated_at",
];

const getAllForms = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;
  const filters = {};

  const settings = await getCachedSettings();

  let formQuery = Form.query()
    .select(select)
    .withGraphFetched("created_by(defaultSelects)")
    .orderBy("created_at", "desc")
    .orderBy("id")
    .limit(50);

  let forms;

  if (nextCursor) {
    const next = nextCursor.split(".")[0];
    forms = await getCachedQuery(
      `forms:${next}`,
      formQuery.clone().cursorPage(nextCursor),
      settings.cache_forms_on_fetch,
      filters
    );
  } else {
    forms = await getCachedQuery(
      "forms:first",
      formQuery.clone().cursorPage(),
      settings.cache_forms_on_fetch,
      filters
    );
  }

  console.log(forms);

  res.status(200).send(forms);
};

module.exports = {
  path: "/",
  method: "GET",
  middleware: [
    validate([
      query("nextCursor")
        .optional()
        .isString()
        .customSanitizer((v) => sanitize(v)),
      query("prevCursor")
        .optional()
        .isString()
        .customSanitizer((v) => sanitize(v)),
    ]),
  ],
  handler: getAllForms,
};
