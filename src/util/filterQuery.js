"use strict";
/**
 *
 * @param {promise} query The unresolved promise to be filtered
 * @param {object} filters An object holding key/value pairs to filter the query by
 * @param {string} table The table prefix
 */
module.exports = function filterQuery(query, filters, table) {
  if (filters && Object.keys(filters).length) {
    Object.entries(filters).forEach(([key, val]) => {
      if (/^searchBy/.test(key)) {
        if (val) {
          let identifier = key.split("searchBy")[1];

          /** Split PascalCase */
          const parts = identifier.trim().split(/(?=[A-Z])/);

          if (parts && Array.isArray(parts) && parts.length > 1) {
            identifier = identifier.join(".");
          } else {
            identifier = parts[0];
          }

          query = query.andWhere(identifier.toLowerCase(), "like", `${val}%`);
        }
      } else if (key === "exclude" && val.length) {
        query = query.whereNotIn(`${table}.id`, val);
      } else if (key === "limit") {
        query = query.limit(parseInt(val, 10));
      } else {
        if (Array.isArray(val) && val.length) {
          query = query.whereIn(key, val);
        } else {
          query = query.andWhere(key, val);
        }
      }
    });
  }

  return query;
};
