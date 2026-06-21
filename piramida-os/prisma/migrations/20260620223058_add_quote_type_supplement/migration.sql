-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('ORIGINAL', 'SUPPLEMENT');

-- AlterTable
ALTER TABLE "pricing_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "parent_quote_id" UUID,
ADD COLUMN     "quote_type" "QuoteType" NOT NULL DEFAULT 'ORIGINAL';

-- CreateIndex
CREATE INDEX "quotes_org_id_event_id_quote_type_idx" ON "quotes"("org_id", "event_id", "quote_type");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_fkey" FOREIGN KEY ("parent_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "pricing_rules_org_scope_active_idx" RENAME TO "pricing_rules_org_id_scope_active_idx";

-- RenameIndex
ALTER INDEX "pricing_rules_org_target_scope_idx" RENAME TO "pricing_rules_org_id_target_id_scope_idx";
