"use strict";
const slugify = require("slugify");

module.exports = (data) => {
  if (data.form.fields && data.form.fields.length) {
    const fields = data.form.fields.reduce((obj, field) => {
      obj[slugify(field.alias, "_").toLowerCase()] = field.answer.value;
      return obj;
    }, {});

    delete data.form.fields;
    return Object.assign(data, fields);
  }
  return data;
};
