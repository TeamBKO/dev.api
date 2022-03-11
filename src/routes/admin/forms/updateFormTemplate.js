"use strict";
const Form = require("$models/Form");
const Field = require("$models/Field");
const sanitize = require("sanitize-html");
const guard = require("express-jwt-permissions")();
const redis = require("$services/redis");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, UPDATE_ALL_FORMS } = require("$util/policies");

const validators = validate([
  param("id").isNumeric().toInt(10),
  body("details.name")
    .optional()
    .isAlphanumeric()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("details.category_id").optional().isNumeric(),
  body("details.description")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("added.*.optional").optional().isBoolean(),
  body("added.*.order").optional().isNumeric(),
  body("added.*.value")
    .optional()
    .isString()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("added.*.type")
    .optional()
    .isIn(["textfield", "textarea", "multiple", "select", "checkbox"]),
  body("update.*.id").optional().isNumeric(),
  body("update.*.value")
    .optional()
    .isAlphanumeric()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
  body("update.*.optional").optional().isBoolean(),
  body("update.*.order").optional().isNumeric(),
  body("update.*.type")
    .optional()
    .isIn(["textfield", "textarea", "multiple", "select", "checkbox"]),
  body("remove.*").optional().isNumeric(),
]);

const consoleRequest = (req, res, next) => {
  console.log(req.body);
  next();
};

const upsert = (id, details, fields) => {
  let result = { id };

  if (details && Object.keys(details).length) {
    Object.assign(result, details);
  }

  if (fields && fields.length) {
    fields = fields.map((field) => {
      if (field.options) {
        if (field.options.length) {
          field.options = JSON.stringify(field.options);
        } else {
          field.options = null;
        }
      }

      return field;
    });

    Object.assign(result, { fields });
  }
  return result;
};

const updateForm = async function (req, res, next) {
  const { details, fields } = req.body;

  const up = upsert(req.params.id, details, fields);
  const trx = await Form.startTransaction();

  try {
    const { id } = await Form.query(trx).upsertGraph(up);

    await redis.del(`form_${id}`);

    await trx.commit();

    const form = await Form.query()
      .where("id", id)
      .select(uniq(["name", ...Object.keys(details)]))
      .first();

    res.status(200).send(form);
  } catch (err) {
    console.log(err);
    next(err);
  }

  // const form = await Form.transaction(async (trx) => {
  //   let result = await Form.query(trx).upsertGraph(up).first().returning("*");

  //   if (remove && remove.length) {
  //     await Field.query(trx).whereIn("id", remove).del().returning("*");
  //     if (!details && !added && !update) {
  //       result = await Form.query(trx)
  //         .patch({
  //           updated_at: new Date().toISOString(),
  //         })
  //         .returning("*");
  //     }
  //   }

  //   await redis.del(`form_${req.params.id}`);

  //   // return pick(result, [
  //   //   "name",
  //   //   "status",
  //   //   "category",
  //   //   "created_at",
  //   //   "updated_at",
  //   // ]);

  //   return result;
  // });

  res.status(200).send(form);
};

module.exports = {
  path: "/:id",
  method: "PATCH",
  middleware: [
    consoleRequest,
    guard.check([VIEW_ALL_ADMIN, UPDATE_ALL_FORMS]),
    validators,
  ],
  handler: updateForm,
};
