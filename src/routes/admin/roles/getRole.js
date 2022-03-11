"use strict";
const Role = require("$models/Role");
const DiscordRole = require("$models/DiscordRole");
const Policy = require("$models/Policy");
const Settings = require("$models/Settings");
const getCache = require("$util/getCache");

const guard = require("express-jwt-permissions")();
const { param } = require("express-validator");
const { validate } = require("$util");
const {
  VIEW_ALL_ADMIN,
  VIEW_ALL_ROLES,
  UPDATE_ALL_ROLES,
} = require("$util/policies");

// const select = [
//   "roles.id",
//   "roles.name",
//   "roles.level",
//   "roles.is_deletable",
//   "roles.is_removable",
//   "roles.created_at",
//   "roles.updated_at",
// ];

const select = [
  "id",
  "name",
  "level",
  "is_deletable",
  "is_removable",
  "created_at",
  "updated_at",
];

const getRole = async function (req, res) {
  // const settings = await Settings.query()
  //   .select(["enable_bot", "bot_server_id"])
  //   .first();

  // if (settings.enable_bot && settings.bot_server_id) {
  //   const discord = await getCache("discord", DiscordRole.query());
  //   Object.assign(response, { discord });
  // }

  const role = await getCache(
    `role_${req.params.id}`,
    Role.query()
      .where("id", req.params.id)
      .select(select)
      .withGraphFetched("[policies, discord_roles]")
      .first()
      .throwIfNotFound()
  );

  // let [role, selectable] = await Promise.all([
  //   getCache(`role_${req.params.id}`, roleQuery),
  //   getCache("policies", Policy.query()),
  //   // Policies.query().where("level", ">=", req.user.level),
  // ]);

  // selectable = selectable.filter(({ level }) => level >= req.user.level);

  res.status(200).send(role);
};

module.exports = {
  path: "/:id",
  method: "GET",
  middleware: [
    guard.check([VIEW_ALL_ADMIN, VIEW_ALL_ROLES, UPDATE_ALL_ROLES]),
    validate([param("id").isNumeric().toInt(10)]),
  ],
  handler: getRole,
};
