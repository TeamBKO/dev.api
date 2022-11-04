"use strict";
require("dotenv");
const args = require("minimist-lite")(process.argv.splice(2));
const fs = require("node:fs");
const path = require("node:path");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord.js");

const commands = [];
const commandsPath = path.join(_dirname, "commands");
const commandsFiles = fs
  .readdirSync(commandsPth)
  .filter((file) => file.endsWith(".js"));

for (const file of commandsFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  commands.push(command.toJSON());
}

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);

rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, args.guild)
);
