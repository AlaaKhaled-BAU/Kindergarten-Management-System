# TODOS

## Cloudflare / Workers

### Leftover OpenNext SSR CPU (exceededCpu after auth cut)

**What:** After shipping unsigned cookies and CF skip-seed, measure `thoughtmakers` Worker `$workers.cpuTimeMs` and `exceededCpu` on `GET /` and `GET /students`.

**Why:** HMAC removal does not make Next.js SSR fit the 10ms Free cap. A later plan must not "fix" this by rewriting ledger SQL without a new money-safe design.

**Context:** Observability already showed ~42ms avg CPU on success and kills at 10ms. Auth/settings were the only safe CPU cuts. Do not KV-cache logged-in HTML. Do not chunk promotion. Start from `docs/superpowers/plans/2026-09-06-plain-auth-cpu.md` D6.

**Effort:** M
**Priority:** P2
**Depends on:** Plain-auth PR deployed

### Leftover GET /payments first-paint CPU

**What:** Cap or paginate `getReceipts` and stop sending every active student on first `/payments` paint (`StudentSearchPicker` already shows at most 50 rows).

**Why:** This PR only removed `router.refresh()` after insert. Opening the payments page can still hit Cloudflare Free `exceededCpu`.

**Context:** `src/app/(dashboard)/payments/page.tsx` loads `getReceipts()` with no `take`, `getAllStudents({ isActive: true })`, then `getStudentBalances` for all ids. Do not change `processPayment` `$transaction` membership. Plan: `docs/superpowers/plans/2026-09-06-receipt-insert-cpu.md`.

**Effort:** M
**Priority:** P2
**Depends on:** Receipt-insert CPU PR (drop refresh + DTO)

## Completed
