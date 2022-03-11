"use strict";

const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});
const guid = require("$util/mixins/guid")();

class UserForm extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "user_forms";
  }

  static get modifiers() {
    return {
      default: (qb) => qb.select("id"),
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
        // status: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const User = require("$models/User");
    const RosterMember = require("$models/RosterMember");
    const Form = require("$models/Form");
    const UserFormField = require("$models/UserFormField");
    const Field = require("$models/Field");
    return {
      applicant: {
        relation: Model.BelongsToOneRelation,
        modelClass: RosterMember,
        join: {
          from: "user_forms.roster_member_id",
          to: "roster_members.id",
        },
      },
      form: {
        relation: Model.HasOneRelation,
        modelClass: Form,
        join: {
          from: "user_forms.form_id",
          to: "forms.id",
        },
      },
      fields: {
        relation: Model.ManyToManyRelation,
        modelClass: Field,
        join: {
          from: "user_forms.id",
          through: {
            from: "user_form_fields.form_id",
            extra: ["answer"],
            to: "user_form_fields.field_id",
          },
          to: "fields.id",
        },
      },
      form_fields: {
        relation: Model.HasManyRelation,
        modelClass: UserFormField,
        join: {
          from: "user_forms.id",
          to: "user_form_fields.form_id",
        },
      },
    };
  }
}

module.exports = UserForm;
