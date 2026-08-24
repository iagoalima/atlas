import { prisma } from "../infrastructure/database/prisma.js";

/**
 * Retorna os cargos vinculados a uma medalha.
 */
export async function getMedalRoles(medalId: string) {
  return prisma.medalRole.findMany({
    where: {
      medalId,
    },
  });
}

/**
 * Vincula um cargo do servidor de entrega a uma medalha.
 */
export async function addMedalRole(
  medalId: string,
  roleId: string
): Promise<void> {
  await prisma.medalRole.upsert({
    where: {
      medalId_roleId: {
        medalId,
        roleId,
      },
    },
    update: {},
    create: {
      medalId,
      roleId,
    },
  });
}

/**
 * Remove um cargo vinculado a uma medalha.
 */
export async function removeMedalRole(
  medalId: string,
  roleId: string
): Promise<void> {
  await prisma.medalRole.deleteMany({
    where: {
      medalId,
      roleId,
    },
  });
}

/**
 * Remove todos os cargos vinculados a uma medalha.
 */
export async function clearMedalRoles(
  medalId: string
): Promise<void> {
  await prisma.medalRole.deleteMany({
    where: {
      medalId,
    },
  });
}