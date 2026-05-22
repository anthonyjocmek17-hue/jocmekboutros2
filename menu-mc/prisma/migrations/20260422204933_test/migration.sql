-- AlterTable
ALTER TABLE "Order" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "estimatedReadyAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "readyAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "startedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isOutOfStock" BOOLEAN NOT NULL DEFAULT false,
    "prepTimeMinutes" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("categoryId", "createdAt", "description", "id", "isAvailable", "name", "price", "sortOrder", "updatedAt") SELECT "categoryId", "createdAt", "description", "id", "isAvailable", "name", "price", "sortOrder", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
