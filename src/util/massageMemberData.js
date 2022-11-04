"use strict";
const snakeCase = require("lodash.snakecase");

module.exports = (data) => {
  if (data.forms && data.forms.length) {
    let forms = {};
    const results = data.forms.reduce((obj, form) => {
      if (form) {
        let fields;
        if (form.fields && form.fields.length) {
          fields = form.fields.reduce((o, field) => {
            const alias = snakeCase(field.alias).toLowerCase();
            o[alias] = field.answer.value;
            return o;
          }, {});
        }

        Object.assign(forms, { [form.form_id]: form.id });

        delete form.fields;
        Object.assign(obj, fields);
      }
      return obj;
    }, {});
    return Object.assign(data, results, { forms });
  }
  return data;
};
