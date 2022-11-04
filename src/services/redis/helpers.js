"use strict";
const redis = require("$services/redis");
const Settings = require("$models/Settings");

const isUndefined = (v) => v === undefined;
const isObjectEmpty = (obj) =>
  obj && typeof obj === "object" && !!Object.keys(obj).length;

const getCachedObject = async (key, obj, shouldCache = true, ttl = 120) => {
  if (!shouldCache) return obj;

  try {
    if (await redis.exists(key)) {
      return JSON.parse(await redis.get(key));
    }
    await redis.set(key, JSON.stringify(obj), "NX", "EX", ttl);
    return obj;
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Returns a cached database query result if prompted.
 * @param {String} key The redis key to save the query under
 * @param {Promise} query The unresolved query
 * @param {Boolean} shouldCache A boolean specifying whether the query should be cached or not
 * @param {Object} filters A filter objection which decides if a query should be cached or not.
 * @param {Boolean} pagination Whether the results should have cursor pagination
 * @param {Number} ttl How long the query results should live in-memory in seconds.
 */

const getCachedQuery = async function (
  key,
  query,
  shouldCache = true,
  filters = undefined,
  ttl = 60
) {
  if (!isUndefined(filters) || !isObjectEmpty(filters)) return query;

  if (!shouldCache) return query;

  try {
    if (await redis.exists(key)) {
      return JSON.parse(await redis.get(key));
    }

    const data = await query;

    // if (pagination && data && data.results.length) {
    //   await redis.set(key, JSON.stringify(data), "NX", "EX", ttl);
    // }

    if (data) {
      await redis.set(key, JSON.stringify(data), "NX", "EX", ttl);
    }

    return data;
  } catch (err) {
    return Promise.reject(err);
  }
};

const getCachedSettings = function (select, ttl = 60) {
  const columns = [
    "show_history_carousel_on_frontpage",
    "show_video",
    "show_video_on_mobile",
    "show_testimonies",
    "enable_account_media_sharing",
    "show_recruitment_button",
    "enable_user_authentication",
    "enable_user_registration",
    "enable_social_authentication",
    "enable_local_authentication",
    "enable_email_request_throttling",
    "require_account_verification",
    "allow_users_to_delete_account",
    "universal_request_ttl_in_minutes",
    "number_of_login_attempts",
    "time_till_next_username_change",
    "front_page_video_url",
    "enable_bot",
    "bot_prefix",
    "bot_server_id",
    "bot_recruitment_channel_id",
    "cache_users_on_fetch",
    "cache_roles_on_fetch",
    "cache_forms_on_fetch",
    "cache_categories_on_fetch",
    "cache_tags_on_fetch",
    "cache_rosters_on_fetch",
  ];

  const s = Array.isArray(select) && select.length ? select : columns;

  return getCachedQuery(
    "settings",
    Settings.query().select(s).first(),
    true,
    undefined,
    ttl
  );
};

const getResultsByPattern = (pattern) => {
  return new Promise((resolve, reject) => {
    const stream = redis.scanStream({
      match: pattern,
      count: 100,
    });
    const items = [];
    stream.on("data", (keys) => {
      if (keys.length) {
        keys.forEach((key) => {
          if (!items.includes(key)) {
            items.push(key);
          }
        });
      }
    });
    stream.on("end", () => resolve(keys));
  });
};

const deleteCacheByPattern = (pattern) => {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  stream.on("data", (keys) => {
    if (keys.length) {
      redis.unlink(keys);
    }
  });
};

module.exports = {
  getCachedQuery,
  getCachedObject,
  getCachedSettings,
  getResultsByPattern,
  deleteCacheByPattern,
};
