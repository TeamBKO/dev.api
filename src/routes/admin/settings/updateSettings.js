"use strict";
const Settings = require("$models/Settings");
const sanitize = require("sanitize-html");
const pick = require("lodash.pick");
const guard = require("express-jwt-permissions")();
const redis = require("$services/redis");
const pluralize = require("pluralize");
const { body } = require("express-validator");
const { validate } = require("$util");
const { VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS } = require("$util/policies");
const client = require("$root/src/bot");

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
  const columns = pick(req.body.settings, [
    "front_page_video_url",
    "show_video",
    "show_video_on_mobile",
    "show_testimonies",
    "show_recruitment_button",
    "enable_social_authentication",
    "enable_local_authentication",
    "enable_bot",
    "bot_server_id",
    "bot_prefix",
    "bot_recruitment_channel_id",
    "enable_user_authentication",
    "enable_user_registration",
    "enable_email_request_throttling",
    "require_account_verification",
    "allow_users_to_delete_account",
    "universal_request_ttl_in_minutes",
    "number_of_login_attempts",
    "time_till_next_username_change",
    "cache_users_on_fetch",
    "cache_roles_on_fetch",
    "cache_forms_on_fetch",
    "cache_categories_on_fetch",
    "cache_tags_on_fetch",
    "cache_rosters_on_fetch",
  ]);

  console.log(columns);

  const trx = await Settings.startTransaction();

  try {
    const settings = await Settings.query()
      .patch(columns)
      .first()
      .returning(Object.keys(columns));

    if (settings.enable_bot) {
      client.login(process.env.DISCORD_BOT_TOKEN);
    } else {
      client.destroy();
    }

    const pipeline = redis.pipeline();

    for (let [key, isEnabled] of Object.entries(settings)) {
      if (!/^cache_/.test(key)) {
        continue;
      }
      if (!isEnabled) {
        const name = key.split("_")[1];
        const single = pluralize.singular(name);
        pipeline.del(`${name}:`);
        pipeline.del(`${single}:`);
      }
    }

    pipeline.exec();

    await trx.commit();

    console.log(settings);

    res.status(200).send(settings);
  } catch (err) {
    console.log(err);
    await trx.rollback();
  }
};

module.exports = {
  path: "/",
  method: "PATCH",
  middleware: [guard.check([VIEW_ALL_ADMIN, UPDATE_ALL_SETTINGS]), validators],
  handler: updateSettings,
};
