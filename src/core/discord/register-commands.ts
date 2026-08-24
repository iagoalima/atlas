import { REST, Routes } from "discord.js";
import { env } from "../../config/env.js";
import { commands, loadCommands } from "./commands.js";

await loadCommands();

const rest = new REST({ version: "10" }).setToken(env.discordToken);

const commandData = commands.map((command) => command.data.toJSON());

await rest.put(
  Routes.applicationCommands(env.clientId),
  { body: commandData }
);

console.log(`✅ ${commandData.length} comando(s) registrado(s).`);