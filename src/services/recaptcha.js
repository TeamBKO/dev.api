"use strict";
const phin = require("phin");

/**
 * Returns the recaptcha uri to verify the response.
 * @param {string} secret The google recaptcha secret.
 * @param {string} response The grecaptcha response sent from the client
 * @returns {string}
 */
const recaptchaURI = (secret, response) => {
  return `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${response}`;
};
/**
 * calls next() and moves the request forward
 * @param {string} secret The google recaptcha secret.
 */
const verifyRecaptcha = function (secret) {
  return async function (req, res, next) {
    if (!secret || typeof secret !== "string") {
      const error = new Error();
      error.message = "Recaptcha secret is either missing or not a string";
      error.statusCode = 500;
      return next(error);
    }

    try {
      const { body } = await phin({
        url: recaptchaURI(secret, req.body.gresponse),
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        parse: "json",
      });

      if (body.success) return next();
      if (body["error-codes"].length) {
        const errors = body["error-codes"];
        return res.status(500).send(errors);
      }
    } catch (err) {
      next(err);
    }
  };
};

module.exports = verifyRecaptcha;
