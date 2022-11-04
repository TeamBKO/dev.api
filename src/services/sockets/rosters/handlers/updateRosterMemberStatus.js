"use strict";
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const Settings = require("$models/Settings");
const User = require("$models/User");
const massageMemberData = require("$util/massageMemberData");
const updateDiscordMessages = require("$services/discord/helpers/updateDiscordMessages");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const Joi = require("../schemes");

const schema = Joi.object({
  id: Joi.string()
    .sanitize()
    .trim()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .optional(),
  rosterId: Joi.string()
    .sanitize()
    .trim()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .required(),
  members: Joi.array
    .items(
      Joi.object({
        id: Joi.string()
          .sanitize()
          .guid({
            version: ["uuidv4", "uuidv5"],
          }),
        userID: Joi.number().integer().optional(),
      })
    )
    .optional(),
  userID: Joi.number().integer().optional(),
  status: Joi.string()
    .sanitize()
    .trim()
    .pattern(/pending|approved|rejected/),
  source: Joi.string().sanitize().required(),
});

const graphFn = (id, status) => {
  const result = {
    id: id,
  };

  if (status) {
    Object.assign(result, { status });
    if (status === "approved") {
      Object.assign(result, { approved_on: new Date().toISOString() });
    }
  }

  return result;
};

const select = [
  "roster_members.id as id",
  "member.username as username",
  "member.avatar as avatar",
  "roster_members.status",
  "roster_members.approved_on",
];

const hasAccess = async function (id, cb) {
  const accessQuery = RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select("roster_members.roster_id")
    .where("roster_members.member_id", id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  const settingsQuery = Settings.query().select("enable_bot").first();

  const [hasAccess, settings] = await Promise.all([accessQuery, settingsQuery]);

  if (!hasAccess) {
    return cb({
      error: "Invalid Access.",
      errorDetails: "User lacks necessary permissions.",
    });
  }

  return { hasAccess, settings };
};

const updateSingleRosterMemberStatus = async function (
  socket,
  value,
  settings,
  cb
) {
  const { id, userID, rosterId, status } = value;

  let roster = await Roster.query()
    .withGraphFetched("[roles(default)]")
    .select([
      "apply_roles_on_approval",
      "link_to_discord",
      "applicant_form_channel_id",
    ])
    .where("id", rosterId)
    .first();

  const upsert = graphFn(id, status);

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(upsert);

    if (roster.apply_roles_on_approval && roster.roles && roster.roles.length) {
      await User.relatedQuery("roles", trx)
        .for(userID)
        .relate(roster.roles.map(({ id }) => id));
    }

    /** Update the form information on discord if setting is enabled. */
    if (settings.enable_bot) {
      if (roster.link_to_discord) {
        await updateDiscordMessages(id, status);
      }
    }
    await trx.commit();

    let results = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched("[rank(default), forms(default).fields(useAsColumn)]")
      .select(select)
      .where("roster_members.id", id)
      .first();

    deleteCacheByPattern(`?(admin:rosters:*|rosters:*|roster:${rosterId}*`);

    results = massageMemberData(results);

    socket
      .to(`roster:${rosterId}`)
      .volatile.emit("update:members:status", results, value.source);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    cb(err);
  }
};

module.exports = async function (payload, cb) {
  const socket = this;

  const { hasAccess, settings } = await hasAccess(socket.user.id);

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

  if (value.id) {
    return updateSingleRosterMemberStatus(socket, value, settings);
  }

  const { status, members, rosterId } = value;

  let roster = await Roster.query()
    .withGraphFetched("[roles(default)]")
    .select([
      "apply_roles_on_approval",
      "display_applicant_forms_on_discord",
      "approved_applicant_channel_id",
      "rejected_applicant_channel_id",
    ])
    .where("id", rosterId)
    .first();

  const upsert = members.map((member) => graphFn(member.id, status));

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(upsert);

    if (roster.apply_roles_on_approval && roster.roles && roster.roles.length) {
      await User.relatedQuery("roles", trx)
        .for(members.map(({ userID }) => userID))
        .relate(roster.roles.map(({ id }) => id));
    }

    await trx.commit();

    /** GRAB ROSTER MEMBERS */
    let results = RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched("[rank(default), form(default).fields(useAsColumn)]")
      .select(select)
      .whereIn(
        "roster_members.id",
        members.map(({ id }) => id)
      );

    results = results.map(massageMemberData);

    /** CLEAR CACHE */
    deleteCacheByPattern(`?(admin:rosters:*|rosters:*:|roster:${rosterId}:*`);

    socket
      .to(`roster:${req.params.rosterId}`)
      .emit("update:members:status", results, value.source);

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};
