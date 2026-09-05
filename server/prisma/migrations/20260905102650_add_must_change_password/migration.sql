-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
