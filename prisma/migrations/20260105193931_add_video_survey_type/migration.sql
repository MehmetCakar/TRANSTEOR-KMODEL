/*
  Warnings:

  - A unique constraint covering the columns `[videoId]` on the table `Survey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "SurveyType" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "videoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Survey_videoId_key" ON "Survey"("videoId");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
