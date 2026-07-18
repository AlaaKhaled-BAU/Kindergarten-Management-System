import { PrismaClient } from "@prisma/client";
import { seedDefaultFees } from "../src/lib/db-init";

const prisma = new PrismaClient();

async function main() {
  console.log("بدء زراعة قاعدة البيانات...\n");
  await seedDefaultFees(prisma);
  console.log("اكتملت زراعة قاعدة البيانات.");
}

main()
  .catch((e) => {
    console.error("خطأ في زراعة قاعدة البيانات:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
