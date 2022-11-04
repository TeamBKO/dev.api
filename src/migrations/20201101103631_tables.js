"use strict";

const ON_BEFORE_INSERT_FUNCTION = `
CREATE OR REPLACE FUNCTION ignore_dups()
RETURNS trigger as $$
BEGIN
  If Exists (
    Select 
    * 
    FROM user_roles 
    WHERE user_id = NEW.user_id
    AND role_id = NEW.role_id 
  ) Then
    Return NULL;
  End If;
  Return NEW;
End;
$$ Language plpgsql;`;

const DROP_BEFORE_INSERT = `DROP FUNCTION ignore_dups()`;

const CREATE_TRIGGER = `
Create Trigger ignore_dups
Before Insert On user_roles
For Each Row
Execute Procedure ignore_dups()
`;

exports.up = function (knex) {
  return Promise.all([
    knex.raw(ON_BEFORE_INSERT_FUNCTION),
    knex.schema.hasTable("users").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("users", (t) => {
        t.increments("id").primary();
        t.string("discord_id").nullable();
        t.string("email").unique();
        t.string("username").unique();
        t.string("first_name");
        t.string("last_name");
        t.string("location");
        t.string("birthday");
        t.enum("gender", ["Male", "Female", "Other"]);
        t.text("description");
        t.string("password");
        t.string("avatar");
        t.boolean("active").defaultTo(false);
        t.boolean("local").defaultTo(false);
        t.boolean("is_deletable").defaultTo(true);
        t.integer("login_attempts").defaultTo(0);
        t.timestamp("last_activation_email_sent");
        t.timestamp("last_password_reset_sent");
        t.timestamp("last_username_change");
        t.timestamp("last_signed_in");
        t.timestamps();
      });
    }),
    knex.schema.hasTable("user_sessions").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("user_sessions", (t) => {
        t.uuid("id").primary();
        t.integer("user_id").references("users.id").onDelete("CASCADE");
        // t.string("token_id");
        t.string("refresh_token_id");
        t.timestamp("expires");
        t.timestamps();
      });
    }),
    knex.schema.hasTable("roles").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roles", (t) => {
        t.increments("id").primary();
        t.string("name").unique();
        t.integer("level").defaultTo(5);
        t.boolean("is_deletable").default(true);
        t.boolean("is_removable").default(true);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("role_maps").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("role_maps", (t) => {
        t.increments("id").primary();
        t.integer("role_id")
          .references("id")
          .inTable("roles")
          .onDelete("CASCADE");
        t.uuid("native_discord_role_id")
          .references("id")
          .inTable("discord_roles")
          .onDelete("CASCADE");
      });
    }),
    knex.schema.hasTable("discord_roles").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_roles", (t) => {
        t.uuid("id").primary();
        t.string("name");
        t.string("discord_role_id");
      });
    }),
    knex.schema.hasTable("discord_message_drafts").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_message_drafts", (t) => {
        t.uuid("id").primary();
        t.string("uid");
        t.string("name");
        t.jsonb("body").nullable();
        t.jsonb("meta").nullable();
        t.boolean("private").default(true);
        t.integer("author_id")
          .references("users.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.timestamps();
      });
    }),
    // knex.schema.hasTable("discord_emoji").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("discord_emoji", (t) => {
    //     t.uuid("id").primary();
    //     t.string("snowflake_id").nullable();
    //     t.string("guild_id").nullable();
    //     t.string("unicode").nullable();
    //     t.string("name").nullable();
    //     t.string("group");
    //     t.boolean("is_unicode").defaultTo(false);
    //     t.boolean("require_colons").default(false);
    //     t.boolean("animated").default(false);
    //   });
    // }),
    // knex.schema.hasTable("discord_reaction_role_assignment").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable(
    //     "discord_reaction_role_assignment",
    //     (t) => {
    //       t.uuid("emoji_id")
    //         .references("discord_emoji.id")
    //         .onUpdate("CASCADE")
    //         .onDelete("CASCADE");
    //       t.integer("discord_role_id")
    //         .references("discord_roles.id")
    //         .onUpdate("CASCADE")
    //         .onDelete("CASCADE");
    //     }
    //   );
    // }),
    knex.schema.hasTable("discord_reaction_role_assignment").then((exists) => {
      if (exists) return;
      return knex.schema.createTable(
        "discord_reaction_role_assignment",
        (t) => {
          t.integer("id").primary();
          t.string("emoji");
          t.uuid("discord_role_id")
            .references("discord_roles.id")
            .onUpdate("CASCADE")
            .onDelete("CASCADE");
          t.boolean("is_unicode").default(false);
          t.boolean("animated").default(false);
          t.boolean("require_colon").default(false);
        }
      );
    }),
    knex.schema.hasTable("discord_webhooks").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_webhooks", (t) => {
        t.uuid("id").primary();
        t.bigint("webhook_id");
        t.bigint("webhook_token");
        t.timestamps();
      });
    }),

    knex.schema.hasTable("discord_messages").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_messages", (t) => {
        t.uuid("id").primary();
        t.string("message_id");
        t.string("channel_id");
        t.string("guild_id");
        t.string("sent_via_webhook").default(false);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("role_policies").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("role_policies", (t) => {
        t.integer("role_id")
          .references("id")
          .inTable("roles")
          .onDelete("CASCADE");
        t.integer("policy_id")
          .references("id")
          .inTable("policies")
          .onDelete("CASCADE");
      });
    }),
    knex.schema.hasTable("policies").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("policies", (t) => {
        t.increments("id").primary();
        t.enum("action", ["view", "add", "update", "delete"]);
        t.enum("target", ["own", "all"]);
        t.string("resource");
        t.integer("level");
      });
    }),
    knex.schema.hasTable("user_roles").then((exists) => {
      if (exists) return;
      return knex.schema
        .createTable("user_roles", (t) => {
          t.integer("user_id")
            .references("users.id")
            .onUpdate("CASCADE")
            .onDelete("CASCADE");
          t.integer("role_id")
            .references("roles.id")
            .onUpdate("CASCADE")
            .onDelete("CASCADE");
          t.enum("assigned_by", ["site", "discord", "roster"]).defaultTo(
            "site"
          );
        })
        .then(() => knex.raw(CREATE_TRIGGER));
    }),

    knex.schema.hasTable("user_policies").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("user_policies", (t) => {
        t.integer("user_id")
          .references("id")
          .inTable("users")
          .onDelete("CASCADE");
        t.integer("policy_id")
          .references("id")
          .inTable("policies")
          .onDelete("CASCADE");
      });
    }),

    knex.schema.hasTable("roster_form_fields").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_form_fields", (t) => {
        t.uuid("id").primary();
        t.uuid("form_id")
          .references("roster_member_forms.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        // t.uuid("form_id")
        //   .references("user_forms.id")
        //   .onDelete("CASCADE")
        //   .onUpdate("CASCADE");
        t.uuid("field_id")
          .references("fields.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.jsonb("answer").nullable();
        t.timestamps();
      });
    }),

    knex.schema.hasTable("testimonies").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("testimonies", (t) => {
        // t.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
        t.uuid("id").primary();
        t.string("author");
        t.string("avatar");
        t.text("text");
        t.timestamps();
      });
    }),

    knex.schema.hasTable("settings").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("settings", (t) => {
        t.increments("id").primary();
        t.boolean("show_history_carousel_on_frontpage").defaultTo(true);
        t.boolean("show_video").defaultTo(true);
        t.boolean("show_video_on_mobile").defaultTo(true);
        t.boolean("show_testimonies").defaultTo(true);
        t.boolean("enable_account_media_sharing").defaultTo(true);
        t.boolean("show_recruitment_button").defaultTo(true);
        t.boolean("enable_user_authentication").defaultTo(true);
        t.boolean("enable_user_registration").defaultTo(true);
        t.boolean("enable_social_authentication").defaultTo(true);
        t.boolean("enable_local_authentication").defaultTo(true);
        t.boolean("enable_email_request_throttling").defaultTo(true);
        t.boolean("require_account_verification").defaultTo(true);
        t.boolean("allow_users_to_delete_account").defaultTo(false);
        t.integer("universal_request_ttl_in_minutes").defaultTo(10);
        t.integer("number_of_login_attempts").defaultTo(5);
        t.string("time_till_next_username_change").defaultTo("1 week");
        t.string("front_page_video_url").defaultTo(
          "https://blackout-gaming.s3.amazonaws.com/video/0001-0876.webm"
        );
        t.boolean("enable_bot").defaultTo(false);
        t.string("bot_prefix").defaultTo("!");
        t.string("bot_server_id").defaultTo("549246767577825283");
        t.string("bot_recruitment_channel_id").defaultTo("883085542051438592");
        t.text("bot_recruitment_description");
        t.boolean("cache_users_on_fetch").defaultTo(true);
        t.boolean("cache_roles_on_fetch").defaultTo(true);
        t.boolean("cache_forms_on_fetch").defaultTo(true);
        t.boolean("cache_categories_on_fetch").defaultTo(true);
        t.boolean("cache_tags_on_fetch").defaultTo(true);
        t.boolean("cache_rosters_on_fetch").defaultTo(true);
        t.integer("cache_ttl").defaultTo(120);
      });
    }),

    // knex.schema.hasTable("events").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("events", (t) => {
    //     t.increments("id").primary();
    //     t.integer("category_id").references("categories.id").defaultTo(1);
    //     t.integer("user_id")
    //       .references("users.id")
    //       .onUpdate("CASCADE")
    //       .onDelete("CASCADE");
    //     t.string("title");
    //     t.string("start_time");
    //     t.string("end_time");
    //     t.string("color");
    //     t.enum("interval", ["once", "daily", "weekly", "monthly"]).defaultTo(
    //       "once"
    //     );
    //     t.text("description");
    //     t.boolean("rvsp").defaultTo(false);
    //     t.boolean("all_day").defaultTo(false);
    //     t.index("user_id");
    //     t.timestamps();
    //   });
    // }),
    // knex.schema.hasTable("event_meta").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("event_meta", (t) => {
    //     t.increments("id").primary();
    //     t.string("group_id").nullable();
    //     t.integer("event_id")
    //       .references("events.id")
    //       .onDelete("CASCADE")
    //       .onUpdate("CASCADE");
    //     t.date("start_date");
    //     t.date("end_date");
    //   });
    // }),
    // // knex.schema.raw("ALTER TABLE events_meta ADD duration daterange"),
    // knex.schema.hasTable("event_roles").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("event_roles", (t) => {
    //     t.integer("event_id")
    //       .references("events.id")
    //       .onUpdate("CASCADE")
    //       .onDelete("CASCADE");
    //     t.integer("role_id")
    //       .references("roles.id")
    //       .onUpdate("CASCADE")
    //       .onDelete("CASCADE");
    //   });
    // }),
    // knex.schema.hasTable("event_participants").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("event_participants", (t) => {
    //     t.integer("event_id")
    //       .references("event_meta.id")
    //       .onUpdate("CASCADE")
    //       .onDelete("CASCADE");
    //     t.integer("user_id")
    //       .references("users.id")
    //       .onUpdate("CASCADE")
    //       .onDelete("CASCADE");
    //   });
    // }),
    knex.schema.hasTable("discord_watched_roles").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_watched_roles", (t) => {
        t.uuid("id").primary();
        t.uuid("discord_role_id")
          .references("discord_roles.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
      });
    }),
    knex.schema.hasTable("discord_applicant_forms").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("discord_applicant_forms", (t) => {
        t.uuid("id").primary();
        t.uuid("roster_member_form_id")
          .references("roster_member_forms.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
        t.uuid("applicant_id")
          .references("roster_members.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
        t.string("message_id");
        t.string("channel_id");
        t.string("guild_id");
      });
    }),
    knex.schema.hasTable("categories").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("categories", (t) => {
        t.increments("id").primary();
        t.string("name").unique();
        t.string("image").nullable();
        t.boolean("is_deletable").defaultTo(true);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("tags").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("tags", (t) => {
        t.increments("id").primary();
        t.string("name").unique();
        t.string("color");
        t.boolean("is_deletable").defaultTo(true);
        t.timestamps();
      });
    }),
    // knex.schema.hasTable("post_types").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("post_types", (t) => {
    //     t.uuid("id").primary();
    //     t.integer("user_id").references("users.id");
    //     t.string("name").unique();
    //     t.timestamps();
    //   });
    // }),
    knex.schema.hasTable("rosters").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("rosters", (t) => {
        t.uuid("id").primary();
        t.string("name").unique();
        t.string("url").unique();
        t.string("banner").nullable();
        t.string("icon").nullable();
        t.boolean("enable_recruitment").defaultTo(false);
        t.boolean("apply_roles_on_approval").defaultTo(false);
        t.boolean("private").defaultTo(false);
        t.boolean("auto_approve").defaultTo(false);
        t.boolean("show_fields_as_columns").defaultTo(false);
        t.boolean("assign_discord_roles_on_approval").defaultTo(false);
        t.boolean("link_to_discord").defaultTo(false);
        t.string("applicant_form_channel_id");
        t.integer("creator_id")
          .references("users.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.boolean("is_deletable").defaultTo(true);
        t.boolean("is_disabled").defaultTo(false);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("roster_member_forms").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_member_forms", (t) => {
        t.uuid("id").primary();
        t.integer("form_id")
          .references("id")
          .inTable("forms")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.uuid("roster_id")
          .references("rosters.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.uuid("roster_member_id")
          .references("roster_members.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.timestamps();
      });
    }),
    knex.schema.hasTable("roster_members").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_members", (t) => {
        t.uuid("id").primary();
        t.uuid("roster_id")
          .references("rosters.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.integer("member_id")
          .references("users.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.enum("status", ["pending", "approved", "rejected"]).defaultTo(
          "pending"
        );
        t.boolean("is_deletable").defaultTo(true);
        t.uuid("roster_rank_id").references("roster_ranks.id");
        t.timestamp("approved_on");
        t.timestamps();
      });
    }),
    knex.schema.hasTable("roster_member_permissions").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_member_permissions", (t) => {
        t.uuid("id").primary();
        t.uuid("member_id")
          .references("roster_members.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.boolean("can_add_members").default(false);
        t.boolean("can_edit_members").default(false);
        t.boolean("can_edit_member_ranks").default(false);
        t.boolean("can_add_ranks").default(false);
        t.boolean("can_edit_ranks").default(false);
        t.boolean("can_remove_ranks").default(false);
        t.boolean("can_remove_members").default(false);
        t.boolean("can_edit_roster_details").default(false);
        t.boolean("can_delete_roster").default(false);
      });
    }),
    knex.schema.hasTable("roster_ranks").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_ranks", (t) => {
        t.uuid("id").primary();
        t.uuid("roster_id")
          .references("rosters.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.string("name");
        t.string("icon");
        t.integer("priority").defaultTo(5);
        t.boolean("is_deletable").defaultTo(true);
        t.boolean("is_recruit").defaultTo(false);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("roster_forms").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_forms", (t) => {
        t.uuid("roster_id")
          .references("rosters.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.integer("form_id")
          .references("forms.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
      });
    }),
    knex.schema.hasTable("roster_permissions").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_permissions", (t) => {
        t.uuid("id").primary();
        t.uuid("roster_rank_id")
          .references("roster_ranks.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.boolean("can_add_members").default(false);
        t.boolean("can_edit_members").default(false);
        t.boolean("can_edit_member_ranks").default(false);
        t.boolean("can_remove_members").default(false);
        t.boolean("can_add_ranks").default(false);
        t.boolean("can_edit_ranks").default(false);
        t.boolean("can_remove_ranks").default(false);
        t.boolean("can_edit_roster_details").default(false);
        t.boolean("can_delete_roster").default(false);
      });
    }),
    knex.schema.hasTable("roster_roles").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("roster_roles", (t) => {
        t.uuid("roster_id")
          .references("rosters.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.integer("role_id")
          .references("roles.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
      });
    }),
    knex.schema.hasTable("forms").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("forms", (t) => {
        t.increments("id").primary();
        t.integer("creator_id")
          .references("users.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
        t.string("name");
        t.text("description");
        t.boolean("is_deletable").defaultTo(true);
        t.timestamps();
      });
    }),
    knex.schema.hasTable("fields").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("fields", (t) => {
        t.uuid("id").primary();
        t.text("value");
        t.string("alias").nullable();
        t.boolean("use_as_column").defaultTo(false);
        t.integer("order");
        t.boolean("multiple").defaultTo(false);
        t.enum("type", [
          "textfield",
          "textarea",
          "multiple",
          "select",
          "checkbox",
        ]);
        t.jsonb("options").nullable();
        t.boolean("optional").defaultTo(false);
      });
    }),
    knex.schema.hasTable("form_fields").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("form_fields", (t) => {
        t.integer("form_id")
          .references("forms.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
        t.uuid("field_id")
          .references("fields.id")
          .onUpdate("CASCADE")
          .onDelete("CASCADE");
      });
    }),
    knex.schema.hasTable("menu").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("menu", (t) => {
        t.increments("id").primary();
        t.integer("order");
        t.string("title");
        t.string("icon");
        t.string("to");
        t.timestamps();
      });
    }),
    knex.schema.hasTable("menu_tree").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("menu_tree", (t) => {
        t.integer("menu_parent_id").references("menu.id");
        t.integer("menu_child_id").references("menu.id");
      });
    }),
    // knex.schema.hasTable("posts").then((exists) => {
    //   if (exists) return;
    //   return knex.schema.createTable("posts", (t) => {
    //     t.increments("id").primary();
    //     t.integer("user_id").references("users.id");
    //     t.integer("post_type").references("post_types.id");
    //     t.string("slug");
    //     t.string("title");
    //     t.string("featured_image");
    //     t.jsonb("data");
    //     t.text("excerpt");
    //     t.boolean("has_excerpt").defaultTo(false);
    //     t.boolean("is_deletable").defaultTo(true);
    //     t.timestamps();
    //   });
    // }),
    knex.schema.hasTable("media").then((exists) => {
      if (exists) return;
      return knex.schema.createTable("media", (t) => {
        t.uuid("id").primary();
        t.string("mimetype");
        t.string("url");
        t.string("storage_key");
        t.integer("owner_id")
          .references("users.id")
          .onDelete("CASCADE")
          .onUpdate("CASCADE");
        t.timestamps();
      });
    }),

    // knex.schema.raw(
    //   `CREATE OR REPLACE RULE check_user_role_duplicates AS ON INSERT TO user_roles WHERE EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = NEW.user_id AND WHERE user_roles.role_id = NEW.role_id) DO INSTEAD NOTHING`
    // ),
  ]);
};

exports.down = async function (knex) {
  return Promise.all([
    knex.raw(
      `DROP TABLE IF EXISTS rosters, roster_forms, roster_member_permissions, roster_permissions, roster_members, 
    roster_ranks, roster_roles, media_share, roster_form_fields,
    roster_member_forms, roster_table_columns, user_sessions, user_policies, form_fields, fields, 
    forms, menu_tree, menu, event_participants, 
    event_roles, event_meta, events, categories, 
    user_roles, role_maps, discord_reaction_role_assignment, discord_roles, discord_messages, discord_message_drafts, discord_webhooks, discord_watched_roles, discord_applicant_forms, role_policies, policies, post_types,
    users, roles, media, posts, testimonies, tags, bot_watched_roles, bot_applicant_forms,
    settings, front_page_info`
    ),
    knex.raw(DROP_BEFORE_INSERT),
  ]);
};
