# SOMS - Student Organization Management System

Web-based system for the **Office of Student Affairs (OSA), Assumption College of Davao**.
Organization officers submit softcopy documents online (and track the matching hardcopy),
OSA reviews, approves and stores everything in one place.

> **Status: Phase 9 complete** - authentication, proxy-based route protection,
> role-based layout, user management, organization records, four submission
> modules on one shared workflow engine, notifications (Realtime + e-mail),
> requirements with deadline reminders, the audit trail viewer, role-aware
> dashboards, the OSA report screen with Excel/PDF exports, the Phase 3
> checkpoint (a configurable approval chain per module with the **dean** role
> between the adviser and OSA), and the spec's Phase 3-5 checkpoints: the
> approval workflow walks officer -> adviser -> dean -> OSA with a revision
> loop, overlapping venue bookings are refused with a live warning, and
> attachment uploads are versioned - the previous file stays downloadable.
> Tests and cleanup are done: 36 RLS/RPC checks in SQL and the browser smoke
> test in `scripts/e2e-smoke.mjs`.

## Tech stack

| Layer      | Choice                                                              |
| ---------- | ------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript                                |
| UI         | Tailwind CSS v4 + shadcn/ui (radix-nova style)                      |
| Database   | Supabase Postgres - schema managed by Supabase CLI migrations       |
| Auth       | Supabase Auth (email + password) via `@supabase/ssr`                 |
| Storage    | Supabase Storage - **private** buckets served through signed URLs   |
| Realtime   | Supabase Realtime (in-app notifications)                            |
| Validation | Zod + react-hook-form                                               |
| Exports    | `@react-pdf/renderer`, `exceljs` (Phase 6), `qrcode` (Phase 5)       |
| Email      | Resend (Phase 5)                                                    |

## Prerequisites

- Node.js 20.11+ (verified on 22.x) and npm
- Docker Desktop (for the local Supabase stack)
- Supabase CLI (installed as a dev dependency: `npx supabase --version`)

## Quick start (local)

```bash
# 1. dependencies
npm install

# 2. environment - start the local stack and copy its keys
npx supabase start
npx supabase status -o env          # paste into .env.local (see .env.example)

# 3. database: migrations + base seed data
npm run db:reset

# 4. auth users, advisers/officers and sample submissions
npm run seed:auth

# 5. run the app
npm run dev                         # http://localhost:3000
```

`.env.local` is git-ignored. **Never** put `SUPABASE_SERVICE_ROLE_KEY` behind a
`NEXT_PUBLIC_` variable - only the URL and anon key may be exposed to the browser.

### Hosted project instead of local

1. Sign up at https://supabase.com and click **New project** (name it `SOMS`,
   pick a region, save the database password).
2. Wait for the provisioning to finish, then link the CLI and push the schema:
   ```bash
   npx supabase link --project-ref <project-ref>   # Project Settings -> General
   npx supabase db push                            # applies supabase/migrations
   ```
   (or `npm run db:reset` once, which also runs `supabase/seed.sql`).
3. Copy **Project Settings -> API** values into `.env.local`
   (start from `.env.example`):

   | Variable                        | Where it comes from                       |
   | ------------------------------- | ----------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Project URL                               |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key                  |
   | `SUPABASE_SERVICE_ROLE_KEY`     | `service_role` secret - **server only**   |
   | `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000` (or your origin)  |
   | `RESEND_API_KEY` (optional)     | https://resend.com - e-mail notifications |
   | `CRON_SECRET` (optional)        | any long random string - reminder cron    |
   | `SEED_PASSWORD` (optional)      | password given to seeded accounts         |

4. Run `npm run seed:auth` to create the accounts, then `npm run gen:types`
   (hosted: add `--db-url <connection-string>` or run it right after
   `supabase start` locally).

## Seeded accounts

Default password for **every** seeded account: `ChangeMe123!`
(override with `SEED_PASSWORD` in `.env.local`, change the accounts after first login).

| Role         | E-mail                                |
| ------------ | ------------------------------------- |
| Super Admin  | `its.admin@acd.edu.ph`                |
| OSA Admin    | `osa.admin@acd.edu.ph`                |
| Dean         | `dean.<collegecode>@acd.edu.ph`       |
| Adviser      | `adviser.<orgcode>@acd.edu.ph`        |
| Officer      | `president.<orgcode>@acd.edu.ph`      |

`<orgcode>` is the lower-case organization code, e.g. `president.lits@acd.edu.ph`,
`adviser.afphi@acd.edu.ph`; `<collegecode>` is the lower-case college code, e.g.
`dean.bsit@acd.edu.ph`. 44 accounts in total (2 admins + 6 deans + 18 advisers +
18 presidents).

## Commands

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Start Next.js on http://localhost:3000                    |
| `npm run build`         | Production build (also runs TypeScript)                   |
| `npm run lint`          | ESLint                                                    |
| `npm run typecheck`     | `tsc --noEmit`                                            |
| `npm run supabase:start` / `:stop` / `:status` | Control the local Supabase stack       |
| `npm run db:reset`      | Recreate the local DB, apply all migrations, run `seed.sql` |
| `npm run gen:types`     | Regenerate `src/lib/database.types.ts` from the schema    |
| `npm run seed:auth`     | Create auth users, adviser/officer links and sample records  |
| `npm run e2e`           | Browser smoke test: auth, roles, all four submission workflows through the approval chain (adviser, dean, OSA), chain editor, notifications, dashboards, report exports, venue conflict warning + refusal, calendar board, venue manager and attachment versioning (150 checks, needs `npm run dev`) |
| `npm run test:rls`      | 36 RLS + RPC smoke tests against the local database (all rolled back)  |

## Phase 1 - what was built

```
supabase/
  config.toml                      local stack config (project_id = "SOMS")
  migrations/
    20261006000100_core_schema.sql     enums, 18 tables, indexes, updated_at triggers,
                                       reference-number generator (SOMS-2026-0001)
    20261006000200_functions.sql       SECURITY DEFINER helpers (get_my_role, is_osa,
                                       is_adviser_of, ...), signup trigger, guard
                                       triggers, audit_logs trigger, RPCs
                                       (transition_submission, add_review_comment,
                                       mark_hardcopy_received, check_rate_limit)
    20261006000300_rls.sql             table grants + RLS policies for every table
    20261006000400_views.sql           list views with hardcopy badge + report summaries
    20261006000500_storage_realtime.sql private buckets, storage policies, realtime
    20261010000100_phase1_foundation_tables.sql
                                       venues, templates, announcements (+targets),
                                       accreditation_items/-submissions, officer_terms,
                                       v_calendar_events, school_years.is_archived,
                                       storage buckets `templates` + `announcements`;
                                       accreditation_status aligned to the spec's four
                                       values (pending/accredited/conditional/
                                       not_accredited)
  seed.sql                           colleges, school years, 18 organizations, settings,
                                     venues, sample accreditation checklist
scripts/seed-users.ts                auth users + adviser/officer links + sample data
src/lib/supabase/                    browser / server / service-role clients
src/lib/database.types.ts            generated Supabase types (npm run gen:types)
tests/rls-smoke.sql                  RLS + RPC smoke tests (all rolled back)
```

### Tables (all with RLS enabled)

`profiles`, `colleges`, `organizations`, `organization_officers`, `advisers`,
`school_years`, `activity_proposals`, `accomplishment_reports`, `audit_documents`,
`other_documents`, `documents`, `review_logs`, `notifications`, `hardcopy_records`,
`requirements`, `audit_logs`, `system_settings`, `rate_limits`,
`venues`, `templates`, `announcements`, `announcement_targets`,
`accreditation_items`, `accreditation_submissions`, `officer_terms`
(all RLS enabled - `tests/rls-smoke.sql` T30 asserts zero exceptions)

Views: the four submission list views, `v_document_latest`, `v_organization_summary`,
`v_activity_summary_by_college`, `v_pending_approval` (all `security_invoker`), plus
`v_calendar_events` (approved events are public to signed-in users; own-org events
regardless of status - rules embedded in the view, see the migration header).

### Authorization rules (enforced in Postgres)

- Officers see/edit **only their own organization's** records.
- Advisers see only the organization(s) assigned to them in `advisers`.
- OSA Admin and Super Admin see everything.
- Status changes are impossible with a plain `UPDATE` - a BEFORE trigger rejects
  them; only `transition_submission()` (which re-checks the caller's role) works.
- `review_logs` and `notifications` have no INSERT policy: only the
  SECURITY DEFINER RPCs can write them.
- `audit_logs` is readable by OSA/Super Admin only and is never client-writable.

## Phase 2 - what was built

```
src/proxy.ts                          route protection + Supabase session refresh
                                      (Next 16 name for middleware)
src/lib/auth.ts                       getSession/getProfile/requireRole/requireOsa
src/lib/navigation.ts                 sidebar items, role groups, route prefix rules
src/lib/labels.ts                     role / status / accreditation labels
src/lib/action-result.ts              { ok } | { ok: false, error } result contract
src/lib/actions/auth.ts               loginAction (rate limited), logoutAction
src/lib/actions/users.ts              createUser, updateUser, toggleUserActive,
                                      resetUserPassword (super admin)
src/lib/actions/organizations.ts      updateOrganization (OSA only)
src/lib/actions/school-years.ts       createSchoolYear, setCurrentSchoolYear
src/lib/actions/profiles.ts           updateProfile, changePassword (self-service)
src/lib/validations/                  zod schemas (auth, users, organizations,
                                      profiles)
src/app/(auth)/login/                 sign-in screen
src/app/(app)/                        authenticated shell (layout + pages)
src/app/(app)/dashboard/              greeting, counts, recent proposals
src/app/(app)/organizations/          list + detail (OSA can edit the record)
src/app/(app)/profile/                my account + password change
src/app/(app)/admin/users/            create / edit / reset password / activate
src/app/(app)/admin/school-years/     academic years + current-year switch
src/components/                       app shell, sidebar, dialogs, form helpers
src/components/profile/               profile details + change-password forms
scripts/e2e-smoke.mjs                 browser smoke test (Edge via playwright-core)
```

### Authentication and authorization

- **`src/proxy.ts`** refreshes the Supabase session cookie and redirects
  anonymous requests to `/login?next=...`. It only checks that a session cookie
  exists - **never** a role, so a forged cookie grants nothing.
- Every page/action re-reads the profile from Postgres through
  `requireProfile()` / `requireRole()` (`src/lib/auth.ts`). Role changes take
  effect immediately, on the next request.
- Login goes through `loginAction`, which calls `check_rate_limit()`
  (5 attempts / 15 min per e-mail) before `signInWithPassword`, and rejects
  deactivated accounts.
- Deactivating an account kills access at the next request: the shell and every
  action call `requireProfile()`, which bounces inactive profiles to
  `/login?error=inactive`.
- Creating users needs the service-role key (only `auth.admin.createUser`);
  role/organization/active changes run through the session client so RLS and
  `enforce_profile_guard()` still apply.
- **Self-service password change**: `/profile` (in the user menu) lets every
  signed-in user update their display name/position and replace the temporary
  password given by OSA (`supabase.auth.updateUser`, min 8 chars). Role,
  organization, college, e-mail and active flag stay read-only - those are
  guarded by `enforce_profile_guard()` and edited by super admin / OSA.
- **Admin password reset**: super admin can reset any account's password from
  `/admin/users` (Reset button) via `auth.admin.updateUserById` - useful when
  someone forgets the temporary password.

### Role map

| Route / action                    | super_admin | osa_admin | adviser | dean | officer |
| ---------------------------------- | :---------: | :-------: | :-----: | :--: | :-----: |
| `/dashboard`, `/organizations`, own module pages | yes | yes | yes | yes | yes |
| Create a submission (`/proposals/new`, `/reports/new`, `/documents/new`) | - | - | - | - | yes (own organization) |
| Edit a draft / revision-requested record | yes | yes | - | - | creator officer |
| Submit or withdraw a record | - | - | - | - | officers of that organization |
| Endorse a record (adviser step) | - | - | adviser of that organization | - | - |
| Approve / reject / request revision (dean step) | - | - | - | dean of that organization's college | - |
| Approve / reject / request revision (OSA step) | yes | yes | - | - | - |
| `/reviews` (My Approvals queue) | - | - | yes | yes | - |
| `/osa/*` (reviews, hardcopy, reports, approval chains) | yes | yes | - | - | - |
| `/admin/users`, `/admin/school-years` | yes | - | - | - | - |
| Reset a user's password | yes | - | - | - | - |
| Edit own profile / change own password (via `/profile`) | yes | yes | yes | yes | yes |
| Edit an organization record | yes | yes | - | - | - |

Navigation groups (`Administration`, `Office of Student Affairs`) only render for
the roles allowed on those routes; a direct URL is still blocked server-side with
a redirect to `/dashboard?denied=1`.

## Phase 3 - what was built

```
src/lib/validations/proposals.ts   zod schema for the activity fields
src/lib/actions/proposals.ts       create / update a proposal
src/lib/format.ts                  date, time, money and byte formatters
src/components/proposals/          proposal form + proposal detail fields
src/app/(app)/proposals/           list, new, [id] detail, [id]/edit
src/app/(app)/osa/reviews/         OSA review queue (submitted / endorsed / under review)
src/app/api/files/[id]/route.ts    signed-URL download for private attachments
```

> The shared parts of this phase (status badge, table, filters, list/detail page
> bodies, actions, attachments, timeline and the permission matrix) were lifted
> into `src/lib/submissions.ts` + `src/components/submissions/` in Phase 4, so
> this list shows what stayed module specific.

### The workflow

```
officer                adviser                 OSA
draft ──submit──▶ submitted ──endorse──▶ endorsed ──start review──▶ under_review
  ▲                  │                                            ├─ approve
  └──── withdraw ────┘                                            ├─ reject
       OSA may also send any of the above back: ──▶ revision_requested
       (the officer edits and resubmits - `version` + 1)
```

- **All** status changes go through `transition_submission()`; the server action
  never writes `status` itself, so the guard trigger, the review log
  (`review_logs`) and the in-app notifications can never drift apart.
- The UI only offers the buttons the role may use
  (`submissionPermissions()` in `src/lib/submissions.ts`) and Postgres re-checks
  the same matrix inside the RPC - the button is a hint, the database is the
  authority.
- Remarks are mandatory for approve / reject / request revision, are stored on
  the proposal (`reviewer_remarks`), shown as an alert to the officers and kept
  in the review timeline.
- Reviewers can leave a remark without moving the workflow
  (`add_review_comment()`), which lands in the same timeline as `commented`.
- Attachments are stored in the private `submissions` bucket under
  `{org_id}/proposals/{proposal_id}/…`, registered in `documents`, and only
  reachable through `/api/files/{id}` - that route checks the session and the
  `documents` row under the caller's RLS before minting a 10-minute signed URL.
- The list is RLS-scoped: officers and advisers only ever see their own
  organization's proposals, OSA sees everything, with search, status and
  (for OSA) organization filters plus pagination.

## Phase 4 - what was built

Phase 3's plumbing was generalized into **one submission engine** that now serves
three modules - activity proposals, accomplishment reports and other documents
(audit documents join it in Phase 5).

```
src/lib/submissions.ts                module registry (table, view, route, storage
                                      folder, document kind, create roles) +
                                      submissionPermissions()
src/lib/actions/shared.ts             FormData, current-school-year and revalidate helpers
src/lib/actions/submissions.ts        transition / comment / upload / delete (generic)
src/lib/actions/proposals.ts          create / update a proposal
src/lib/actions/reports.ts            create / update a report (links an approved proposal)
src/lib/actions/other-documents.ts    create / update a governed document
src/lib/validations/                  submissions (shared), proposals, reports, other-documents
src/components/submissions/           status badge, table, filters, list page body,
                                      detail page body, workflow actions, attachments,
                                      review timeline
src/components/proposals|reports|documents/   module form + module detail fields
src/app/(app)/reports/                list, new, [id] detail, [id]/edit
src/app/(app)/documents/              list, new, [id] detail, [id]/edit
```

- What the three modules share lives in `src/lib/submissions.ts` +
  `src/components/submissions/`: the same `transition_submission()` RPC, the same
  remarks rules, the same attachments, the same review timeline and the same
  permission matrix - only the table, route, storage folder and fields differ.
- The target module is never taken from the client as a table name: the form
  posts a `module` key that is resolved through `getModule()` (a whitelist) to
  the table, `record_type`, storage folder and document kind.
- **Accomplishment reports** may link an **approved** proposal of the *same*
  organization (checked server-side, along with the school year and the create
  role) and record attendance, budget spent and a liquidation summary.
- **Other documents** carry a category (constitution & by-laws, resolution,
  memo, minutes, other) and follow exactly the same
  draft → submit → endorse → review → approve path.
- Every new record belongs to the current school year, is created by an officer
  of its own organization and receives a `SOMS-YYYY-NNNN` reference number.
- Attachments keep the Phase 3 rules, now stored under
  `{org_id}/{proposals|reports|other}/{record_id}/…` with `documents.record_type`
  and `documents.doc_type` identifying the owning module.
- `/osa/reviews` still lists proposals waiting for a decision; reports and
  documents are reached from their own pages (Phase 5 adds the hardcopy/QR side
  for all four modules).

## Phase 5 - what was built

Notifications, requirements with deadline reminders, and the audit trail
viewer.

```
supabase/migrations/20261006000600_phase5_notifications_reminders.sql
                                    reminded_at + emailed_at bookkeeping,
                                    notify_org_officers(), sweep_requirements(),
                                    guarded pg_cron schedule (daily 06:00)
src/lib/email.ts                     Resend dispatch mirroring `notifications`
src/lib/actions/notifications.ts     mark one / mark all read
src/lib/actions/requirements.ts      OSA create, edit, delete, sweep
src/components/notifications/        header bell (Realtime subscription)
src/components/requirements/         form dialog, row actions, sweep button
src/app/(app)/notifications/         full inbox (all / unread tabs)
src/app/(app)/requirements/          real page (was ComingSoon)
src/app/(app)/osa/audit-trail/       OSA-only audit log viewer
src/app/api/cron/reminders/route.ts  POST/GET fallback scheduler (CRON_SECRET)
```

- **One source of truth for recipients.** The database decides who is notified
  (`notify_user()` inside the workflow RPCs, `notify_org_officers()` for
  organization-wide announcements, `sweep_requirements()` for deadline
  reminders) by inserting `notifications` rows. `src/lib/email.ts` only mirrors
  those rows to Resend and stamps `emailed_at` - it never re-implements the
  recipient rules, so in-app and e-mail can never disagree.
- **Header bell + `/notifications`.** A Supabase Realtime `postgres_changes`
  channel (scoped by `user_id=eq.<uid>`, enforced again by RLS) keeps the
  unread badge live; the inbox page lists everything with an all/unread filter
  and "mark all read".
- **Requirements** are OSA-created compliance items per organization. Officers
  and advisers see only their own rows (RLS `requirements_select`), get a
  notification when one is assigned, and OSA can complete / waive / reopen /
  edit / delete them. The "Run reminder sweep" button calls the same
  `sweep_requirements(3)` RPC the scheduler uses.
- **Deadline engine.** `sweep_requirements()` marks past-due items `overdue`
  and sends at most one reminder per requirement per user per day. It runs
  through `pg_cron` where installed (daily 06:00) and otherwise through
  `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` - the
  route is in `PUBLIC_PATHS` so the session proxy lets it through, and the
  bearer secret is the only gate.
- **E-mail is best-effort by design.** Without `RESEND_API_KEY` the dispatcher
  is a logged no-op (in-app notifications still work); failures leave
  `emailed_at` NULL for the next run. Workflow transitions, review remarks,
  hardcopy logging and requirement assignments all dispatch after the database
  transaction commits.
- **Audit trail** (`/osa/audit-trail`, OSA + Super Admin, enforced by the
  `audit_logs_select` policy) shows every INSERT/UPDATE/DELETE with actor,
  table, record id and a pre-computed field diff (`before -> after`), with
  table/action/actor filters and pagination. Read-only: the table has no write
  policies for clients.
- Requirement reminders created by `sweep_requirements()` use
  `record_type = null` + `record_id = <requirement uuid>` (the enum has no
  `requirement` value) and link to `/requirements`.

## Phase 6 - what was built

Role-aware dashboards, the OSA report screen and the Excel/PDF exports.

```
supabase/migrations/20261006000700_phase6_reports.sql   summary views now cover EVERY school year
                                                        (they cross join school_years; callers filter
                                                        by school_year_id)
src/lib/dashboard.ts                  dashboard service: KPIs, attention queues, status matrix,
                                      recent activity - one code path per role
src/app/(app)/dashboard/              thin renderer over loadDashboard()
src/lib/reports.ts                    one column spec per table driving all three renderers +
                                      the shared loaders (loadOrgSummary / loadCollegeSummary)
src/lib/exports/summary-excel.ts      ExcelJS workbook: title block, frozen + filtered header,
                                      typed cells, bold totals row
src/lib/exports/summary-pdf.tsx       landscape A4 PDF (@react-pdf/renderer), columns scaled
                                      from the same widths as the Excel file
src/app/api/exports/summary/route.ts  GET ?scope=organizations|colleges&format=xlsx|pdf&year=<uuid>
                                      OSA-gated in the handler, queries run as the caller (RLS)
src/app/(app)/osa/reports/            report screen: school-year picker + Excel/PDF buttons
src/app/(app)/organizations/[id]/     now filters the summary view by school_year_id
next.config.ts                        serverExternalPackages: ["exceljs"]
```

- **Dashboards.** `/dashboard` renders `loadDashboard(profile)`:
  - **OSA / Super Admin** - active organizations, records awaiting a decision,
    overdue requirements and the approved-budget total, a queue of the oldest
    waiting submissions plus hardcopy/overdue nudges.
  - **Adviser** - organizations advised, records awaiting their endorsement,
    records already with OSA, requirements.
  - **Officer** - their own submissions, drafts and requested revisions, what
    is with the adviser/OSA, and requirement deadlines.
  - Every audience also gets the **status matrix** (all four modules x all
    seven workflow statuses) and a cross-module "Recent activity" list. All
    queries use the caller's session, so RLS scopes every number - the counts
    an officer sees are their organization's counts.
- **Reports.** `/osa/reports` lists the organization and college summaries for
  a chosen school year, with a totals row. The **same column spec and the same
  queries** feed the HTML table, the Excel workbook and the PDF, so the three
  outputs cannot drift apart.
- **Exports** are plain GET downloads (`/api/exports/summary`): the handler
  checks the profile itself (a page-level redirect would turn a download into
  an HTML page), re-uses the session client so RLS still applies, and answers
  401/403 for anonymous/non-OSA callers. Money is written as a real number
  with an Excel number format (`#,##0.00`); the PDF says "PHP 1,234.00"
  because the built-in Helvetica has no peso glyph.
- **Search and filters** (finished here, indexes landed in Phase 1): every
  list screen filters server-side - title/reference search on the submission
  lists, name/code on organizations, name/e-mail on users, title/description
  plus status on requirements, and table/action/actor filters on the audit
  trail - all backed by the `pg_trgm` GIN indexes, with status/organization
  dropdowns and pagination.

## Phase 7 - what was built

Tests, documentation and cleanup.

```
tests/rls-smoke.sql       23 RLS/RPC checks (T1-T23), every block rolled back.
                          Actor and record ids are resolved at run time from
                          the seed data (psql \gset: e-mail -> profile id,
                          code -> organization id), so the suite keeps working
                          after any `npm run db:reset`.
scripts/e2e-smoke.mjs     103 browser checks: auth and routing (Phases 2-5),
                          all four module workflows, notifications, the OSA
                          report screen, both export formats and the three
                          role dashboards (Phases 6-7), with full cleanup.
README.md                 setup steps for the local stack and for a hosted
                          Supabase project (including the env-var table).
```

- **Workflow tests per role:** the officer creates/submits/revises, the
  adviser endorses (and is refused for other organizations), OSA reviews and
  approves, the super admin manages accounts and school years, and the anon
  visitor only ever reaches `/login` - asserted both in SQL (`transition_submission`
  re-checks the matrix) and in the browser (the buttons each role is offered).
- **New in this phase:** `T22` (adviser reads only their organizations' rows)
  and `T23` (an officer sees only their own organization's requirements and
  cannot edit them even in the same transaction OSA wrote them in) - the deny
  path is proven with a savepoint + re-select instead of an aborted
  transaction, so the "0 rows" assertions really run.
- The SQL suite is print-style: compare the output against the expectations
  below (nothing is persisted - every block ends in `rollback`).

## Phase 8 - what was built

The spec's Phase 3 checkpoint: **officer -> adviser -> dean -> OSA**, with the
approver sequence configurable per submission module.

```
supabase/migrations/20261008000100_phase8_dean_role.sql
                                    `dean` user role + `step_approved` review action,
                                    `profiles.college_id`, strict current-step
                                    ownership inside `transition_submission()`
supabase/migrations/20261008000200_phase8_approval_chains.sql
                                    `approval_chains` + `approval_chain_steps`,
                                    `approval_records` (written only by the
                                    SECURITY DEFINER RPCs, select-only for clients),
                                    `v_pending_approval` exposes the current step
src/lib/validations|actions/approval-chains.ts   OSA edits a chain (role list -> replace steps)
src/components/admin/approval-chain-editor.tsx    per-chain step editor (role select, add/remove)
src/app/(app)/osa/approval-chains/                chain management page (OSA only)
src/app/(app)/reviews/                            "My approvals" queue for advisers and deans
src/components/submissions/approval-chain.tsx     numbered step list on the detail page
```

- **One chain per module.** Proposals, reports and audit documents default to
  Adviser -> Dean -> OSA; other documents go straight to OSA. The OSA edits the
  sequence at `/osa/approval-chains` (must not be empty, max 6 steps) - edits
  apply to **new** submissions only, because every submitted record snapshots
  its chain into `approval_records` and keeps moving through the snapshot.
- **Status mapping** (`transition_submission()` is the only writer):
  submit -> `submitted`; an adviser's endorsement -> `endorsed`; a non-final
  step's approval -> `under_review` once the next step is the OSA's, otherwise
  `endorsed`; the final step's approval -> `approved`. Rejection and revision
  requests keep their statuses; OSA's "Start review" (`submitted | endorsed` ->
  `under_review`) still applies to single-step chains.
- **Strict step ownership.** Whoever owns the *current pending step* decides:
  the adviser of that organization (labelled **Endorse**), the dean of that
  organization's college, or OSA for the last step. Everyone else only gets the
  comment box - `transition_submission()` re-checks ownership and raises 42501,
  so skipping the queue is impossible even through the RPC.
- **`/reviews` ("My approvals").** Advisers and deans get their own queue off
  `v_pending_approval` (RLS-scoped) filtered to their step role; OSA keeps
  `/osa/reviews`, which now only lists records actually resting at the OSA step.
- **Detail page.** The right column renders the snapshotted chain as a numbered
  list (with per-step status and who approved), and the workflow card says
  whose turn it is ("Waiting on Dean").
- **Dean dashboard.** Colleges' organizations, records awaiting the dean's
  approval, records with the adviser, requirement deadlines.
- **`approval_records`** is append-only from the clients' point of view (no
  INSERT/UPDATE/DELETE policy): rows are written only by the workflow RPCs, so
  approvals can never be forged by a direct insert.

## Phase 9 - what was built (spec Phases 3-5 checkpoints)

The spec's remaining three checkpoints, on top of the Phase 8 approval chain.

```
supabase/migrations/20261010000200_phase4_calendar_venues.sql
                                    `activity_proposals.venue_id`, the
                                    `find_venue_conflicts()` RPC (SECURITY
                                    DEFINER), the `enforce_venue_conflict`
                                    trigger, `v_venue_conflicts`, and a
                                    recreated `v_calendar_events` /
                                    `v_activity_proposal_list` carrying the
                                    venue and college columns
src/lib/validations|actions/venues.ts  venue CRUD (OSA) + live conflict lookup
src/components/proposals/venue-conflict-warning.tsx  debounced form warning
src/app/(app)/osa/venues/          venue manager + conflict register (OSA)
src/app/(app)/calendar/            month board over v_calendar_events (all roles)
src/lib/actions/submissions.ts      uploadAttachmentAction versions files
src/components/submissions/attachments.tsx  v-badges, "new version" + history
```

- **Approval workflow (spec Phase 3).** Officer submits, the adviser endorses,
  the dean clears, OSA approves - each step can request a revision, which drops
  the record back to the officer (status `revision_requested`) with the remark
  on the timeline; the officer edits and resubmits (`version` + 1) and the
  chain re-walks from the adviser. `/reviews` is the queue for whoever owns the
  current step; OSA keeps `/osa/reviews` for its own step. Phase 8's chain
  editor customises the sequence per module.
- **Venue conflict detection (spec Phase 4).** The proposal form gained a
  venue picker (free text still allowed for off-campus venues). While the
  officer types, `VenueConflictWarning` asks `find_venue_conflicts()` - the
  exact SECURITY DEFINER function the `enforce_venue_conflict` trigger uses on
  submit - so the form can never disagree with the server: an overlapping
  booking in `submitted / endorsed / under_review / approved` is refused with
  the blocking activity in the error. Drafts, rejections and free-text venues
  never hold a slot; a null start/end means whole-day. `/calendar` renders
  every visible proposal on a month board (approved events are public to
  signed-in users; own-org events visible to the org, its adviser and dean);
  `/osa/venues` manages the venue list and shows the `v_venue_conflicts`
  register of every overlapping pair.
- **Attachment versioning (spec Phase 5).** Files are never overwritten:
  `uploadAttachmentAction` links a new upload to the previous `documents` row
  (`parent_id`, `version` + 1) and marks the old row inactive - but its
  storage object and `/api/files/{id}` route stay, so every old version stays
  downloadable. Uploading the same file name supersedes automatically, and the
  per-file "new version" button does it explicitly. The detail page shows one
  entry per logical file with a `v2` badge and a "History (n)" list of the
  older versions; deleting the newest version restores the previous one.

## Testing

```bash
# 1. everything compiles
npm run typecheck && npm run lint && npm run build

# 2. RLS + RPC smoke tests (36 checks, all rolled back)
npm run test:rls

# 3. browser smoke test - the app must be running first
npm run dev                # terminal 1
npm run e2e                # terminal 2 (Edge headless, cleans up)
```

Expected results in the RLS smoke test:

- officer of LITS sees **1** proposal, **0** other-org rows, **0** audit logs,
  **0** other people's notifications, and **0** rows from the college summary view
- cross-org `UPDATE` / `INSERT` affect **0** rows
- direct status change and role escalation raise errors (guard triggers)
- adviser endorses their own organization (`endorsed`), and is rejected (42501)
  for any other organization
- officer cannot approve their own submission (42501)
- OSA sees all 18 proposals, can approve and log the hardcopy
  (`copy_status = complete`), and sees 6 colleges in the summary view
- the rate limiter allows 2 attempts then blocks
- `anon` cannot read any public table
- **Phase 5:** an officer cannot call `notify_org_officers()` or
  `sweep_requirements()` (42501), cannot insert `notifications` or
  `requirements` directly (no client INSERT/UPDATE policy), cannot mark
  another user's notification read (0 rows) and cannot read `audit_logs`;
  OSA can, `notify_org_officers()` returns one id per active officer/adviser
  of the organization, and `sweep_requirements(3)` returns an integer >= 0
- **Phase 6:** the summary views cover every school year - an officer sees 36
  organization rows (18 orgs x 2 years) but only their own organization's
  counts (`1`) and no college rows (`0`); OSA sees 36 rows, all 18 proposals
  and 12 college rows (6 colleges x 2 years)
- **Phase 7:** an adviser reads only their own organization's proposals
  (`1 / 0` own vs. other, `0` audit logs); OSA can insert two requirements
  but the officer of one organization sees only theirs (`1 / 0`), and their
  `UPDATE` leaves both titles untouched (`0` hijacked)
- **Phase 8:** a dean sees only their own college's pending steps (and nothing
  outside it); approving *before* the adviser, an OSA jumping the queue, a
  forged `approval_records` insert and an officer editing chain steps are all
  refused (42501 / `0` rows), while the full chain walk
  adviser -> dean -> OSA ends `endorsed / under_review / approved` with
  `0` steps pending; deans can comment where officers cannot, and OSA can
  reorder the proposal chain
- **Phase 1 checkpoint (foundation tables):** zero public tables without RLS;
  an officer sees only their own organization's `accreditation_submissions`
  (`1`), cannot self-approve one (RLS error), while OSA reviews both seeded
  uploads (`approved / rejected`); officers cannot add venues or post
  announcements (RLS error) but OSA can (`1`); expired announcements vanish
  for officers (`0`) and stay visible to OSA (`1`)
- **Phase 9 (spec 3-5):** an overlapping venue booking is refused by the
  `enforce_venue_conflict` trigger on submit (ERROR naming the blocking
  activity) while a non-overlapping slot the same day submits fine, and
  `find_venue_conflicts()` reports the blocking booking for the live form
  warning; the `v_venue_conflicts` register shows the pair to OSA (`1`) but
  not to an officer who cannot see both sides (`0`); a second attachment
  upload supersedes the first (`parent_id`/`version`/`is_active`), the old
  version stays readable (`1`) and downloadable, `v_document_latest` returns
  only the newest (`1`), another org's officer reads neither version (`0`)
  while OSA keeps the full audit trail (`2`)

Expected results in the browser smoke test (`npm run e2e`):

- anonymous visitors are redirected to `/login?next=<destination>` and land back
  on that destination after signing in
- the super admin sees the Administration group, opens `/admin/users` and
  creates an account (service-role path) end-to-end
- officers/advisers never see the Administration or OSA groups, and asking for
  `/admin/users` lands them on `/dashboard?denied=1`
- the OSA admin sees the OSA group, is turned away from `/admin/*`, but can edit
  an organization record (server action + RLS)
- an officer can open `/organizations` but gets no "Edit record" control
- sign out returns to `/login` and the session survives a reload
- an officer creates a proposal (gets a `SOMS-YYYY-NNNN` reference), attaches a
  PDF and submits it; the file is served back through `/api/files/{id}` with a
  signed URL
- the adviser of that organization endorses it (their `/reviews` queue lists
  it first); the dean of the college requests a revision with remarks (OSA is
  turned away while the record rests at the dean step), the officer resubmits
  (`Version 2`), and the chain re-walks adviser -> dean -> OSA until OSA
  approves
- the officer never sees the Approve button or the "My Approvals" nav item,
  OSA never sees `/proposals/new`, the timeline keeps one entry per status
  change, and an approved proposal disappears from `/osa/reviews`
- an officer creates an **accomplishment report** (reference number, linked
  activity picker), attaches a PDF and submits it; the adviser sees
  "Endorse report" and endorses it, the dean clears it (`Under Review`) and
  OSA approves it with remarks - the report then appears in `/reports` while
  OSA is turned away from `/reports/new`
- an officer creates an **other document** (category = Resolution) and submits
  it; OSA starts the review (`Under Review`), approves it, and is turned away
  from `/documents/new`
- **Phase 5:** OSA assigns a requirement to LITS from the dialog; the
  assignment shows up in the table, the LITS president's header bell gets an
  unread badge and the `/notifications` inbox lists the announcement, while the
  officer never sees the "New requirement" button; `GET /api/cron/reminders`
  refuses an unauthenticated caller; `/osa/audit-trail` lists recorded changes
  for OSA and redirects an officer to `/dashboard`
- **Phase 6:** an officer is turned away from `/osa/reports` and gets **403**
  from `/api/exports/summary`; OSA sees all 18 organizations and all 6
  colleges, can switch school years, downloads a real `.xlsx` (PK zip magic)
  and a real `.pdf` (`%PDF-` magic); each role lands on its own dashboard -
  OSA gets "Waiting for your decision" + the budget KPI, the officer gets
  "Your work in progress" and never the OSA queue, the adviser gets
  "Waiting for your endorsement", and the status matrix shows 7 status rows
  with a scope that shrinks from OSA (28) to a single organization (4)
- **Phase 8:** the OSA opens `/osa/approval-chains`, edits the proposal chain's
  last step and saves it, then restores the original sequence; the adviser and
  dean queues at `/reviews` list the record exactly when it is their step
  (and the officer is turned away from `/reviews`); the dean lands on their
  own dashboard ("Waiting for your approval", college scope) without the OSA
  nav group
- **Phase 9:** the proposal form lists the seeded venues and stays warning-free
  for a free slot; a second proposal double-booking that slot gets the live
  "Venue already booked" warning naming the blocking activity, and its submit
  is refused by the database ("Venue conflict") while the draft can still be
  saved; `/calendar` navigates to the activity month and lists the booking;
  the officer is turned away from `/osa/venues` while OSA sees the venue list
  and the empty conflict register; attaching the same file name again
  supersedes it (`v2` badge), the "History (1)" list shows the previous
  version, and both versions answer **200** from `/api/files/{id}`
- the throwaway account, proposal, conflicting proposal, report, document,
  requirement, attachments, the overwritten `membership_count` and (after a
  failed run) the approval chains are all restored by the cleanup step

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is only used in `src/lib/supabase/admin.ts`
  (guarded by `server-only`), in the user-management server actions, in
  `scripts/seed-users.ts` and in the cleanup helpers of `scripts/e2e-smoke.mjs`.
- Route protection lives in `src/proxy.ts` (session cookie only) and
  `src/lib/auth.ts` (`requireRole()` reads the role from Postgres on every
  request) - the role is never trusted from a cookie or the client.
- Login is rate limited through `check_rate_limit()` in `loginAction`
  (5 attempts / 15 minutes per e-mail address).
- Storage buckets are private (10 MB cap, PDF/DOC/DOCX/XLS/XLSX/JPG/PNG only);
  files are served with short-lived signed URLs created server-side.

## Assumptions made

1. The brief says "19 organizations" but lists 18 - 18 are seeded
   (add a row to `supabase/seed.sql` for the missing one).
2. College/category names are stored exactly as listed (BSIT, Business
   Administration, Social Work, Teacher Education, Hospitality Management,
   College-Wide) - edit them in `supabase/seed.sql` if you want full names.
3. The current school year is **2026-2027** (June 2026 - May 2027).
4. "Other Documents" got their own `other_documents` table (on top of the tables
   listed in the brief) so they can carry a title, status, remarks and a
   reference number like every other module.
5. One adviser **and** one officer (President) account per organization were
   seeded - tell me if you want every officer position instead.
6. Brand colours now follow ACD's official blue (the Pantone 301 family,
   `#004B87`) and the shell/login use a geometric star-and-A school mark
   (`src/components/layout/school-mark.tsx`). The real ACD seal is a
   trademark of the college - drop the image into `src/app/icon.svg` /
   replace the component when the office supplies the file.
7. There is **no separate `comments` table**: the spec's comment thread per
   submission is the `review_logs` rows with `action = 'commented'`
   (written by `add_review_comment()`), so one timeline holds both status
   history and remarks.
8. `accreditation_status` uses the spec's four values
   (`pending`, `accredited`, `conditional`, `not_accredited`); the earlier
   ad-hoc values map `provisional/for_renewal -> conditional` and
   `expired/suspended -> not_accredited`.
9. `v_calendar_events` is a view over `activity_proposals` (allowed by the
   spec) rather than a separate `calendar_events` table - the `/calendar`
   board is built on it.
