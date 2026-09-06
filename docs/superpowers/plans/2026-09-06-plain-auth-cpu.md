# Plain auth + low-risk CPU cuts

> **For agentic workers:** Money tables (`Transaction`, `Payment`, `Receipt`, `Revenue`, `Expense`) are **untouchable**. Do not change query shapes, Server Action RSC behavior, or page data loaders. If a change could alter a balance, skip it.

**Goal:** Cut per-request CPU on Cloudflare Workers Free by removing HMAC/session crypto and DB lookups from the auth hot path, plus two request-path taxes that never touch money.

**Architecture:** Login/setup/password-change compare a plaintext password from `Setting`. After login the cookie is the role string only (`admin` | `teacher`). `getAuthRole()` is a string check, cached once per request. Cloudflare skips fee-seed on settings refresh. Electron still seeds on first run.

**Tech Stack:** Next.js 16 App Router, existing `Setting` keys, `cookies()`, `React.cache`.

**Success:** Admin/teacher login, logout, setup, password change, and all existing `requireAdmin` gates still work. No ledger/payment/student write logic in the diff. Deployed users re-login once (old signed cookies invalid).

## Global Constraints

- Arabic UI strings unchanged.
- Dual runtime: Electron (SQLite) and Cloudflare (Postgres/Hyperdrive). Electron first-run seed **must** remain.
- Do not add hashing, HMAC, JWT, or env cookie secrets.
- User accepts: cookie is forgeable; passwords stored in clear in `Setting`.
- Do not check the password on every page load (that would add Prisma CPU).

## What already exists

- `src/lib/password.ts` already stores `plain:${password}` and compares with `timingSafeEqual`. Hot-path cost is **not** scrypt on every request; it is HMAC in `src/lib/auth.ts`.
- `src/lib/auth.ts` `sign()` loads `cookieSecret` + password setting and HMAC-SHA256 on **every** `getAuthRole()`.
- `src/lib/settings.ts` `refresh()` always calls `ensureDatabaseReady()` → `seedDefaultFees()` then may `create` `cookieSecret`.
- Login/setup/settings/account already go through `hashPassword` / `verifyPassword`. Keep those call sites; change the helpers and cookie format.
- Setting keys `adminPasswordHash` / `teacherPasswordHash` must stay (setup/login redirects use `hasSetting("adminPasswordHash")`).

## NOT in scope

- KV / HTML / RSC cache (stale balances / wrong-user HTML)
- Raw SQL or Prisma read-path rewrite
- Splitting Server Actions from RSC (`POST /students`)
- Chunked promotion/import
- Lazy ledger tab
- Removing `requireAdmin` / `requireAuth` from money actions
- Dropping `force-dynamic`
- ExcelJS / second Worker
- Paid Workers plan / `limits.cpu_ms`

```
REQUEST (after this change)
  cookies() → value "admin"|"teacher"? → role
  layouts / requireAdmin → same gates, cheaper
LOGIN
  getSetting(adminPasswordHash|teacherPasswordHash)
  stored === typed  (strip optional "plain:" prefix)
  set cookie "admin"|"teacher"
```

---

### Task 1: Unsigned role cookie + cached getAuthRole

**Files:**
- Modify: `src/lib/auth.ts`

**Behavior:**
- Cookie name stays `auth_role`. Flags stay `httpOnly`, `sameSite: "lax"`, `maxAge` 7 days, `secure` in production, `path: "/"`.
- `setAuthCookie(role)` sets value exactly `"admin"` or `"teacher"` (no HMAC suffix).
- `verifyRoleCookie(raw)`: if `raw === "admin"` or `raw === "teacher"` return it; else `null`. Do **not** accept `admin.<hex>` (force one re-login). Do not call `getSetting` or `node:crypto`.
- `getAuthRole()`: wrap implementation in `React.cache` so layout + page + `requireAuth` share one cookie read per request.
- Keep exporting `verifyRoleCookie` if anything imports it; same logic.
- Remove `createHmac`, `timingSafeEqual`, `getSetting` imports from this file.

**Verify:** Typecheck. Manual: with cookie `admin` dashboard loads; with missing/garbage cookie → `/login`. Teacher cookie cannot open admin-only layouts (existing layout checks stay).

---

### Task 2: Plaintext password helpers (login path only)

**Files:**
- Modify: `src/lib/password.ts`

**Behavior:**
- **KEEP `plain:` prefix** (devil's advocate [Review](27f5460a-79ce-46fc-b345-ff744393b3ce)): `hashPassword` stays `return \`plain:${password}\``. Do **not** store bare passwords. Today's scrypt fallback does `split(":")` and `return false` if there is no second part — storing `"secret"` would make **every login fail**.
- `verifyPassword(password, stored)`:
  - If `stored.startsWith("plain:")`, strip prefix and `timingSafeEqual` (lengths must match; else false, no throw).
  - Else if stored looks like scrypt (`saltHex:hashHex` and 64-byte hash), scrypt once.
  - Else if it is not a valid scrypt shape, compare as plaintext with `timingSafeEqual` (passwords that contain `:` must not die in the scrypt branch).
  - Never `return false` solely because `split(":")` yielded one segment.
- Do not import this module from `auth.ts`.

**Verify:** Unit-style checks if the repo has a test runner; otherwise a tiny `tsx` script in comments is enough. Cases: exact match, wrong password, `plain:` prefix, empty stored.

---

### Task 3: Login / setup / change-password call sites

**Files:**
- Call sites already use `hashPassword` / `verifyPassword`. **Do not edit these files** unless adding optional scrypt→`plain:` rewrite after **successful** login. Default: **zero edits**.

**Verify:** Setup still blocked if `adminPasswordHash` exists. Wrong password still Arabic error. Teacher login still `/students`.

---

### Task 4: Settings refresh — no cookieSecret; CF skip seed

**Files:**
- Modify: `src/lib/settings.ts`
- Read-only: `src/lib/db-init.ts`, `src/lib/prisma.ts` (`isOnCloudflare` pattern)

**Behavior:**
- Remove the `if (!cache.cookieSecret) { create... }` block and `randomBytes` if unused.
- `refresh()`: on Cloudflare (`getCloudflareContext` succeeds with Hyperdrive, same idea as `prisma.ts` `isOnCloudflare`), **do not** call `ensureDatabaseReady()`. Still `findMany` settings.
- On Electron/local: keep `ensureDatabaseReady()` once per process (`migrated` flag) so empty SQLite still gets default fees.
- Do not change fee amounts, student, or ledger code.

**Verify:** Local `npm run dev:next` first-run still seeds fees if DB empty. Cloudflare request path never inserts default fees as a side effect of `getSetting`.

---

### Task 5: Manual smoke (required before deploy)

- Login admin, login teacher, logout.
- Open `/`, `/students`, issue a payment (existing UI) — **balances must match pre-change** (no code change in those actions; this is a regression sniff).
- Change admin password, login with new password.
- After deploy: one forced re-login (old cookie format).

---

### Task 6: Vitest for auth + password (eng-review D5 = A)

**Files:**
- Create: `vitest.config.ts` (node environment)
- Create: `src/lib/auth.test.ts`
- Create: `src/lib/password.test.ts`
- Modify: `package.json` add `vitest` devDependency and `"test": "vitest run"`

**Must assert:**
- `verifyRoleCookie("admin")` → `"admin"`; `"teacher"` → `"teacher"`
- **CRITICAL regression:** `"admin.deadbeef"` → `null` (old HMAC cookies rejected)
- `""`, `"guest"`, `undefined` → `null`
- `verifyPassword("x", "x")` true; `"x"` vs `"plain:x"` true; wrong password false; different lengths false without throw

Do not mock Prisma. Do not import student/payment actions.

---

## Eng-review decisions (locked)

| ID | Choice |
|----|--------|
| D0 | Snooze gstack upgrade 24h |
| D1 | Skip /office-hours |
| D2 | Exact cookie `admin`\|`teacher` only; one re-login |
| D3 | CF skip `ensureDatabaseReady` in `getSetting`; Electron keep it |
| D4 | Keep `hashPassword` / `verifyPassword` names; comment plaintext on purpose |
| D5 | Add vitest unit tests |
| D6 | Remaining `exceededCpu` on SSR is a later plan, not this PR |
| D7 | TODOS.md leftover SSR CPU |
| D8 | Do not delete leftover `cookieSecret` rows |

## Implementation Tasks

- [ ] **T1 (P1, human: ~30min / CC: ~10min)** — unsigned role cookie + `React.cache` `getAuthRole`
  - Surfaced by: Architecture D2
  - Files: `src/lib/auth.ts`
  - Verify: `npx vitest run src/lib/auth.test.ts`
- [ ] **T2 (P1, human: ~20min / CC: ~8min)** — plaintext `hashPassword`/`verifyPassword` (keep names)
  - Surfaced by: Code quality D4
  - Files: `src/lib/password.ts`
  - Verify: `npx vitest run src/lib/password.test.ts`
- [ ] **T3 (P2, human: ~15min / CC: ~5min)** — call sites unchanged except optional scrypt→plaintext rewrite after successful login
  - Files: `src/app/login/actions.ts`, `src/app/setup/actions.ts`, `src/app/actions/settings-actions.ts`, `src/app/actions/account-actions.ts`
  - Verify: Arabic errors unchanged; setup still uses `adminPasswordHash` key
- [ ] **T4 (P1, human: ~30min / CC: ~10min)** — settings: drop cookieSecret create; CF skip seed
  - Surfaced by: Architecture D3
  - Files: `src/lib/settings.ts`
  - Verify: `isOnCloudflare` matches `src/lib/prisma.ts` Hyperdrive check
- [ ] **T5 (P2, human: ~20min / CC: ~15min)** — vitest bootstrap + tests
  - Surfaced by: Test review D5
  - Files: `vitest.config.ts`, `src/lib/auth.test.ts`, `src/lib/password.test.ts`, `package.json`
- [ ] **T6 (P2, human: ~15min)** — TODOS.md leftover SSR CPU; manual smoke
  - Do not treat remaining 1102 as a bug in this PR (D6)

**Parallel lanes:** Lane A: T1+T2+T5 (auth/password/tests). Lane B: T4 (settings). Merge. Then T3 if login rewrite needed. Sequential if one agent: T2 → T1 → T5 → T4 → T3.

Do not commit `src/lib/prisma.ts` unless it is part of T4 detection helper (prefer copy the existing helper, do not "fix" prisma pooling in this PR).

---

## Failure modes

| Path | Failure | User sees |
|------|---------|-----------|
| Old cookie `admin.hex` | verify returns null | Redirect `/login` (expected once) |
| Forged cookie `admin` | Accepted | Admin UI (accepted risk) |
| CF skip seed on brand-new Postgres with no Fee rows | Empty fees UI until deploy seed | Fees page empty — **mitigation:** deploy still runs existing seed script, not this PR |
| Electron skip seed by mistaken CF detection | Empty local DB | Setup/fees broken — test `isOnCloudflare` only when Hyperdrive binding exists |
| Length-mismatch password compare | false | Arabic wrong-password (correct) |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 issues, 0 critical gaps; D2–D8 folded |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG CLEARED — ready to implement (unsigned cookies, CF skip seed, vitest). Leftover SSR 1102 is TODO, not this PR.

NO UNRESOLVED DECISIONS
