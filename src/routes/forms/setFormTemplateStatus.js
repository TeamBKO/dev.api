"use strict";
const Form = require("./models/Form");
const guard = require("express-jwt-permissions")();
const { body, param } = require("express-validator");
const { validate } = require("$util");

const setFormStatus = async function (req, res, next) {
  try {
    const check = await Form.query()
      .where("id", req.params.id)
      .select(["status", "id", "category_id"])
      .first()
      .throwIfNotFound();

    const form = await Form.transaction(async (trx) => {
      await Form.query(trx)
        .patch({ status: null })
        .where({ status: true, category_id: check.category_id });
      const result = await Form.query(trx)
        .patch({ status: !check.status })
        .where("id", check.id)
        .first()
        .returning(["id", "category_id", "status"]);

      return result;
    });

    console.log(form);

    res.status(200).send({ form });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/status/:id",
  method: "PUT",
  middleware: [
    // guard.check("users:view"),
    validate([
      body("category_id").isNumeric(),
      body("status").isBoolean(),
      param("id").isNumeric(),
    ]),
  ],
  handler: setFormStatus,
};
