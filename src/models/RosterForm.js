"use strict";

const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});
const guid = require("$util/mixins/guid")();

class RosterForm extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "roster_member_forms";
  }

  static get modifiers() {
    const { ref } = RosterForm;
    return {
      default: (qb) => {
        qb.select(ref("id"), ref("form_id"));
      },
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["form_id"],
      properties: {
        id: { type: "string" },
        form_id: { type: "integer" },
        roster_member_id: { type: "string" },
        roster_id: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const RosterMember = require("$models/RosterMember");
    const Roster = require("$models/Roster");
    const Form = require("$models/Form");
    const RosterFormField = require("$models/RosterFormField");
    const Field = require("$models/Field");
    return {
      roster: {
        relation: Model.BelongsToOneRelation,
        modelClass: Roster,
        join: {
          from: "roster_member_forms.roster_id",
          to: "rosters.id",
        },
      },
      applicant: {
        relation: Model.BelongsToOneRelation,
        modelClass: RosterMember,
        join: {
          from: "roster_member_forms.roster_member_id",
          to: "roster_members.id",
        },
      },
      form: {
        relation: Model.HasOneRelation,
        modelClass: Form,
        join: {
          from: "roster_member_forms.form_id",
          to: "forms.id",
        },
      },
      fields: {
        relation: Model.ManyToManyRelation,
        modelClass: Field,
        join: {
          from: "roster_member_forms.id",
          through: {
            from: "roster_form_fields.form_id",
            extra: ["id", "answer"],
            to: "roster_form_fields.field_id",
          },
          to: "fields.id",
        },
      },
      form_fields: {
        relation: Model.HasManyRelation,
        modelClass: RosterFormField,
        join: {
          from: "roster_member_forms.id",
          to: "roster_form_fields.form_id",
        },
      },
    };
  }
}

module.exports = RosterForm;
