"use strict";
const Roster = require("$models/Roster");
const RosterMember = require("$models/RosterMember");
const guard = require("express-jwt-permissions")();
const sanitize = require("sanitize-html");
const slugify = require("slugify");
const redis = require("$services/redis");
const { deleteCacheByPattern } = require("$services/redis/helpers");
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN } = require("$util/policies");

const isUndefined = (v) => v === undefined;

const validators = validate([
  body("name")
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("icon")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("enable_recruitment").optional().isBoolean(),
  body("auto_approve").optional().isBoolean(),
  body("apply_roles_on_approval").optional().isBoolean(),
  body("show_fields_as_columns").optional().isBoolean(),
  body("private").optional().isBoolean(),
  body("is_disabled").optional().isBoolean(),
  body("selectedForm").optional().isNumeric().toInt(10),
  body("selectedRoles.*").notEmpty().optional().isNumeric().toInt(10),
  body("link_to_discord").optional().isBoolean(),
  body("assign_discord_roles_on_approval").optional().isBoolean(),
  body("applicant_form_channel_id")
    .optional()
    .isString()
    .customSanitizer((v) => sanitize(v)),
]);

const generateGraph = (userId, body) => {
  const results = {
    "#id": "roster",
    name: body.name,
    url: body.url,
    creator_id: userId,
    members: [
      {
        member_id: userId,
        status: "approved",
        approved_on: new Date().toISOString(),
        is_deletable: false,
        permissions: {
          can_add_members: false,
          can_edit_members: false,
          can_remove_members: false,
          can_edit_roster_details: false,
          can_delete_roster: false,
          can_add_ranks: false,
          can_edit_ranks: false,
          can_remove_ranks: false,
        },
        rank: {
          name: "Owner",
          icon:
            "https://lobucket.s3.ca-central-1.amazonaws.com/images/ranks/owner.png",
          roster_id: "#ref{roster.id}",
          is_deletable: false,
          priority: 1,
          permissions: [
            {
              can_add_members: true,
              can_edit_members: true,
              can_edit_member_ranks: true,
              can_remove_members: true,
              can_edit_roster_details: true,
              can_delete_roster: true,
              can_add_ranks: true,
              can_edit_ranks: true,
              can_remove_ranks: true,
            },
          ],
        },
      },
    ],
    ranks: [
      {
        name: "Leader",
        icon:
          "https://lobucket.s3.ca-central-1.amazonaws.com/images/ranks/leader.png",
        priority: 2,
        is_deletable: false,
        permissions: [
          {
            can_add_members: true,
            can_edit_members: true,
            can_edit_member_ranks: true,
            can_remove_members: true,
            can_edit_roster_details: true,
            can_delete_roster: false,
            can_add_ranks: true,
            can_edit_ranks: true,
            can_remove_ranks: true,
          },
        ],
      },
      {
        name: "Officer",
        icon:
          "https://lobucket.s3.ca-central-1.amazonaws.com/images/ranks/officer.png",
        priority: 3,
        is_deletable: false,
        permissions: [
          {
            can_add_members: true,
            can_edit_members: true,
            can_remove_members: true,
            can_edit_member_ranks: true,
          },
        ],
      },
      {
        name: "Member",
        icon:
          "https://lobucket.s3.ca-central-1.amazonaws.com/images/ranks/member.png",
        priority: 4,
        is_deletable: false,
        permissions: [
          {
            can_add_members: false,
            can_edit_members: false,
            can_remove_members: false,
            can_edit_roster_details: false,
            can_delete_roster: false,
          },
        ],
      },
      {
        name: "Recruit",
        icon:
          "https://lobucket.s3.ca-central-1.amazonaws.com/images/ranks/recruit.png",
        priority: 5,
        is_deletable: false,
        is_recruit: true,
        permissions: [
          {
            can_add_members: false,
            can_edit_members: false,
            can_remove_members: false,
            can_edit_roster_details: false,
            can_delete_roster: false,
          },
        ],
      },
    ],
  };

  const keys = [
    "icon",
    "enable_recruitment",
    "auto_approve",
    "apply_roles_on_approval",
    "show_fields_as_columns",
    "private",
    "is_disabled",
    "assign_discord_roles_on_approval",
    "link_to_discord",
    "applicant_form_channel_id",
    "pending_applicant_channel_id",
    "rejected_applicant_channel_id",
  ];

  keys.forEach((key) => {
    if (!isUndefined(body[key])) {
      Object.assign(results, { [key]: body[key] });
    }
  });

  if (body.banner) {
    Object.assign(results, { banner: body.banner });
  } else {
    Object.assign(results, {
      banner:
        "https://images.ctfassets.net/j95d1p8hsuun/1ShvIkEIe3cvb5qKSguLdC/9bbac0c4239985ca540650ec240d765b/HOME_USP1_FightTheWorld_CPB-L-1920x720.jpg",
    });
  }

  if (!isUndefined(body.selectedForm)) {
    Object.assign(results, { roster_form: { id: body.selectedForm } });
  }

  if (body.roles && body.roles.length) {
    Object.assign(results, { roles: body.roles.map((id) => ({ id })) });
  }

  return results;
};

const addRoster = async function (req, res, next) {
  const body = req.body;

  body.url = slugify(body.name, {
    strict: true,
    lower: true,
  });

  const data = generateGraph(req.user.id, body);

  const trx = await Roster.startTransaction();

  try {
    const { id } = await Roster.query(trx).insertGraph(data, {
      relate: [
        "roster_form",
        "member.permissions",
        "roles",
        "rank",
        "rank.permissions",
      ],
      allowRefs: true,
    });

    deleteCacheByPattern(`?(admin:rosters:*|rosters:*)`);
    await trx.commit();

    const roster = await Roster.query()
      .select([
        "*",
        RosterMember.query()
          .where("roster_members.member_id", req.user.id)
          .whereColumn("roster_members.roster_id", "rosters.id")
          .count()
          .as("joined"),
        RosterMember.query()
          .whereColumn("roster_members.roster_id", "rosters.id")
          .count()
          .as("members"),
      ])
      .withGraphFetched("[roster_form, creator(defaultSelects)]")
      .where("id", id)
      .first();

    res.status(200).send(roster);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    next(err);
  }
};

module.exports = {
  path: "/",
  method: "POST",
  middleware: [
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    guard.check([VIEW_ALL_ADMIN]),
    validators,
  ],
  handler: addRoster,
};
