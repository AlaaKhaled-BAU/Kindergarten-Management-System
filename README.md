# Kindergarten ERP — نظام إدارة الروضة

An offline-first, cross-platform desktop ERP application for Kindergarten management. Manages student enrollment, financial operations (fees, payments, receipts, expenses), and reporting — entirely in Arabic (RTL).

## Features

- **Student Management** — Enroll students, track personal info, parents, authorized pickup persons
- **The Ledger** — Immutable double-entry accounting: charges, payments, adjustments, reversals, balance transfers
- **Payments & Receipts** — Issue receipts, cancel with reversal, track revenue & expenses
- **Grade Promotion** — Batch promote students with automatic balance transfer between academic years
- **Dashboard** — KPI cards for expected income, collected income, outstanding balances, collection rate
- **PDF Reports** — Receipts (A5), student ledgers (A4), monthly summaries (A4) with Arabic number-to-words (tafqit)
- **Excel** — Export revenues, expenses, student balances to `.xlsx`; import legacy data
- **Backup & Logging** — Manual database backup, daily JSON activity logs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Desktop | Electron 37 + electron-builder |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (RTL) |
| Database | SQLite via Prisma ORM |
| PDFs | @react-pdf/renderer |
| Excel | exceljs |
| Fonts | Cairo (UI), Scheherazade New (print) |

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# Clone & install
npm install

# Set up the database
npm run db:migrate
npm run db:seed

# Configure environment
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD and KG_NAME
```

### Development

```bash
npm run dev          # Start Next.js dev server + Electron window
npm run dev:next     # Start Next.js dev server only (browser)
```

### Production

```bash
npm run build                # Build Next.js standalone output
npm run electron:build:win   # Build Windows .exe installer
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/        # Authenticated pages with sidebar
│   │   ├── page.tsx        # Dashboard KPIs
│   │   ├── students/       # Student list + profile with ledger
│   │   ├── payments/       # Receipt issuance & cancellation
│   │   ├── expenses/       # Expense tracking
│   │   ├── revenues/       # Revenue tracking
│   │   └── reports/        # Monthly financial summaries
│   └── login/              # Login page (Admin/Teacher)
├── components/
│   ├── ui/                 # 12 shadcn/ui components
│   ├── layout/             # Sidebar, backup button
│   ├── students/           # Student table
│   ├── payments/           # Payment form, receipt table
│   ├── financial/          # Expense/Revenue tables, import dialog
│   └── pdf/                # Receipt, ledger, monthly summary PDFs
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   ├── auth.ts             # Auth cookie helpers
│   ├── tafqit.ts           # Arabic number-to-words (دينار أردني)
│   ├── excel-utils.ts      # Excel export builders (RTL)
│   ├── download-utils.ts   # Browser download helper
│   └── logger.ts           # Daily JSON activity logger
└── proxy.ts                # Route protection (auth guard, role-based access)
```

## Architecture — The Ledger

All student balances are derived from the immutable `Transaction` table:

```
Student Balance = SUM(amount) FROM Transaction WHERE studentId = X
```

| Type | Sign | Meaning |
|------|------|---------|
| Charge | + | Tuition, fees billed |
| Payment | − | Payment received |
| Adjustment | ± | Fee/discount changes |
| Reversal | + | Cancelled receipt |
| BalanceTransferOut | − | Old balance cleared (promotion) |
| BalanceTransferIn | + | Old balance carried forward (promotion) |

Every multi-entry financial operation uses `prisma.$transaction` for atomic all-or-nothing execution.

## License

This project is proprietary software. All rights reserved.
