"use strict";
const RosterMember = require("$models/RosterMember");
const Roster = require("$models/Roster");
const Settings = require("$models/Settings");
const User = require("$models/User");
const massageMemberData = require("$util/massageMemberData");
const sanitize = require("sanitize-html");
const redis = require("$services/redis");
const emitter = require("$services/redis/emitter");
const updateDiscordMessages = require("$services/discord/helpers/updateDiscordMessages");
const { body, param } = require("express-validator");
const { validate } = require("$util");
const { deleteCacheByPattern } = require("$services/redis/helpers");

const validators = validate([
  param("id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  param("rosterId")
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("members.*.id")
    .optional()
    .isUUID()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("members.*.userID").optional().isNumeric().toInt(10),
  body("userID").optional().isNumeric().toInt(10),
  body("status").optional().isIn(["pending", "approved", "rejected"]),
  body("source").customSanitizer((v) => sanitize(v)),
]);

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

const hasAccess = async function (req, res, next) {
  const accessQuery = RosterMember.query()
    .joinRelated("[permissions, rank.[permissions]]")
    .select("roster_members.roster_id")
    .where("roster_members.member_id", req.user.id)
    .andWhere((qb) =>
      qb
        .where("permissions.can_edit_members", true)
        .orWhere("rank:permissions.can_edit_members", true)
    )
    .first();

  const settingsQuery = Settings.query().select("enable_bot").first();

  const [hasAccess, settings] = await Promise.all([accessQuery, settingsQuery]);

  if (!hasAccess) {
    return res.status(403).send({ message: "Insufficient permissions" });
  }

  req.hasAccess = hasAccess;
  req.settings = settings;
  next();
};

const updateMultipleRosterMemberStatus = async function (req, res, next) {
  if (req.params.id) return next();

  const { status, members } = req.body;

  const rosterID = req.hasAccess.roster_id;

  if (!members || !Array.isArray(members)) {
    return res.sendStatus(400);
  }

  let roster = await Roster.query()
    .withGraphFetched("[roles(default)]")
    .select([
      "apply_roles_on_approval",
      "display_applicant_forms_on_discord",
      "approved_applicant_channel_id",
      "rejected_applicant_channel_id",
    ])
    .where("id", rosterID)
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

    /** Update the form information on discord if setting is enabled. */
    // if (req.settings.enable_bot) {
    //   if (roster.display_applicant_forms_on_discord) {
    //     /** If we're only updating one message */
    //     await updateDiscordMessages(
    //       members.map(({ id }) => id),
    //       roster,
    //       status
    //     );
    //   }
    // }

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

    emitter
      .of("/rosters")
      .to(`roster:${req.params.rosterId}`)
      .emit("update:members:status", results, req.body.source);

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

const updateSingleRosterMemberStatus = async function (req, res, next) {
  const { status, userID } = req.body;

  const rosterId = req.params.rosterId;

  let roster = await Roster.query()
    .withGraphFetched("[roles(default)]")
    .select([
      "apply_roles_on_approval",
      "link_to_discord",
      "applicant_form_channel_id",
    ])
    .where("id", rosterId)
    .first();

  const upsert = graphFn(req.params.id, status);

  const trx = await RosterMember.startTransaction();

  try {
    await RosterMember.query(trx).upsertGraph(upsert);

    if (roster.apply_roles_on_approval && roster.roles && roster.roles.length) {
      await User.relatedQuery("roles", trx)
        .for(userID)
        .relate(roster.roles.map(({ id }) => id));
    }

    /** Update the form information on discord if setting is enabled. */
    if (req.settings.enable_bot) {
      if (roster.link_to_discord) {
        await updateDiscordMessages(req.params.id, status);
      }
    }
    await trx.commit();

    let results = await RosterMember.query()
      .joinRelated("[member(defaultSelects)]")
      .withGraphFetched("[rank(default), forms(default).fields(useAsColumn)]")
      .select(select)
      .where("roster_members.id", req.params.id)
      .first();

    deleteCacheByPattern(`?(admin:rosters:*|rosters:*|roster:${rosterId}*`);

    results = massageMemberData(results);
    // res.status(200).send(results);

    emitter
      .of("/rosters")
      .to(`roster:${rosterId}`)
      .volatile.emit("update:members:status", results, req.body.source);

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/:rosterId/members/status/:id?",
  method: "PATCH",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validators,
  ],
  handler: [
    hasAccess,
    updateMultipleRosterMemberStatus,
    updateSingleRosterMemberStatus,
  ],
};
