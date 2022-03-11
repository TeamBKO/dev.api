const { Model } = require("objection");

class Settings extends Model {
  static get tableName() {
    return "settings";
  }

  static get jsonSchema() {
    return {
      type: "object",
      properties: {
        show_history_carousel_on_frontpage: { type: "boolean" },
        show_video: { type: "boolean" },
        show_video_on_mobile: { type: "boolean" },
        show_testimonies: { type: "boolean" },
        enable_account_media_sharing: { type: "boolean" },
        show_recruitment_button: { type: "boolean" },
        enable_user_authentication: { type: "boolean" },
        enable_user_registration: { type: "boolean" },
        enable_social_authentication: { type: "boolean" },
        enable_local_authentication: { type: "boolean" },
        enable_email_request_throttling: { type: "boolean" },
        require_account_verification: { type: "boolean" },
        allow_users_to_delete_account: { type: "boolean" },
        universal_request_ttl_in_minutes: { type: "integer" },
        number_of_login_attempts: { type: "integer" },
        time_till_next_username_change: { type: "string" },
        front_page_video_url: { type: "string" },
        enable_bot: { type: "boolean" },
        bot_prefix: { type: "string" },
        bot_server_id: { type: "string" },
        bot_recruitment_channel_id: { type: "string" },
        // show_history_carousel_on_frontpage: { type: "boolean" },
        // show_video: { type: "boolean" },
        // show_video_on_mobile: { type: "boolean" },
        // show_testimonies: { type: "boolean" },
        // show_recruitment_button: { type: "boolean" },
        // enable_social_authentication: { type: "boolean" },
        // // password_reset_request_ttl_in_minutes: { type: "integer" },
        // // password_reset_resend_timer_in_minutes: { type: "integer" },
        // // user_activation_request_ttl_in_minutes: { type: "integer" },
        // // user_activation_resend_timer_in_minutes: { type: "integer" },
        // front_page_video_url: { type: "string" },
      },
    };
  }
}

module.exports = Settings;
