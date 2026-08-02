# Kindergarten ERP — Comprehensive QA Test Cases

**App:** Offline-first Desktop ERP (Next.js 16 + Electron 37 + Prisma/SQLite, Arabic RTL)
**Scope:** End-to-end functional QA — setup → students → ledger → payments → reports → year rollover → sync/backup
**Status:** Prepared for manual execution. Nothing has been executed.

> ## ⚠️ CRITICAL RULES — READ FIRST
>
> 1. **REPORT ONLY — NEVER EDIT CODE.** This is a QA document. Do not modify any source file, schema, migration, or configuration. Do not "fix" a bug found during testing — log it and report it. Bugs found here are *expected and valuable*; fixing them is out of scope.
> 2. **NEVER TOUCH THE PRODUCTION APP/DATA.** The production install (packaged Electron app, its `%APPDATA%` database, Backups/, Logs/, sync worker state) must not be opened, launched, altered, or tested against in any way. All financial operations in this suite are irreversible and would corrupt production books.
> 3. **ALWAYS TEST ON A LOCAL TEST INSTANCE ONLY.** Launch the app **locally** (dev mode: `npm run dev:next` + browser, or `npm run dev:electron`) with a disposable database (`./kindergarten.db` in dev — or a copied/renamed copy of the DB for baseline testing). Use the test kindergarten name and test data in section 1.2. If the packaged app must be tested, use a machine/VM with no production data, or a temporary user profile so `userData` is fresh.
> 4. **Never run sync against the real worker.** Section 19 sync tests must use a throwaway worker/bucket or be skipped — a real push would overwrite the school's live database.

---

## 1. Test Environment & Baseline Data

### 1.1 Environment
| Item | Value |
|------|-------|
| App mode | Electron packaged (`npm run electron:build:win`) **and** browser dev mode (`npm run dev:next`) |
| Roles under test | Admin, Teacher (both sessions open simultaneously in two browsers/incognito) |
| Print tests | PDF printer driver installed (e.g., "Microsoft Print to PDF" / "Save as PDF") |
| Excel tests | LibreOffice or MS Excel available for opening `.xlsx` files |
| DB location (Electron) | `%APPDATA%/إدارة الروضة/kindergarten.db` (prod), `./kindergarten.db` (dev) |

### 1.2 Baseline Dataset (create once, reuse across sections)
1. Complete first-run setup: kindergarten name **"روضة الاختبار"**, admin password **"1234"**.
2. Verify 3 default fees seeded for **2025-2026**: Pre=350, KG1=400, KG2=500 (all `Monthly`, active).
3. Add students (see matrix below) — record each student's id, grade, year, fees, discount.

| ID | Name | Grade | Year | Bus | Extra | Discount | DOB |
|----|------|-------|------|-----|-------|----------|-----|
| S1 | أحمد محمد | KG1 | 2025-2026 | 50 | 20 | 10% | 2021-01-15 |
| S2 | سارة علي | KG2 | 2025-2026 | 0 | 0 | 25 (flat) | 2020-05-10 |
| S3 | خالد عمر | KG1 | 2025-2026 | 0 | 0 | 0 | 2021-03-22 |
| S4 | لينا حسن | Pre | 2025-2026 | 30 | 0 | 0 | 2022-07-08 |
| S5 | عمر سمير | KG2 | 2024-2025 | 0 | 0 | 0 | 2020-11-30 |

> S5 enrolled in the **previous** year to exercise year-filtering and promotion scenarios.

---

## 2. Conventions

- **Priority:** High = money/data integrity or security; Medium = functional; Low = cosmetic/UX.
- **Type:** Positive (expected-success path), Negative (rejected path), Edge (boundary), Regression (consistency).
- Expected monetary values are computed from the actual ledger formulas in `student-actions.ts`, `payment-actions.ts`, `revenue-actions.ts`, `promotion-actions.ts`.
- Golden rule to verify after *every* financial test: **Student Balance = SUM(Transaction.amount) for that student**, and every payment/reversal must have a matching ±Revenue row.

---

## 3. First-Run / Setup (SETUP)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| SETUP-01 | Positive | High | Fresh install shows setup wizard | Launch packaged app with empty `userData` | Redirects to `/setup`, Arabic form: اسم الروضة + كلمة مرور المسؤول + تأكيد كلمة المرور |
| SETUP-02 | Negative | High | Setup rejects blank name | Submit with empty name | Error `الرجاء إدخال اسم الروضة`, stays on page |
| SETUP-03 | Negative | High | Setup rejects short password | Password "12" | Error `كلمة المرور يجب أن تتكون من 4 أحرف على الأقل` |
| SETUP-04 | Negative | High | Setup rejects mismatched passwords | Password "1234", confirm "4321" | Error `كلمتا المرور غير متطابقتين` |
| SETUP-05 | Positive | High | Setup completes and auto-logs-in | Valid input → بدء الاستخدام | Lands on dashboard as admin; `kindergartenName` + `adminPasswordHash` settings written |
| SETUP-06 | Regression | High | Setup cannot be re-run after completion | Log out, browse `/setup` again; also POST directly to setup action | Redirect to `/login` in both cases; password NOT reset |
| SETUP-07 | Positive | Medium | Default fees seeded on fresh DB | After setup, go to الرسوم الدراسية | 3 rows: بستان 350 / روضة أولى 400 / روضة ثانية 500, all year 2025-2026, active |
| SETUP-08 | Edge | Medium | Setup with Arabic + spaces in name | "  روضة الأزهار  " | Stored trimmed, no leading/trailing spaces |

---

## 4. Authentication & Authorization (AUTH)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| AUTH-01 | Positive | High | Admin login | Login page → correct admin password | Cookie set, redirect `/`, dashboard renders |
| AUTH-02 | Negative | High | Admin wrong password | Wrong password | Error `كلمة المرور غير صحيحة`, stays on login |
| AUTH-03 | Negative | High | Empty password field | Submit empty | Error `الرجاء إدخال كلمة المرور` |
| AUTH-04 | Negative | High | Teacher login before teacher password configured | Fresh install, teacher form | Error `لم يتم تفعيل حساب المعلم بعد. الرجاء التواصل مع المسؤول` |
| AUTH-05 | Positive | High | Teacher login | Admin sets teacher password first (see SET-04), then teacher logs in | Redirect `/students`, NOT dashboard |
| AUTH-06 | Negative | High | Cookie tampering: teacher→admin | DevTools: edit `auth_role` cookie value to `admin.<sig>` or swap roles | Any verification fails; user stays teacher / redirected; no admin data exposed |
| AUTH-07 | Negative | High | Teacher blocked from admin pages | Teacher navigates to `/`, `/fees`, `/revenues`, `/expenses`, `/reports`, `/settings`, `/print/receipt/1`, `/students/1` (print) | Each redirects to `/students` (or `/login` if unauthenticated) |
| AUTH-08 | Positive | Medium | Admin sees all nav items; teacher only sees students + payments | Compare sidebars | Teacher: الطلاب، المدفوعات والإيصالات، تسجيل الخروج only |
| AUTH-09 | Positive | Medium | Logout clears session | Logout → press browser back | Lands on `/login`; dashboard not reachable without re-login |
| AUTH-10 | Positive | Medium | Already-logged-in user visiting /login | While admin session active, go to `/login` | Redirected to `/` |
| AUTH-11 | Edge | Medium | Unauthenticated access to any dashboard route | Clear cookies, open `/students` | Redirect `/login` |
| AUTH-12 | Edge | High | Admin password change invalidates old session? | Change password (SET-08), then use old password to log in from another session | Old session cookie survives (by design) but old password rejected; note this is expected behavior — verify login with old password fails |
| AUTH-13 | Positive | Medium | Cookie expiry | Set cookie `maxAge` short via devtools (or wait 7 days) | Session expires → redirect to login |

---

## 5. Students (STU)

### 5.1 List & Filters
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| STU-01 | Positive | High | New student appears in list | Add S1 | Row shows name, الصف (روضة أولى), السنة (2025-2026), balance 423.00 (computed in 5.3), badge نشط |
| STU-02 | Positive | Medium | Search by first/last/full name | Type "أحمد", "محمد", "أحمد محمد" | Filters client-side; partial matches match |
| STU-03 | Positive | Medium | Grade filter | Select روضة أولى | Only KG1 students shown |
| STU-04 | Positive | Medium | Year filter | Select 2024-2025 | Only S5 shown |
| STU-05 | Positive | Medium | Combined filters + search | Year 2025-2026 + grade KG1 + search "س" | Intersection applied |
| STU-06 | Edge | Medium | Empty result state | Search "zzz" | Row `لا يوجد طلاب` |
| STU-07 | Positive | Medium | Row click opens profile | Click S1 row | Navigates `/students/{id}` |

### 5.2 Create (validation & data capture)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| STU-02a | Negative | High | Missing required fields blocked by UI | Submit empty form | `required` HTML validation blocks; server also rejects (test via devtools-removed `required`) with Arabic errors |
| STU-02b | Edge | High | Whitespace-only names | Set firstName = "   " via devtools | Server error `الحقل "الاسم الأول" مطلوب` |
| STU-08 | Positive | High | Full create with parents + pickup person | Add student with parent (name/phone/relationship) + pickup person | Student created; parent row + StudentParent link + pickup row exist; profile shows them |
| STU-09 | Edge | Medium | Parent name without phone (or phone without name) | Fill only parent name | Parent silently skipped (client only sends when both present) — verify no orphan/error and note UX |
| STU-10 | Negative | Edge | Negative/NaN bus/additional/discount via devtools | Set busFees="-50" | NOTE — server accepts negative bus fees (no validation); a negative Charge is posted, reducing balance. Document as **defect candidate** (see LED-09) |
| STU-11 | Positive | Medium | Date of birth optional | Create without DOB | `dateOfBirth` null, profile shows "—" |
| STU-12 | Positive | High | Duplicate student names allowed | Create two students same name | Allowed (no unique constraint) — verify both appear and balances tracked separately |

### 5.3 Ledger after creation (the golden checks)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| LED-01 | Positive | High | S1 enrolment charges (tuition + extras + %discount) | Create S1 (KG1, bus 50, extra 20, discount 10%) | Transactions: +400 `رسوم دراسية`, +70 `رسوم إضافية (باص + إضافات)`, −47 `خصم 10%`. Balance = **423.00** |
| LED-02 | Positive | High | S2 enrolment (flat discount) | Create S2 (KG2, discount 25 flat) | +500, −25. Balance = **475.00** |
| LED-03 | Positive | High | S4 enrolment (bus only) | Create S4 (Pre, bus 30) | +350, +30. Balance = **380.00** |
| LED-04 | Positive | High | No-fee student with no fee row | Create student in grade/year with no Monthly fee | Tuition charged 0 (getDefaultTuition fallback empty → 0); balance only extras |
| LED-05 | Positive | High | Ledger page shows correct running balance | Open S1 كشف الحساب | Rows chronological, running balance ends at 423.00; badges: رسوم for charges |
| LED-06 | Positive | Medium | Ledger ordering | Create entries out of order by back-dating | Table shows most-recent-first (desc) with correct running balance recomputed |

### 5.4 Edit (automatic Adjustment)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| STU-13 | Positive | High | Change bus fee only | S1 bus 50→80 | Adjustment +30 `تعديل: رسوم الباص`; balance 423→**453.00** |
| STU-14 | Positive | High | Change grade (different tuition) | S1 KG1→KG2 (both 2025-2026) | Adjustment = 500−400 = +100 `تعديل: الصف`; balance 453→**553.00** |
| STU-15 | Positive | High | Change discount type flat→percent | S2: 25 flat → 10% | New effective = 50, old 25 → Adjustment +25; balance 475→**500.00** |
| STU-16 | Positive | High | Multiple changes in one edit | S1: bus 80→60, extra 20→30, grade KG2→KG1, discount 10%→15% | Single Adjustment with joined description `تعديل: رسوم الباص، رسوم إضافية، الخصم، الصف`; net = (400+60+30−73.5) − (500+80+30−61) = −101.5 → balance 553→**451.50** |
| STU-17 | Edge | High | Edit with zero net change | Change name only | NO Adjustment row posted; balance unchanged |
| STU-18 | Edge | High | Float-drift guard | Change discount 10%→10.00% (cosmetic) or values that net to <0.0005 | No Adjustment (tolerance check) |
| STU-19 | Positive | Medium | Edit name/DOB/allergies/notes only | Change firstName + allergies | No financial impact; profile updated |
| STU-20 | Edge | Medium | Clear optional fields | Set notes/allergies/medicalNotes to empty | Stored null (not empty string) |

### 5.5 Activate / Deactivate
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| STU-21 | Positive | High | Deactivate student | S3 → إلغاء تفعيل → confirm dialog | Badge غير نشط; excluded from active lists (payments dropdown, reports pickers, balances export) |
| STU-22 | Negative | High | Payment blocked for inactive student | Attempt payment for S3 (still in receipts list history but not in dropdown; test via devtools-crafted action) | Error `لا يمكن تسجيل دفعة لطالب غير نشط` |
| STU-23 | Positive | High | Reactivate student | S3 → إعادة تفعيل | Badge نشط; reappears in active lists; balance/history intact |
| STU-24 | Regression | Medium | Inactive student still visible with filter | Students list | Shows with غير نشط badge (list shows all) — verify filter by نشط/غير نشط available via grade/year only; note inactive students remain listed |
| STU-25 | Negative | High | Teacher cannot deactivate | Teacher session, attempt setStudentActive | `غير مصرح: يتطلب صلاحيات المسؤول` |

### 5.6 Student Profile
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| STU-26 | Positive | Medium | Info tab completeness | Open S1 profile | All InfoRows: name, grade, year, DOB dd/MM/yyyy, enrollment date, bus, extra, discount (10%), notes, allergies, medical notes |
| STU-27 | Positive | Medium | Parents & pickup cards | S1 with both | Both cards render with phone/relationship |
| STU-28 | Edge | Medium | Nonexistent student id | `/students/999999` | 404 notFound page |
| STU-29 | Edge | Medium | Non-numeric id | `/students/abc` | 404 (parse guard) |
| STU-30 | Positive | Medium | Ledger tab empty state | Student with no transactions (fee=0 student) | `لا توجد معاملات لهذا الطالب` |

---

## 6. Payments & Receipts (PAY)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| PAY-01 | Positive | High | Issue receipt (cash) | S1, amount 100, today, نقداً | Receipt #1; student balance 423→**323.00**; ledger Payment −100 `دفعة نقدية` ref `Receipt:1`; Revenue +100 (current year/month, category رسوم دراسية, source Payment); receipt row appears at top |
| PAY-02 | Positive | High | Receipt number sequence | Issue 3 more receipts | Numbers 2,3,4 strictly sequential |
| PAY-03 | Positive | High | Receipt captures kindergarten name at issue time | Issue while name = روضة الاختبار | Receipt PDF header shows روضة الاختبار (snapshot, not live setting) |
| PAY-04 | Positive | Medium | Payment methods | Issue receipts with each of: شيك، تحويل بنكي، بطاقة ائتمان | Method stored & displayed; receipt PDF shows the checkbox item |
| PAY-05 | Positive | Medium | Reference number + notes | Add ref "CHK-100" + notes "دفعة أولى" | Stored; notes appear in monthly report & receipt "وذلك عن" fallback is `رسوم دراسية` unless payment notes exist |
| PAY-06 | Negative | High | Amount 0 / negative / NaN | Try 0, −5, "abc" | Server `الحقل "المبلغ" يجب أن يكون رقماً موجباً` (0 and negatives rejected); UI min=0.01 also blocks |
| PAY-07 | Edge | High | Overpayment (more than balance) | S3 balance 400, pay 500 | **Allowed** — creates credit; balance −100; dashboard outstanding shows negative → card "رصيد دائن (زيادة دفع)" |
| PAY-08 | Positive | High | Partial payment | S2 balance 475, pay 100 | Balance 375; receipt amount 100 |
| PAY-09 | Positive | High | Back-dated payment | Pay with date 3 months ago | Revenue posted to that month/year; receipt issueDate = chosen date; monthly report for that month shows it |
| PAY-10 | Positive | Medium | Search receipts | By student name; by receipt number | Client filter matches both |
| PAY-11 | Edge | Medium | No receipts state | Fresh year/empty db | `لا توجد إيصالات` |
| PAY-12 | Edge | High | Concurrent receipt numbers (two admins) | Two browser sessions submit payment simultaneously (scripted) | No duplicate receiptNumber; one succeeds on retry (up to 3 attempts); both receipts exist with unique numbers; ledgers correct |

### 6.1 Cancel Receipt
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| PAY-13 | Positive | High | Cancel a receipt | Cancel #2 with reason "خطأ في المبلغ" | Receipt badge ملغي; Reversal +100 in student ledger `إلغاء إيصال رقم 2: خطأ في المبلغ`; Revenue −100 posted to **same year/month as receipt's issueDate** (not cancel date); balance restored; cancel date+reason stored |
| PAY-14 | Negative | High | Double cancel | Try cancel #2 again | Error `هذا الإيصال ملغي مسبقاً`; no second Reversal |
| PAY-15 | Negative | High | Cancel without reason | Submit empty reason | UI `required` blocks; server-side (devtools) also must reject (verify validation path) |
| PAY-16 | Negative | High | Teacher cannot cancel | Teacher session → cancel button absent; devtools-call cancelReceipt | `غير مصرح: يتطلب صلاحيات المسؤول` |
| PAY-17 | Regression | High | Canceled receipt excluded from print & monthly report | After PAY-13: reports tab سند قبض search for #2; monthly receipts for that month | #2 not listed in سند قبض tab; monthly report row count excludes it; totals exclude it |
| PAY-18 | Regression | High | Same-month cancel nets dashboard revenue | Cancel receipt issued this month | receivedIncome (this month) reflects net (Payment − Cancellation); outstanding returns to pre-payment value |
| PAY-19 | Regression | High | Cross-month cancel keeps original month revenue correct | Cancel a receipt issued 2 months ago | That old month's monthly report revenue reduced by the amount; current month unaffected |

---

## 7. Refunds (REF)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REF-01 | Positive | High | Cash refund (admin only, profile → استرداد نقدي) | S2 (credit/positive balance), amount 50, reason "انسحاب" | Refund row created; ledger Adjustment +50 `استرداد نقدي: انسحاب`; balance +50; NO receipt, NO revenue row |
| REF-02 | Negative | High | Refund amount 0/negative | 0 or −10 | `الحقل "المبلغ" يجب أن يكون رقماً موجباً` |
| REF-03 | Negative | High | Missing reason | Empty | `الحقل "السبب" مطلوب` |
| REF-04 | Negative | High | Teacher cannot refund | Teacher session | Button hidden; direct action call → admin-only error |
| REF-05 | Regression | High | Refund reflected in dashboard expected income | After REF-01 | expectedIncome (Charge+Adjustment, current year) increases by 50 — matches receivable reality |
| REF-06 | Regression | Medium | Refund on student with 0 balance | Refund 100 on S5 (0 balance) | Allowed; balance +100 (student now owes). Note: not blocked — verify copy warns; acceptable per design |

---

## 8. Fees (FEE)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| FEE-01 | Positive | High | Create fee | Pre 2026-2027, name "رسوم صف البستان", amount 375 | Row appears; getDefaultTuition for Pre+2026-2027 → 375 |
| FEE-02 | Negative | High | Create fee amount ≤ 0 | 0 / −5 | `الحقل "المبلغ" يجب أن يكون رقماً موجباً` |
| FEE-03 | Negative | High | Create fee missing fields | Blank name / grade / year | Arabic required errors |
| FEE-04 | Positive | Medium | Delete fee | Delete an unused fee | Removed from list; no cascade issues |
| FEE-05 | Negative | Edge | Delete fee that students were charged with | Delete the KG1 2025-2026 fee (S1..S3) | Delete succeeds (no FK from transactions) — existing students' ledger untouched; future enrollments fall back to any active fee or 0. Verify no crash |
| FEE-06 | Positive | High | Copy fees to new year | 2025-2026 → 2026-2027 | 3 rows copied (Pre/KG1/KG2); message `تم نسخ 3 رسم` |
| FEE-07 | Positive | High | Copy skips existing target rows | Re-run copy 2025-2026 → 2026-2027 | 0 copied, 3 skipped; no duplicates |
| FEE-08 | Edge | High | Copy with one grade pre-priced in target year | Manually add KG1 2026-2027=420 first, then copy | KG1 skipped; Pre+KG2 copied (2 copied, 1 skipped) |
| FEE-09 | Positive | High | Year-exact tuition wins over older rate | Pre has 2025-2026=350 and 2026-2027=375; create Pre student in 2026-2027 | Charges 375 (exact year), NOT 350 (fallback) |
| FEE-10 | Negative | Edge | Duplicate fee rows same grade+year | Add second KG1 2026-2027 fee | Allowed (no constraint) — creation uses cheapest (orderBy amount asc). Verify documented behavior, flag as potential defect if unexpected |

---

## 9. Academic Year (YEAR)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| YEAR-01 | Positive | High | Start new academic year | Settings → `بدء سنة دراسية جديدة (2026-2027)` → confirm | Setting advances; page shows 2026-2027; no data mutated (students/fees untouched) |
| YEAR-02 | Positive | Medium | Year selectors refresh after start | Reopen students page | AcademicYearSelect now includes 2026-2027 |
| YEAR-03 | Regression | High | Dashboard scopes to current year | After YEAR-01, create a 2026-2027 student with charges | expectedIncome includes only that student's charges; old-year students' outstanding still count in outstandingBalance (unscoped) |
| YEAR-04 | Negative | High | Teacher cannot start year | Teacher direct action call | `غير مصرح: يتطلب صلاحيات المسؤول` |
| YEAR-05 | Edge | Medium | Malformed year label | Set currentAcademicYear = "bad" via devtools; call next | nextAcademicYear returns input unchanged (no crash); UI shows "bad" |
| YEAR-06 | Positive | Medium | includeNext option | Open "إضافة طالب"/fee dialog while current=2026-2027 | 2027-2028 offered in picker |

---

## 10. Grade Promotion (PROMO)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| PROMO-01 | Positive | High | Preview candidates | Students → ترقية صف → source KG1 2025-2026, target KG2 2026-2027 → معاينة الطلاب | Lists active KG1 2025-2026 students only (S1, S3); S5 not listed (different year); inactive S3 excluded if deactivated |
| PROMO-02 | Negative | High | Promote into unpriced year | Target KG2 2026-2027 with **no** fee row for that year+grade | Whole batch refused: `لا توجد رسوم محددة لصف "روضة ثانية" للسنة الدراسية 2026-2027...`; every candidate returns error; nothing changed |
| PROMO-03 | Positive | High | Successful promotion (S1 with balance) | Use S1 at initial state **423.00** (run before the edit tests in 5.4, or pick a fresh student with same fees); promote to KG2 2026-2027 (with KG2 2026-2027 fee priced, e.g. 500) | Old S1 deactivated; new student S1' created KG2/2026-2027 with same name/DOB/fees/discount/parents/pickups/globalId/allergies/notes; new ledger: +500 tuition `رسوم دراسية - ترقية`, +70 extra `رسوم إضافية (باص + إضافات) - ترقية`, −(500+70)*0.10=−57 discount; BalanceTransferOut −423 on old, BalanceTransferIn +423 on new; old balance = 0, new balance = 500+70−57+423 = **936.00** |
| PROMO-04 | Positive | High | Promotion with credit balance (S2) | S2 balance 475 → promote | Transfer keeps sign: old gets −475? No — S2 owes 475: old BalanceTransferOut −475 (balance→0), new BalanceTransferIn +475. If instead a credit (negative balance) student is promoted, signs invert and credit carries over |
| PROMO-05 | Negative | High | Duplicate promotion attempt | Run same promotion again (S1 still active → candidate again? No: old S1 now inactive) — instead: promote S3, then try to re-promote manually via second window while first still open | Error `الطالب موجود مسبقاً في روضة ثانية - 2026-2027` (duplicate firstName+lastName+DOB+grade+year guard); batch partially succeeds for others |
| PROMO-06 | Edge | High | Mixed batch: one duplicate, one fine | Promote batch containing a duplicate + a fresh student | Per-student results: fresh succeeds, duplicate errors; summary shows `تمت ترقية 1 من 2`; error listed per student |
| PROMO-07 | Regression | High | Promoted student's parents shared, not duplicated | Compare parent rows of old vs new student | New student references SAME Parent ids (no duplicate parent rows) |
| PROMO-08 | Regression | High | Old student stays in history with zero balance | Open old student profile | غير نشط; balance 0; ledger shows original charges + transfers with refs `Promotion:To/From:{id}` |
| PROMO-09 | Regression | Medium | TuitionOverride carried | Student with tuitionOverride=900 promoted | New student tuition = 900 (override wins, no fee lookup) |
| PROMO-10 | Negative | High | Teacher cannot promote | Teacher → button hidden; direct call | `غير مصرح: يتطلب صلاحيات المسؤول` |
| PROMO-11 | Edge | Medium | Promote into same grade (no-op change) | Pre→Pre | Allowed; new student same grade new year; charges re-posted with - ترقية suffix |

---

## 11. Revenues (REV)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REV-01 | Positive | High | Manual revenue | Add category "نشاطات", amount 25, current month | Row source=Manual; appears in table; monthly summary revenue increases |
| REV-02 | Negative | High | Manual revenue amount ≤ 0 / missing category | 0 / blank | Arabic validation errors |
| REV-03 | Positive | Medium | Edit manual revenue | Change amount 25→30 | Updated; summary reflects 30 |
| REV-04 | Positive | Medium | Delete manual revenue | Delete it | Removed; summary decreases |
| REV-05 | Negative | High | Cannot edit/delete derived (payment) rows | Try editing a source=Payment row (its row shows تلقائي, no buttons; call updateRevenue via devtools) | Error `لا يمكن تعديل هذا السجل لأنه ناتج تلقائياً عن عملية دفع أو إلغاء إيصال`; same for delete |
| REV-06 | Negative | Edge | Delete a Cancellation row | Devtools-call deleteRevenue on a Cancellation source row | Same derived-protection error |
| REV-07 | Regression | High | Payment revenue appears with correct month/year | Back-dated payment (PAY-09) | Revenue row year/month = paymentDate's, source Payment, description contains student name |
| REV-08 | Regression | High | Monthly summary math | Verify against known dataset | For each month: revenue sum = Payment + Cancellation + Manual + Import; net = revenue − expense; totals match; all 12 months rendered even with 0s |

---

## 12. Expenses (EXP)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| EXP-01 | Positive | High | Create expense | category "رواتب", 300, today, vendor "شركة X", ref "INV-1" | Row created with all fields, source=Manual |
| EXP-02 | Negative | High | Amount ≤ 0 / missing category | 0 / blank | Arabic validation errors |
| EXP-03 | Positive | Medium | Edit expense | Change 300→320 | Updated row |
| EXP-04 | Positive | Medium | Delete expense | Delete it | Removed; dashboard expensesThisMonth and monthly summary drop |
| EXP-05 | Regression | High | Dashboard expenses = current calendar month only | Create expense dated 2 months ago + one today | Only today's counts in `ملخص المصروفات (الشهر الحالي)` card |
| EXP-06 | Positive | Medium | Back-dated expense | Date 3 months ago | Monthly summary for that month includes it |
| EXP-07 | Negative | High | Teacher cannot manage expenses | Teacher direct call | Admin-only error |

---

## 13. Reports (REP)

### 13.1 Monthly Summary (التقرير الشهري tab)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REP-01 | Positive | High | Summary totals match data | After dataset of section 1-12 | 12 rows; each month's revenue/expense/net; total cards = sum; net = revenue−expense; color coding (green/red) correct |
| REP-02 | Positive | Medium | All months present | Empty year | 12 rows all 0.00 |
| REP-03 | Edge | Medium | Negative net styling | Month with expense > revenue | Red net value |

### 13.2 Receipt print (سند قبض)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REP-04 | Positive | High | Search & select receipt | Search by "#00001" or student name | Only non-canceled receipts listed, sorted desc by number, padded to 5 digits |
| REP-05 | Positive | High | Receipt PDF content | Open `/print/receipt/{id}` | Header روضة الاختبار + address/phone/email (from settings); سند قبض; رقم 00001; dinars/fils boxes (e.g. 100 / 000); tafqit words e.g. "مائة دينار أردني"; payment method; two copies: نسخة الروضة + نسخة ولي الأمر; dashed cut line; auto print dialog opens |
| REP-06 | Positive | High | Tafqit correctness | Test amounts: 1.00, 2.00, 3.00, 11.00, 25.00, 100.00, 500.50, 1250.00, 0.025, 1000.00 | 1 → `دينار أردني`; 2 → `ديناران أردنيان`; 3–10 → `دنانير أردنية`; 11–99 → `ديناراً أردنياً`; 500.50 → `خمسمائة دينار أردني و خمسمائة فلساً`; 0.025 → `خمسة و عشرون فلساً`; 0 → `صفر` |
| REP-07 | Edge | High | Fils rounding carry | Amount 1.9999 | splitDinarFils carries: 2 دينار / 000 فلس |
| REP-08 | Negative | High | Print receipt for canceled receipt | Devtools-open `/print/receipt/{id-of-canceled}` | Route still prints (by design — receipt remains printable); verify content shows original data, no crash. Document behavior |
| REP-09 | Edge | Medium | Nonexistent receipt id | `/print/receipt/99999` | 404 |
| REP-10 | Positive | Medium | Fonts render in PDF | Print to PDF, inspect | Arabic Cairo/Scheherazade rendered, no tofu/boxes, RTL correct |

### 13.3 Student ledger print (كشف حساب طالب)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REP-11 | Positive | High | Ledger PDF for S1 | Open `/print/ledger/{S1}` | Header: student name, grade label, شعبة "—", المبلغ المستحق = sum of positive Charges (e.g. 400+70), قيمة الخصم = sum of |negative Charges| (47), صافي المبلغ = running balance with عليه/له suffix; table rows: number, دفعات (credit amount only), تاريخ, رقم الوصل (Receipt:N), الرصيد with عليه/له |
| REP-12 | Positive | High | Credit balance label | Student with balance < 0 | Net shows `له` suffix; rows negative balance show `له` |
| REP-13 | Regression | High | Ledger PDF matches screen ledger | Same student | Both show identical running balance; PDF debit/credit columns correct (charge=debit, payment=credit) |
| REP-14 | Edge | Medium | Empty ledger student | Print for fee=0 student | `لا توجد معاملات` row; net 0 no suffix |

### 13.4 Monthly receipts report (تقرير وصولات شهري)
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REP-15 | Positive | High | Preview count | Select month with receipts | Button `طباعة تقرير الوصولات (N إيصال)`; N = non-canceled receipts with issueDate in month |
| REP-16 | Positive | High | Report content | Open `/print/monthly/{y}/{m}` | A4 landscape; month name in Levantine names (كانون الثاني etc.); rows: name, padded receipt number, amount, الباقي = student's **current** balance with (مدين)/(دائن) suffix, notes; footer total = sum of receipts; zebra striping |
| REP-17 | Positive | Medium | Empty month | Preview empty month | `لا توجد وصولات في هذا الشهر`; print page shows empty table + `لا توجد وصولات في هذا الشهر` |
| REP-18 | Edge | Medium | Invalid month/year params | `/print/monthly/2024/13` or `/abc` | parseInt guards: 13 renders as "13" month name fallback (no crash); non-numeric → 404 |
| REP-19 | Regression | High | Canceled receipts excluded from totals | Cancel one receipt in the month | Count and total drop accordingly |
| REP-20 | Regression | Medium | Balance column = live balance at print time | Print report, then make a payment, print again | Balance column changes on re-print (balance is computed live) |

### 13.5 Print controls
| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| REP-21 | Positive | Medium | Auto-print after fonts load | Open any print page | Print dialog appears after short delay; Arabic glyphs correct in preview |
| REP-22 | Positive | Medium | Manual print button | Cancel auto dialog, click طباعة / حفظ كـ PDF | Dialog re-opens; button hidden in printed output |

---

## 14. Excel Export (XLSX)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| XLS-01 | Positive | High | Export revenues | Revenues page → تصدير إلى Excel | Downloads `الإيرادات.xlsx`; RTL sheet; headers سنة/شهر/فئة/مبلغ/وصف/مصدر/تاريخ; month as Arabic name; amounts 2 decimals; opens in Excel |
| XLS-02 | Positive | High | Export expenses | Expenses page → تصدير إلى Excel | `المصروفات.xlsx` with vendor column; correct rows |
| XLS-03 | Positive | High | Export student balances | Students page → تصدير الأرصدة | `أرصدة_الطلاب.xlsx`; active students only; name/grade/year/balance; balance = SUM(transactions) per student |
| XLS-04 | Regression | High | Export excludes inactive students | After STU-21 (S3 inactive) | S3 absent from balances export |
| XLS-05 | Negative | High | Formula injection sanitized | Create revenue category `=HYPERLINK("http://evil","x")` then export | Cell shows `'=HYPERLINK(...)` (text, not formula); same for description/vendor/student name |
| XLS-06 | Edge | Medium | Export with zero rows | Fresh year | Valid xlsx with header row only, no crash |
| XLS-07 | Positive | Medium | Filenames Arabic | Download | `الإيرادات.xlsx`, `المصروفات.xlsx`, `أرصدة_الطلاب.xlsx` exactly |

---

## 15. Excel Import (IMP)

Template columns (row 1 = header, data from row 2):
- Revenue: السنة | الشهر | الفئة | المبلغ | الوصف | المصدر | التاريخ
- Expense: السنة | الشهر | الفئة | المبلغ | الوصف | البائع | التاريخ

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| IMP-01 | Positive | High | Preview shows first rows | Pick valid xlsx | Preview table with headers + up to 5 rows + `معاينة (N من M صف)` |
| IMP-02 | Positive | High | Import revenues (valid file) | 10 valid rows | `تم استيراد 10 سجل بنجاح`; rows appear; router refreshed; source=Import |
| IMP-03 | Positive | High | Import expenses (valid file) | 10 valid rows | Same for expenses |
| IMP-04 | Positive | High | Month as Arabic name | Month column "مارس" | Parsed as 3 (MONTH_INDEX) |
| IMP-05 | Positive | High | Month as number/string number | "3" / 3 | Parsed as 3 |
| IMP-06 | Negative | High | Invalid month name | "برمودة" | Row error `اسم الشهر غير معروف: "برمودة"`; other valid rows still import (partial success) |
| IMP-07 | Negative | High | Negative/zero amount | −5 | Row error `المبلغ يجب أن يكون موجباً` |
| IMP-08 | Negative | High | Non-numeric amount | "abc" | Row error `المبلغ غير صالح: "abc"` |
| IMP-09 | Negative | High | Invalid year | 1999 / 2101 | Row error `السنة غير صالحة: ...` |
| IMP-10 | Negative | High | Invalid date | "not-a-date" | Row error `التاريخ غير صالح: "not-a-date"` |
| IMP-11 | Edge | High | Excel serial-date cell | Date cell stored as number (44941) | **Known risk:** parseDate gets a number → `new Date(44941)` yields 1970 date, NOT error. Verify behavior and record as defect if wrong date imported silently |
| IMP-12 | Edge | Medium | Blank rows skipped | Trailing blank rows | Skipped silently; count unaffected |
| IMP-13 | Negative | High | File with no valid rows | All rows invalid | Error `لا توجد بيانات صالحة للاستيراد`; nothing inserted |
| IMP-14 | Negative | High | Non-xlsx file / no file | .csv or none | Error `لم يتم اختيار ملف` / ExcelJS load failure surfaced |
| IMP-15 | Positive | Medium | Mixed valid/invalid file | 8 valid + 2 invalid | 8 imported; errors listed with row numbers `صف N: <message>`; success banner + error list both shown |
| IMP-16 | Regression | Medium | Imported rows editable/deletable | Delete an Imported revenue row | Deletable (source=Import is not protected, only Payment/Cancellation) |
| IMP-17 | Negative | High | Teacher cannot import | Teacher calls importRevenues | `غير مصرح: يتطلب صلاحيات المسؤول` |

---

## 16. Settings (SET)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| SET-01 | Positive | High | Update kindergarten info | Name/address/phone/email → حفظ | `تم الحفظ بنجاح`; receipt print header/contact updated on next issue |
| SET-02 | Negative | High | Blank name | Clear name → save | `الحقل "اسم الروضة" مطلوب` |
| SET-03 | Positive | Medium | Email/phone validation | Invalid email | Browser type=email blocks; server stores as-is otherwise (verify no server-side validation) |
| SET-04 | Positive | High | Set teacher password | TeacherPasswordButton, "5678" ×2 | `تم الحفظ بنجاح`; teacher can now log in with 5678 (AUTH-05) |
| SET-05 | Negative | High | Teacher password mismatch / <4 chars | "123"/mismatch | Errors `كلمتا المرور غير متطابقتين` / `كلمة المرور يجب أن تتكون من 4 أحرف على الأقل` |
| SET-06 | Positive | High | Change admin password | Current "1234", new "abcd" ×2 | `تم تغيير كلمة المرور بنجاح`; form reset; re-login with new works, old fails |
| SET-07 | Negative | High | Wrong current password | Current "xxxx" | `كلمة المرور الحالية غير صحيحة` |
| SET-08 | Negative | High | New password < 4 chars | "abc" | `كلمة المرور الجديدة يجب أن تتكون من 4 أحرف على الأقل` |
| SET-09 | Negative | High | New/confirm mismatch | "abcd"/"abce" | Client-side `كلمتا المرور الجديدتان غير متطابقتين` |
| SET-10 | Positive | Medium | Passwords stored hashed | Inspect Setting table (`adminPasswordHash`) | Format `salt:hash` (hex), scrypt — never plaintext |
| SET-11 | Positive | Medium | Sync config save (empty = disabled) | Save empty URL+token | Saved; sync-state.json written; push/pull skipped |
| SET-12 | Positive | Medium | Sync config save (filled) | https://worker.url + token | Saved; Electron pull on next launch, push on quit (see SYNC section) |
| SET-13 | Negative | High | Teacher blocked from settings | Teacher direct call | Admin-only errors |

---

## 17. Dashboard (DASH)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| DASH-01 | Positive | High | KPI correctness vs known dataset | Build full dataset, compute manually | expectedIncome = Σ(Charge+Adjustment) of students in current year; receivedIncome = net Payment+Cancellation revenue this calendar month; outstanding = Σ all transactions (all years); collectionRate = collectedYear/expected ×100 (rounded 2dp); expenses card = this month expenses |
| DASH-02 | Positive | High | Collection rate sanity | Student charged 400, paid 100 | Rate = 25.00% (collected/charged same scope), NOT tiny fraction |
| DASH-03 | Positive | Medium | Unpaid alert (30-day window) | Student with balance > 0 and last payment ≥31 days ago; student never paid; student paid 2 days ago | Alert count excludes the recent payer; includes the 31-day-old and never-paid; dialog shows names, balances, last payment dates, badges متأخر/لم يدفع أبداً |
| DASH-04 | Edge | Medium | Paid-off students excluded | Student with balance ≤ 0 | Not in unpaid list |
| DASH-05 | Positive | Medium | No alert when empty | All paid / no students | Alert component absent |
| DASH-06 | Positive | Medium | Credit (negative outstanding) presentation | Whole school in credit | Card title `رصيد دائن (زيادة دفع)`, green, absolute value |
| DASH-07 | Regression | High | Year scoping after rollover | YEAR-01 then check | KPI year label shows new year; expected income scoped to it |
| DASH-08 | Negative | High | Teacher redirected from dashboard | Teacher → `/` | Redirect `/students` (page-level guard) |

---

## 18. Backup (BAK)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| BAK-01 | Positive | High | Create SQLite backup | Sidebar → نسخ احتياطي | Success message + download `backup_YYYY-MM-DD_HH-MM-SS.db`; file in `{KG_DATA_DIR}/Backups/`; openable/valid SQLite |
| BAK-02 | Positive | High | Backup is consistent snapshot | Make backup mid-activity (after some writes) | Restored db contains all committed data; no torn state |
| BAK-03 | Positive | Medium | Retention: max 30 | Create 31+ backups (or copy files) | Oldest beyond 30 deleted; latest 30 kept |
| BAK-04 | Negative | High | Teacher cannot backup | Teacher direct call | Admin-only error |
| BAK-05 | Edge | Medium | Backup when DB file missing | Simulate missing db path | `ملف قاعدة البيانات غير موجود` error, no crash |
| BAK-06 | Regression | High | Postgres mode dump (if tested) | Run against Postgres env | `.sql` dump download containing CREATE TABLE + INSERT + sequence setvals; restorable with psql |

---

## 19. Sync (SYNC) — Electron + Worker

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| SYNC-01 | Positive | High | First launch pulls remote db | Configure sync, seed device B, close, delete device A's local db, relaunch | A pulls B's db before server starts (prod only); data appears |
| SYNC-02 | Positive | High | Quit pushes local changes | Device A makes changes, close app | `PUT` with If-Match to worker; etag stored in sync-state.json; log `sync_push_success` |
| SYNC-03 | Negative | High | Conflict (412) not clobbering | Device B pushed newer data; device A (stale etag) quits | Push skipped with 412; log `sync_push_conflict`; B's data intact |
| SYNC-04 | Negative | High | Wrong token rejected by worker | Call worker GET with bad token | 401 |
| SYNC-05 | Positive | Medium | First-ever push (no etag) | Fresh install pushes | Unconditional PUT accepted (onlyIf null) |
| SYNC-06 | Negative | High | sync-push endpoint requires internal token | POST `/api/internal/sync-push` without Bearer | 401 |
| SYNC-07 | Positive | Medium | Sync disabled = no network calls | Empty URL/token, launch & quit | No pull/push; startup not blocked |
| SYNC-08 | Edge | Medium | Worker down at quit | Stop worker, quit app | Push fails gracefully (log error), app still quits normally |
| SYNC-09 | Edge | Medium | Pull when worker has no data | First-ever GET | 404 → skip silently, local db kept |

---

## 20. Electron / Desktop (ELE)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| ELE-01 | Positive | High | Single instance | Launch app, then launch again | Second launch focuses existing window; no port collision/blank window |
| ELE-02 | Positive | High | Server spawns standalone | Packaged app start | Internal server on random free 127.0.0.1 port; window loads app |
| ELE-03 | Positive | Medium | DB in userData | Packaged app | `kindergarten.db` + `Logs/` + `Backups/` + `sync-state.json` under userData, NOT install dir |
| ELE-04 | Negative | Medium | Server failure shows error page | Kill server process mid-session | Arabic `تعذر تشغيل الخادم الداخلي` page (did-fail-load path) |
| ELE-05 | Positive | Medium | Window basics | Launch | 1366×768, min 1024×600, title إدارة الروضة, RTL UI |
| ELE-06 | Edge | Medium | Dev mode skips sync | `npm run dev` + electron | No pull/push in dev (by design) |
| ELE-07 | Positive | Medium | Logging works | Perform 10+ actions, open `Logs/log_YYYY-MM-DD.json` | One JSON line per event: login, setup_completed, student_created/updated/deactivated/reactivated, receipt_created/canceled, refund_processed, fee_created/updated/deleted/copied, academic_year_started, students_promoted, backup_created, password_changed, import, revenue_deleted, expense_deleted, sync events; app never breaks if Logs dir unwritable (silent fail) |

---

## 21. RTL / Localization / UI (UIX)

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| UIX-01 | Positive | Medium | All pages render RTL Arabic | Sweep all pages + dialogs | `<html dir="rtl" lang="ar">`; no English UI strings; no LTR artifacts (punctuation/numbers OK) |
| UIX-02 | Positive | Medium | No unlocalized text | Screenshot sweep | Every visible string Arabic; error messages Arabic |
| UIX-03 | Positive | Medium | Dialog a11y | Tab through dialogs | Focus visible; Esc closes; labels tied to inputs |
| UIX-04 | Positive | Medium | Loading/empty states | Navigate fast, open empty pages | loading.tsx / لا توجد... states render, no flash of unauthenticated content |
| UIX-05 | Positive | Medium | Responsive | Narrow window / mobile emulation | Sidebar collapses to sheet; tables scroll horizontally |
| UIX-06 | Positive | Medium | Amount formatting | Mixed values incl. 0.005 fils | `.toFixed(2)` shows 2 decimals; fils values rounded at 3 (roundMoney) — verify display vs storage of e.g. 0.004 → 0.00 display |
| UIX-07 | Positive | Medium | Date formatting | Various dates | `dd/MM/yyyy` in tables, `yyyy-MM-dd` in inputs |

---

## 22. Cross-Cutting Consistency / Regression Suite (XCS)

Run these after completing all sections; they are the app's invariants.

| ID | Type | Priority | Test Case | Steps | Expected Result |
|----|------|----------|-----------|-------|-----------------|
| XCS-01 | Regression | High | Ledger identity | For every student: SUM(Transaction.amount) == balance shown in students table, profile, ledger print, monthly report balance column | All match to the fils (3dp) |
| XCS-02 | Regression | High | Receipt ↔ Revenue lockstep | For every non-canceled receipt: +Revenue row exists (same amount, Payment source, month = issueDate). For every canceled: −Revenue row exists (Cancellation source, same month) | One-to-one; no orphan revenue rows |
| XCS-03 | Regression | High | Payment ↔ Reversal symmetric | For each canceled receipt: student balance unchanged vs before payment; Reversal amount == Payment amount | True |
| XCS-04 | Regression | High | Dashboard vs reports agree | outstanding == Σ(report balances); monthly summary revenue == Σ payments received in that month (net of cancels) + manual + import | Agree |
| XCS-05 | Regression | High | No negative balances on promoted cohorts | After PROMO: Σ(new student balances) == Σ(old balances) + new charges − nothing lost | Balance conservation across promotion: old 0 + new = old + charges |
| XCS-06 | Regression | High | No orphan students | Every StudentFee/Payment/Receipt/Transaction/Refund references an existing student; no duplicate receiptNumbers | FK integrity via Prisma; spot-check with SQL |
| XCS-07 | Regression | High | Float precision | Sum 1000+ small payments and charges | roundMoney keeps totals exact to 0.001; no cumulative drift visible |
| XCS-08 | Regression | Medium | Logs complete for money ops | Grep log file | receipt_created/canceled, refund_processed, students_promoted, fee_* events exist for actions performed |
| XCS-09 | Regression | Medium | Idempotent boot | Restart app 3× in a row | No re-seed duplicates (seedDefaultFees skip), no migration errors, settings persist |
| XCS-10 | Regression | High | Two-browser concurrency sanity | Admin in window A issues receipt; window B (admin) refreshes payments page | B sees the new receipt (router.refresh / server render reads DB) |

---

## 23. Known Defect Candidates to Confirm (from code reading)

These are *suspected* behaviors a tester should verify and escalate — not all are bugs:

1. **STU-10 / LED-09:** `createStudent`/`updateStudent` do not validate `busFees`/`additionalFees`/`discountValue` server-side (only UI `min="0"`). Negative values via devtools create negative Charges → balance manipulation. Verify and report if reproducible.
2. **IMP-11:** Excel serial-date cells (numeric) parse to a 1970-era date instead of erroring — verify with a real file.
3. **FEE-10:** Duplicate Monthly fees for same grade+year are allowed; `getDefaultTuition` picks the cheapest, which may silently under-bill. Confirm with two different amounts.
4. **REP-08:** Canceled receipts can still be printed directly via `/print/receipt/{id}` (no canceled flag check on the print route) — verify if this should show a warning/badge.
5. **AUTH-12:** Changing admin password does not invalidate existing sessions (cookies are role-only, not password-derived). Confirm and decide acceptable.
6. **REV-05/06:** Derived (Payment/Cancellation) revenue rows are protected from edit/delete server-side, but the guard checks `source` before update — a devtools-crafted update that also changes `source` may bypass; verify.
7. **EXP/REV month input:** free-text month input allows 13+ via devtools — rows stored with month 13 would be invisible in reports; verify validation.
8. **SET-03:** Email/phone are client-validated only — server stores any string. Low impact.
9. **STU-24:** Students page has no active/inactive filter — inactive students appear mixed in the list; verify this matches product expectations.

---

## 24. Suggested Execution Order

1. SETUP-* → AUTH-* (both roles)
2. FEE-* → STU-* + LED-* (build dataset)
3. PAY-* (incl. cancels) → REF-*
4. REV-*, EXP-*, XLS-*, IMP-*
5. REP-* (all four tabs + tafqit)
6. YEAR-* → PROMO-* (end-of-year flow)
7. DASH-* → BAK-* → SYNC-*/ELE-* (Electron)
8. XCS-* regression sweep → defect candidates section 23
