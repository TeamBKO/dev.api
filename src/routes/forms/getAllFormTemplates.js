"use strict";
const Form = require("$models/Form");

const sanitize = require("sanitize-html");

const { query } = require("express-validator");
const { validate } = require("$util");

const select = [
  "forms.id",
  "forms.name",
  "forms.is_deletable",
  "forms.created_at",
  "forms.updated_at",
];

const getAllForms = async function (req, res, next) {
  const nextCursor = req.query.nextCursor;

  let formQuery = Form.query()
    .select(select)
    .withGraphFetched("created_by(defaultSelects)")
    .orderBy("created_at", "desc")
    .orderBy("id")
    .limit(50);

  let forms;

  if (nextCursor) {
    forms = await formQuery.clone().cursorPage(nextCursor);
  } else {
    forms = await formQuery.clone().cursorPage();
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
