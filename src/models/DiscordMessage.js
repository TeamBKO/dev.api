const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const guid = require("$util/mixins/guid")();
const cursor = require("objection-cursor")({
  // nodes: true,
  pageInfo: {
    hasMore: true,
  },
});

class DiscordMessageRosterButtons extends cursor(guid(Model)) {
  static get tableName() {
    return "discord_message_roster_buttons";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        draft_id: { type: "string" },
        roster_id: { type: "string" },
      },
    };
  }
}

class DiscordWebhook extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "discord_webhooks";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        id: { type: "string" },
        native_discord_message_id: { type: "string" },
        webhook_id: { type: "integer" },
        webhook_token: { type: "integer" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }
}

class DiscordMessageDraft extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "discord_message_drafts";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        id: { type: "string" },
        uid: { type: "string" },
        body: { type: "string" },
        meta: { type: "string" },
        private: { type: "boolean" },
        author_id: { type: "integer" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const User = require("$models/User");
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: "discord_message_drafts.author_id",
          to: "users.id",
        },
      },
    };
  }
}

class DiscordMessage extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "discord_messages";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        id: { type: "string" },
        discord_message_id: { type: "string" },
        channel_id: { type: "string" },
        guild_id: { type: "string" },
        sent_via_webhook: { type: "boolean" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const Roster = require("$models/Roster");
    return {
      webhooks: {
        relation: Model.ManyToManyRelation,
        modelClass: DiscordWebhook,
        join: {
          from: "discord_messages.id",
          through: {
            from: "discord_message_webhooks.discord_message_id",
            to: "discord_message_webhooks.discord_webhook_id",
          },
          to: "discord_webhooks.id",
        },
      },
    };
  }
}

module.exports = {
  DiscordMessageRosterButtons,
  DiscordMessage,
  DiscordMessageDraft,
  DiscordWebhook,
};
