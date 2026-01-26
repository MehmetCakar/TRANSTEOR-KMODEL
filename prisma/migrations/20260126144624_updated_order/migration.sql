/*
  Warnings:

  - A unique constraint covering the columns `[order]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Video_order_key" ON "Video"("order");
