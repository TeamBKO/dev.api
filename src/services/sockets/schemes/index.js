"use strict";
const Joi = require("joi");
const sanitize = require("sanitize-html");

module.exports = Joi.extend((joi) => {
  return {
    type: "string",
    base: joi.string(),
    rules: {
      sanitizeHtml: {
        validate(value) {
          return sanitize(value, {
            allowedTags: [],
            allowedAttributes: [],
          });
        },
      },
    },
  };
});
