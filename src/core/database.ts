import { prisma } from "../infrastructure/database/prisma.js";

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();

  console.log("🗄️ Banco de dados conectado.");
}