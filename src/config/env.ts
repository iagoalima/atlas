import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;
const discordToken = process.env.DISCORD_TOKEN;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não foi definida.");
}

if (!discordToken) {
  throw new Error("DISCORD_TOKEN não foi definido.");
}

export const env = {
  databaseUrl,
  discordToken,
  clientId: process.env.CLIENT_ID!,
};