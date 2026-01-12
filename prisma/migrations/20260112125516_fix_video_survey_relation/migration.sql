/*
  Warnings:

  - You are about to drop the column `surveyId` on the `Video` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_surveyId_fkey";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "surveyId";

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
