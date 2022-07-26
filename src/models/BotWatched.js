"use strict";
const { Model } = require("objection");

class BotWatched extends Model {
  static get tableName() {
    return "bot_watched_roles";
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
          from: "bot_watched_roles.discord_role_id",
          to: "discord_roles.id",
        },
      },
    };
  }
}

module.exports = BotWatched;
