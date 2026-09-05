-- CreateEnum
CREATE TYPE "StructureStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RuleCalculationType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SalaryRuleCategory" ADD VALUE 'EARNING';
ALTER TYPE "SalaryRuleCategory" ADD VALUE 'EMPLOYER_CONTRIBUTION';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "SalaryRule" ADD COLUMN     "calculationType" "RuleCalculationType" NOT NULL DEFAULT 'FIXED_AMOUNT',
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "fixedAmount" DECIMAL(12,2),
ADD COLUMN     "formula" TEXT,
ADD COLUMN     "percentage" DECIMAL(5,4),
ADD COLUMN     "roundingRule" TEXT,
ADD COLUMN     "status" "RuleStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "category" SET DEFAULT 'EARNING';

-- AlterTable
ALTER TABLE "SalaryStructure" ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "status" "StructureStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
