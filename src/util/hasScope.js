"use strict";
/**
 * Checks user permissions
 * Returns a boolean if all the requirments are met.
 * @param {*} obj
 * @param {*} scope
 * @param {*} options
 * @returns {boolean}
 */

const isString = (v) => typeof v === "string";
const isArray = (v) => Array.isArray(v);

module.exports = function hasScope(
  obj,
  scope,
  options = { key: "permissions" }
) {
  if (isString(scope)) {
    scope = [[scope]];
  } else if (isArray(scope) && scope.every(isString)) {
    scope = [scope];
  }

  if (!obj[options.key]) {
    throw new ReferenceError(`Obj is missing property '${options.key}'`);
  }

  return scope.some((req) => req.every((r) => obj[options.key].includes(r)));
};
