import { ButtonInteraction } from "discord.js";

export async function handleProofUploadButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("request_proof_help:")) return false;
  await interaction.reply({ content: "## 📎 Como enviar as provas\n\nEnvie agora, nesta conversa privada com o Atlas, todos os arquivos que comprovam a medalha indicada.\n\nQuando os arquivos forem recebidos, o Atlas avançará automaticamente para a próxima medalha.\n\n-# O botão apenas inicia a etapa de envio; os arquivos são enviados normalmente como anexos na mensagem do Discord." });
  return true;
}
