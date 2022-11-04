"use strict";

const { Model } = require("objection");
const dateMixin = require("$util/mixins/date")();
const guid = require("$util/mixins/guid")();
const cursor = require("objection-cursor")({
  pageInfo: {
    hasMore: true,
  },
});

class Roster extends cursor(guid(dateMixin(Model))) {
  static get tableName() {
    return "rosters";
  }

  static get modifiers() {
    return {
      default: (qb) => qb.select("id", "name", "icon", "banner"),
    };
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["name", "creator_id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        icon: { type: "string" },
        banner: { type: "string" },
        private: { type: "boolean" },
        auto_approve: { type: "boolean" },
        show_fields_as_columns: { type: "boolean" },
        apply_roles_on_approval: { type: "boolean" },
        enable_recruitment: { type: "boolean" },
        creator_id: { type: "integer" },
        is_deleted: { type: "boolean" },
        is_disabled: { type: "integer" },
        created_at: { type: "string" },
        updated_at: { type: "string" },
      },
    };
  }

  static get relationMappings() {
    const User = require("$models/User");
    const Form = require("$models/Form");
    const Role = require("$models/Role");
    const RosterRank = require("$models/RosterRank");
    const RosterMember = require("$models/RosterMember");
    return {
      creator: {
        relation: Model.HasOneRelation,
        modelClass: User,
        join: {
          from: "rosters.creator_id",
          to: "users.id",
        },
      },
      members: {
        relation: Model.HasManyRelation,
        modelClass: RosterMember,
        join: {
          from: "rosters.id",
          to: "roster_members.roster_id",
        },
      },
      ranks: {
        relation: Model.HasManyRelation,
        modelClass: RosterRank,
        join: {
          from: "rosters.id",
          to: "roster_ranks.roster_id",
        },
      },
      roles: {
        relation: Model.ManyToManyRelation,
        modelClass: Role,
        join: {
          from: "rosters.id",
          through: {
            from: "roster_roles.roster_id",
            to: "roster_roles.role_id",
          },
          to: "roles.id",
        },
      },
      roster_form: {
        relation: Model.HasOneThroughRelation,
        modelClass: Form,
        join: {
          from: "rosters.id",
          through: {
            from: "roster_forms.roster_id",
            to: "roster_forms.form_id",
          },
          to: "forms.id",
        },
      },
    };
  }

  static get URL() {
    return process.env.BASE_URL + `/rosters/${this.url}`;
  }

  static async updateRoster(id, data, trx) {
    let query = trx ? this.query(trx) : this.query();
    let relational = (relation) =>
      trx ? this.relatedQuery(relation, trx) : this.relatedQuery(relation);
    let queries = [];
    let queryData = {};

    if (data.enableRecruitment) {
      Object.assign(queryData, { enable_recruitment: data.enable_recruitment });
    }

    if (data.applyOnApproval) {
      Object.assign(results, { apply_roles_on_approval: body.applyOnApproval });
    }

    if (data.makePrivate) {
      Object.assign(results, { private: body.makePrivate });
    }

    if (data.isDisabled) {
      Object.assign(results, { is_disabled: body.isDisabled });
    }

    if (Object.keys(queryData).length) {
      queries.push(query.patch(queryData).where("id", id));
    }

    if (data.addForm) {
      const relate = relational("roster_form").for(id).relate(data.form);
      queries.push(relate);
    }

    if (data.removeForm && data.removeForm) {
      const unrelate = relational("roster_form")
        .for(id)
        .unrelate()
        .whereIn("id", data.removeForm);
      queries.push(unrelate);
    }

    if (data.rolesAdded && data.rolesAdded.length) {
      const relate = relational("roles").for(id).relate(data.rolesAdded);
      queries.push(relate);
    }

    if (data.rolesRemoved && data.rolesRemoved.length) {
      const unrelate = relational("roles")
        .for(id)
        .unrelate()
        .whereIn("id", data.rolesRemoved);
      queries.push(unrelate);
    }

    try {
      return Promise.all(queries);
    } catch (err) {}
  }
}

module.exports = Roster;
