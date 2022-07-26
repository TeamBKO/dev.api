"use strict";
const getCache = require("$util/getCache");
module.exports = async (key, query, hasFilters = false) => {
  if (hasFilters) {
    return query;
  }
  return getCache(key, query);
};
