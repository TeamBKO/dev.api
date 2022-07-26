"use strict";
const Form = require("$models/Form");
const RosterFormField = require("$models/RosterFormField");
const RosterMember = require("$models/RosterMember");
const { raw, ref } = require("objection");

const dynamicColumnQuery = (field, req) => {
  let query = RosterFormField.query()
    .joinRelated("[form, field]")
    .where("field_id", field.id)
    .andWhere("form.roster_id", req.params.id)
    .andWhere("field.multiple", field.multiple);

  if (field.multiple) {
    // return query
    //   .with("answers", (qb) =>
    //     qb
    //       .select(
    //         raw(`*, jsonb_array_elements(answer->'value') AS ??)`, [
    //           field.alias,
    //         ])
    //       )
    //       .from("roster_form_fields")
    //   )
    //   .select(raw("??, COUNT (??) as members", ["answers", field.alias]))
    //   .from("answers")
    //   .debug()
    //   .groupBy(field.alias);

    return query
      .select(
        raw(
          "jsonb_array_elements(answer->'value') AS ??, count(answer->'value') as members",
          [field.alias]
        )
      )
      .groupBy(field.alias);
  }

  return query
    .select(
      raw(
        "??, count(*) as members, count(*) * 100.0 / sum(count(*)) over () as total",
        [ref("answer:value").as(field.alias)]
      )
    )
    .groupBy(ref("answer:value"));
};

const getRosterAnalytics = async (req, res, next) => {
  const rosterId = req.params.id;

  const { fields } = await Form.query()
    .withGraphJoined("[rosters, fields(useAsColumn)]")
    .where("rosters.id", rosterId)
    .first();

  const joinedOnDate = RosterMember.query()
    .select(
      raw("COUNT (id) AS members, to_char(created_at, 'YYYY-MM-DD') AS day")
    )
    .whereRaw(raw("created_at >= current_date - interval '30 day'"))
    .where("roster_id", rosterId)
    .groupBy("day")
    .orderBy("day");

  const memberComparison = RosterMember.query()
    .select(
      raw(
        "status, count(*) as members, count(*) * 100.0 / sum(count(*)) over () as total"
      )
    )
    .where("roster_id", rosterId)
    .groupBy("status");

  const queries = [
    joinedOnDate,
    memberComparison,
    fields.map((field) => dynamicColumnQuery(field, req)),
  ];

  const data = await Promise.all(queries.flat());

  console.log(data);

  res.status(200).send(data);
};

module.exports = {
  path: "/analytics/:id",
  method: "GET",
  handler: getRosterAnalytics,
};
