"use strict";
const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
    hasNext: true,
    hasPrevious: true,
  },
});
const guid = require("$util/mixins/guid")();

class Testimony extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "testimonies";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["author", "avatar", "order", "text"],
      properties: {
        id: { type: "string" },
        order: { type: "integer" },
        author: { type: "string" },
        avatar: { type: "string" },
        text: { type: "text" },
        created_at: { type: "date" },
        updated_at: { type: "date" },
      },
    };
  }
}

module.exports = Testimony;
