/*
  Warnings:

  - A unique constraint covering the columns `[surveyId,order]` on the table `SurveyQuestion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "SurveyQuestion" DROP CONSTRAINT "SurveyQuestion_surveyId_fkey";

-- CreateTable
CREATE TABLE "SurveyOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurveyOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyOption_questionId_idx" ON "SurveyOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyOption_questionId_order_key" ON "SurveyOption"("questionId", "order");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestion_surveyId_order_key" ON "SurveyQuestion"("surveyId", "order");

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyOption" ADD CONSTRAINT "SurveyOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
