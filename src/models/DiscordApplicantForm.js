"use strict";
const { Model } = require("objection");
const guid = require("$util/mixins/guid")();

class DiscordApplicantForm extends guid(Model) {
  static get tableName() {
    return "discord_applicant_forms";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: [
        "roster_member_form_id",
        "applicant_id",
        "message_id",
        "channel_id",
        "guild_id",
      ],
      properties: {
        id: { type: "string" },
        roster_member_form_id: { type: "string" },
        applicant_id: { type: "string" },
        channel_id: { type: "string" },
        message_id: { type: "string" },
        guild_id: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const RosterForm = require("$models/RosterForm");
    const User = require("$models/User");
    return {
      form: {
        relation: Model.HasOneRelation,
        modelClass: RosterForm,
        join: {
          from: "discord_applicant_forms.roster_member_form_id",
          to: "roster_member_forms.id",
        },
      },
      applicant: {
        relation: Model.ManyToManyRelation,
        modelClass: User,
        join: {
          from: "discord_applicant_forms.applicant_id",
          through: {
            from: "roster_members.id",
            to: "roster_members.member_id",
          },
          to: "users.id",
        },
      },
    };
  }
}

module.exports = DiscordApplicantForm;
