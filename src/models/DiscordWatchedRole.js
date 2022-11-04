"use strict";
const { Model } = require("objection");

class DiscordWatchedRole extends Model {
  static get tableName() {
    return "discord_watched_roles";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["discord_role_id"],
      properties: {
        id: { type: "string" },
        discord_role_id: { type: "integer" },
      },
    };
  }

  static get relationMappings() {
    const DiscordRoles = require("$models/DiscordRoles");
    return {
      discord_roles: {
        relation: Model.HasOneRelation,
        modelClass: DiscordRoles,
        join: {
          from: "discord_watched_roles.discord_role_id",
          to: "discord_roles.id",
        },
      },
    };
  }
}

module.exports = DiscordWatchedRole;
