-- CreateTable
CREATE TABLE "medal_delivery_roles" (
    "id" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medal_delivery_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medal_delivery_roles_medalId_idx" ON "medal_delivery_roles"("medalId");

-- CreateIndex
CREATE UNIQUE INDEX "medal_delivery_roles_medalId_roleId_key" ON "medal_delivery_roles"("medalId", "roleId");

-- AddForeignKey
ALTER TABLE "medal_delivery_roles" ADD CONSTRAINT "medal_delivery_roles_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "medals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
