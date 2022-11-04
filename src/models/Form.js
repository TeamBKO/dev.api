"use strict";
const dateMixin = require("$util/mixins/date")();
const cursor = require("objection-cursor")({
  // nodes: true,
  pageInfo: {
    hasMore: true,
  },
});
const { Model } = require("objection");

class Form extends cursor(dateMixin(Model)) {
  static get tableName() {
    return "forms";
  }

  static get modifiers() {
    return {
      default: (qb) => qb.select("id", "name"),
      id: (qb) => qb.select(["id as form_id", "description"]),
      formIdOnly: (qb) => qb.select("id"),
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["name", "creator_id"],
      properties: {
        id: { type: "integer" },
        creator_id: { type: "integer" },
        name: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const Field = require("$models/Field");
    const User = require("$models/User");
    const Roster = require("$models/Roster");
    return {
      created_by: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: "forms.creator_id",
          to: "users.id",
        },
      },

      rosters: {
        relation: Model.ManyToManyRelation,
        modelClass: Roster,
        join: {
          from: "forms.id",
          through: {
            from: "roster_forms.form_id",
            to: "roster_forms.roster_id",
          },
          to: "rosters.id",
        },
      },

      fields: {
        relation: Model.ManyToManyRelation,
        modelClass: Field,
        join: {
          from: "forms.id",
          through: {
            from: "form_fields.form_id",
            to: "form_fields.field_id",
          },
          to: "fields.id",
        },
      },
    };
  }
}

module.exports = Form;
