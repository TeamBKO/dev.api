"use strict";
const { Model } = require("objection");
const guid = require("$util/mixins/guid")();
const dates = require("$util/mixins/date")();

const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});

class RosterPermission extends guid(Model) {
  static get tableName() {
    return "roster_permissions";
  }

  static get modifiers() {
    return {
      default(qb) {
        qb.select([
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
      defaultWithID(qb) {
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
        can_edit_members_rank: { type: "boolean" },
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

class RosterRank extends cursor(guid(dates(Model))) {
  static get tableName() {
    return "roster_ranks";
  }

  static get modifiers() {
    return {
      default(qb) {
        qb.select("id", "name", "icon", "priority");
      },
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["name"],
      properties: {
        id: { type: "string" },
        roster_id: { type: "string" },
        roster_permission_id: { type: "string" },
        name: { type: "string" },
        icon: { type: "string" },
        is_deletable: { type: "boolean" },
        created_at: { type: "date" },
        updated_at: { type: "date" },
      },
    };
  }

  static get relationMappings() {
    const Roster = require("$models/Roster");
    return {
      roster: {
        relation: Model.BelongsToOneRelation,
        modelClass: Roster,
        join: {
          from: "roster_ranks.roster_id",
          to: "rosters.id",
        },
      },
      permissions: {
        relation: Model.HasOneRelation,
        modelClass: RosterPermission,
        join: {
          from: "roster_ranks.id",
          extra: [
            "can_add_members",
            "can_edit_members",
            "can_remove_members",
            "can_edit_roster_details",
            "can_delete_roster",
          ],
          to: "roster_permissions.roster_rank_id",
        },
      },
    };
  }
}

module.exports = RosterRank;
