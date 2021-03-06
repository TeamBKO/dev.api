"use strict";
const Settings = require("$models/Settings");
const sanitize = require("sanitize-html");
const guard = require("express-jwt-permissions")();
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS } = require("$util/policies");
const { client } = require("$root/src/bot");

const validators = validate([
  body("settings.*.show_video").optional().isBoolean(),
  body("settings.*.show_video_on_mobile").optional().isBoolean(),
  body("settings.*.show_testimonies").optional().isBoolean(),
  body("settings.*.show_recruitment_button").optional().isBoolean(),
  body("settings.*.enable_social_authenticate").optional().isBoolean(),
  body("settings.*.enable_local_authenticate").optional().isBoolean(),
  body("settings.*.bot_enabled").optional().isBoolean(),
  body("settings.*.bot_server_id").optional().isNumeric(),
  body("settings.*.bot_prefix")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
  body("settings.*.password_reset_request_ttl_in_minutes")
    .optional()
    .isNumeric(),
  body("settings.*.password_reset_resend_timer_in_minutes")
    .optional()
    .isNumeric(),
  body("settings.*.user_activation_request_ttl_in_minutes")
    .optional()
    .isNumeric(),
  body("settings.*.user_activation_resend_timer_in_minutes")
    .optional()
    .isNumeric(),
  body("settings.*.front_page_video_url")
    .optional()
    .isString()
    .escape()
    .trim()
    .customSanitizer((v) => sanitize(v)),
]);

const updateSettings = async (req, res) => {
  const _settings = await Settings.query()
    .patch(req.body.settings)
    .first()
    .returning(Object.keys(req.body.settings));

  if (_settings.enable_bot) {
    client.login(process.env.DISCORD_BOT_TOKEN);
  } else {
    client.destroy();
  }

  res.status(200).send(_settings);
};

module.exports = {
  path: "/",
  method: "PATCH",
  middleware: [guard.check([VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS]), validators],
  handler: updateSettings,
};
