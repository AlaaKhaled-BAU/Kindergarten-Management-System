# QA Findings — Code-Level Validation & Fix Plan

**Source:** `qa_root_cause_analysis.md` (14 findings, manual QA)
**Validation method:** every finding checked against current `src/`, `prisma/schema.prisma`, `main/`, `worker/` at commit time. Verdicts below override the source doc where code disagrees with it.
**Golden rule preserved in every fix:** Student Balance = SUM(Transaction.amount); all multi-entry money ops stay inside `prisma.$transaction`.

---

## 0. Environment Facts That Shape This Plan

1. **The app now runs on PostgreSQL (Neon), not SQLite.** `prisma/schema.prisma` has `provider = "postgresql"`; `src/lib/prisma.ts` uses `@prisma/adapter-pg`; `.env` points at a Neon DB; single migration `20260801000000_pg_init` (columns are `DOUBLE PRECISION`). The deployment is Cloudflare Workers + Neon (`.dev.vars`, `wrangler.jsonc`, `open-next.config.ts`).
2. **Consequence:** the `Decimal` migration recommended by the findings doc is **viable on the current stack** (NUMERIC on PG). It would NOT be viable if the app still ran Prisma-on-SQLite (Prisma does not support `Decimal` on SQLite) — so do not regress back to SQLite.
3. **Suspected broken path (separate issue, verify):** `main/main.js:148` still spawns the packaged server with `DATABASE_URL: file:...` + `KG_DATA_DIR`, which the `PrismaPg` adapter cannot connect to. Packaged Electron appears orphaned by the online-first pivot. Confirm whether Electron is still a shipping target before spending effort there. **Not a QA finding; flagged for confirmation.**
4. `src/proxy.ts` **no longer exists** — route protection lives in layouts (`(dashboard)/layout.tsx`, per-section `AdminLayout`s, `print/layout.tsx`) and action-level `requireAuth/requireAdmin`. Findings referencing `proxy.ts` are stale.

---

## 1. Verdict Summary

| # | Finding | Severity (claimed) | Verdict | Reality at code level |
|---|---------|--------------------|---------|------------------------|
| FIN-01 | Float precision in ledger | Critical | **VALID** (impact downgraded) | `Float`/`DOUBLE PRECISION` everywhere; `roundMoney` mitigates at read, but writes are not uniformly rounded. Exact fix = `Decimal(12,3)` — viable on PG. |
| AUTH-01 | Password change doesn't revoke sessions | Critical | **VALID** | `auth.ts sign()` uses only `cookieSecret`; cookie `role.sig` stays valid after password change. Fix is contained in `auth.ts`. |
| STU-02 | Non-atomic student creation | Critical | **INVALID — already fixed** | `createStudent` is wrapped in `prisma.$transaction` (`student-actions.ts:138`); same for `updateStudent:211`, `processPayment:58`, `cancelReceipt:130`, `processRefund:28`, `promoteStudents:41`. No work. |
| PROMO-01 | Micro-balance orphan on promotion | High | **PARTIALLY VALID — proposed fix rejected** | Both transfers already use the same `roundMoney(oldBalance)` value (`promotion-actions.ts:73,136-158`), so balances stay equal across records. Residual only exists in raw float sums; the doc's fix (exact on old, rounded on new) would **break transfer equality** — do NOT adopt. Fix = 1-line interim + FIN-01. |
| IMP-01 | Import memory DoS + formula injection | High | **PARTIALLY VALID** | Formula-injection side **already mitigated** (`excel-utils.ts sanitizeCell` prefixes `'`). No file-size / row-count limit on import — that part is real. |
| FEE-01 | Duplicate fee → silent under-billing | High | **VALID** | No unique constraint on `Fee`; `getDefaultTuition` picks cheapest (`student-actions.ts:485` `orderBy amount asc`). |
| STU-01 | Negative fees accepted server-side | High | **VALID** | `createStudent`/`updateStudent` never validate `busFees`/`additionalFees`/`discountValue` ≥ 0; UI `min="0"` only. |
| PAY-02 | Receipt-number race unhandled | High | **INVALID — already fixed** | Retry loop with `MAX_RECEIPT_ATTEMPTS=3` + P2002 handler exists (`payment-actions.ts:30-55`). No work. |
| TIME-01 | No financial period locking | Medium | **VALID** | `processPayment`, `createExpense`, `createRevenue` accept arbitrary dates/year/month. |
| IMP-02 | Excel serial dates → year 44123 | Medium | **VALID — confirmed live** | `node`: `new Date("44123")` → `Fri Jan 01 44123`. `parseDate` (`import-actions.ts:30-39`) stringifies numeric cells. Corruption confirmed. |
| REV-01 | Month > 12 accepted | Medium | **VALID** | `createRevenue`/`createExpense` validate amount+category only; month/year free. UI `min/max` bypassable. |
| PAY-01 | Uncapped overpayments | Medium | **PARTIALLY VALID — by design, soften** | Credit balances are a deliberate feature (dashboard shows "رصيد دائن (زيادة دفع)"). Do not hard-block; add warning + optional cap. |
| REP-01 | Canceled receipt prints without watermark | Low | **VALID** | `generateReceiptPdf` returns no `isCanceled`; print page renders identically. |
| STU-03 | Inactive students in list vs counter mismatch | Low | **INVALID — doesn't match code** | Students page (`(dashboard)/students/page.tsx`) has **no counter** and lists **all** students incl. inactive (`getAllStudents()` unfiltered, badge shows الحالة). No mismatch exists. |

**Work items: 10 valid/partial findings → 8 code fixes + 2 doc/verify items. 3 findings closed as already-fixed. 1 finding's proposed fix rejected.**

---

## 2. Fix Plan — Per Finding

### FIX-A · FIN-01 · Decimal money storage (PG) — Critical→High, large effort

**Root cause (verified):** `DOUBLE PRECISION` on `Student.busFees/additionalFees/discountValue/tuitionOverride`, `Fee.amount`, `Payment.amount`, `Receipt.amount`, `Revenue.amount`, `Expense.amount`, `Transaction.amount`. Writes not uniformly `roundMoney`'d (e.g. `processPayment` stores raw `input.amount`; `createFee`/`createRevenue`/`createExpense` store raw).

**Design:**
- Switch the 10 money columns to `Decimal @db.Decimal(12,3)` (Prisma maps to PG `NUMERIC(12,3)` — exact 3-fils precision).
- Add `src/lib/money.ts`: `toNum(v: unknown): number` (Decimal|number|null|string → rounded number) and `money(n: number): Prisma.Decimal`. Business math stays in plain numbers via `roundMoney`; exactness comes from NUMERIC storage + exact DB sums.
- **Serialization boundary (the risky part):** Prisma `Decimal` JSON-serializes as **string** in server actions. Every action returning money fields to client components must map through `toNum` — otherwise client `.toFixed(2)` breaks. Audit list below.

**Steps:**
1. `prisma/schema.prisma`: type the 10 columns as above.
2. Generate migration: `npx prisma migrate dev --name decimal_money` — SQL produced will be `ALTER TABLE ... ALTER COLUMN ... TYPE NUMERIC(12,3) USING ...::numeric(12,3)`. **Data check first:** run a query to confirm no stored value exceeds 3dp or 999,999,999 (expected clean — app writes already round).
3. `src/lib/money.ts` helper (above).
4. Action boundary mapping — files & fields:
   - `student-actions.ts`: return objects (student, ledger entries, balances map, unpaid list) — map busFees/additionalFees/discountValue/tuitionOverride/amount.
   - `payment-actions.ts`: `processPayment` return `{payment, receipt}`; `getReceipts`.
   - `refund-actions.ts`, `fee-actions.ts`, `expense-actions.ts`, `revenue-actions.ts` (all CRUD returns), `export-actions.ts` (rows already map fields manually — wrap with `toNum`), `pdf-actions.ts` (builds data — wrap).
   - `getStudentBalances`/`getStudentBalance`/`getUnpaidStudents`/`getDashboardStats`: `_sum` on NUMERIC returns Decimal → `toNum`.
   - `import-actions.ts`: amounts parsed by `parseAmount` remain numbers → pass through `money()`.
5. Keep `roundMoney` where arithmetic happens (discount calc, netChange, transfers) — Decimal at rest, number in flight.
6. Regression: re-run QA sections 5.3 (LED golden checks), 6, 7, 13 with 3-decimal amounts (e.g. 33.333 × 3 = exactly 100.000).

**Interim (do first, ships today):** normalize writes — apply `roundMoney` in `processPayment` (amount), `createFee`/`updateFee`, `createRevenue`/`updateRevenue`, `createExpense`/`updateExpense`, and student fee fields at create/update. Kills the compounding drift the Decimal migration will formalize.

---

### FIX-B · AUTH-01 · Password-versioned session cookies — High, small effort

**Root cause (verified):** `auth.ts:9-15` signs with `cookieSecret` only; password change (`settings-actions.ts changeAdminPassword`, `account-actions.ts setTeacherPassword`) never touches the key.

**Fix (contained in `auth.ts`):** bind the HMAC key to the role's password hash.
```ts
async function sign(role: string): Promise<string> {
  const cookieSecret = await getSetting("cookieSecret");
  const pwdHash = await getSetting(role === "admin" ? "adminPasswordHash" : "teacherPasswordHash");
  return createHmac("sha256", `${cookieSecret}:${pwdHash ?? ""}`).update(role).digest("hex");
}
```
- `verifyRoleCookie` already routes through `sign()` — one change covers both paths (layouts, actions).
- Settings cache (`settings.ts`) makes the two extra reads free after first refresh.
- **Behavioral note:** `changeAdminPassword` now logs out the changer too (their cookie invalidates mid-session). Acceptable and intended; the Settings form should show a hint "سيتم تسجيل خروجك وإعادة تسجيل الدخول" — small copy change in `settings-client.tsx`.
- Edge: `completeSetup` writes `adminPasswordHash` before `setAuthCookie` — order is already correct (`setup/actions.ts:38-41`).
- Test: login as admin → change password → refresh → redirected to login; old password rejected; new password works. Same for teacher.

---

### FIX-C · STU-01 · Server-side non-negative money validation — High, small effort

**Fix:** add to `src/app/actions/validation.ts`:
```ts
export function validateNonNegativeNumber(v: unknown, field: string): asserts v is number {
  if (typeof v !== "number" || isNaN(v) || v < 0) throw new Error(`الحقل "${field}" يجب أن يكون رقماً غير سالب`);
}
export function validateDiscountPercent(v: number, field: string): void {
  if (v > 100) throw new Error(`الحقل "${field}" لا يمكن أن يتجاوز 100%`);
}
```
Apply in `student-actions.ts`:
- `createStudent`: `busFees`, `additionalFees`, `discountValue` ≥ 0; `tuitionOverride` null-or-≥0; if `discountIsPercent` → percent ≤ 100.
- `updateStudent`: same for provided fields (`input.busFees !== undefined` etc.) **before** computing `netChange` (prevents negative-Adjustment injection).
- Also `processRefund`/`processPayment` already validate positive — no change.

---

### FIX-D · FEE-01 · Unique fee per grade+year+type — High, small effort + migration

**Fix:**
1. `prisma/schema.prisma` on `Fee`:
```prisma
@@unique([applicableGrade, academicYear, feeType, isActive])
```
   (isActive included so deactivating a rate and adding a new one for the same grade/year is legal — the actual business flow.)
2. **Dedupe before indexing** (existing Neon data may have dupes): one-off migration SQL — keep the lowest-id row per `(grade, year, feeType)` group, delete the rest (safe: `Fee` has no FKs from ledger — `StudentFee` rows reference `Fee`; deletion must be handled: either delete via `UPDATE StudentFee SET feeId = keepId` first or skip dedupe when `StudentFee` rows exist — **check `StudentFee` usage first; if orphaned `StudentFee` rows are OK to re-point, re-point them**). Only then `CREATE UNIQUE INDEX`.
3. Keep `getDefaultTuition` order-by-amount as a harmless tie-break (can no longer matter within a year).
4. Optional hardening: `createFee` cross-check message when an active fee already exists for grade+year+type (friendlier than a raw unique-violation).

---

### FIX-E · TIME-01 + REV-01 · Financial date/month validation — Medium, small effort

One shared helper in `validation.ts`:
```ts
const MIN_FIN_YEAR = 2000;          // matches import bounds
const MAX_FUTURE_MONTHS = 12;       // no more than 1 year ahead
export function assertValidFinancialDate(d: Date, field: string): void {
  const y = d.getFullYear();
  const now = new Date();
  if (isNaN(d.getTime()) || y < MIN_FIN_YEAR) throw new Error(`تاريخ غير صالح في "${field}"`);
  if (d.getTime() > now.getTime() + MAX_FUTURE_MONTHS * 30 * 86400_000) {
    throw new Error(`تاريخ العملية في "${field}" بعيد جداً في المستقبل`);
  }
}
export function assertMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("الشهر يجب أن يكون بين 1 و 12");
  if (!Number.isInteger(year) || year < MIN_FIN_YEAR || year > 2100) throw new Error("السنة غير صالحة");
}
```
Apply:
- `processPayment` → `paymentDate` (before building Revenue row).
- `createExpense`/`updateExpense` → `expenseDate` + `assertMonthYear(month, year)`.
- `createRevenue`/`updateRevenue` → `recordDate` + `assertMonthYear(month, year)`.
- UI: replace free-text month/year inputs in `revenues-client.tsx`/`expenses-client.tsx` with month Select (1..12) — kills the bypass at the source (optional but cheap).
- Note: back-dating into a *previous* academic year stays allowed (kindergartens legitimately post old months) — only far-future/far-past garbage is blocked. Configurable constants if product wants a tighter window.

---

### FIX-F · IMP-01 · Import size/row caps — Medium, small effort

In `import-actions.ts` (all 4 handlers: `importRevenues`, `importExpenses`, `previewRevenueImport`, `previewExpenseImport`):
```ts
const MAX_IMPORT_MB = 5;
const MAX_IMPORT_ROWS = 10_000;
if (file.size > MAX_IMPORT_MB * 1024 * 1024) throw new Error("حجم الملف يتجاوز الحد المسموح به (5 ميجابايت)");
// after load:
if (sheet.rowCount > MAX_IMPORT_ROWS) throw new Error("عدد الصفوف يتجاوز الحد المسموح به (10000 صف)");
```
- Keep existing `sanitizeCell` (formula injection already handled); extend its trigger class with `\t` and `\r` (`excel-utils.ts:62-64`) — cheap hardening.
- Note: Next.js server-action body limit (default 1 MB) already rejects most oversize uploads; the explicit check gives a friendly Arabic error and protects the preview path.

---

### FIX-G · IMP-02 · Excel serial dates → corrupted year — Medium, small effort

**Confirmed live:** `new Date("44123")` → `Fri Jan 01 44123`.

Fix `parseDate` in `import-actions.ts`:
```ts
function parseDate(raw: unknown): Date {
  if (raw instanceof Date) { if (isNaN(raw.getTime())) throw new Error("التاريخ غير صالح"); return raw; }
  let d: Date;
  if (typeof raw === "number") {
    // Excel serial: days since 1899-12-30
    d = new Date(Math.round((raw - 25569) * 86400_000));
  } else {
    const str = String(raw ?? "").trim();
    // all-digits string is an Excel serial in disguise — same path as numeric
    if (/^\d{4,6}$/.test(str)) d = new Date((parseInt(str, 10) - 25569) * 86400_000);
    else d = new Date(str);
  }
  if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) {
    throw new Error(`التاريخ غير صالح: "${raw}"`);
  }
  return d;
}
```
The year-bound check is the real safety net — any unparseable/absurd value becomes a row error (surfaced in the errors list) instead of silent corruption.

---

### FIX-H · PROMO-01 · Exact zero-out on promoted legacy student — High→Low (interim), 1 line

Reject the doc's split-value proposal (breaks old↔new equality). Instead:
- **Interim (1 line):** in `promotion-actions.ts:73`, drop `roundMoney` for the **transfer amounts only** (keep it for reporting):
  ```ts
  const oldBalanceRaw = balanceResult._sum.amount ?? 0;        // exact float sum
  const oldBalance = roundMoney(oldBalanceRaw);                 // for results/display
  // BalanceTransferOut: -oldBalanceRaw   (legacy ledger → exactly 0.0 raw)
  // BalanceTransferIn:  +oldBalanceRaw   (new ledger carries the same value → equality preserved)
  ```
- **Permanent:** FIN-01 (NUMERIC sums are exact; residual disappears entirely).

---

### FIX-I · PAY-01 · Overpayment guard (soft) — Medium, product decision

Credit balances are deliberate — do not hard-block. Ship:
1. **Soft warning (UI):** payments page passes each active student's current balance to `PaymentsPageClient` (it currently sends only id/name — `payments/page.tsx:23-29`); when `amount > balance` show inline warning "المبلغ أكبر من الرصيد المستحق — سيترك رصيداً دائناً للطالب" + require the cashier to tick a confirm checkbox before إصدار الإيصال.
2. **Optional hard cap (setting):** `maxPaymentAmount` setting (0 = unlimited), enforced in `processPayment`. Default 0 — schools that want the guard enable it.

---

### FIX-J · REP-01 · Canceled-receipt watermark — Low, small effort

1. `pdf-actions.ts`: extend `ReceiptPdfData` with `isCanceled: boolean`, `cancelDate?`, `cancelReason?` — read from the receipt row.
2. `print/receipt/[id]/page.tsx`: when `data.isCanceled`, render a rotated semi-transparent red overlay `إيصال ملغي` across each copy, plus a line with the cancel date/reason under the receipt number.
3. (Optional) `generateReceiptPdf` stays printable for canceled receipts by design — watermark makes it unambiguous on paper.

---

### Closed findings (no work) — record in ticket as verified

- **STU-02 (non-atomic create):** already `$transaction` at `student-actions.ts:138` — includes parents, pickups, `postEnrolmentCharges`. Evidence: all multi-entry ops transactional.
- **PAY-02 (receipt race):** retry loop at `payment-actions.ts:30-55` with P2002 detection + 3 attempts. The doc describes the bug this code already fixes.
- **STU-03 (inactive/counter mismatch):** students page has no counter; inactive students are listed with badges. Finding references `src/app/students/page.tsx` + `proxy.ts` — both nonexistent paths. Stale finding.
- **IMP-01 formula-injection part:** `sanitizeCell` (`excel-utils.ts:62-64`) already prefixes `'` for `= + - @` on every export. Only extend with `\t\r` (see FIX-F).

---

## 3. Execution Order

| Phase | Work | Effort | Risk |
|-------|------|--------|------|
| **P1 (ship first, independent)** | FIX-C (STU-01), FIX-E (TIME/REV), FIX-G (IMP-02), FIX-F (IMP-01), FIX-J (REP-01), FIX-B (AUTH-01), FIX-H interim line | 1-2 days | Low — no schema changes |
| **P2 (schema, needs Neon migration)** | FIX-D (FEE-01 unique + dedupe), FIX-A interim write-rounding | 1 day | Medium — dirty-data dedupe |
| **P3 (big refactor)** | FIX-A full Decimal migration + serialization audit | 3-5 days | **High** — Decimal↔string boundary; full regression of sections 5-14 required |
| **P4 (product decision)** | FIX-I (overpayment warning + optional cap) | 0.5-1 day | Low |
| **Verify-only** | Electron/`file:` DATABASE_URL incompatibility; confirm shipping targets | 0.5 day | — |

## 5. Validation Report (live, local instance)

Validated against a disposable local Postgres 16 (docker, port 5433) + `prisma migrate deploy` + seeded settings, dev server on :3010, exercising server actions over HTTP with the real RSC `next-action` protocol and an HMAC-forged admin cookie (computed from the local DB's `cookieSecret`+`adminPasswordHash`).

| Fix | Live result |
|-----|-------------|
| FIN-01 interim (write rounding) | S1 create: ledger exactly `423.000` (400+70−47); payment 100 → `323.000`; cancel → back to `423.000` with `Reversal:100` and `Revenue:-100/Cancellation` in the original month |
| PROMO-01 (exact transfer) | Promote KG1→KG2: **old student raw DB balance = `0.000000`** (previously float residual e.g. −2.8e-14); new = `936.000` (500+70−57+423); old deactivated; parents/pickups preserved |
| STU-01 (non-negative validation) | `busFees:-100` → `الحقل "رسوم الباص" يجب أن يكون رقماً غير سالب`; `discountValue:-5` via updateStudent → same; discount 150% → `الخصم بالنسبة المئوية لا يمكن أن يتجاوز 100%` |
| FEE-01 (duplicate guard) | Duplicate KG1/2025-2026 fee → `يوجد رسم نشط مسبقاً لهذا الصف والسنة (رسوم صف الروضة الأولى - 400)`; new-year fee (KG1 2026-2027 = 420) created fine; unpriced promotion guard intact (`لا توجد رسوم محددة لصف "روضة ثانية" للسنة الدراسية 2027-2028...`) |
| TIME-01/REV-01 | `month:13` → `الشهر يجب أن يكون رقماً صحيحاً بين 1 و 12`; date `2099-01-01` → `تاريخ العملية في "التاريخ" بعيد جداً في المستقبل`; payment date `1999-01-01` → `تاريخ غير صالح في "تاريخ الدفع"` |
| AUTH-01 (session revocation) | changeAdminPassword succeeded; **old cookie immediately 307→/login**; cookie signed with the new hash accepted (200). Same session-revocation applies to teacher-password changes |
| IMP-02 (serial dates) | Replication of the new `parseDate` branches: `45000` → 2023-03-15; `"44123"` (old bug: year 44123) → 2020-10-19; ISO/slash/Date-object OK; garbage, `<2000`, `>2100` all rejected as row errors |
| REP-01 (watermark) | `/print/receipt/1` after cancel: `إيصال ملغي` overlay + `ملغي بتاريخ 2026-08-01 — السبب: خطأ في المبلغ` |
| Smoke | /students, /payments, /fees, /revenues, /expenses, /reports, /settings, all 3 print routes → 200 with admin cookie |
| Static | ESLint clean on all 14 changed files; `tsc --noEmit` zero errors in changed files (3 pre-existing errors in `qa-tests/` — user's scratch scripts, untouched) |

Not exercised live (harness limits, not code): the multipart/FormData path for `importRevenues` (RSC body protocol not replicable via curl without a browser) — `parseDate` logic covered by the replication above and shares the exact code; size/row caps are trivial branches. Overpay UI warning verified at code level only (needs a browser).

**Leftovers for the real pipeline:** FIN-01 full `Decimal` migration (schema change → needs migrate-deploy pipeline); FEE-01 `@@unique` index (same pipeline — app-level guard covers it meanwhile).

**Rollout notes:**
- AUTH-01: new cookie key includes the password hash → **all existing sessions invalidate once on deploy**; users re-login once. Intended. Password change also logs the changer out (add the "سيتم تسجيل خروجك" hint in settings-client when shipping).
- Closed findings (no code): STU-02 (already `$transaction`), PAY-02 (retry loop exists), STU-03 (no counter exists / list shows all students).
- Also flagged: `main/main.js` still spawns Electron with `file:` DATABASE_URL — incompatible with the `PrismaPg` adapter; confirm whether packaged Electron is still a shipping target.


