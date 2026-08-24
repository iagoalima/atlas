import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../types/command.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica se o Atlas está funcionando.");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.reply("🏓 Pong!");
}