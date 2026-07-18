# Kindergarten ERP — Agent Instructions

## Project Identity

An offline-first, cross-platform Desktop ERP application for Kindergarten management built with Next.js + Electron. The app manages student records, financial operations (fees, payments, receipts, expenses), and reporting — entirely in Arabic (RTL).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript (strict) |
| Desktop | Electron 37 + electron-builder 26 |
| Styling | Tailwind CSS **v4** + shadcn/ui **v4** |
| Icons | lucide-react |
| Database | SQLite via Prisma ORM |
| PDFs | @react-pdf/renderer |
| Excel | exceljs |
| Fonts | Cairo (UI), Scheherazade New (print) |

## Absolute Constraints (NON-NEGOTIABLE)

1. **Arabic ONLY** — Every visible string must be Arabic. `<html lang="ar" dir="rtl">`. No i18n.
2. **Offline First** — SQLite stored locally. No cloud dependencies.
3. **Transactional Integrity** — All multi-entry financial operations must use `prisma.$transaction` (atomic all-or-nothing).
4. **The Ledger** — `Transaction` table is immutable and the single source of truth for student balances. `SUM(amount)` where positive = charge, negative = payment.

## Architecture: The Ledger Pattern

```
Student Balance = SUM(amount) FROM Transaction WHERE studentId = X
```

Transaction types: `Charge`, `Payment`, `Adjustment`, `Reversal`, `BalanceTransferOut`, `BalanceTransferIn`

- Creating a student → Insert Student + Insert Charge Transaction (tuition) in `$transaction`
- Processing payment → Insert Payment + Insert Receipt + Insert Payment Transaction (negative) + Insert Revenue in `$transaction`
- Cancelling receipt → Set isCanceled=true + Insert Reversal Transaction (positive) + Insert negative Revenue in `$transaction`
- Grade promotion → For each student: Create new Student + Post Tuition Charge + Post BalanceTransferOut (old) + BalanceTransferIn (new) — all in `$transaction`

## Commands

```bash
npm run dev          # Start Next.js dev + Electron (auto)
npm run dev:next     # Next.js dev only (open browser manually)
npm run dev:electron # Electron only (attach to running dev server)
npm run dev:launcher # Robust launcher script (use if `dev` hangs)
npm run build        # Production build (standalone output)
npm run lint         # ESLint
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed default fees
npm run electron:build:win  # Build Windows .exe
```

If `npm run dev` hangs at "Compiling /login ...", use the two-terminal approach:

```bash
# Terminal 1
npm run dev:next

# Terminal 2 (after server shows "✓ Ready")
npm run dev:electron
```

## Project Structure

```
src/proxy.ts                # Route protection (auth guard, admin/teacher roles)
main/main.js              # Electron main process (CommonJS, spawns standalone server)
main/preload.js           # Electron preload (contextIsolation)
src/app/                  # Next.js App Router pages
src/app/globals.css        # Tailwind v4 imports + shadcn theme + @font-face
src/app/layout.tsx         # <html lang="ar" dir="rtl"> with Cairo font
src/components/ui/         # 12 shadcn/ui v4 components
src/lib/utils.ts           # cn() helper
src/lib/prisma.ts           # Prisma client singleton
src/lib/                   # tafqit, logger, excel utils
src/app/actions/            # Server Actions for all business logic
prisma/schema.prisma       # Full schema with 11 models
.env                       # DATABASE_URL, ADMIN_PASSWORD, KG_NAME
public/fonts/              # Cairo (400/600/700) + Scheherazade New (400/700) woff2
Logs/                      # (Phase 8) Daily JSON log files
Backups/                   # (Phase 8) SQLite backup .zip files
```

## Shadcn/UI v4 Notes

- shadcn v4 uses `@base-ui/react` (not `@radix-ui/react-*`)
- Animations: `tw-animate-css` (CSS import), not `tailwindcss-animate` (plugin)
- Theme: CSS variables in `oklch()` color space via `shadcn/tailwind.css` import
- Color tokens like `border` are used as `border-border` (property + token name)

## Tailwind v4 Notes

- Config is CSS-first via `@import "tailwindcss"` + `@theme inline` blocks
- `@tailwindcss/postcss` in postcss.config.mjs (no autoprefixer needed)
- RTL supported natively via logical properties (`start-*`, `end-*` instead of `left-*`, `right-*`)
- The `tailwind.config.ts` exists for content paths but primary config is in globals.css

## Next.js 16 Notes

- `output: 'standalone'` in next.config.ts — produces self-contained production build
- Server Actions are used for all database operations (Phase 4)
- Turbopack used for builds

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | COMPLETE | Project init, Electron, Tailwind RTL, fonts, shadcn |
| 2 | COMPLETE | Prisma schema, SQLite, seed script |
| 3 | COMPLETE | Authentication (Admin/Teacher roles, HTTP-only cookies) |
| 4 | COMPLETE | Core Ledger business logic (Server Actions) |
| 5 | COMPLETE | Arabic RTL UI (Dashboard, Students, Payments, Reports) |
| 6 | COMPLETE | PDF reports + Arabic tafqit (number-to-words) |
| 7 | COMPLETE | Excel imports/exports |
| 8 | COMPLETE | Logging & local backups |

## Currency

Jordanian Dinar (دينار أردني / فلس). The tafqit utility will use: "خمسمائة دينار أردني و خمسون فلساً"
