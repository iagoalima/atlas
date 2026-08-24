import { Collection } from "discord.js";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "../../types/command.js";
import "../../interactions/autocomplete/admin.autocomplete.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const commands = new Collection<string, Command>();

function configureAdminAutocompletes(command: Command): void {
  const builder = command.data as any;

  if (command.data.name === "categoria-admin") {
    for (const subcommand of builder.options ?? []) {
      const categoryOption = (subcommand.options ?? []).find(
        (option: any) => option.name === "categoria"
      );

      if (categoryOption) {
        categoryOption.autocomplete = true;
      }
    }
  }

  if (command.data.name === "medal-admin") {
    for (const subcommand of builder.options ?? []) {
      for (const option of subcommand.options ?? []) {
        if (option.name === "medalha" || option.name === "categoria") {
          option.autocomplete = true;
        }
      }
    }
  }
}

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

    const loadedCommand: Command = {
      data: command.data,
      execute: command.execute,
    };

    configureAdminAutocompletes(loadedCommand);

    commands.set(command.data.name, loadedCommand);

    console.log(`📦 Comando carregado: /${command.data.name}`);
  }
}