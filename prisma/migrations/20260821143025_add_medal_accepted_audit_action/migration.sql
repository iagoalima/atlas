/*
  Warnings:

  - You are about to drop the `medal_delivery_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MEDAL_ACCEPTED';

-- DropForeignKey
ALTER TABLE "medal_delivery_roles" DROP CONSTRAINT "medal_delivery_roles_medalId_fkey";

-- DropTable
DROP TABLE "medal_delivery_roles";

-- CreateTable
CREATE TABLE "medal_delivery_permission_roles" (
    "id" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medal_delivery_permission_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medal_delivery_permission_roles_medalId_idx" ON "medal_delivery_permission_roles"("medalId");

-- CreateIndex
CREATE UNIQUE INDEX "medal_delivery_permission_roles_medalId_roleId_key" ON "medal_delivery_permission_roles"("medalId", "roleId");

-- AddForeignKey
ALTER TABLE "medal_delivery_permission_roles" ADD CONSTRAINT "medal_delivery_permission_roles_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "medals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
