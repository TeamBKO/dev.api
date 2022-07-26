"use strict";
const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const guid = require("$util/mixins/guid")();

class RosterFormField extends guid(dateMixin(Model)) {
  static get tableName() {
    return "roster_form_fields";
  }

  static get modifiers() {
    return {
      fields: (qb) => qb.joinRelated("field"),
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["form_id", "field_id", "answer"],
      properties: {
        id: { type: "string" },
        form_id: { type: "string" },
        field_id: { type: "string" },
        answer: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const RosterForm = require("$models/RosterForm");
    const Field = require("$models/Field");
    return {
      form: {
        relation: Model.BelongsToOneRelation,
        modelClass: RosterForm,
        join: {
          from: "roster_form_fields.form_id",
          to: "roster_member_forms.id",
        },
      },
      field: {
        relation: Model.BelongsToOneRelation,
        modelClass: Field,
        join: {
          from: "roster_form_fields.field_id",
          to: "fields.id",
        },
      },
    };
  }
}

module.exports = RosterFormField;
