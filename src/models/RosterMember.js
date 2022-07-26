"use strict";
const { BitField } = require("discord.js");
const { Model } = require("objection");

const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});
const dates = require("$util/mixins/date")();
const guid = require("$util/mixins/guid")();

class RosterMemberPermission extends guid(Model) {
  static get tableName() {
    return "roster_member_permissions";
  }

  static get modifiers() {
    return {
      default(qb) {
        qb.select([
          "id",
          "can_add_members",
          "can_edit_members",
          "can_edit_member_ranks",
          "can_remove_members",
          "can_add_ranks",
          "can_edit_ranks",
          "can_remove_ranks",
          "can_edit_roster_details",
          "can_delete_roster",
        ]);
      },
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        id: { type: "string" },
        can_add_members: { type: "boolean" },
        can_edit_members: { type: "boolean" },
        can_edit_member_ranks: { type: "boolean" },
        can_remove_members: { type: "boolean" },
        can_add_ranks: { type: "boolean" },
        can_edit_ranks: { type: "boolean" },
        can_remove_ranks: { type: "boolean" },
        can_edit_roster_details: { type: "boolean" },
        can_delete_roster: { type: "boolean" },
      },
    };
  }
}

class RosterMember extends cursor(guid(dates(Model))) {
  static get tableName() {
    return "roster_members";
  }

  static get modifiers() {
    return {
      default(qb) {
        qb.select("id", "status", "approved_on", "is_deletable");
      },
    };
  }

  static get relationMappings() {
    const User = require("$models/User");
    const RosterRank = require("$models/RosterRank");
    const RosterForm = require("$models/RosterForm");
    const Roster = require("$models/Roster");
    return {
      roster: {
        relation: Model.BelongsToOneRelation,
        modelClass: Roster,
        join: {
          from: "roster_members.roster_id",
          to: "rosters.id",
        },
      },
      rank: {
        relation: Model.BelongsToOneRelation,
        modelClass: RosterRank,
        join: {
          from: "roster_members.roster_rank_id",
          to: "roster_ranks.id",
        },
      },
      member: {
        relation: Model.HasOneRelation,
        modelClass: User,
        join: {
          from: "roster_members.member_id",
          to: "users.id",
        },
      },
      form: {
        relation: Model.HasOneRelation,
        modelClass: RosterForm,
        join: {
          from: "roster_members.id",
          extra: ["form_id"],
          to: "roster_member_forms.roster_member_id",
        },
      },
      permissions: {
        relation: Model.HasOneRelation,
        modelClass: RosterMemberPermission,
        join: {
          from: "roster_members.id",
          extra: [
            "can_add_members",
            "can_edit_members",
            "can_edit_member_ranks",
            "can_remove_members",
            "can_add_ranks",
            "can_edit_ranks",
            "can_remove_ranks",
            "can_edit_roster_details",
            "can_delete_roster",
          ],
          to: "roster_member_permissions.member_id",
        },
      },
    };
  }
}

module.exports = RosterMember;
