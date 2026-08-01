# خطة تنفيذ وحدة المحاسبة المبسطة (Option 1)

**الهدف**: تحويل التطبيق من "متابعة رسوم الطلاب" إلى "برنامج محاسبة متكامل مبسط" للروضة: خزينة وبنوك، سندات صرف، شيكات، موردين، رواتب، وتقارير محاسبية — بدون تحويل إلى القيود المزدوجة.

**المدة المقدرة**: Part 1 (محاسبة) ≈ 13 يوم عمل + Part 2 (بوابة الأهل) ≈ 17 يوم عمل — فرد واحد
**العميل**: رخصة "برنامج محاسبة" — بيع مقابل +150 إلى +300 دينار فوق رخصة القاعدة.

---

## 1. المبادئ المعمارية (ثابتة — لا تُكسر)

1. **دفتر الخزينة الواحد**: جدول `CashMove` واحد يسجل كل حركة مال (داخل/خارج/تحويل). لا تحويل مزدوج.
2. **المبالغ بإشارة** (نفس فلسفة `Transaction`): Income = +، Expense = −، Transfer = − (خروج) / + (دخول).
3. **الرصيد دائماً محسوب، غير مخزّن**: `Account.Balance = openingBalance + SUM(CashMove.amount)`.
4. **كل عملية مالية متعددة السجلات داخل `prisma.$transaction`** — ذرّية (قاعدة التطبيق رقم 3).
5. **ترقيم الأوراق (سند قبض/سند صرف) بنمط MAX+1 مع إعادة المحاولة** (نمط `payment-actions.ts:30-55`).
6. **الربط بين الدفاتر عبر strings**: `source` = `Receipt:12` / `Voucher:5` / `PayrollRun:3` — لا FKs بين دفاتر (مثل `Transaction.referenceId`).
7. **جدول `Transaction` يبقى مصدر الحقيقة الوحيد لرصيد الطالب** — لا يُلمس.
8. **كل الوحدات الجديدة admin-only** (`requireAdmin`).

---

## 2. تصميم قاعدة البيانات (التغيير الكامل)

### يبقى كما هو — صفر تغييرات
`Student`, `Parent`, `StudentParent`, `AuthorizedPickupPerson`, `Fee`, `StudentFee`, `Payment`, `Receipt`, `Transaction`, `Refund`, `Revenue`, `Setting`

### حذف
`Expense` — يُهاجر إلى `ExpenseVoucher` ثم يُحذف.

### إضافة (7 جداول)

```prisma
// ===== الخزينة والبنوك =====

model Account {
  id             Int      @id @default(autoincrement())
  name           String                       // "الخزينة الرئيسية" / "بنك الإسكان - فرع الصويفية"
  type           String                       // "Cash" | "Bank"
  openingBalance Float    @default(0)         // رصيد افتتاحي عند الإطلاق
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  cashMoves      CashMove[]

  @@index([type])
}

model CashMove {
  id          Int      @id @default(autoincrement())
  accountId   Int
  type        String   // "Income" | "Expense" | "Transfer" | "ManualAdjust"
  amount      Float    // بإشارة: Income=+ ، Expense=- ، Transfer=-(خروج)/+(دخول)
  date        DateTime
  category    String   // "رسوم دراسية" / "إيجار" / "رواتب" ...
  description String?
  source      String?  // "Receipt:12" | "CancelReceipt:12" | "Voucher:5" | "CancelVoucher:5" | "PayrollRun:3" | "Transfer:1722..." | "ChequeBounce:7" | "ChequeCancel:9" | "Opening" | "ManualAdjust"
  createdBy   String
  createdAt   DateTime @default(now())

  account     Account  @relation(fields: [accountId], references: [id])

  @@index([accountId, date])
  @@index([date])
  @@index([category])
}

// ===== سند الصرف =====

model ExpenseVoucher {
  id            Int      @id @default(autoincrement())
  voucherNumber Int      @unique
  category      String
  amount        Float
  expenseDate   DateTime
  paymentMethod String   // "Cash" | "Cheque" | "Transfer"
  accountId     Int      // الخزينة/البنك المصروف منه — إلزامي
  supplierId    Int?
  vendor        String?  // حر (للهجرة من جدول Expense القديم)
  referenceNumber String? // رقم فاتورة المورد
  description   String?
  isCanceled    Boolean  @default(false)
  cancelReason  String?
  createdBy     String
  createdAt     DateTime @default(now())

  supplier      Supplier? @relation(fields: [supplierId], references: [id])

  @@index([expenseDate])
  @@index([category])
  @@index([accountId])
}

// ===== الموردون =====

model Supplier {
  id       Int      @id @default(autoincrement())
  name     String
  phone    String?
  address  String?
  notes    String?
  isActive Boolean  @default(true)
  createdAt DateTime @default(now())

  vouchers ExpenseVoucher[]
}

// ===== الموظفون والرواتب =====

model Employee {
  id         Int      @id @default(autoincrement())
  fullName   String
  role       String   // "معلمة" / "مديرة" / "طباخة" / "سائق"
  phone      String?
  baseSalary Float
  allowances Float    @default(0)   // بدلات شهرية ثابتة
  socialSecurityPct Float @default(0)  // % الضمان الاجتماعي (يُحسب تلقائياً كخصم)
  incomeTaxPct      Float @default(0)  // % ضريبة الدخل (نسبة مبسطة — بدون شرائح)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  payrollRuns PayrollRun[]
}

model PayrollRun {
  id          Int      @id @default(autoincrement())
  employeeId  Int
  year        Int
  month       Int
  baseSalary  Float
  allowances  Float
  deductions  Float    @default(0)   // سلف / غيابات / خصومات
  netSalary   Float
  accountId   Int?                   // الخزينة التي صُرف منها (تُعرف عند الصرف)
  paidAt      DateTime?
  paid        Boolean  @default(false)
  note        String?
  createdBy   String
  createdAt   DateTime @default(now())

  employee    Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, year, month])  // راتب واحد لكل موظف/شهر
  @@index([year, month])
}

// ===== دفتر الشيكات =====

model Cheque {
  id        Int      @id @default(autoincrement())
  number    String
  bank      String
  type      String   // "Received" (وارد من ولي أمر) | "Issued" (صادر لمورد)
  amount    Float
  issueDate DateTime
  dueDate   DateTime?
  status    String   // Received: "InCollection"|"Deposited"|"Cleared"|"Returned"
                     // Issued:   "Issued"|"Paid"|"Cancelled"
  accountId Int?     // حساب البنك المرتبط
  source    String?  // "Payment:12" / "Voucher:5"
  notes     String?
  createdAt DateTime @default(now())

  @@index([status])
  @@index([dueDate])
  @@index([type])
}
```

### ملاحظات تصميم حاسمة

- **`CashMove.amount` بإشارة** (وليس موجب دائماً) — يطابق فلسفة `Transaction`، ويجعل الإلغاءات بسيطة: إلغاء سند صرف = سطر Expense موجب. الرصيد = `opening + SUM(amount)`.
- **`PayrollRun` يفصل "التخطيط" عن "الصرف"**: `runMonthlyPayroll` يُنشئ السجلات فقط (الأرصدة المقدرة)، و`markPayrollPaid` يُسجل الخروج الفعلي من الخزينة (CashMove) + `paidAt`. بهذا لا يظهر راتب غير مدفوع في الخزينة.
- **`voucherNumber` فريد**: نفس نمط `receiptNumber` مع `MAX + 1` + إعادة المحاولة عند تصادم P2002.
- **لا علاقة بين `Revenue` و`CashMove`**: `Revenue` يبقى كما هو (مصدر التقارير القديمة)، و`CashMove` يوازيه للخزينة. الإيراد يُكتب في الاثنين داخل نفس الـ transaction.

---

## 3. الهجرة (Migration)

### 3.1 توليد المخطط
```bash
npx prisma migrate dev --name accounting-module
```
سيُنتج `prisma/migrations/XXXXXX_accounting_module/migration.sql` بجداول CREATE فقط (إضافية — آمنة).

### 3.2 هجرة بيانات Expense → ExpenseVoucher
عدّل الـ migration يدوياً — أضف قبل `DROP TABLE`:

```sql
-- 1) نسخ المصروفات القديمة كسندات صرف مرقّمة
INSERT INTO "ExpenseVoucher" (
  "voucherNumber", "category", "amount", "expenseDate", "paymentMethod",
  "accountId", "vendor", "referenceNumber", "description", "isCanceled",
  "createdBy", "createdAt"
)
SELECT
  (SELECT COALESCE(MAX("voucherNumber"), 0) FROM "ExpenseVoucher")
    + ROW_NUMBER() OVER (ORDER BY "id"),
  "category", "amount", "expenseDate", 'Cash',
  NULL, "vendor", "referenceNumber", "description", 0,
  'migration', "expenseDate"
FROM "Expense"
WHERE NOT EXISTS (SELECT 1 FROM "ExpenseVoucher" WHERE "createdBy" = 'migration');

-- 2) حذف الجدول القديم (يجب أن يسبقه النسخ دائماً)
DROP TABLE "Expense";
```

⚠️ الترتيب إلزامي: CREATE → COPY → DROP. الـ migrator الذاتي (`db-init.ts:85-115`) ينفّذ الجمل بالتسلسل فيعمل الأمر دون تدخل.

⚠️ **الحراسة ضد الازدواجية (مهم)**: الـ migrator يعمل عند كل إقلاع، و`_kg_migrations` يُكتب فقط بعد اكتمال الـ migration. لو انهار التطبيق بين النسخ والحذف (COPY تمت، DROP لم تكتمل) → في الإقلاع التالي يعاد الـ migration → **الـ INSERT محمي بـ `WHERE NOT EXISTS`** فلم يُنسخ شيء → DROP يعمل — النتيجة صحيحة مهما تكرر. بدون هذا الشرط كانت كل المصروفات تتكرر.

### 3.3 لماذا يعمل الترقية تلقائياً عند العميل الأول
- `ensureDatabaseReady()` يطبّق كل migrations جديدة عند كل إقلاع (`db-init.ts:60-118`).
- النسخة الجديدة تُركّب فوق القديمة → الجداول تُنشأ ذاتياً، البيانات تنتقل، كل شيء محفوظ في `_kg_migrations`.
- استرجاع نسخة احتياطية قديمة على نسخة جديدة → يعاد تشغيل كل الـ migrations → "already exists" تُتجاهل (`db-init.ts:106`) → آمن.
- النسخ الاحتياطي يضغط ملف `.db` كاملاً → الجداول الجديدة مشمولة تلقائياً، لا تغيير في كود النسخ.

### 3.4 Seed — أضف إلى `src/lib/db-init.ts`
```ts
export const DEFAULT_ACCOUNTS = [
  { name: "الخزينة الرئيسية", type: "Cash", openingBalance: 0 },
  { name: "بنك الإسكان", type: "Bank", openingBalance: 0 },
];
export const EXPENSE_CATEGORIES = [
  "رواتب", "إيجار", "كهرباء", "ماء", "نقل", "قرطاسية",
  "صيانة", "مستلزمات تعليمية", "اتصالات", "أخرى",
];
```
- `seedDefaultAccounts(client)` — نمط `seedDefaultFees` (إنشاء إن لم يوجد).
- الفئات: قائمة ثابتة في الكود تُعرض في select (v1 لا حاجة لإدارة فئات).

---

## 4. طبقة الـ Actions (كل ملف وكل دالة)

### 4.1 `src/app/actions/treasury-actions.ts` (جديد)

| الدالة | التوقيع | المنطق |
|---|---|---|
| `getAccounts` | `(): Promise<{ id, name, type, openingBalance, isActive, balance }[]>` | `requireAuth`؛ لكل حساب: `prisma.cashMove.groupBy({ by:["accountId"], _sum:{ amount } })` + جمع الرصيد |
| `createAccount` | `(input: { name, type, openingBalance? })` | `requireAdmin` + `validateRequiredString(name)`؛ إنشاء |
| `updateAccount` | `(id, input: { name?, type?, isActive? })` | `requireAdmin`؛ منع تعطيل حساب عليه أرصدة إذا أردت (v1: اسمح) |
| `getCashMoves` | `(filters?: { accountId?, startDate?, endDate?, type?, category? })` | `requireAuth`؛ findMany + orderBy date desc |
| `transferFunds` | `(fromId, toId, amount, date, note?)` | `requireAdmin` + `validatePositiveNumber`؛ **$transaction**: تحقق من اختلاف الحسابين ووجودهما، أنشئ سطرين `Transfer` (−/+ بنفس `source: Transfer:${Date.now()}`)، logEvent |
| `createOpeningBalance` | `(accountId, amount, note?)` | `requireAdmin`؛ **$transaction**: `CashMove` { type:"ManualAdjust", amount, source:"Opening" } + logEvent. يُستدعى من معالج "الرصيد الافتتاحي" في أول فتح لصفحة الخزينة (§6.1) |
| `createCashAdjustment` | `(accountId, amountSigned, category, description)` | `requireAdmin`؛ **$transaction**: `CashMove` { type:"ManualAdjust", amountSigned, source:"ManualAdjust" } + logEvent — **إصلاح فروقات الجرد** (تسوية يدوية موثقة) |
| `getTreasuryReport` | `(accountId?, startDate, endDate)` | `requireAuth`؛ تُرجع { opening, income, expense, closing } (opening = رصيد قبل startDate) |

### 4.2 `src/app/actions/voucher-actions.ts` (جديد — يحل محل expense-actions)

```ts
const MAX_VOUCHER_ATTEMPTS = 3;  // نسخة من نمط receipts

createExpenseVoucher(input: {
  category: string; amount: number; expenseDate: Date;
  paymentMethod: "Cash" | "Cheque" | "Transfer";
  accountId: number; supplierId?: number; vendor?: string;
  referenceNumber?: string; description?: string;
  chequeNumber?: string; chequeBank?: string; chequeDueDate?: Date;
}): Promise<ExpenseVoucher>
```
- `requireAdmin` + تحقق (category، amount موجب، accountId موجود ونشط).
- **الحساب الافتراضي**: Setting `defaultCashAccountId` + `defaultBankAccountId` (تُضبط في صفحة الإعدادات §5) — النقد → نقدي، شيك/تحويل → بنكي. لا IDs مثبتة في الكود أبداً.
- حلقة إعادة محاولة على `voucherNumber` (نمط `payment-actions.ts:45-55`).
- **$transaction**:
  1. `expenseVoucher.create` (next number = MAX+1)
  2. `cashMove.create` { type:"Expense", amount: −input.amount, source:`Voucher:${N}`, accountId, category }
  3. إن كان `paymentMethod === "Cheque"`: `cheque.create` { type:"Issued", status:"Issued", source:`Voucher:${N}` }
  4. `logEvent("voucher_created", ...)`
- **سياسة التوقيت (مفصّلة عمداً)**: الحركة تُسجل عند إصدار السند (أساس "وقت الحركة" لا "وقت التسوية") — سياسة موحدة للداخل والخارج. النتيجة: رصيد الخزينة النقدية يعكس الأوراق الصادرة فوراً، والبنك يعكس الشيكات المرهونة. تُفصَّل للعميل في العقد (§9).

```ts
cancelVoucher(id: number, reason: string)
```
- `requireAdmin`؛ **$transaction**: تحقق غير ملغي، ضع `isCanceled=true + cancelReason`، أنشئ CashMove معاكس { type:"Expense", amount: +voucher.amount, source:`CancelVoucher:${N}`, category، description: "إلغاء سند صرف N: سبب" }، **وإن كان مدفوعاً بشيك صادر**: `cheque.update` → status `Cancelled` + `cheque.notes` بالسبب. logEvent.

```ts
getVouchers(filters?: { startDate?, endDate?, category?, accountId?, supplierId?, isCanceled? })
getVoucher(id)                          // للطباعة — include supplier
getExpenseSummary(year)                 // groupBy month+category، حيث isCanceled=false
```
- **ملاحظة**: `getExpenseSummary` تنتقل هنا من `expense-actions.ts` — كل من يستوردها يجب أن يتغير (انظر §5).

### 4.3 `src/app/actions/supplier-actions.ts` (جديد)
`getSuppliers()`, `getSupplierOptions()` (نشطون فقط للـ select), `createSupplier({name,phone?,address?,notes?})`, `updateSupplier(id, input)`, `deleteSupplier(id)` — حذف ناعم (`isActive=false`) حفظاً للتاريخ، `requireAdmin` على الكتابة، `requireAuth` على القراءة.

### 4.4 `src/app/actions/employee-actions.ts` (جديد)
نفس نمط الموردين: `getEmployees()`, `createEmployee({fullName, role, baseSalary, allowances?, socialSecurityPct?, incomeTaxPct?})`, `updateEmployee`, `deleteEmployee` (ناعم — لا تحذف من لديه PayrollRuns). نسب الضمان/الضريبة نسب مئوية مبسطة (بلا شرائح ضريبية — v1).

### 4.5 `src/app/actions/payroll-actions.ts` (جديد)

| الدالة | المنطق |
|---|---|
| `runMonthlyPayroll(year, month)` | `requireAdmin`؛ **$transaction**: لكل موظف نشط `upsert` على `@@unique([employeeId, year, month])` بحيث: `deductions = سلف/غيابات يدوية + (base + allowances) × (socialSecurityPct + incomeTaxPct) / 100` (من ملف الموظف، مع قابلية تجاوزها يدوياً)، `net = base + allowances − deductions`. لا CashMove هنا — تخطيط فقط. logEvent |
| `updateRunDeduction(runId, deduction, note?)` | `requireAdmin`؛ يسمح التعديل قبل الدفع فقط (throw إذا `paid`)؛ إعادة حساب net |
| `markPayrollPaid(runIds: number[], accountId: number)` | `requireAdmin`؛ **$transaction** لكل شهر: أنشئ **سند صرف واحد** `expenseVoucher.create` { category:"رواتب", amount: Σ net, paymentMethod حسب نوع الحساب, accountId, description:"رواتب شهر M/Y" } ثم لكل run غير مدفوع → `paid=true, paidAt=now` + `cashMove.create` { type:"Expense", amount: −netSalary, source:`PayrollRun:${id}`, category:"رواتب" } (مرتبط بمعرّف السند في description) + logEvent. **النتيجة**: الرواتب لها سند صرف مرقّم قابل للطباعة — نفس الورق الثبوتي لأي صرف آخر |
| `getPayrolls(year, month)` | `requireAuth`؛ runs مع employee + إجماليات |
| `getPayrollSummary(year)` | `requireAuth`؛ groupBy شهر/حالة للتقارير |

### 4.6 `src/app/actions/cheque-actions.ts` (جديد)

| الدالة | المنطق |
|---|---|
| `getCheques(filters?: { type?, status?, bank? })` | `requireAuth` |
| `updateChequeStatus(id, status, note?)` | `requireAdmin`؛ تحقق من الانتقال المسموح (جدول أدناه) + logEvent |
| `markChequeCleared(chequeId)` | `requireAdmin`؛ **$transaction**: تحقق status=Issued/Received، ضع status=`Cleared/Paid` + clearingDate + logEvent. **بلا CashMove إضافي** — الحركة سُجلت عند الإصدار/الاستلام (§4.2) |
| `bounceCheque(chequeId, reason, accountId)` | `requireAdmin`؛ **$transaction** (الخزينة مصدر الحقيقة → عكس أثر الحركة): ضع status=`Bounced` + notes، وأنشئ CashMove معاكس:
  - صادر (حركة −): CashMove { type:"Expense", amount: +amount, source:`ChequeBounce:${chequeId}`, description:"إرجاع شيك صادر N" }
  - وارد (حركة +): CashMove { type:"Income", amount: −amount, source:`ChequeBounce:${chequeId}`, description:"ارتداد شيك وارد N" } + logEvent |
| `cancelCheque(chequeId, reason)` | `requireAdmin`؛ **$transaction**: تحقق status=Issued فقط (لا يُلغى مهرىّ)، ضع status=`Cancelled` + **أنشئ CashMove معاكساً** (نفس منطق `bounceCheque` بـ source:`ChequeCancel:${chequeId}`). لا يمس سند الصرف المرتبط — الإلغاء يلغي أثر الشيك فقط + logEvent |
| `getOverdueCheques()` | `requireAuth`؛ `dueDate < today` و status في InCollection/Issued — للتنبيه بلوحة التحكم |

**الانتقالات المسموحة**:
- Received: `InCollection → Deposited → Cleared`، `InCollection/Deposited → Returned`
- Issued: `Issued → Paid`، `Issued → Cancelled`

⚠️ **اتساق رصيد الخزينة**: الأثر المالي للشيك يُسجَّل عند الإصدار/الاستلام فقط (سياسة وقت الحركة، §4.2). `Bounced`/`Cancelled` تلغي الأثر بـ CashMove معاكس — فيبقى `openingBalance + Σ amount` مطابقاً دائماً دون استثناءات.

### 4.7 `src/app/actions/student-actions.ts` (تعديل — إضافة دالة)

```ts
getAgingReport(): Promise<{ bucket: "<30"|"30-60"|"60-90"|"90+", students: { id, name, grade, balance, oldestChargeDate }[] }>
```
- `requireAuth`؛ **خوارزمية FIFO (وثيقة)**: لا تُحسب من "أقدم قسط" — لكل طالب نشط رصيده > 0: نسبة الدفع (`SUM(Transaction.amount) / SUM(StudentFee.amount)`) تُوزَّع تنازلياً على الأقساط الأقدم → الأحدث (الأقدم يُدفع أولاً)، والرصيد المتبقي يُصنَّف في دلاء (<30 / 30-60 / 60-90 / 90+) حسب `dueDate`. الاحتياط الموثق: طلاب بلا StudentFees → رصيدهم كاملاً في دلو "الحالي". يُقدَّم في الواجهة كـ"تقدير خوارزمي" وليس محاسبة قانونية. (البديل المهمول: أقدم Transaction موجب — غير معتمد.)

---

## 5. تعديلات الكود الحالي (بالملفات)

| الملف | التعديل |
|---|---|
| `src/app/actions/payment-actions.ts` | `attemptProcessPayment`: بعد `revenue.create` أضف — `cashMove.create` { type:"Income", amount: +amount, source:`Receipt:${nextReceiptNumber}`, accountId: `input.accountId ?? defaultCashAccountId (Setting)` }؛ وإن كان `paymentMethod === "Cheque"`: `cheque.create` { type:"Received", status:"InCollection", source:`Payment:${payment.id}` }. ووسّع `ProcessPaymentInput` بحقول الشيك الاختيارية. |
| `src/app/actions/payment-actions.ts` | `cancelReceipt`: بعد الـ Revenue العكسي أضف `cashMove.create` { type:"Income", amount: −receipt.amount, source:`CancelReceipt:${N}` }، وإن كان الدفع شيكاً وارداً: `bounceCheque` أو `cancelCheque` وفق الحالة. |
| `src/app/actions/expense-actions.ts` | **حذف الملف** (بعد هجرة البيانات). |
| `src/components/reports/report-monthly-summary.tsx:2,14` | استبدل `getExpenseSummary` من expense-actions بـ `voucher-actions`، وأضف الرواتب (PayrollRuns المدفوعة) إلى المصروفات الشهرية. |
| `src/app/actions/export-actions.ts` | استبدل تصدير المصروفات القديم بتصدير `ExpenseVoucher` (مصفاة) + أضف تصدير حركة الخزينة والرواتب. |
| `src/app/actions/import-actions.ts` | أزل استيراد المصروفات القديم (أو حوّله إلى سندات صرف حسب رغبة العميل — v1: إزالته). |
| `src/app/(dashboard)/expenses/page.tsx` | استبدله بـ `vouchers/page.tsx` (قسم §6). |
| `src/components/financial/expenses-client.tsx` | استبدله بـ `vouchers-client.tsx`. |
| `src/app/(dashboard)/page.tsx` | بطاقة المصروفات (تقرأ Expense) → من `getExpenseSummary(voucher)`؛ أضف بطاقة رصيد الخزينة (إجمالي كل الحسابات). |
| `src/components/layout/sidebar.tsx:34` | أزل رابط "المصروفات" من مكانه، أضف مجموعة "المحاسبة" (قسم §7). |
| `src/proxy.ts:41` | أضف البادئات الجديدة إلى `ADMIN_ONLY_PREFIXES`: `/treasury`, `/vouchers`, `/suppliers`, `/payroll`, `/cheques`. |
| `src/app/actions/student-actions.ts` | `createStudent` → **backfill `globalId`** لكل الطلاب الموجودين: `S-${year}-${Number(globalId.slice(4)) + 1}` (نمط `payment-actions.ts:30-55`) + تعيينه للجدد — شرط مسبق لمزامنة البوابة (§15). |
| `src/app/actions/settings-actions.ts` (جديد) | `getSettings` / `saveSettings`: `defaultCashAccountId` + `defaultBankAccountId` (تُعرض في صفحة الإعدادات، مع تنبيه إن لم تُضبط) + `accessCode` (لمزامنة البوابة §15). |
| `src/app/actions/treasury-actions.ts` (جديد) | `createOpeningBalance` (رصيد افتتاحي أول: CashMove { type:"ManualAdjust", source:"Opening" }) — انظر §6.1. |
| `src/components/dashboard/unpaid-alert.tsx` (اختياري) | أضف تنبيه شيكات مستحقة + رواتب غير مدفوعة. |
| `src/lib/excel-utils.ts` | أضف: `exportVouchers`, `exportPayrollRuns`, `exportCashMoves`, `exportAgingReport`. |
| `src/lib/logger.ts` | بلا تغيير — `logEvent` عام (verify: المتغيرات تمرر JSON). |
| **النسخ الاحتياطي** | بلا تغيير — `createBackup` يضغط `.db` كاملاً. |

---

## 6. طبقة الواجهة (كل صفحة ومكون)

### 6.1 `src/app/(dashboard)/treasury/page.tsx` + `src/components/financial/treasury-client.tsx`
- **معالج الرصيد الافتتاحي (مرة واحدة)**: إن لم توجد أي CashMove إطلاقاً → Banner "ضبط الرصيد الافتتاحي" → Dialog: الحساب + المبلغ (موجب = نقدي، سالب = مكشوف) + وصف → `createOpeningBalance`. لا يُقفل المعالج — أي تعديل لاحق يمر عبر زر التسوية اليدوية.
- بطاقات حسابات (الاسم، النوع، **الرصيد الحي**) — نفس نمط بطاقات الشاشة الرئيسية.
- زر "تحويل بين الحسابات": Dialog (من/إلى/مبلغ/تاريخ/ملاحظة) → `transferFunds`.
- زر **"تسوية يدوية"** (admin only): Dialog (الحساب، المبلغ الموقّع، الفئة، وصف إلزامي: سبب الفرق) → `createCashAdjustment` — لإصلاح فروقات الجرد فقط.
- جدول حركات الخزينة: التاريخ، الحساب، النوع (شارة ملونة: دخل أخضر/صرف أحمر/تحويل أزرق/تسوية رمادية)، الفئة، المبلغ، المصدر (سند قبض 12 / سند صرف 5 / ترحيل), فلترة (حساب + نطاق تاريخ).
- زر طباعة كشف الخزينة (يؤدي `print/treasury/...`).

### 6.2 `src/app/(dashboard)/vouchers/page.tsx` + `src/components/financial/vouchers-client.tsx` (يحل محل المصروفات)
- نموذج سند صرف: الفئة (select من `EXPENSE_CATEGORIES` + إدخال حر)، المبلغ، التاريخ، طريقة الدفع (نقد/شيك/تحويل)، الحساب المصروف منه (select الخزائن النشطة)، المورد (select)، رقم مرجعي، وصف.
- إن كان "شيك": حقول رقم الشيك، البنك، تاريخ الاستحقاق.
- جدول السندات: رقم السند، التاريخ، الفئة، المورد، الحساب، المبلغ، الحالة (نشط/ملغي)، أزرار: طباعة (سند صرف PDF)، إلغاء (Dialog يطلب السبب).

### 6.3 `src/app/(dashboard)/suppliers/page.tsx` + `financial/suppliers-client.tsx`
- جدول موردين + Dialog إضافة/تعديل + تعطيل ناعم. بسيط.

### 6.4 `src/app/(dashboard)/payroll/page.tsx` + `financial/payroll-client.tsx`
- تبويبان (Tabs): **الموظفون** (جدول + Dialog إضافة/تعديل) و**الرواتب**.
- الرواتب: اختيار شهر/سنة → زر "تشغيل رواتب الشهر" → جدول (الموظف، الأساسي، البدلات، الخصومات [قابلة للتعديل قبل الدفع]، الصافي، الحالة: مقدرة/مدفوعة، تاريخ الدفع).
- زر "صرف الرواتب المحددة" (select + اختيار حساب) → `markPayrollPaid`.
- زر طباعة كشف رواتب الشهر.

### 6.5 `src/app/(dashboard)/cheques/page.tsx` + `financial/cheques-client.tsx`
- جدول دفتر الشيكات: الرقم، البنك، النوع (وارد/صادر)، المبلغ، تاريخ الإصدار، الاستحقاق (مستحق = تمييز أحمر)، الحالة (Dropdown → `updateChequeStatus`).
- فلترة: النوع، الحالة، البنك.

### 6.6 التقارير — تعديل `src/app/(dashboard)/reports/page.tsx`
أضف 4 Tabs (نمط موجود):
1. **تقرير الخزينة**: حساب (أو كلها) + نطاق تاريخ → `getTreasuryReport` → ملخص افتتاحي/دخل/صرف/ختامي + جدول الحركات + طباعة.
2. **صافي الدخل**: `getRevenueSummary` + `getExpenseSummary(voucher)` + الرواتب المدفوعة → مصفوفة شهرية (دخل − مصروفات − رواتب = صافي). يعتمد على `report-monthly-summary.tsx` المحدّث.
3. **ذمم الطلاب**: `getAgingReport()` → مجموعات <30/30-60/60-90/90+ + مجموع كل فئة.
4. **كشف رواتب**: `getPayrolls(year, month)` + إجماليات + طباعة.

### 6.7 الطباعة (PDF) — نمط `src/app/print/receipt/[id]/page.tsx`
| الملف | المحتوى |
|---|---|
| `src/app/print/voucher/[id]/page.tsx` | سند صرف: رقم السند، التاريخ، الفئة، المورد، المبلغ بالأرقام + **tafqit**، الحساب، التوقيعات (المُعد/المدير). خط Scheherazade. |
| `src/app/print/treasury/[year]/[month]/page.tsx` | كشف خزينة شهري: رصيد افتتاحي، حركات، إجماليات، رصيد ختامي. |
| `src/app/print/payroll/[year]/[month]/page.tsx` | كشف رواتب: الموظف/الأساسي/البدلات/الخصم/الصافي/التوقيع، إجمالي الشهر. |

كلها تستخدم `print-controls.tsx` + `validatePositiveNumber`/`requireAdmin` في صفحة الطباعة حسب الحاجة.

### 6.8 الشريط الجانبي — تعديل `sidebar.tsx`
أزل "المصروفات" و"الإيرادات" القديمة من مكانها، وأضف مجموعة:
```
المحاسبة
├── الخزينة والبنوك    → /treasury
├── سندات الصرف        → /vouchers
├── دفتر الشيكات       → /cheques
├── الموردون           → /suppliers
└── الموظفون والرواتب  → /payroll
```
كلها `role: "admin"`.

---

## 7. ترتيب التنفيذ والجهد (فرد واحد)

| المرحلة | المحتوى | أيام |
|---|---|---|
| 1 | Schema + migration + هجرة Expense (idempotent) + seed + **backfill globalId** | 1 |
| 2 | Treasury core (actions + صفحة + تحويلات + **رصيد افتتاحي + تسوية يدوية**) | 2.5 |
| 3 | **ربط السندات بالخزينة** (processPayment + cancelReceipt + شيكات واردة) | 1 |
| 4 | سندات الصرف + موردين (actions + صفحات) + **إعدادات الحساب الافتراضي** | 2 |
| 5 | موظفون + رواتب (تشغيل/صرف/تعديل خصومات + ضمان/ضريبة) | 2.5 |
| 6 | دفتر الشيكات (حالات + مستحقة + **ارتداد/إلغاء بعكس الأثر**) | 1.5 |
| 7 | تقارير + طباعة PDF (3 أوراق) + **ذمم FIFO** | 2.5 |
| 8 | لوحة التحكم + Excel + proxy + sidebar + lint/build + اختبار شامل | 1.5 |

**إجمالي: ~13 يوم عمل.** الـ scaffolding كله موجود (نمط receipts/actions/components) — التنفيذ نسخ وتعديل أكثر منه بناء من الصفر.

---

## 8. قائمة الاختبار اليدوي (قبل التسليم)

1. سداد طالب نقداً → سند قبض + CashMove دخل + رصيد الخزينة يزيد.
2. سداد طالب شيكاً → شيك وارد InCollection في دفتر الشيكات، رصيد الخزينة النقدي لا يتغير.
3. إلغاء سند قبض → سند ملغي + CashMove عكسي + رصيد يعود.
4. إنشاء سند صرف نقداً → سند مرقّم + CashMove صرف + الرصيد ينقص.
5. إلغاء سند صرف → عكس كامل.
6. تحويل بين خزينة وبنك → سطران، رصيدا الحسابين صحيحان، مجموع الخزائن ثابت.
7. تشغيل رواتب الشهر → سجلات مقدرة بلا تأثير على الخزينة؛ الصرف → CashMove − و paid=true؛ تشغيل نفس الشهر مجدداً → upsert لا تكرار (unique).
8. تعيين شيك مستحق → يظهر في تنبيه لوحة التحكم.
9. تقرير ذمم → فئات صحيحة حسب أقدم استحقاق (FIFO) + طلاب بلا StudentFees في "الحالي".
10. كشف الخزينة + سند الصرف PDF → عربي + tafqit سليم.
11. `npm run lint` + `npm run build` بلا أخطاء.
12. نسخة احتياطية → استرجاع على نسخة قديمة ثم ترقية → لا انهيار (اختبار الهجرة من أقدم DB لديك).
13. **إعادة تشغيل التطبيق مرتين أثناء هجرة المصروفات** (قتل العملية بين الخطوات) → لا ازدواجية سندات (حراسة NOT EXISTS).
14. إلغاء سند صرف مدفوع بشيك → السند ملغي + الشيك Cancelled + رصيد الخزينة عاد للمستوى الصحيح.
15. ارتداد شيك وارد → رصيد الخزينة ينقص بمبلغه (عكس الدخل) + الشيك Bounced.
16. رصيد افتتاحي خاطئ → تسوية يدوية تصلحه + الحركتان مرئيتان في كشف الخزينة بمصدر Opening/ManualAdjust.
17. صرف رواتب → سند صرف مرقّم قابل للطباعة بمجموع الرواتب + كشف رواتب مطابق.

---

## 9. رسالة العميل (عربية — عند البيع)

> "المرحلة الأولى: خزينة وبنوك + سندات صرف مرقّمة + دفتر شيكات + موردين + رواتب موظفين (أساسي/بدلات/خصومات/ضمان/ضريبة) + تقارير محاسبية (كشف خزينة، صافي دخل شهري، ذمم الطلاب، كشف رواتب) — جاهزة خلال 3-4 أسابيع.
> **غير مشمول في هذه المرحلة**: ميزان مراجعة، ميزانية عمومية، إطفاء أصول، قيود مزدوجة، دورة مستندية كاملة — إن احتجتها لاحقاً فهي مرحلة ثانية بتكلفة إضافية.
> ملاحظة: تقرير ذمم الطلاب تقدير خوارزمي (FIFO) وليس محاسبة قانونية."

**السعر المقترح للوحدة كاملة**: +150 إلى +300 دينار فوق رخصة القاعدة، أو تحويل نموذج التسعير إلى اشتراك 25-40 دينار/شهر يشمل الدعم والصيانة.

---

# الجزء الثاني: بوابة الأهل (Parent Portal — تواصل الأهل)

**الهدف**: تطبيق ويب (PWA) يعمل على هاتف كل ولي أمر: منشورات مصوّرة (صور/فيديو)، إشعارات فورية، أسئلة وأجوبة مباشرة مع الروضة، وجدول الباص الثابت (بلا GPS).

**المدة**: ~17 يوم عمل (Part 2 — تفصيل §17) **الميزانية الخام**: $0/شهر

## 10. المبدأ المعماري الحاسم

1. **منظومة سحابية منفصلة تماماً** — لا تلمس تطبيق الروضة المحلي ولا SQLite المحلي ولا `Transaction`/`CashMove`.
2. التطبيق المحلي يبقى offline-first. البوابة تحتاج إنترنت.
3. **الربط بين العالمين عبر `Student.globalId`** (موجود أصلاً في `schema.prisma:36`): حسابات الأهل في السحابة تشير إلى globalId الطفل. لا ترسل بيانات حساسة من المحلي للسحابة إلا globalId + اسم الطفل.
4. **قرار معمارية**: تطبيق Next.js مستقل في مجلد `portal/` داخل نفس الريبو، منشور على **Cloudflare**:
   - **API**: Workers مستقل (Hono) — نقطة اتصال واحدة لكل شيء (مصادقة، منشورات، مراسلات، إشعارات، Durable Objects).
   - **الواجهة (PWA)**: static export (Next `output: "export"` أو SPA خفيف) يُخدَّم من Workers Static Assets على نفس الأصل — **لا OpenNext إطلاقاً** (استضافته على R2/D1 معقدة وغير ناضجة بما يكفي، وكل ميزة مطلوبة هنا تقليدية: صفحات + API + Web Push + WebSocket).
   - لا يشارك قاعدة البيانات ولا الكود مع `src/` — المشروعان منفصلان، فقط ريبو واحد للنسخ والتفريعات.
5. كل خدمة سحابية → **Cloudflare أولاً** (انظر الجدول §11) — لا AWS، لا Vercel، لا Firebase إلا إذا تعذر.

## 11. جدول الخدمات (Cloudflare أولاً) + التكلفة الخام

| الحاجة | الخدمة (Cloudflare) | الحدود المجانية | التكلفة عند تجاوزها |
|---|---|---|---|
| استضافة API + PWA | **Workers API + Static Assets** (بلا OpenNext) | 100K طلب/يوم | ~$0.30 لكل مليون طلب إضافي |
| قاعدة البيانات | **D1** (SQLite سحابي) | 5GB، 5M قراءة/يوم، 100K كتابة/يوم | $0.50/M قراءات إضافية |
| تخزين الصور | **R2** + CDN مدمج (صفر egress) | 10GB تخزين + 1M عملية كتابة/شهر | $0.015/GB/شهر |
| الفيديو | **R2 كبافر مباشر** (MP4 H.264 — الهواتف تشغّله أصلاً). Stream اختياري فقط إذا طلب العميل مشغّلاً احترافياً/تشفير تلقائي | مجاني 10GB (~أسابيع من الكليبات) — **لا فوترة لكل دقيقة إطلاقاً** |
| الإشعارات الفورية | **Web Push API** من Worker (VAPID keys) | مجاني | — |
| الدردشة الحية (أسئلة الأهل) | **Durable Objects** (WebSockets) | 1M طلب/شهر | $0.15/M طلب |
| حماية التسجيل | **Turnstile** | مجاني | — |
| إشعارات بريد (اختياري) | **Email Routing** | مجاني | — |
| DNS + CDN + SSL + Caching | Cloudflare (مدمج) | مجاني | — |
| مفاتيح سرية | Workers Secrets | مجاني | — |

**الحساب الواقعي لروضة 100-200 طفل**: كل شيء داخل الحدود المجانية (R2 كبافر — لا Stream في v1). **المجموع الخام: $0/شهر**، مع هامش أمان حتى 10GB R2.

⚠️ **تحذير D1 + Prisma**: محوّل Prisma لـ D1 (`@prisma/adapter-d1`) تجريبي (beta). القرار: **استخدم Drizzle ORM لطبقة البوابة** (ناضج على D1، وسجلات SQL نفسها). Prisma يبقى حصراً للتطبيق المحلي. لا تكسر قاعدة عمل تعمل.

## 12. مخطط قاعدة D1 (جداول البوابة)

```sql
CREATE TABLE parent_account (
  id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,          -- رقم ولي الأمر
  password_hash TEXT NOT NULL,
  student_global_id TEXT NOT NULL,     -- يطابق globalId في SQLite المحلي
  student_name TEXT NOT NULL,          -- لقطة من المزامنة (إظهار فوري بلا join)
  grade TEXT,                          -- لقطة من المزامنة (الصف)
  access_code TEXT NOT NULL,           -- رمز التفعيل المطبوع من الروضة
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE student (                 -- سجل الطلاب المستورد من التطبيق المحلي (v1: CSV يدوي)
  global_id TEXT PRIMARY KEY,          -- يطابق Student.globalId المحلي
  full_name TEXT NOT NULL,
  grade TEXT,
  access_code TEXT,                    -- الرمز المطبوع من الروضة
  is_active INTEGER DEFAULT 1,
  imported_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE announcement (            -- منشور عام للروضة (صور/فيديو/نص)
  id INTEGER PRIMARY KEY,
  title TEXT,
  body TEXT,
  author TEXT,
  class_id TEXT,                       -- اختياري: تقييد منشور بصف معين (v1: اختياري، واجهة لاحقاً)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  announcement_id INTEGER,             -- NULL = مرفق برسالة مباشرة
  r2_key TEXT NOT NULL,                -- مسار الكائن في R2
  type TEXT CHECK(type IN ('image','video')),
  expires_at TEXT NOT NULL,            -- حذف تلقائي عبر Cron (فيديو: +10 أيام، صور: +6 أشهر)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE message (                 -- أسئلة الأهل / ردود الروضة
  id INTEGER PRIMARY KEY,
  parent_account_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('parent','staff')),
  read_at TEXT,                        -- لمقاطعة "غير مقروء" للمعلمة
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE push_subscription (
  id INTEGER PRIMARY KEY,
  parent_account_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE bus_schedule (            -- جدول ثابت (بدون تتبع مباشر)
  id INTEGER PRIMARY KEY,
  route_name TEXT,
  stop_name TEXT,
  pickup_time TEXT,
  dropoff_time TEXT,
  student_global_id TEXT               -- اختياري: ربط الولد بمحطته
);

CREATE TABLE api_error_log (           -- سجل أخطاء بوابة (إصدار/قراءة — لا سريانات)
  id INTEGER PRIMARY KEY,
  endpoint TEXT,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 13. واجهة API (Routes على Worker)

| المسار | المنطق |
|---|---|
| `POST /api/register` | رمز التفعيل + هاتف + كلمة مرور + **Turnstile token**؛ تحقق من access_code؛ أنشئ الحساب |
| `POST /api/login` | تحقق + JWT في httpOnly cookie (60 يوم) |
| `GET /api/child` | بيانات طفلي: الاسم، الصف، جدول الباص (بالـ globalId من الجلسة) |
| `GET /api/announcements?after=` | المنشورات + قائمة media |
| `GET /api/media/:id` | **R2 signed URL بصلاحية 60 ثانية** — لا عناوين عامة أبداً |
| `POST /api/messages` | سؤال جديد من ولي الأمر |
| `GET /api/messages` | المحادثة (مؤرشفة) |
| `WS /api/chat/:id` | Durable Object — رسائل حية |
| `POST /api/push/register` | حفظ اشتراك Web Push |
| `POST /api/push/send` | (staff فقط) إشعار جماعي لجميع الأهل |
| `POST /api/admin/announcements` | (staff) إنشاء منشور + رفع media (class_id اختياري) |
| `POST /api/admin/media` | رفع صورة/فيديو → R2 (expires_at يُضبط تلقائياً حسب النوع) |
| `POST /api/admin/messages/:id/reply` | (staff) رد على سؤال |
| `POST /api/admin/students` | (staff) استيراد CSV الطلاب (global_id، الاسم، الصف، access_code) من التطبيق المحلي — **v1 مزامنة يدوية** (§15) |
| `GET /api/admin/students` | (staff) عرض سجلات الاستيراد (للتدقيق: مطابقة، أخطاء) |
| `GET /api/health` | فحص الحالة: D1 + R2 reachable — لمراقبة العقد والأوبس (§16.8) |

**نموذج بيانات مشترك**: جدول `STAFF_TOKENS` في D1 (أو Workers KV) يحمل كلمات مرور المعلمات — لا داعي لربط أدوار التطبيق المحلي.

## 14. صفحات PWA (مجلد `portal/src/app/`)

| الصفحة | المحتوى |
|---|---|
| `/login`, `/register` | تسجيل الدخول/الإنشاء + Turnstile |
| `/` (dashboard) | بطاقة طفلي: الاسم، الصف، **جدول الباص** (استلام/إيصال) |
| `/announcements` | Feed المنشورات: صور مصغّرة، فيديو بـ `<video src=URL موقّع>` من R2، توسيع |
| `/messages` | أسئلتي: قائمة + إرسال جديد + ردود الروضة (WebSocket للحيوية) |
| `/settings` | تفعيل الإشعارات (Web Push)، تغيير كلمة المرور، خروج |
| `/admin/*` (staff) | إنشاء منشور + رفع صور/فيديو + الرد على الأسئلة + إشعار جماعي + **استيراد الطلاب (CSV) + صفحة الاحتفاظ /admin/retention** |

- **manifest + service worker**: تعمل من "أضف إلى الشاشة الرئيسية" — لا متجر تطبيقات، لا تطوير iOS/Android منفصل.
- أيقونة عربية بسيطة + ثيم يطابق هوية الروضة (الاسم من إعداد التطبيق المحلي يُدخل يدوياً في إعدادات البوابة v1).

## 15. ربط التطبيق المحلي (مزامنة يدوية v1 — يوم واحد)

**القرار**: v1 لا تزامن تلقائي من التطبيق المحلي (كانت الفكرة: sync endpoint من سطح المكتب → سحابة؛ أُسقطت لأن التطبيق المحلي offline-first وقد لا يتوفر إنترنت وقت النشر، وأي إجبار على رفع من المحلي يكسر مبدأه). بديل موثق:

في `src/app/actions/` + `src/app/print/`:
- `exportStudentsForPortal()`: يصدّر **CSV** { global_id، fullName، grade، accessCode } لكل الطلاب النشطين + **globalId backfill** (من §5) إن كان بعض الطلاب قديمين بلا معرّف.
- `generateAccessCodes()`: يولّد `accessCode` (6 أحرف) لكل طالب نشط، يحفظه في حقل جديد `accessCode` على `Student` (مخطط محلي — `prisma migrate` إضافي آمن). تصدير CSV يتضمن الرمز.
- صفحة `src/app/print/access-codes/page.tsx`: طباعة رسالة ترحيب بالوالدين فيها رمز التفعيل + رابط البوابة + خطوات التسجيل.
- **التدفق**: الروضة تطبع الرسائل → توزعها → ترفع CSV إلى `/admin/students` في البوابة → الأهل يسجلون برموزهم. المزامنة الجديدة (طالب جديد/تغيير صف) = CSV جديد (يدوي، سريع).
- **تحسين مستقبلي (خارج v1)**: زر "مزامنة" في التطبيق المحلي يرفع CSV عبر endpoint محمي برمز `accessCode` من الإعدادات (§5) — بدون ذلك، المحلي لا يعرف عنوان البوابة ولا يرسل شيئاً.

## 16. الأمان

1. **Turnstile** على /api/register و /api/login (منع البوتات).
2. JWT في httpOnly + Secure cookie؛ جلسات قابلة للإلغاء (معلمات الروضة).
3. **صور R2 بصلاحية موقعة 60 ثانية** — لا روابط عامة دائمة؛ الفيديو عبر R2 بنفس الآلية (بلا Stream).
4. ولي الأمر يرى **طفله فقط** — الربط بـ access_code + globalId، فحص عند كل قراءة.
5. Rate limiting على /api/login (Workers Rate Limiting — مجاني ضمن العقد).
6. VAPID private key + مفاتيح R2 في **Workers Secrets** — لا في الكود ولا في git.
7. تسجيل كل دخول ورسالة في D1 (سجل تدقيق خفيف) — نمط `logEvent` لكن في سحابة.
8. **الأوبس (H13)**:
   - `GET /api/health` + **فحص دوري (Uptime)**: Cron Trigger كل 5 دقائق ينبه (بريد Email Routing) إن تعطل شيء.
   - `api_error_log`: سجل أخطاء قليل الضجيج (endpoint + رسالة فقط — لا بيانات شخصية ولا أسرار).
   - **Kill switch**: عقد الاشتراك يتضمن بند إيقاف — عند التوقف عن السداد: تتعطل البوابة (حسابات الأهل تبقى للقراءة، لا إشعارات ولا مراسلات جديدة) **ولا تتأثر بيانات الروضة المحلية أبداً** — هذا هو الأمان الأساسي للفصل المعماري.
   - تصدير بيانات البوابة (CSV/JSON لكل الأهل والرسائل) عند إنهاء الخدمة — التزام تعاقدي.
9. **قيود Web Push على iOS (H12 — وثق للعميل)**: الإشعارات على iPhone تعمل من Safari **16.4+** **وفقط بعد** "أضف إلى الشاشة الرئيسية". التطبيق يعرض داخل الواجهة تنبيهاً: "فعّل الإشعارات من: أضف إلى الشاشة الرئيسية ثم افتح التطبيق". وثق في العقد (§18).

## 17. مراحل التنفيذ والجهد

| المرحلة | المحتوى | أيام |
|---|---|---|
| 1 | إعداد Workers + Static Assets + D1 + Drizzle + المصادقة (register/login/Turnstile/JWT) | 2.5 |
| 2 | منشورات + رفع R2 + URLs موقعة + العرض | 2 |
| 3 | Web Push (VAPID، اشتراك، إشعار جماعي) + **تنبيه iOS داخل الواجهة** | 2 |
| 4 | مراسلات + Durable Objects (WebSocket) + read_at | 2.5 |
| 5 | PWA UI كاملة (manifest + service worker + كل الصفحات) | 3 |
| 6 | استيراد CSV (backend + /admin/students + التدقيق) + توليد/طباعة رموز التفعيل من التطبيق المحلي + backfill globalId | 2 |
| 7 | **الأوبس**: /api/health + سجل أخطاء + kill switch + فحص دوري + تصدير البيانات | 1.5 |
| 8 | اختبار شامل + نشر (wrangler deploy) + domain + SSL | 1.5 |

**إجمالي: ~17 يوم عمل** (كان 12.5 — المزامنة اليدوية والأوبس والقيود الحقيقية رُفعت عن أرض الواقع).

## 18. ما يُباع للعميل (نص عربي)

> "بوابة الأهل: تطبيق ويب يعمل على هاتف كل أب — منشورات مصوّرة وفيديو، إشعارات فورية، أسئلة وأجوبة مباشرة، وجدول الباص. لا حاجة لتثبيت من المتجر: رابط + تسجيل برمز التفعيل المطبوع من الروضة. البوابة متاحة 24/7 على الإنترنت، والتطبيق المحلي للروضة لا يتأثر أبداً بانقطاع النت.
> **الفيديوهات متاحة للعرض والتحميل 10 أيام من النشر، والصور 6 أشهر، ثم تُحذف تلقائياً** — خدمة الأرشفة الدائمة متاحة بتكلفة إضافية. الإشعارات على آيفون تعمل من متصفح Safari بعد إضافة التطبيق للشاشة الرئيسية (خاصية من Apple).
> **التكلفة**: تكلفة إعداد (مرة واحدة) + **20-40 دينار/شهر** تشمل الاستضافة والتخزين والدعم. الجهاز الوحيد المطلوب: هاتف للمعلمة لنشر الصور."

## 19. إجمالي التكلفة الخام الشهرية (كامل المشروع)

| الجزء | شهرياً |
|---|---|
| المحاسبة المبسطة (Part 1) | **0 دينار** — محلي بالكامل، صفر خدمات |
| بوابة الأهل (Part 2) | **$0/شهر** (داخل الحدود المجانية) |
| Domain | ~10 دينار/سنة |
| GPS/باص | ملغي (خارج النطاق) |

**الخلاصة**: المشروعان معاً بميزانية خام **صفر** — كل شيء داخل الحدود المجانية لـ Cloudflare (R2 بافر يحذف تلقائياً). الربح من اشتراك العميل 20-40 دينار/شهر = هامش صافٍ شبه كامل. هذا هو مصدر الدخل المتكرر الذي لا يملكه التطبيق المحلي وحده.

## 20. سياسة الاحتفاظ بالوسائط (⚠️ ليست أبدية — اقرأ قبل الالتزام)

**الحقيقة من وثائق Cloudflare الرسمية**:

| الخدمة | ما يحدث | المصدر |
|---|---|---|
| **Stream (فيديو)** | "تُحذف الفيديوهات إذا لم يُجدَّد الاشتراك خلال 30 يوماً" — الفيديو **ليس ملكك** في الحساب المجاني، والتخزين **مدفوع شهرياً** ($5/1000 دقيقة) مهما قدمت | `developers.cloudflare.com/stream/faq` |
| **R2 (صور)** | الأجسام تبقى حتى تحذفها — **لكن**: الـ free tier 10GB فقط، بعدها يُفوَّر الحساب تلقائياً ($0.015/GB/شهر). يوجد lifecycle rules لحذف تلقائي | مستندات R2 |
| **D1 (بيانات/رسائل/منشورات)** | نصية — دائمة، رخيصة، لا مشكلة | — |

**الاستنتاج**: الصور والفيديوهات تُحفظ "حتى" — حتى تمتلئ الـ free tier، حتى يُلغى الاشتراك، حتى تُحذف. التصميم يجب أن يبني **سياسة احتفاظ صريحة** من اليوم الأول:

### 20.0 القرار: R2 كبافر (بدل Stream) — فكرة "العرض المؤقت" صحيحة لكن أبسط منها

| | Stream كبافر | **R2 كبافر (المعتمد)** |
|---|---|---|
| السقف المجاني | **100 دقيقة تخزين فقط** — 10 دقائق/يوم × 10 أيام = 100 دقيقة بالضبط. روضة تنشر أكثر → تدفع | **10GB** ≈ أسابيع من الكليبات (كليب 1-3 دقائق ≈ 20-60MB) — هامش أوسع بكثير |
| الفوترة | $5/1000 دقيقة/شهر لحظة تجاوز الـ 100 دقيقة | $0.015/GB فقط — لا يُتجاوز عملياً مع بافر 10 أيام |
| التحميل للأهل | يتطلب ميزة Downloadable Videos (قيود) | توقيع URL + `Content-Disposition: attachment` — بسيط |
| التشغيل على الهاتف | مفيد (تشفير تلقائي) | **كافٍ**: كليبات H.264 MP4 تشغّلها كل الهواتف الحديثة |
| الترميز | تلقائي (مجاني ضمن الحدود) | لا حاجة — الكليبات من الهواتف جاهزة أصلاً |

**التدفق المعتمد (buffer flow)**:
1. المعلمة ترفع كليباً → R2 (مسار `videos/2026/08/01/xxx.mp4`) + سطر في `media` مع `expires_at = الآن + 10 أيام`.
2. الأهل يشاهدون ويحمّلون خلال 10 أيام (URL موقّع 60 ثانية + رأس تحميل).
3. بعد 10 أيام → Cron Trigger اليومي يحذف الكائن من R2 + سطر `media` — **يظل المنشور نصياً**.
4. بعد انتهاء الصلاحية يعرض الواجهة: "انتهت مدة العرض — للأسئلة تواصل مع الروضة".

**الحساب الواقعي**: روضة تنشر 5-10 كليبات يومياً (30-120 ثانية) → ~150-300MB/يوم → في بافر 10 أيام: **1.5-3GB** — داخل الـ 10GB المجاني بأمان، مع ضعفين للهوامش الموسمية (أعياد/رحلات).

**متى يُعاد Stream للحوار**: إذا طلب العميل "فيديو متدرج الجودة على نت ضعيف" أو "بث مباشر" — حينها تُقارن تكلفته بالحجم الفعلي. v1: لا.

### 20.1 ما يُضاف للتصميم

1. **حقل `expires_at` على `media`** في D1 — تاريخ انتهاء إلزامي لكل وسيط (v1: `now + 10 أيام` للفيديو، `now + 6 أشهر` للصور — يعدّله `/admin/retention`).
2. **Cron Trigger على Worker** (مجاني): يعمل يومياً، يحذف:
   - من R2: الأجسام المنتهية (`expires_at < اليوم`) — حذف مباشر من Worker عبر R2 API (أو lifecycle rule).
   - من D1: سجلات `media` المقابلة (المنشور يبقى نصياً).
3. **صفحة `/admin/retention`**: مدة الاحتفاظ الافتراضية (فيديو: أيام / صور: أشهر) + زر "تنظيف الآن" + عدّاد الاستخدام (GB في R2 + عدد الأجسام المنتهية).
4. **الافتراضي الذكي**: الفيديو بافر 10 أيام (مع زر تحميل للأهل قبل الانتهاء)، الصور 6 أشهر (مع أرشفة اختيارية: نسخ نهائية تُترك بلا `expires_at` — ضمن 10GB المجاني، وتبقى الصور القديمة قابلة للعرض).

### 20.2 التكلفة الواقعية بمرور الزمن (روضة تنشر يومياً) — مع بافر R2

| العنصر | شهرياً سنة 1 | شهرياً سنة 3 |
|---|---|---|
| صور (5-10/يوم × 3MB، احتفاظ 6 أشهر) | داخل الـ 10GB المجاني | داخل المجاني (ثابت — القديم يُحذف) |
| فيديو (بافر 10 أيام فقط) | **$0** | **$0** — لا تراكم إطلاقاً |
| **بلا سياسة احتفاظ** | ~0 | $5-15/شهر متنامية |

**الخط الخلاصة**: البافر (10 أيام فيديو + 6 أشهر صور) يثبّت التكلفة عند **صفر دينار شهرياً** للأبد. يُكتب في عقد العميل: "الفيديوهات متاحة للعرض والتحميل 10 أيام من النشر، الصور 6 أشهر، ثم تُحذف تلقائياً. خدمة الأرشفة الدائمة متاحة بتكلفة إضافية." — يحمي هامشك ويحميك من مفاجآت الفوترة.

### 20.3 تعديل على الـ schema المخطط

```sql
ALTER TABLE media ADD COLUMN expires_at TEXT;  -- تُملأ من صفحة الإدارة أو الافتراضي (نهاية العام)
ALTER TABLE announcement ADD COLUMN keep_media_until TEXT;  -- تجاوز لكل منشور
```

---

## 21. سجل قرارات مراجعة الخطة (fixes after review)

الثغرات التي رصدها التمحيص النقدي (H1–H18) وكيف عولجت في هذا المستند:

| # | الثغرة | المعالجة في المستند |
|---|---|---|
| H1 | هجرة Expense غير محصّنة — إعادة تشغيل تعيد النسخ | حراسة `WHERE NOT EXISTS` في INSERT (§3.2) + اختبار 13 (§8) |
| H2 | الشيكات بلا أثر مالي | سياسة تسجيل صريحة عند الإصدار/الاستلام (§4.2) + عكس أثر الارتداد/الإلغاء (§4.6) |
| H3 | لا تسوية يدوية للجرد | `createOpeningBalance` (مرة واحدة) + `createCashAdjustment` (§4.1، §6.1) |
| H4 | حسابات مثبتة في الكود | Setting `defaultCashAccountId/BankAccountId` في صفحة الإعدادات (§5) |
| H5 | ذمم محسوبة من أقدم قسط (غير دقيق) | خوارزمية FIFO وثائقية على نسبة الدفع + احتياط الطلاب بلا StudentFees (§4.7) |
| H6 | صرف رواتب بلا سند | `markPayrollPaid` تنشئ سند صرف مرقّماً بمجموع الشهر (§4.5) |
| H7 | لا رصيد افتتاحي | معالج الرصيد الافتتاحي عند أول فتح للخزينة (§6.1) |
| H8 | — | (مدمج في سياسات التوقيت الموحدة) |
| H9/H10 | تدفق محلي→سحابي مفقود/غير قابل للتشغيل | مزامنة يدوية CSV موثقة كاملة (§15) + استيراد/تدقيق في البوابة (§13) |
| H11 | OpenNext غير ناضج | حذفه — Workers API + Static Assets (§10) |
| H12 | iOS بلا Web Push | تنبيه داخل الواجهة + وثّق للعميل (§16.9، §18) |
| H13 | لا أوبس | health + أخطاء + kill switch + تصدير بيانات (§16.8) |
| H14 | الصور أبدية؟ | احتفاظ 6 أشهر افتراضي + أرشفة اختيارية لكل منشور (§20.1.4) |
| H15 | منشورات بلا تصنيف صف | `announcement.class_id` في الـ schema (v1 اختياري) (§12) |
| H16 | globalId غير مُملأ للطلاب القدامى | backfill في مرحلة 1 (§5، §7) |
| H17 | تقدير جهد ناقص | 12.5 → 17 يوماً (Part 2) و12 → 13 (Part 1) (§7، §17) |
| H18 | العميل يتوقع "محاسبة كاملة" | "غير مشمول" صريح في رسالة البيع + تسعير المرحلة الثانية (§9) |

**قرارات معلّقة للعميل (تُطرح قبل التوقيع)**:
1. سياسة توقيت الشيكات (تسجيل عند الإصدار/الاستلام) — مقبولة؟ (البديل: التسجيل عند الصرف/التحصيل الفعلي — يتطلب شاشة إضافية للأرصدة المعلّقة)
2. مزامنة CSV اليدوية في v1 مقبولة (تكلفة صفر) أم يريد زر مزامنة تلقائي (يوم إضافي)؟
3. احتفاظ الصور 6 أشهر مع أرشفة اختيارية — مقبولة؟ (الأرشيف الدائم = تكلفة R2 إضافية على العميل)؟
