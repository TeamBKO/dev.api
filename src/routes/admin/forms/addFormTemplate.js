"use strict";
const Form = require("$models/Form");

const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { body } = require("express-validator");
const { buildQuery, validate } = require("$util");
const { VIEW_ALL_ADMIN, ADD_ALL_FORMS } = require("$util/policies");
const { transaction } = require("objection");

const validators = validate([
  body("details.name")
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("details.description")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  // body("fields.*.order").isNumeric(),
  // body("fields.*.type").isAlphanumeric().trim().escape(),
  // body("fields.*.optional").isBoolean(),
  body("fields.*.value")
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),

  // body("page").optional().isNumeric(),
  // body("limit").optional().isNumeric(),
  // body("orderBy").optional().isString().trim().escape(),
  // body("sortBy").optional().isString().trim().escape(),
]);

const insertFn = (id, details, fields) => {
  const result = { creator_id: id };

  if (details && Object.keys(details).length) {
    Object.assign(result, details);
  }

  if (fields && fields.length) {
    Object.assign(result, {
      fields: fields.map((field) => {
        field.options =
          field.options && field.options.length
            ? JSON.stringify(field.options)
            : null;
        return field;
      }),
    });
  }

  return result;
};

const select = [
  "forms.id",
  "forms.name",
  "forms.is_deletable",
  "forms.created_at",
  "forms.updated_at",
];

const addForm = async function (req, res, next) {
  const { details, fields } = req.body;

  const insert = insertFn(req.user.id, details, fields);

  const trx = await Form.startTransaction();

  try {
    const { id } = await Form.query(trx).insertGraph(insert);

    await trx.commit();

    const form = await Form.query()
      .withGraphFetched("created_by(defaultSelects)")
      .select(select)
      .where("forms.id", id)
      .first();

    console.log(form);
    res.status(200).send(form);
  } catch (err) {
    console.log(err);
    await trx.rollback();
  }
};

module.exports = {
  path: "/",
  method: "POST",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, ADD_ALL_FORMS]),
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validators,
  ],
  handler: addForm,
};
