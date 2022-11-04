"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const emitter = require("$services/redis/emitter");
const pick = require("lodash.pick");
const hasScope = require("$util/hasScope");
const { VIEW_ALL_ADMIN } = require("$util/policies");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const Joi = require("joi");

const schema = Joi.object({
  id: Joi.string().guid().sanitize().trim().required(),
  name: Joi.string().sanitize().trim().optional(),
  icon: Joi.string().sanitize().trim().optional(),
  enable_recruitment: Joi.boolean().optional(),
  show_fields_as_columns: Joi.boolean().optional(),
  apply_roles_on_approval: Joi.boolean().optional(),
  is_disabled: Joi.boolean().optional(),
  private: Joi.boolean().optional(),
  selectedForm: Joi.number().integer().optional(),
  roles: Joi.array().items(Joi.number().integer()),
  link_to_discord: Joi.boolean().optional(),
  assign_discord_roles_on_approval: Joi.boolean().optional(),
  applicant_form_channel_id: Joi.string().sanitize().optional(),
});

const generateGraph = (rosterId, body) => {
  const results = { id: rosterId };
  const keys = [
    "enable_recruitment",
    "auto_approve",
    "apply_roles_on_approval",
    "show_fields_as_columns",
    "private",
    "is_disabled",
    "assign_discord_roles_on_approval",
    "link_to_discord",
    "applicant_form_channel_id",
  ];

  keys.forEach((key) => {
    if (!isUndefined(body[key])) {
      Object.assign(results, { [key]: body[key] });
    }
  });

  if (!isUndefined(body.selectedForm)) {
    if (body.selectedForm) {
      Object.assign(results, { roster_form: { id: body.selectedForm } });
    } else {
      Object.assign(results, { roster_form: null });
    }
  }

  if (!isUndefined(body.roles)) {
    const roles = body.roles.length ? body.roles.map((id) => ({ id })) : [];
    Object.assign(results, { roles });
  }

  // if (body.roles) {
  //   Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  // }

  return results;
};

const processSocketRequest = async function (payload, cb) {
  const { id, ...body } = payload;

  const data = generateGraph(id, body);

  const columns = pick(payload, [
    "icon",
    "banner",
    "auto_approve",
    "enable_recruitment",
    "auto_approve",
    "apply_roles_on_approval",
    "show_fields_as_columns",
    "private",
    "is_disabled",
    "assign_discord_roles_on_approval",
    "link_to_discord",
    "applicant_form_channel_id",
  ]);

  const trx = await Roster.startTransaction();

  try {
    const roster = await Roster.query(trx).upsertGraph(data, {
      noDelete: true,
      unrelate: ["roles", "roster_form"],
      relate: ["roles", "roster_form"],
    });

    await trx.commit();

    let query = Roster.query()
      .select(["id", "name", "url", "updated_at", ...Object.keys(columns)])
      .withGraphFetched("[roles, roster_form(default).[fields(useAsColumn)]]")
      .where("id", roster.id)
      .first();

    const result = await query;

    deleteCacheByPattern(`?(rosters:*|roster:${query.id}*)`);

    this.to(`roster:${roster.id}`).emit("update:settings", result);

    this.of("/rosters-index").emit("update:roster", result);

    cb(result);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    cb(err);
  }
};

module.exports = async function (payload, cb) {
  const socket = this;

  const { error, value } = schema.validate(payload, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return cb({
      errors: Errors.INVALID_PAYLOAD,
      errorDetails: error.details,
    });
  }

  if (hasScope(socket.user, [VIEW_ALL_ADMIN])) {
    return processSocketRequest.call(this, value, cb);
  }

  const hasAccess = await RosterMember.query()
    .joinRelated("[rank.[permissions], permissions]")
    .where("roster_members.member_id", socket.user.id)
    .andWhere((qb) => {
      qb.where("permissions.can_edit_roster_details", true).orWhere(
        "rank:permissions.can_edit_roster_details",
        true
      );
    })
    .first();

  if (!hasAccess) {
    return cb({
      statusCode: 403,
      message: "Insufficient Permissions",
    });
  }

  processSocketRequest.call(this, value, cb);
};
