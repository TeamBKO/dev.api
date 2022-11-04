"use strict";
const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const guid = require("$util/mixins/guid")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});

const userList = (req, key) => {
  if (req.body[key]) {
    return Array.isArray(req.body[key])
      ? req.body[key].length > 1
        ? req.body[key]
        : req.body[key][0]
      : req.body[key];
  }
  return false;
};

class Media extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "media";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["mimetype", "url", "storage_key", "owner_id"],
      properties: {
        id: { type: "string" },
        mimetype: { type: "string" },
        url: { type: "string" },
        storage_key: { type: "string" },
        owner_id: { type: "integer" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const User = require("$models/User");
    return {
      uploader: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: "media.owner_id",
          to: "users.id",
        },
      },
    };
  }
}

module.exports = Media;
