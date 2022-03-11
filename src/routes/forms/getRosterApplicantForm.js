"use strict";
const Form = require("$models/Form");
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const getCache = require("$util/getCache");
const guard = require("express-jwt-permissions")();
const { param, query } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_FORMS } = require("$util/policies");

const validators = validate([param("id").optional().isUUID()]);

// const columns = [
//   "forms.id",
//   "description",
//   "rosters.name as name",
//   "rosters.id",
// ];

const select = ["id", "name"];

const getRecruitmentForm = async function (req, res, next) {
  let response = {};

  let roster_id;

  try {
    const rosters = await Roster.query()
      .where("enable_recruitment", true)
      .andWhere("private", false)
      .select(["id", "name"])
      .cursorPage();

    if (!rosters.results.length) {
      return res.status(200).send({ empty: true });
    }

    if (!req.params.id) {
      if (rosters.results && rosters.results.length) {
        roster_id = rosters.results[0].id;
        Object.assign(response, { roster_id });
      }
    } else {
      roster_id = req.params.id;
    }

    const userAlreadySubmitted = await RosterMember.query()
      .where("roster_id", roster_id)
      .andWhere("member_id", req.user.id)
      .andWhere((qb) => {
        qb.where("status", "pending").orWhere("status", "approved");
      })
      .first();

    if (userAlreadySubmitted) {
      return res.status(203).send({
        rosters,
        roster_id,
        message:
          "You've already submitted an application for this category. We'll get back to you with a respone soon.",
      });
    }

    // Object.assign(response, {
    //   form: await getCache(
    //     `r_form_${roster_id}`,
    //     Form.query()
    //       .withGraphJoined("[rosters(default), fields(order)]")
    //       .where("rosters.id", roster_id)
    //       .andWhere("rosters.enable_recruitment", true)
    //       .select(columns)
    //       .first()
    //   ),
    // });

    let { roster_form, ...roster } = await getCache(
      `r_form_${roster_id}`,
      Roster.query()
        .withGraphFetched("roster_form(id).[fields(order)]")
        .where("id", roster_id)
        .andWhere("enable_recruitment", true)
        .select(select)
        .first()
    );

    response = Object.assign(response, { form: roster_form, roster, rosters });

    console.log(response);

    res.status(200).send(response);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports = {
  path: "/roster/:id?",
  method: "GET",
  middleware: [guard.check([VIEW_ALL_FORMS]), validators],
  handler: getRecruitmentForm,
};
