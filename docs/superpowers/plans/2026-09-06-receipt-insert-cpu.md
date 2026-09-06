# Receipt-insert CPU (Cloudflare Free)

> **Money freeze:** Do not change `attemptProcessPayment` create order, amounts, signs, or `$transaction` membership (Payment + Receipt + Transaction Payment + Revenue). Do not chunk the write. Do not rewrite `SUM(amount)`.

**Goal:** Stop Cloudflare `exceededCpu` (Error 1102) when issuing a receipt, without risking a partial ledger.

**Root cause (investigate):** Issuing a receipt is not “one small insert.” On Workers Free (10 ms CPU):

```
POST Server Action processPayment
  Prisma client construct (CF: new client per request)
  $transaction: student + getSetting + max receipt# + payment + receipt + ledger + revenue
  serialize Prisma objects back to the client
THEN (same user click)
  router.refresh() → GET /payments
    getReceipts() ALL receipts + nested payment.student
    getAllStudents(active)
    getStudentBalances(all those ids)
```

If the Worker dies **before** commit: no receipt (safe). If it dies **after** commit while serializing or on `refresh()`: receipt **exists**, UI shows error → staff may issue a **duplicate**. That is the money risk of “retry.”

`payments-client.tsx` already prepends the new receipt in React state (`setReceipts`). `router.refresh()` is redundant for the list and is the expensive second invocation.

**Architecture:** Keep one atomic `$transaction`. Make the action return a small JSON DTO (not full Prisma graphs). Do **not** call `router.refresh()` after a successful insert; update local list + next VouNo + that student’s balance. Hoist `getSetting` **out of** the transaction. Optionally cap the initial receipt list on GET (display), not the write.

**Success:** Insert still all-or-nothing. After success the table shows the new row without a full `/payments` SSR. Duplicate-on-retry only if the user submits twice after a true error with no row (existing collision retry already handles VouNo).

## What already exists

- `attemptProcessPayment` is the correct ledger write (`payment-actions.ts:90-160`).
- Client already optimistic-appends the receipt (`payments-client.tsx:108-117`).
- `StudentSearchPicker` only **shows** 50 rows but still receives the **full** student array from the server.
- Auth HMAC already removed (prior PR); leftover CPU is Prisma + SSR.

## NOT in scope

- Changing Transaction types/amounts
- KV/HTML cache of authenticated pages
- Chunked promotion/import
- Rewriting dashboard/students SQL
- Workers Paid
- Removing `requireAuth` from `processPayment`

## Investigate conclusion

**Root cause hypothesis:** Cloudflare kills the receipt click because the **same user action** pays for (1) a multi-query Prisma transaction plus (2) a full `/payments` RSC refresh that loads every receipt and every active student. (2) is optional for correctness of the insert. (1) must stay atomic.

---

### Task 1: Do not SSR `/payments` after a successful insert

**Files:** `src/components/payments/payments-client.tsx`

- On `processPayment` success: keep `setReceipts` prepend; bump `payReceiptNumber`; close dialog.
- **Remove** `router.refresh()` from `handlePayment` success path.
- Subtract `amount` from `balances` in local state for that `studentId` (same sign as ledger: payment reduces amount owed). Do not refetch all balances.
- Keep `router.refresh()` on **cancel receipt** if that path still needs server truth (cancel is rarer; or apply the same local-row update if already done).

**Verify:** Issue a receipt locally; network tab has **one** server action, no extra document/RSC GET for `/payments`. List shows the new row. Balance in the picker for that student drops by the amount.

---

### Task 2: Hoist settings out of the DB transaction

**Files:** `src/app/actions/payment-actions.ts` (`attemptProcessPayment` only)

Quoted today:

```
const kgName = (await getSetting("kindergartenName")) ?? "الروضة";
```

inside `$transaction` (`payment-actions.ts:100`).

- Call `getSetting("kindergartenName")` and `getSetting("maxPaymentAmount")` **before** `prisma.$transaction`.
- Pass `kgName` into `attemptProcessPayment`.
- Do not add/remove create calls inside the transaction.

**Verify:** Receipt still has kindergarten name on the row. Wrong max amount still Arabic error before tx.

---

### Task 3: Return a small DTO from `processPayment`

**Files:** `src/app/actions/payment-actions.ts`, `payments-client.tsx` types

Return only what the client already uses (`id`, `receiptNumber`, `amount`, `issueDate`, `studentName`, payment `id/studentId/method/notes`). Do not return full Prisma `include` graphs. Cuts CPU on the action response.

Do not change DB writes.

---

### Task 4 (optional, GET page — only if Task 1 is not enough)

**Files:** `payments/page.tsx`, `getReceipts`

- `take: 100` (or year filter) on `getReceipts` for the page list.
- Do **not** change insert.

Defer loading all students if still over budget after 1–3 (picker currently needs the full array in memory). Separate follow-up.

---

## Failure modes

| Event | Money | UI |
|-------|--------|-----|
| 1102 before commit | No receipt | Error; retry OK |
| 1102 after commit, during serialize | Receipt exists | Error; **must not** blindly retry same VouNo |
| 1102 on removed refresh | Receipt exists | List already updated locally (Task 1) |

Task 1 is the duplicate-receipt guard for the “UI failed but DB wrote” case.

## Tests

- Vitest: DTO shape / local balance math helper if extracted.
- Manual: one receipt, check DB one Payment+Receipt+Transaction+Revenue; UI one new row; second identical submit hits unique VouNo or existing collision retry.

## Eng review decisions (2026-09-06)

- D1 A: Remove `router.refresh()` after successful insert.
- D2 A: Hoist `getSetting` out of `$transaction`.
- D3 A: Return slim DTO from `processPayment`.
- D4 A: Local `useState` balances; subtract on pay, add on cancel.
- D5 A: Vitest for balance helpers + DTO mapper.
- D6 A: TODOS leftover GET `/payments` first paint (not this PR).

## Implementation Tasks

- [x] **T1** — Drop refresh; local receipts + balances + VouNo
- [x] **T2** — Hoist kindergarten name / max amount already outside tx
- [x] **T3** — `toProcessPaymentDto`
- [x] **T4** — Vitest `src/lib/payment-balances.test.ts`

## NOT in scope

- Slim GET `/payments` (TODO)
- Ledger SQL / SUM rewrite
- Chunking `$transaction`
- KV cache of authenticated HTML
- Workers Paid

## What already exists

- `attemptProcessPayment` money writes unchanged
- Client already prepended receipts
- `StudentSearchPicker` still needs full student array on first GET

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues folded (D1–D5), 1 TODO (D6), 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG CLEARED — receipt-insert CPU plan implemented on the agreed scope.

NO UNRESOLVED DECISIONS
