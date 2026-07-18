# **Kindergarten ERP — AI Agent Execution Blueprint**

## **1\. Project Context & Absolute Constraints**

**Objective:** Build a robust, offline, cross-platform Desktop ERP application for a Kindergarten. The system manages student records, financial operations (fees, payments, receipts, expenses), and reporting.

**Core Architecture (The Ledger):** Financial integrity is paramount. The system relies on an immutable Transactions table (The Ledger) as the single source of truth for all student balances. Balances are calculated dynamically by summing transaction amounts (Charges \= positive, Payments \= negative).

**Tech Stack:**

* **Framework:** Next.js 15 (App Router) wrapped in **Electron** (via electron-forge or nextron) for offline desktop capabilities.  
* **Database:** SQLite.  
* **ORM:** Prisma ORM.  
* **Styling:** Tailwind CSS \+ shadcn/ui (or similar headless accessible components).  
* **Logic:** Next.js Server Actions for secure database operations.  
* **File Generation:** @react-pdf/renderer or native browser print for PDFs, exceljs for Excel.

**Strict Constraints for AI Agent:**

1. **Arabic ONLY:** The application MUST be entirely in Arabic. Do not implement i18n or English fallbacks. Hardcode Arabic strings. The entire HTML document MUST be \<html lang="ar" dir="rtl"\>.  
2. **Offline First:** The app runs locally on a single machine. SQLite is stored locally. No cloud dependencies.  
3. **Transactional Integrity:** Any operation involving multiple ledger entries (e.g., issuing a receipt, promoting a student) MUST use Prisma $transaction to ensure all-or-nothing execution.

## **Phase 1: Project Initialization & Configuration**

1. **Initialize Next.js \+ Electron:** Set up the Next.js project configured to run within an Electron window. Ensure the build outputs a standalone desktop application (.exe for Windows).  
2. **Tailwind RTL Setup:** Configure Tailwind CSS. No special plugins are needed, but ensure logical properties are used (e.g., ms-4 instead of ml-4, start-0 instead of left-0) so the UI flows naturally from right to left.  
3. **Font Setup:** Integrate Arabic fonts (e.g., 'Cairo' or 'Tajawal' for UI, 'Scheherazade New' for printed PDFs).

## **Phase 2: Database Design (Prisma Schema)**

Implement the exact schema below in prisma/schema.prisma.

datasource db {  
  provider \= "sqlite"  
  url      \= env("DATABASE\_URL") // "file:../kindergarten.db"  
}

generator client {  
  provider \= "prisma-client-js"  
}

model Student {  
  id                      Int       @id @default(autoincrement())  
  firstName               String    // first\_name  
  lastName                String    // last\_name  
  dateOfBirth             DateTime?  
  grade                   String    // "Pre", "KG1", "KG2"  
  academicYear            String    // "YYYY-YYYY"  
  enrollmentDate          DateTime  @default(now())  
  isActive                Boolean   @default(true)  
  notes                   String?  
  busFees                 Float     @default(0)  
  additionalFees          Float     @default(0)  
  discountValue           Float     @default(0)  
  discountIsPercent       Boolean   @default(false)  
  exitStatus              Int       @default(0) // 0=None, 1=Half-day, 2=Full-day  
  tuitionOverride         Float?  
  globalId                String?   // GUID tracking across academic years  
  allergies               String?  
  medicalNotes            String?  
  siblingGlobalId         String?

  parents                 StudentParent\[\]  
  pickups                 AuthorizedPickupPerson\[\]  
  fees                    StudentFee\[\]  
  payments                Payment\[\]  
  transactions            Transaction\[\]  
  refunds                 Refund\[\]

  @@index(\[grade, academicYear\])  
}

model Parent {  
  id              Int       @id @default(autoincrement())  
  fullName        String  
  phone           String  
  alternatePhone  String?  
  email           String?  
  address         String?  
  students        StudentParent\[\]  
}

model StudentParent {  
  studentId    Int  
  parentId     Int  
  relationship String?  
  student      Student @relation(fields: \[studentId\], references: \[id\])  
  parent       Parent  @relation(fields: \[parentId\], references: \[id\])

  @@id(\[studentId, parentId\])  
}

model AuthorizedPickupPerson {  
  id           Int     @id @default(autoincrement())  
  studentId    Int  
  fullName     String  
  relationship String?  
  phone        String?  
  notes        String?  
  student      Student @relation(fields: \[studentId\], references: \[id\])  
}

model Fee {  
  id              Int       @id @default(autoincrement())  
  name            String  
  description     String?  
  amount          Float  
  feeType         String    // "Monthly", "OneTime", "Annual"  
  applicableGrade String?   // Null \= all grades  
  academicYear    String?  
  isActive        Boolean   @default(true)  
  studentFees     StudentFee\[\]  
}

model StudentFee {  
  id        Int       @id @default(autoincrement())  
  studentId Int  
  feeId     Int  
  dueDate   DateTime?  
  student   Student   @relation(fields: \[studentId\], references: \[id\])  
  fee       Fee       @relation(fields: \[feeId\], references: \[id\])  
}

model Payment {  
  id              Int       @id @default(autoincrement())  
  studentId       Int  
  amount          Float  
  paymentDate     DateTime  
  paymentMethod   String    @default("Cash") // "نقداً", "شيك", "تحويل بنكي", "بطاقة ائتمان"  
  referenceNumber String?  
  notes           String?  
  student         Student   @relation(fields: \[studentId\], references: \[id\])  
  receipts        Receipt\[\]  
}

model Receipt {  
  id               Int       @id @default(autoincrement())  
  receiptNumber    Int       @unique  
  paymentId        Int  
  issueDate        DateTime  
  amount           Float  
  studentName      String    // Denormalized  
  kindergartenName String    // Denormalized  
  isCanceled       Boolean   @default(false)  
  cancelDate       DateTime?  
  cancelReason     String?  
  payment          Payment   @relation(fields: \[paymentId\], references: \[id\])  
}

model Revenue {  
  id          Int      @id @default(autoincrement())  
  year        Int  
  month       Int  
  category    String  
  amount      Float  
  description String?  
  recordDate  DateTime  
  source      String?  // 'Payment', 'Import', 'Manual', 'Cancellation'  
}

model Expense {  
  id              Int      @id @default(autoincrement())  
  year            Int  
  month           Int  
  category        String  
  amount          Float  
  description     String?  
  expenseDate     DateTime  
  vendor          String?  
  referenceNumber String?  
  source          String?  // 'Import', 'Manual'  
}

model Transaction {  
  id              Int      @id @default(autoincrement())  
  studentId       Int  
  transactionType String   // "Charge", "Payment", "Adjustment", "Reversal", "BalanceTransferOut", "BalanceTransferIn"  
  amount          Float    // Positive=charge (debt), Negative=payment (credit)  
  transactionDate DateTime @default(now())  
  description     String?  
  referenceId     String?  // e.g. "Receipt:1001", "Fee:Tuition"  
  createdBy       String?  
  createdAt       DateTime @default(now())  
  student         Student  @relation(fields: \[studentId\], references: \[id\])

  @@index(\[studentId\])  
}

model Refund {  
  id          Int      @id @default(autoincrement())  
  studentId   Int  
  amount      Float  
  refundDate  DateTime  
  reason      String  
  notes       String?  
  createdBy   String  
  createdAt   DateTime @default(now())  
  student     Student  @relation(fields: \[studentId\], references: \[id\])

  @@index(\[studentId\])  
}

*Agent Note: Create a seed script that populates the Fee table with defaults: Pre Tuition (350), KG1 Tuition (400), KG2 Tuition (500).*

## **Phase 3: Authentication Logic**

1. **Roles:** Admin (Full access) and Teacher (Cannot view Reports/KPI pages).  
2. **Implementation:** Read ADMIN\_PASSWORD from .env. Create a login page (/login). If password matches, set a secure HTTP-only cookie with { role: 'Admin' }. If the user chooses "Teacher Login", no password is required, set cookie { role: 'Teacher' }.  
3. **Middleware:** Protect all routes. Redirect unauthenticated users to /login. Restrict /reports to Admin only.

## **Phase 4: Core Ledger Business Logic (Server Actions)**

Implement these critical Server Actions securely handling the ledger logic.

1. **Create Student:** Insert Student \-\> Auto-assign default grade tuition Fee \-\> Insert positive Transaction (Charge). Use Prisma $transaction.  
2. **Update Student:** If Bus Fees, Additional Fees, Discount, or Grade changes, calculate the difference and post an Adjustment to the Transaction table.  
3. **Process Payment (Crucial):**  
   * Validate amount \> 0\.  
   * Find the next available receiptNumber (MAX(receiptNumber) \+ 1).  
   * Use $transaction to: Insert Payment \-\> Insert Receipt \-\> Insert Transaction (Negative amount, type: "Payment") \-\> Insert Revenue record (Source: 'Payment').  
4. **Cancel Receipt:** Set isCanceled=true on Receipt \-\> Insert positive Transaction (type: "Reversal") to undo the payment \-\> Insert negative Revenue record to reverse income.  
5. **Get Student Balance:** Query: SELECT SUM(amount) FROM Transaction WHERE studentId \= X.  
6. **Grade Promotion (Batch):** Iterate selected students. For each: Check duplicate \-\> Calc old balance \-\> Create new Student (new year/grade) \-\> Post Tuition Charge \-\> Post BalanceTransferOut (negative) on old student \-\> Post BalanceTransferIn (positive) on new student.

## **Phase 5: User Interface (Arabic RTL)**

Build the following screens exclusively in Arabic:

1. **Dashboard (لوحة القيادة):** KPI cards for Expected Income, Received Income (this month), Outstanding Balances, Collection Rate.  
2. **Students (الطلاب):** Data table with filters (Grade, Year). View/Edit modals.  
3. **Student Profile (ملف الطالب):** Shows parents, authorized pickups, and a dedicated **Ledger Tab (كشف الحساب)** showing all transactions and the running balance.  
4. **Payments & Receipts (المدفوعات والإيصالات):** UI to issue new payments. Display a table of generated receipts with a "Cancel (إلغاء)" button.  
5. **Expenses & Revenues (المصروفات والإيرادات):** Tables to record non-tuition financial entries.  
6. **Reports (التقارير):** Admin only. Monthly summary data.

## **Phase 6: PDF Reports & Arabic Data Processing**

**Arabic Numbers to Words Converter (التفقيط):**

Implement a utility function to convert numbers to Arabic words (e.g., 500.50 \-\> "خمسمائة دينار و خمسون فلساً"). Apply this to the Receipt PDF.

**PDF Generation (Use @react-pdf/renderer or customized HTML print views):**

1. **Receipt (سند قبض):** A5 Landscape. Must include: Kindergarten Name, Receipt Number, Date, Student Name, Amount in Numbers (Dinar/Fils breakdown), Amount in Words, Payment Method, and Signature line.  
2. **Student Ledger (كشف حساب طالب):** A4 Landscape. Header info, summary box (Total Fees, Discount, Net), and a detailed table of the student's transactions (Running balance).  
3. **Monthly Summary (تقرير شهر):** A4 Portrait. List of receipts, amounts, remaining balances, and grand totals.

## **Phase 7: Excel Imports & Exports**

Use exceljs library.

1. **Exports:** Generate .xlsx files for Revenue Reports, Expense Reports, and Student Balances. Ensure Excel headers are in Arabic and sheets are configured as RTL (rightToLeft: true in worksheet views).  
2. **Imports:** Allow importing legacy Revenues and Expenses. Validate columns (Year, Month, Category, Amount) before bulk inserting via Prisma.

## **Phase 8: Logging & Local Backups**

Since this is an offline app, data safety is critical.

1. **Logging:** Create a Node.js utility writing to a daily JSON file (Logs/log\_yyyy-MM-dd.json). Log: Receipt creation/cancellation, logins, imports, backups.  
2. **Backup System:** Create a Server Action triggered manually from the UI ("نسخ احتياطي"). It must use Node's fs module to copy kindergarten.db and compress it into a .zip file stored in a local Backups/ directory on the host machine. Keep the last 30 backups.