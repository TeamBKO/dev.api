"use strict";
const RosterForm = require("$models/RosterForm");

const guard = require("express-jwt-permissions")();

const { query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, DELETE_ALL_FORMS } = require("$util/policies");

const removeRosterForm = async function (req, res, next) {
  const trx = await RosterForm.startTransaction();

  try {
    const deleted = await RosterForm.query(trx)
      .whereIn("id", req.query.ids)
      .del()
      .returning("id");

    await trx.commit();

    res.status(200).send(deleted);
  } catch (err) {
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/forms",
  method: "DELETE",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    guard.check([VIEW_ALL_ADMIN, DELETE_ALL_FORMS]),
    validate([query("ids.*").isUUID()]),
  ],
  handler: removeRosterForm,
};
