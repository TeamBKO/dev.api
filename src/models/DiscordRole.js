const { Model } = require("objection");

const guid = require("$util/mixins/guid")();

const cursor = require("objection-cursor")({
  limit: 50,
  pageInfo: {
    hasMore: true,
  },
});

class DiscordRole extends cursor(guid(Model)) {
  static get tableName() {
    return "discord_roles";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: ["name", "discord_role_id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        discord_role_id: { type: "string" },
      },
    };
  }
}

module.exports = DiscordRole;
