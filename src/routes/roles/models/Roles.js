"use strict";
const Base = require("$base");

class Group extends Base {
  static get tableName() {
    return "roles";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        can_access_admin: { type: "boolean" },
        can_view_maps: { type: "boolean" },
        can_view_events: { type: "boolean" },
        can_view_pins: { type: "boolean" },
        can_view_users: { type: "boolean" },
        can_view_groups: { type: "boolean" },
        can_edit_maps: { type: "boolean" },
        can_edit_events: { type: "boolean" },
        can_edit_pins: { type: "boolean" },
        can_edit_users: { type: "boolean" },
        can_edit_groups: { type: "boolean" },
        can_add_maps: { type: "boolean" },
        can_add_events: { type: "boolean" },
        can_add_pins: { type: "boolean" },
        can_add_users: { type: "boolean" },
        can_add_groups: { type: "boolean" },
        can_remove_maps: { type: "boolean" },
        can_remove_events: { type: "boolean" },
        can_remove_pins: { type: "boolean" },
        can_remove_users: { type: "boolean" },
        can_remove_groups: { type: "boolean" },
        can_disable_maps: { type: "boolean" },
        can_disable_events: { type: "boolean" },
        can_disable_pins: { type: "boolean" },
        can_disable_users: { type: "boolean" },
        can_disable_groups: { type: "boolean" },
        can_upload_maps: { type: "boolean" },
        can_upload_pins: { type: "boolean" },
        is_disabled: { type: "boolean" },
        is_removable: { type: "boolean" },
      },
    };
  }

  static get relationMappings() {
    const Users = require("$models/User");
    const Roles = require("$models/Roles");

    return {
      users: {
        relation: Base.ManyToManyRelation,
        modelClass: Users,
        join: {
          from: "roles.id",
          through: {
            from: "user_roles.role_id",
            to: "user_roles.user_id",
          },
          to: "users.id",
        },
      },
      role: {
        relation: Base.HasOneRelation,
        modelClass: Roles,
        join: {
          from: "user_roles.role_id",
          to: "roles.id",
        },
      },
    };
  }
}

module.exports = Group;
