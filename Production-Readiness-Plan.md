# Kindergarten ERP — Production Readiness Plan

**Status of the app today: it cannot ship.** Not "needs polish" — three independent
defects each make the installed product unusable, and every one of them was
reproduced live during this audit, not inferred from reading code.

This document is the full picture: what is broken, the evidence, and the ordered
plan to make the app genuinely usable by a kindergarten office on both Linux and
Windows.

It supersedes `Performance-Readiness-Design-Plan.md` (that plan's colour/loading/
N+1 work is correct and is folded in here as Phase 5) and `Audit Execution Plan.md`
(already executed, 14 commits on `main`).

---

## 0. Executive summary

| # | Blocker | Evidence |
|---|---------|----------|
| B1 | **Every PDF the app prints is unreadable Arabic gibberish** | Rendered a receipt with the app's own font + strings; see image proof in §1.1 |
| B2 | **A fresh install has no database tables** — every page 500s on first launch | Booted the real standalone server against a clean DB path; `The table main.Student does not exist` |
| B3 | **`ADMIN_PASSWORD` is compiled into the shipped JS in plaintext** and is not runtime-configurable | Password found in `.next/server/chunks/*.js`; auth succeeded with the env var unset |
| B4 | **Grade promotion mis-charges every promoted student** | Promoted a student live: bus/extra fees never charged, discount never applied |
| B5 | **The new school year silently charges last year's tuition**, and there is no UI anywhere to change fees | `getDefaultTuition` fallback + zero Fee-management pages |
| B6 | **The developer's real student database, backups, logs and `.env` are baked into the installer** | `.next/standalone/kindergarten.db`, `Backups/*.db`, `Logs/*.json`, `.env` |

Beyond the blockers: a teacher (who logs in **with no password at all**) can
permanently delete the kindergarten's revenue and expense records; backups cannot
be written at all on a normal Windows install and there is no restore path; the
ledger PDF prints debit and credit **backwards**; the dashboard takes 2.4 seconds
at 300 students with no loading indicator; and the app is unreadable if the
operating system is in dark mode.

**Effort estimate: 6 phases, roughly 3–4 focused days.** Phases 1–4 are the
blockers and must land in order. Phase 5 is quality-of-life. Phase 6 is the
enhancements that turn it from "works" into "good".

---

## 1. The blockers, with proof

### 1.1 B1 — PDF Arabic rendering is completely broken

**What the app prints today.** Rendering the receipt layout with the app's exact
font (`public/fonts/scheherazade-400.ttf`), the exact tafqit output, and the app's
exact patched `@react-pdf/textkit`:

```
Expected: التاريخ : ...... 2026-07-25 ......
Rendered: خيراتلا ...... 2026-07-25 ......      ← letters reversed, joining destroyed
Expected: روضة صناع الفكر — كشف حساب طالب
Rendered: ب‍لاط ب‍اسح فشك — ركفلا عانص ةضور
```

Every Arabic string in every receipt, ledger, and monthly report comes out
mirrored and mis-shaped. AGENTS.md marks Phase 6 (PDF reports) as COMPLETE. It
is 0% functional.

**Root cause — and why the existing "fix" made it worse.** `@react-pdf/textkit@6.3.0`'s
`reorderLine()` maps a *string* index through `run.stringIndices` (which is a
glyph→string map, not string→glyph). The moment Arabic shaping makes glyph count
differ from character count — ligatures, or a combining tanween — the lookup
returns `undefined` and the renderer throws. `scripts/patch-react-pdf.js` works
around this by replacing the whole function with `return line`, i.e. **disabling
bidi reordering entirely**, which is why RTL text now renders left-to-right.

Both states are fatal. Measured directly, one string at a time:

```
whole=ok    "رقم 00007"
whole=CRASH "350 دينار و 500 فلس"
whole=CRASH "إلغاء إيصال رقم 5: خطأ في المبلغ"
whole=CRASH "تعديل: رسوم الباص، الخصم"           ← pure Arabic, still crashes
whole=CRASH "خمسمائة دينار أردني و خمسون فلساً"   ← the receipt amount line
```

Splitting mixed-direction text into separate `<Text>` nodes does **not** help —
pure-Arabic strings crash too. `@react-pdf/renderer@4.5.1` is the latest published
version; there is no upstream fix to upgrade to.

**The fix: stop using `@react-pdf/renderer`. Print with Chromium.** The app is an
Electron app. Chromium already renders this app's Arabic perfectly on screen —
proven by every screenshot of the dashboard. Driving the *same* engine through
`webContents.printToPDF` with the same font and the same strings produces a
flawless document:

```
روضة صناع الفكر — سند قبض
التاريخ :               2026-07-25
وصلنا من السادة :        أحمد محمد
مبلغ وقدره :             خمسمائة دينار أردني و خمسون فلساً
وذلك عن :                خصم 10% على الرسوم — رصيد مرحل من KG1 - 2025-2026
```

Mixed RTL/LTR, percentages, dates, Latin grade codes — all correct, no patching,
no fontkit. This was rendered end-to-end with the project's own Electron binary
during the audit.

**What this removes on the way:** `@react-pdf/renderer`, `@react-pdf/textkit`,
`fontkit`, `brotli`, `scripts/patch-react-pdf.js` (a `postinstall` hook that
rewrites `node_modules` and **fails `npm install` outright** if react-pdf ever
changes a byte), ~2 MB of client bundle, and two ~500 KB `.ttf` downloads per PDF.

---

### 1.2 B2 — A fresh install has no database

Booted `.next/standalone/server.js` exactly the way `main/main.js` does — correct
cwd, `NODE_ENV=production`, `DATABASE_URL` pointed at a clean userData path:

```
✓ Ready in 0ms
GET /login   → 200
GET /        → 307 → /login          (auth works)
GET /students → 500
⨯ PrismaClientKnownRequestError: The table `main.Student` does not exist in the
  current database.  code: 'P2021'
```

Prisma silently created a 0-byte SQLite file and every database page died.

**Root cause.** `instrumentation.ts` → `ensureDatabaseReady()` is the only thing
that creates the schema on first run. Next.js 16 builds it (`.next/server/instrumentation.js`
exists) but **does not copy it into the standalone output**:

```
.next/server/instrumentation.js              ← exists
.next/standalone/.next/server/instrumentation.js  ← does not exist
```

So on any machine that isn't the developer's, the app installs, launches, shows
the login page, and then breaks on the first click. Forever.

---

### 1.3 B3 — The admin password is compiled into the binary

Next.js inlines `process.env.ADMIN_PASSWORD` into the server bundle at build time:

```
$ grep -rl "0505" .next/
.next/server/chunks/ssr/[root-of-the-server]__0s1m817._.js
.next/standalone/.env
```

Three consequences, all confirmed:

1. **Not runtime-configurable.** Editing `.env` on the customer's machine changes
   nothing. The password is whatever it was on the build machine.
2. **Readable by anyone with the install.** It sits in plaintext in the shipped
   `.env` *and* in the shipped JS chunks.
3. **Admin cookies are forgeable.** `src/lib/auth.ts` uses the password itself as
   the HMAC signing key. During the audit a valid admin cookie was minted from the
   build-time password and accepted by the production server **with `ADMIN_PASSWORD`
   unset in the environment** — the request reached the database layer instead of
   being redirected to `/login`.

The `verifyRoleCookie` fail-closed guard (`role === "admin" && !process.env.ADMIN_PASSWORD`)
is dead code in production, because the inlined value is always truthy.

`KG_NAME` has the same problem, which is why the kindergarten's name can never be
changed after the build.

---

### 1.4 B4 — Grade promotion mis-charges every student

Reproduced live through the app's own promotion dialog.

Student before promotion — `Pre`, tuition 350, bus 30, extras 20, 10% discount:

```
Charge  +350.00  رسوم دراسية
Charge   +50.00  رسوم إضافية (باص + إضافات)
Charge   -40.00  خصم 10%
                 balance 360.00   ✓ correct
```

After promoting to `KG1` / `2026-2027`:

```
old student:  BalanceTransferOut  -360.00     → balance 0     ✓
new student:  Charge             +400.00  رسوم دراسية - ترقية
              BalanceTransferIn  +360.00
                                  balance 760.00
```

**Correct balance is 765.00.** `promoteStudents` copies `busFees`,
`additionalFees`, `discountValue` onto the new student row but **never posts the
corresponding ledger entries** — unlike `createStudent`, which posts all three.
The student is under-charged 50 for extras and over-charged 45 for the missing
discount. The error scales with the fee structure and is invisible: the student
row *says* they have a 30 JOD bus fee, the ledger just never billed it.

Also confirmed in the same run:
- `Student.notes` is silently dropped on promotion.
- No `logEvent` — a bulk financial operation with zero audit trail.
- Ledger descriptions leak raw grade codes: `رصيد مرحل من Pre - 2025-2026`
  (violates the Arabic-only constraint; `gradeLabel()` exists and is not used).
- The duplicate guard matches on first+last name only, so two students named
  سارة أحمد block each other with a false "already exists".

---

### 1.5 B5 — The new school year charges last year's tuition, forever

In the same live promotion, the new `2026-2027` KG1 student was charged **400** —
the `2025-2026` rate. `getDefaultTuition` finds no fee for the new year and falls
back to "any active fee for this grade".

That fallback is deliberate and sensible *only if* an admin can then create the
new year's fee. **They cannot.** There is no Fees page, no Fees dialog, no Fees
route. The `Fee` table is written exactly once, by `seedDefaultFees()`, hardcoded
to `academicYear: "2025-2026"`:

```
$ ls "src/app/(dashboard)/"
expenses/  layout.tsx  page.tsx  payments/  reports/  revenues/  students/
```

So the year-rollover the user specifically asked about is a dead end: promote the
cohort and every child is billed the previous year's price, with no way to fix it
short of editing SQLite by hand.

---

### 1.6 B6 — The installer ships the developer's real data

`.next/standalone` after a clean build:

```
.next/standalone/kindergarten.db              112 KB   ← real students, payments, receipts
.next/standalone/Backups/backup_2026-07-19…db 112 KB   ← real backup
.next/standalone/Logs/log_2026-07-19.json              ← real audit log
.next/standalone/.env                                  ← ADMIN_PASSWORD="0505"
```

`package.json` → `build.extraResources` copies `.next/standalone` **wholesale**
into the installer, so all of this ships to every customer.

**Root cause.** Next.js's file tracer statically resolves
`path.join(process.cwd(), "Logs")` (`src/lib/logger.ts:11`) and
`path.join(process.cwd(), "Backups")` (`src/app/actions/backup-actions.ts:39`)
into whole-directory includes, and resolves `DATABASE_URL` from
`prisma/schema.prisma` into a file include. The bundle is **310 MB** for the same
reason — it also drags in the entire Prisma CLI and 33 MB of `sharp`.

---

## 2. High-severity findings (not shipping blockers, but data-integrity or safety)

| ID | Finding | Location |
|----|---------|----------|
| H1 | **Teachers log in with no password** and can create/edit/**permanently delete** revenues and expenses, cancel any receipt, and deactivate students. `proxy.ts` gates only `/` and `/reports`; the sidebar shows `/revenues` and `/expenses` to teachers (`role: "all"`); the actions use `requireAuth` where `requireAdmin` is needed. | `src/proxy.ts:21`, `src/components/layout/sidebar.tsx:26`, `revenue-actions.ts`, `expense-actions.ts`, `payment-actions.ts:91`, `student-actions.ts:379` |
| H2 | `deleteRevenue`/`updateRevenue` can mutate the auto-generated `source: "Payment"` and `"Cancellation"` rows, silently desyncing the revenue ledger from receipts. No `logEvent` on delete. | `src/app/actions/revenue-actions.ts:37,58` |
| H3 | **Backups and Logs are written to the install directory.** `main.js` sets `cwd` to `resources/standalone/`; under `C:\Program Files` that is read-only for a standard user. Backup returns an error; logging swallows it silently. | `main/main.js:31`, `backup-actions.ts:39`, `logger.ts:11` |
| H4 | Backup is a raw `fs.copyFile` of a **live** SQLite file — a concurrent write yields a torn copy. **And there is no restore path anywhere in the app.** | `src/app/actions/backup-actions.ts:52` |
| H5 | **No single-instance lock and a hardcoded port 3000.** Double-clicking the shortcut twice, or any other process holding 3000, leaves a permanently blank window. | `main/main.js:6` |
| H6 | **The ledger PDF prints debit and credit backwards.** A positive balance means the family *owes* the kindergarten, but the PDF labels it `له` ("owed to them"). Parents receive statements claiming the kindergarten owes them money. | `src/components/pdf/ledger-pdf.tsx:228,261` |
| H7 | **No `error.tsx`, `loading.tsx`, `not-found.tsx`, or `global-error.tsx` anywhere.** A thrown Arabic auth error becomes Next.js's English "Application error: a server-side exception has occurred". | `src/app/**` |
| H8 | **Dark mode is unusable.** The app inherits the OS colour scheme, `<body>` has no `bg-background text-foreground`, and KPI chips hardcode light pastels (`bg-blue-50`, `bg-red-100`). Verified: near-black page, invisible text. | `src/app/layout.tsx:16`, `globals.css` |
| H9 | Receipt numbers are allocated with `MAX(receiptNumber)+1` inside the transaction; a retry or concurrent payment hits the unique constraint and surfaces a raw Prisma error. Payments have no idempotency key. | `src/app/actions/payment-actions.ts:33` |
| H10 | `processPayment` never checks `student.isActive` — a promoted-away or withdrawn student can still be paid against. | `src/app/actions/payment-actions.ts:27` |

---

## 3. Medium-severity findings

**Performance** (measured on a seeded 300-student / 3,612-transaction database):

| Page | Time | Cause |
|------|------|-------|
| `/` (dashboard) | **2.16 – 2.38 s** | `getUnpaidStudents` runs 3 **sequential** queries per active student — 909 round-trips |
| `/students` | 0.46 s | 303 parallel `getStudentBalance` calls, each re-reading and re-verifying the auth cookie |

Both collapse to a single `groupBy`. No loading indicator exists, so the dashboard
is a frozen blank page for those 2.4 seconds.

**Correctness / logic**

- **M1** `updateStudent` posts fee changes as `Adjustment`, but `getDashboardStats`
  computes "الدخل المتوقع" from `Charge` only — editing a student's fees never moves
  expected income. Refunds (also `Adjustment`) make `outstandingBalance` and
  `expectedIncome − collected` fail to reconcile; verified live: 349.95 vs 299.95.
- **M2** **No student edit UI at all.** `updateStudent` exists with zero callers. A
  typo in a child's name is permanent.
- **M3** **The create-student form never collects parents or pickup persons.** The
  action supports them and the profile page displays them; the form has no fields.
  Parent phone numbers can never be entered — for a kindergarten, that is a
  functional hole, not a nicety.
- **M4** `exportStudentBalances` and `getRefunds` have no UI. Refunds are invisible
  after creation except as an unlabelled `Adjustment` line.
- **M5** Discounts are stored as `Charge` rows with a negative amount, labelled
  "رسوم" in the ledger badge, and reverse-engineered by sign in `generateLedgerPdf`.
- **M6** `createStudent` and `updateStudent` never `roundMoney()` the computed
  discount or `netChange`; float epsilon produces spurious `Adjustment` rows.
- **M7** `Revenue` and `Expense` have **no indexes at all**, yet the dashboard
  aggregates them by `(year, month)`.
- **M8** `academicYear` is free text with no canonical list; the promotion dialog
  hardcodes `"2025-2026"` → `"2026-2027"`. `getDefaultTuition` tie-breaks by
  cheapest amount.
- **M9** The 310 MB standalone bundle ships the whole Prisma CLI and 33 MB of `sharp`.
- **M10** `main.js` `startServer()` resolves even after exhausting its 30 retries, so
  the window opens against a dead server; the `did-fail-load` fallback only fires
  once `serverProcess` is already null.
- **M11** `triggerDownload` uses a `data:` URL — a large Excel export can exceed
  browser URL limits.
- **M12** `parseDate` in the Excel importer is `new Date(str)` — locale-dependent
  and silently accepts junk.
- **M13** `getAllStudents` search uses case-sensitive `contains` and returns every
  row unpaginated.
- **M14** The receipt PDF hardcodes one kindergarten's address, phone and email;
  the ledger PDF hardcodes `KG_NAME = "روضة صناع الفكر"`, ignoring the env var.
- **M15** Dead schema with no UI or meaning: `Student.exitStatus`, `globalId`,
  `siblingGlobalId`, the entire `StudentFee` table, `Payment.referenceNumber`.

---

## 4. The plan

Phases are ordered by dependency. **Do not reorder 1 → 4.** Each phase ends with a
verification step that must pass before moving on.

---

### Phase 1 — Make the packaged app run at all (B2, B3, B6, H3, H5)

Nothing else can be validated until an installed build actually works.

**1.1 Move configuration out of the build and into the database.**

Add a `Setting` key/value table (`kindergartenName`, `address`, `phone`, `email`,
`logoPath`, `currentAcademicYear`, `adminPasswordHash`). Seed it on first run.

- Replace `process.env.ADMIN_PASSWORD` with a **scrypt/argon2 hash read from the
  database**, set through a first-run setup screen. Keep `timingSafeEqual`.
- Generate a **random 32-byte cookie signing secret** on first run, store it in the
  database, and use it instead of the password. This fixes forgeable cookies and
  makes the password changeable without a rebuild.
- Replace `process.env.KG_NAME` and the hardcoded strings in `receipt-pdf.tsx`
  and `ledger-pdf.tsx` with `Setting` reads.
- Keep `DATABASE_URL` as an env var — it is a path, not a secret, and `main.js`
  already overrides it correctly.

**1.2 Run database initialisation from a place that survives packaging.**

`instrumentation.ts` is not copied into standalone output. Do not fight it. Move
`ensureDatabaseReady()` to an explicit call and invoke it from **both**:
- a `getPrisma()` accessor that awaits a module-level `ensureDatabaseReady()`
  promise once, guarding every server action; **or** (simpler, preferred)
- `main/main.js`, which spawns a short-lived `node` process running a bundled
  `db-init.js` **before** starting the server, and shows an Arabic error dialog if
  it fails.

The second option is more honest: schema creation is a startup step, not a
request-path concern. Keep `instrumentation.ts` for `next dev`.

**1.3 Write runtime data outside the install directory.**

`Logs/` and `Backups/` must live next to the database in `app.getPath("userData")`,
not in `process.cwd()`. Pass their paths from `main.js` as `KG_DATA_DIR` and read
that in `logger.ts` and `backup-actions.ts`. This fixes Windows read-only installs
**and** stops the file tracer from bundling them (B6).

**1.4 Stop shipping the developer's data.**

```jsonc
// next.config.ts
outputFileTracingExcludes: {
  "*": ["**/*.db", "**/Backups/**", "**/Logs/**", "**/node_modules/prisma/**",
        "**/node_modules/@img/**", "**/.env"],
}
```

Then add an explicit build step that writes a clean `.env` (containing only
`DATABASE_URL`) into `.next/standalone` before `electron-builder` runs, and assert
in CI that no `*.db` exists under `.next/standalone`.

**1.5 Harden Electron startup.**

- `app.requestSingleInstanceLock()`; on `second-instance`, focus the existing window.
- Pick a **free ephemeral port** (bind `0` on a throwaway server, read `.address().port`)
  instead of hardcoding 3000, and pass it to both the server and `loadURL`.
- Make `startServer()` **reject** after max attempts and show the Arabic failure
  page from the rejection path, not from a `did-fail-load` race.
- Kill the child on `will-quit` as well as `before-quit`, and on Windows use
  `taskkill /pid <pid> /T /F` so no orphan holds the port.

**Verify Phase 1:** on a machine with no `.env`, no `node_modules`, and no existing
database — install the built package, launch it, complete first-run setup, add a
student, take a backup. Confirm `userData/` contains the DB, `Logs/`, and
`Backups/`, and that `resources/standalone/` contains no `.db` and no secret.

---

### Phase 2 — Fix PDF output (B1, H6)

**2.1 Delete the react-pdf stack.**

Remove `@react-pdf/renderer`, `@react-pdf/textkit`, `scripts/patch-react-pdf.js`,
the `postinstall` patch hook, and `src/components/pdf/fonts.ts`.

**2.2 Add print routes.**

Three server-rendered, print-styled pages reusing the existing Tailwind RTL setup:

```
/print/receipt/[id]
/print/ledger/[studentId]
/print/monthly/[year]/[month]
```

Each renders plain HTML with an `@media print` stylesheet (`@page { size: A5 landscape }`
for the receipt, `A4` for the ledger, `A4 landscape` for the monthly report) and
`@font-face` pointing at the existing `scheherazade-400.woff2` — the browser's
native WOFF2 decoder is unaffected by the fontkit bug. Use `thead { display: table-header-group }`
so multi-page tables repeat their header, which the react-pdf version never did.

**2.3 Wire up printing.**

- **Print to paper / Save as PDF:** open the print route in a new window and call
  `window.print()`. Works in the browser during development and in Electron.
- **Save PDF directly** (nicer): an IPC channel to `main.js` that opens a hidden
  `BrowserWindow`, loads the print route with the auth cookie, calls
  `webContents.printToPDF`, and writes the file through `dialog.showSaveDialog`.
  This is the mechanism verified during the audit.

**2.4 Fix the inverted sign while rewriting the ledger.**

A positive balance means the family owes the kindergarten → `عليه`. Negative →
`له`. Currently reversed in both the summary block and every row.

**Verify Phase 2:** print one receipt, one ledger with 25+ transactions (forcing
pagination), and one monthly report. Confirm every Arabic string is correct,
mixed digits/percentages read correctly, the table header repeats on page 2, and
the debit/credit labels match the on-screen ledger.

---

### Phase 3 — Fix the financial logic (B4, B5, H2, H9, H10, M1, M5, M6)

**3.1 Extract one shared "post the enrolment charges" function.**

`createStudent` and `promoteStudents` must call the *same* code. Today they have
divergent copies and the promotion copy is missing two of the three entries.

```ts
async function postEnrolmentCharges(tx, studentId, {tuition, busFees, additionalFees,
                                                    discountValue, discountIsPercent}, actor)
// posts: Charge(tuition), Charge(extras), Discount(-effective)  — all roundMoney()'d
```

This alone fixes B4 permanently — it cannot drift again.

**3.2 Add a `Discount` transaction type.**

Stop encoding "discount" as a negative `Charge`. Add `Discount` to the type set,
label it in the ledger badge and the PDF, and drop the sign-sniffing in
`generateLedgerPdf`.

**3.3 Round all money at the write boundary.**

`roundMoney()` the effective discount, the `netChange` in `updateStudent`, and
compare `Math.abs(netChange) >= 0.0005` instead of `!== 0` so float epsilon stops
creating phantom adjustment rows.

**3.4 Build the Fees management page** (`/fees`, admin-only).

CRUD over `Fee` with grade + academic year + amount + active flag, plus a
**"copy this year's fees to next year"** action. Without this, B5 cannot be closed.

**3.5 Make the academic year a real setting.**

Store `currentAcademicYear` in `Setting`. Drive the student form default, the
promotion dialog, and the dashboard from it instead of hardcoded strings and a
`groupBy` heuristic. Offer a year picker rather than a free-text box.

**3.6 Make promotion safe and auditable.**

- Wrap the whole batch in one `$transaction` (or keep per-student transactions but
  return a proper summary) and add `logEvent("students_promoted", …)`.
- Match duplicates on `(firstName, lastName, dateOfBirth)`, or better, on a stable
  student identity, not on name alone.
- Copy `notes`.
- Use `gradeLabel()` in ledger descriptions — no `Pre`/`KG1` in Arabic text.
- **Refuse to promote into a year that has no `Fee` row** for the target grade,
  with an Arabic error pointing at `/fees`. This turns B5 from a silent
  mis-billing into a clear, fixable prompt.

**3.7 Protect derived revenue rows.**

`updateRevenue`/`deleteRevenue` must reject rows whose `source` is `"Payment"` or
`"Cancellation"`. Hide the edit/delete buttons for them. Add `logEvent` to both
delete actions.

**3.8 Harden payments.**

- `requireAdmin` for `cancelReceipt` (it is a financial reversal).
- Reject payments for `isActive: false` students.
- Allocate receipt numbers from a dedicated counter row with an atomic
  `UPDATE … SET value = value + 1 RETURNING value`, and catch the unique-constraint
  error into an Arabic retry message.
- Accept an optional client-generated idempotency key so a double-submit cannot
  create two receipts.

**3.9 Reconcile the dashboard KPIs.**

Include `Adjustment`, `Discount`, `BalanceTransferIn/Out` in the expected-income
computation, or redefine the card as "صافي المستحق" = `SUM(all transactions)` for
the current year's students so it reconciles with outstanding balance by
construction. Whichever is chosen, the numbers on that page must add up.

**Verify Phase 3:** create a student with bus fees and a percentage discount;
confirm the ledger. Promote them to a year that has its own `Fee` row; confirm the
new ledger equals `newTuition + extras − discount + carriedBalance` exactly. Try
promoting into a year with no fee and confirm the Arabic refusal. Try to delete a
payment-derived revenue row and confirm the refusal.

---

### Phase 4 — Close the authorization holes (H1)

**4.1 Give the teacher role a password**, stored the same way as the admin's, or
remove the role entirely if the kindergarten has one operator. A no-password
button that grants receipt-cancellation and expense-deletion rights is not a role,
it is an open door.

**4.2 Gate `/revenues` and `/expenses` to admin** in `proxy.ts`, and set their
sidebar entries to `role: "admin"`.

**4.3 Move to `requireAdmin`:** `cancelReceipt`, `setStudentActive`,
`createRevenue`/`updateRevenue`/`deleteRevenue`, `createExpense`/`updateExpense`/
`deleteExpense`, `importRevenues`/`importExpenses`.

**4.4 Hide the backup button from teachers** — it currently renders for everyone
and then fails with an authorization error.

**Verify Phase 4:** log in as teacher; confirm `/revenues`, `/expenses`, `/reports`
and `/` all redirect, the sidebar shows only Students and Payments, and no backup
button appears.

---

### Phase 5 — Performance, feedback, and the colour system

This is `Performance-Readiness-Design-Plan.md` — its analysis is sound and its
phases 1–3 should be executed as written. Summarised:

**5.1 Kill the two N+1 loops.** Replace the per-student queries in
`getUnpaidStudents` and `students/page.tsx` with one `transaction.groupBy({ by: ['studentId'], _sum: { amount: true } })`
plus one `payment.groupBy` for last/this-month payment dates. Expect the dashboard
to drop from ~2.4 s to well under 100 ms at 300 students.

**5.2 Add loading and error UI.** `loading.tsx` for the dashboard group,
`error.tsx` with an Arabic message and a retry button, `global-error.tsx`, and
`not-found.tsx`.

**5.3 Fix the colour system.** Define the semantic tokens the app already uses,
give `<body>` `bg-background text-foreground`, and **force `color-scheme: light`**
— this is an offline single-tenant desktop app; inheriting the OS dark theme buys
nothing and currently makes the app unreadable. Replace the hardcoded
`bg-blue-50`/`bg-red-100` chips with tokens.

**5.4 Index the financial tables.** `@@index([year, month])` on `Revenue` and
`Expense`.

**5.5 Add a `busy_timeout`.** Do **not** enable WAL yet — `createBackup` currently
copies only the `.db` file, so under WAL the most recent commits would still be
sitting in `-wal` and every backup would silently lose them. Enable
`PRAGMA journal_mode = WAL` **only together with, or after, the `VACUUM INTO`
backup rewrite in 6.3**, never before it.

**5.6 Shrink the bundle.** With the tracing excludes from 1.4 plus removing
react-pdf, the 310 MB standalone should fall to roughly 60–80 MB.

**Verify Phase 5:** re-run the 300-student seed and confirm the dashboard is under
200 ms; toggle the OS to dark mode and confirm the app still reads correctly.

---

### Phase 6 — Make it genuinely usable (the gaps that make it feel unfinished)

**6.1 Student editing.** A full edit dialog wired to the existing `updateStudent`,
including grade, academic year, fees and discount — with the resulting `Adjustment`
shown to the user before saving ("سيتم إضافة تسوية بقيمة X").

**6.2 Parent and pickup-person management.** Fields in the create form and an edit
panel on the profile. This is the single biggest missing feature: right now a
kindergarten cannot record a parent's phone number.

**6.3 Backup and restore, done properly.**
- Replace `fs.copyFile` with `VACUUM INTO '<path>'` — one line, atomic, always a
  consistent snapshot, and the prerequisite for turning on WAL (5.5).
- Add a **restore** flow: pick a backup, verify it opens and has the expected
  tables, back up the current DB first, swap, restart.
- Automatic backup on launch, keeping the existing 30-file rotation.

**6.4 Refund visibility.** Surface `getRefunds` on the student profile.

**6.5 Student balances export.** Wire the orphaned `exportStudentBalances` to a
button on `/students`.

**6.6 Settings page.** Kindergarten name, address, phone, email, logo upload,
current academic year, change admin password. Feeds Phase 1.1 and the PDFs.

**6.7 Print-preview.** Show the print route in-app before printing so the operator
sees exactly what will come out.

**6.8 Schema cleanup.** Either use or drop `exitStatus`, `globalId`,
`siblingGlobalId`, `StudentFee`. Dead columns in a financial schema are future
bugs.

**6.9 Consider integer fils.** Every money column is `Float`. `roundMoney()` is a
patch over that, not a fix. A migration to integer fils (`amount INTEGER`, 1 JOD =
1000) removes an entire class of drift. Worth doing before the data set grows —
it only gets more expensive.

---

## 5. What is already good

Worth stating plainly, because the plan above is unrelenting:

- The **ledger pattern is the right architecture** and it is implemented correctly.
  `Transaction` is genuinely append-only, balance is genuinely `SUM(amount)`, and
  every multi-entry operation is inside a real `prisma.$transaction`.
- **Cancellation writes its reversal into the original month**, not the current one
  — a subtle thing most implementations get wrong.
- The **tafqit implementation is careful and correct**, including Arabic
  numeral-noun agreement and the JOD thousandths (not cents) distinction.
- **Excel export escapes formula injection** on every free-text field.
- The **logger writes JSON Lines** rather than read-modify-writing an array, which
  removes a real concurrency race.
- **Migrations are idempotent** and tracked in `_kg_migrations`.
- TypeScript is strict and `tsc --noEmit` is clean; the production build passes.

The foundation is sound. What is missing is everything between "the ledger is
correct" and "a kindergarten secretary can install this and use it".

---

## 6. Suggested execution order (condensed)

```
Day 1   Phase 1  — packaged app boots, config in DB, data out of installer
Day 2   Phase 2  — PDFs via Chromium print
Day 2–3 Phase 3  — financial logic, fees page, promotion
Day 3   Phase 4  — authorization
Day 3   Phase 5  — perf, loading/error UI, colours
Day 4   Phase 6  — student editing, parents, backup/restore, settings
```

**Gate before release:** build the installer on a clean checkout, install it on a
Windows machine that has never run the app, and complete this script end to end
with no developer intervention — first-run setup, add a student with parents and a
bus fee, take a payment, print the receipt, print the ledger, create next year's
fees, promote the grade, verify the new balance arithmetic by hand, take a backup,
restore it.
