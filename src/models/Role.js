"use strict";
const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});

class Role extends cursor(dateMixin(Model)) {
  static get tableName() {
    return "roles";
  }

  static get modifiers() {
    return {
      default(builder) {
        builder.select("id");
      },
      nameAndId(builder) {
        builder.select("id", "name");
      },
      distinctOnRole(builder) {
        builder.distinctOn("id");
      },
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["name"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        level: { type: "integer" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const Users = require("$models/User");
    const Policy = require("$models/Policy");
    const DiscordRole = require("$models/DiscordRole");
    return {
      users: {
        relation: Model.ManyToManyRelation,
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

      discord_roles: {
        relation: Model.ManyToManyRelation,
        modelClass: DiscordRole,
        join: {
          from: "roles.id",
          through: {
            from: "role_maps.role_id",
            to: "role_maps.native_discord_role_id",
          },
          to: "discord_roles.id",
        },
      },

      policies: {
        relation: Model.ManyToManyRelation,
        modelClass: Policy,
        join: {
          from: "roles.id",
          through: {
            from: "role_policies.role_id",
            to: "role_policies.policy_id",
          },
          to: "policies.id",
        },
      },
    };
  }

  static async createRole(data, returning = "*") {
    const trx = await this.startTransaction();

    try {
      const role = await this.query(trx)
        .insert(data.details)
        .returning(returning);

      if (data.policies && data.policies.length) {
        await this.relatedQuery("policies", trx)
          .for(role.id)
          .relate(data.policies);
      }

      if (data.discord_roles && data.discord_roles.length) {
        await this.relatedQuery("discord_roles", trx)
          .for(role.id)
          .relate(data.discord_roles);
      }

      await trx.commit();

      return role;
    } catch (err) {
      await trx.rollback();
      return Promise.reject(err);
    }
  }

  static async updateRole(id, data, trx) {
    let queries = [];
    let relationQuery = (relation) =>
      trx ? this.relatedQuery(relation, trx) : this.relatedQuery(relation);
    let query = trx ? this.query(trx) : this.query();
    let queryData = { updated_at: new Date().toISOString() };

    if (data.details && Object.keys(data.details).length) {
      queries.push(query.patch(data.details).where("id", id));
      // Object.assign(queryData, data.details);
    }

    // queries.push(query.patch(queryData).where("id", id));

    if (data.addPolicies && data.addPolicies.length) {
      const relate = relationQuery("policies").for(id).relate(data.addPolicies);
      queries.push(relate);
    }

    if (data.removePolicies && data.removePolicies.length) {
      const unrelate = relationQuery("policies")
        .for(id)
        .unrelate()
        .whereIn("id", data.removePolicies);
      queries.push(unrelate);
    }

    if (data.addDiscordRoles && data.addDiscordRoles.length) {
      const relate = relationQuery("discord_roles")
        .for(id)
        .relate(data.addDiscordRoles);
      queries.push(relate);
    }

    if (data.removeDiscordRoles && data.removeDiscordRoles.length) {
      const unrelate = relationQuery("discord_roles")
        .for(id)
        .unrelate()
        .whereIn("id", data.removeDiscordRoles);
      queries.push(unrelate);
    }

    try {
      return Promise.all(queries);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

module.exports = Role;
