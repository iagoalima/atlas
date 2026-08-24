import { client } from "../core/discord/client.js";
import { env } from "../config/env.js";

client.once("ready", (bot) => {
  console.log(`Atlas conectado como ${bot.user.tag}`);
});

client.login(env.discordToken);