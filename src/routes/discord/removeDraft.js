"use strict";
const sanitize = require("sanitize-html");

const sanitizeHtml = (v) => sanitize(v, { ALLOW_TAGS: [], ALLOW_ATTR: [] });

const { DiscordMessageDraft } = require("$models/DiscordMessage");

const { param } = require("express-validator");
const { validate } = require("$util");

const middleware = [
  validate([
    param("id")
      .isString()
      .isUUID()
      .trim()
      .customSanitizer((v) => sanitizeHtml(v)),
  ]),
];

const removeDraft = async function (req, res, next) {
  const trx = await DiscordMessageDraft.startTransaction();

  try {
    let deleted = await DiscordMessageDraft.query(trx)
      .where("id", req.params.id)
      .andWhere("author_id", req.user.id)
      .throwIfNotFound()
      .returning(["id", "name"])
      .delete();

    await trx.commit();
    res.status(200).send(deleted);
  } catch (err) {
    console.log(err);
    await trx.rollback();
    return next(err);
  }
};

module.exports = {
  path: "/drafts/:id",
  method: "DELETE",
  middleware,
  handler: removeDraft,
};
