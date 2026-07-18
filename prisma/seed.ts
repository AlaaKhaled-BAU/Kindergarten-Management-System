import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("بدء زراعة قاعدة البيانات...\n");

  const fees = [
    {
      name: "رسوم صف البستان",
      amount: 350,
      feeType: "Monthly",
      applicableGrade: "Pre",
      academicYear: "2025-2026",
    },
    {
      name: "رسوم صف الروضة الأولى",
      amount: 400,
      feeType: "Monthly",
      applicableGrade: "KG1",
      academicYear: "2025-2026",
    },
    {
      name: "رسوم صف الروضة الثانية",
      amount: 500,
      feeType: "Monthly",
      applicableGrade: "KG2",
      academicYear: "2025-2026",
    },
  ];

  for (const fee of fees) {
    const existing = await prisma.fee.findFirst({
      where: {
        name: fee.name,
        applicableGrade: fee.applicableGrade,
        academicYear: fee.academicYear,
      },
    });

    if (!existing) {
      await prisma.fee.create({ data: fee });
      console.log(`✓ تم إنشاء: ${fee.name}`);
    } else {
      console.log(`• موجود مسبقاً: ${fee.name}`);
    }
  }

  console.log("\nاكتملت زراعة قاعدة البيانات.");
}

main()
  .catch((e) => {
    console.error("خطأ في زراعة قاعدة البيانات:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
