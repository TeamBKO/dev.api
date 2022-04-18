"use strict";
const Form = require("$models/Form");
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const getCache = require("$util/getCache");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const { param, query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_FORMS } = require("$util/policies");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .trim()
    .escape()
    .customSanitizer((v) => sanitize(v)),
]);

// const columns = [
//   "forms.id",
//   "description",
//   "rosters.name as name",
//   "rosters.id",
// ];

const select = ["id", "name", "banner"];

const getRecruitmentForm = async function (req, res, next) {
  let response = {};

  try {
    if (!req.query.edit) {
      const userAlreadySubmitted = await RosterMember.query()
        .withGraphFetched("roster(default)")
        .where("roster_id", req.params.id)
        .andWhere("member_id", req.user.id)
        // .andWhere((qb) => {
        //   qb.where("status", "pending").orWhere("status", "approved");
        // })
        .first();

      if (userAlreadySubmitted) {
        console.log("already submitted");
        return res.status(203).send({
          roster: userAlreadySubmitted.roster,
          message:
            "You've already submitted an application for this category. We'll get back to you with a respone soon.",
        });
      }
    }

    let { roster_form, ...roster } = await getCache(
      `r_form_${req.params.id}`,
      Roster.query()
        .withGraphFetched("roster_form(id).[fields(order)]")
        .where("id", req.params.id)
        .andWhere("enable_recruitment", true)
        .select(select)
        .first()
    );

    res.status(200).send({ form: roster_form, roster });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/roster/:id?",
  method: "GET",
  middleware: [validators],
  handler: getRecruitmentForm,
};
