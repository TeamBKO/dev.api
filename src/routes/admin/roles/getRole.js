"use strict";
const Role = require("$models/Role");

const guard = require("express-jwt-permissions")();
const { param } = require("express-validator");
const { validate } = require("$util");
const {
  VIEW_ALL_ADMIN,
  VIEW_ALL_ROLES,
  UPDATE_ALL_ROLES,
} = require("$util/policies");
const {
  getCachedQuery,
  getCachedSettings,
} = require("$services/redis/helpers");

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

  const settings = await getCachedSettings();

  const role = await getCachedQuery(
    `role:${req.params.id}`,
    Role.query()
      .where("id", req.params.id)
      .select(select)
      .withGraphFetched("[policies, discord_roles]")
      .first()
      .throwIfNotFound(),
    settings.cache_roles_on_fetch,
    undefined,
    false
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
