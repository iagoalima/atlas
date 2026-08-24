-- CreateTable
CREATE TABLE "medal_roles" (
    "id" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medal_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medal_roles_medalId_idx" ON "medal_roles"("medalId");

-- CreateIndex
CREATE UNIQUE INDEX "medal_roles_medalId_roleId_key" ON "medal_roles"("medalId", "roleId");

-- AddForeignKey
ALTER TABLE "medal_roles" ADD CONSTRAINT "medal_roles_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "medals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
