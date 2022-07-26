const { Model } = require("objection");
const guid = require("$util/mixins/guid")();
class Field extends guid(Model) {
  static get tableName() {
    return "fields";
  }

  static get modifiers() {
    const { ref } = Field;
    return {
      order(builder) {
        builder.orderBy(ref("order"), "asc");
      },

      useAsColumn(builder) {
        builder.where("fields.use_as_column", true);
        // .select(["answer", "options", "fields.alias", "user_form_fields.id"]);
      },
    };
  }

  static get jsonSchema() {
    return {
      type: "object",

      properties: {
        id: { type: "string" },
        value: { type: "string" },
        type: { type: "string" },
        optional: { type: "boolean" },
      },
    };
  }

  // static get relationMappings() {
  //   const FormField = require("$models/FormField");
  //   const Form = require("$models/Form");
  //   return {
  //     form: {
  //       relation: Model.ManyToManyRelation,
  //       modelClass: Form,
  //       join: {
  //         from: "fields.id",
  //         through: {
  //           from: "form_fields.field_id",
  //           to: "form_fields.form_id",
  //         },
  //         to: "forms.id",
  //       },
  //     },
  //     form: {
  //       relation: Model.HasOneRelation,
  //       modelClass: FormFields,
  //       join: {
  //         from: "fields.id",
  //         to: "form_fields.field_id",
  //       },
  //     },
  //   };
  // }
}

module.exports = Field;
