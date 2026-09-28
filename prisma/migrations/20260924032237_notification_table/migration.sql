-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "data" JSONB,
    "readAt" BOOLEAN NOT NULL DEFAULT false,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_readAt_idx" ON "notification"("readAt");
