-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('GROUP', 'DIRECT', 'COMMENT');

-- AlterTable
ALTER TABLE "Chat"
ADD COLUMN "messageType" "ChatMessageType" NOT NULL DEFAULT 'GROUP',
ADD COLUMN "recipientId" TEXT,
ADD COLUMN "shapeId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Chat_roomId_messageType_createdAt_idx" ON "Chat"("roomId", "messageType", "createdAt");

-- CreateIndex
CREATE INDEX "Chat_roomId_shapeId_createdAt_idx" ON "Chat"("roomId", "shapeId", "createdAt");

-- CreateIndex
CREATE INDEX "Chat_roomId_recipientId_createdAt_idx" ON "Chat"("roomId", "recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
