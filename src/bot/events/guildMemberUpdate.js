"use strict";
const Role = require("$models/Role");
const User = require("$models/User");

class DiscordMember {
  constructor(oldMember, newMember) {
    const oldRoles = oldMember._roles;
    const newRoles = newMember._roles;

    this.id = newMember.id;
    this.roles = newRoles;
    this.old = oldRoles;
    /** CHECK TO SEE IF A ROLE IS BEING REMOVED */
    this.removing = oldRoles.some((role) => !newRoles.includes(role));
  }

  get role() {
    if (this.removing) {
      return this.old.filter((role) => !this.roles.includes(role))[0];
    } else {
      return this.roles.filter((role) => !this.old.includes(role))[0];
    }
  }
}

module.exports = {
  name: "guildMemberUpdate",
  once: false,
  async execute(oldMember, newMember, client) {
    let watched = [];

    if (process.env.DISCORD_WATCHED_ROLES) {
      watched = process.env.DISCORD_WATCHED_ROLES.split(",");
    }

    if (!watched || !watched.length) return;

    const m = new DiscordMember(oldMember, newMember);

    if (!watched.includes(m.role)) return;

    console.log(m);

    const user = await User.query().where("discord_id", m.id).select("id");

    if (!user) return;

    const roles = await Role.query()
      .withGraphJoined("role_maps")
      .whereIn("role_maps.discord_role_id", m.roles)
      .select("role_id as id");

    if (!roles || !roles.length) return;

    const options = { relate: true, unrelate: true };

    const data = { id: user.id, roles };

    const trx = await User.startTransaction();

    try {
      await User.query(trx).upsertGraph(data, options);
      await trx.commit();
    } catch (err) {
      await trx.rollback();
    }
  },
};
