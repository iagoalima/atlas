-- CreateTable
CREATE TABLE "ticket_force_close_approvals" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_force_close_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_force_close_approvals_ticketId_idx" ON "ticket_force_close_approvals"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_force_close_approvals_ticketId_userId_key" ON "ticket_force_close_approvals"("ticketId", "userId");

-- AddForeignKey
ALTER TABLE "ticket_force_close_approvals" ADD CONSTRAINT "ticket_force_close_approvals_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
