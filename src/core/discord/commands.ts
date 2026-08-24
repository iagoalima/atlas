import { Collection } from "discord.js";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "../../types/command.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const commands = new Collection<string, Command>();

export async function loadCommands(): Promise<void> {
  const commandsPath = path.resolve(__dirname, "../../commands");
  const files = await readdir(commandsPath);

  for (const file of files) {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) continue;

    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;

    const command = await import(fileUrl);

    if (!command.data || !command.execute) {
      console.warn(`⚠️ Comando inválido: ${file}`);
      continue;
    }

    commands.set(command.data.name, {
      data: command.data,
      execute: command.execute,
    });

    console.log(`📦 Comando carregado: /${command.data.name}`);
  }
}