// SOMS smoke test: authentication and role-based routing (Phase 2), the
// activity proposal workflow (Phase 3), the accomplishment report + other
// document workflows (Phase 4), notifications, requirements and the audit
// trail (Phase 5), the OSA report screen with its Excel/PDF exports and the
// role-aware dashboards (Phase 6) - create draft, attach a file, submit,
// adviser endorsement, dean approval, OSA decision (Phase 8 approval chains),
// plus the spec checkpoints: venue conflict warning + refusal, the /calendar
// board, the OSA venue manager, and attachment versioning where the previous
// file stays downloadable (Phase 9); then the Phase 7 template library +
// version history, the announcement board with audience targeting, the
// Phase 8 global search box, and the Phase 6 foundation features - the
// accreditation checklist (OSA publishes items, the org uploads, OSA
// approves), the officer-list turnover (officers submit, OSA approves) and
// the school-year archive + one-click rollover - driven through a real
// browser (Microsoft Edge via playwright-core).
//
//   npm run dev            # in one terminal
//   node scripts/e2e-smoke.mjs
//
// Exit code 0 = every check passed. The throwaway records and account created
// by this run are removed at the end.

import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
// No hardcoded fallback on purpose - a known default password in the source
// would be a free account on any deployment seeded from this repo. The run
// script passes --env-file=.env.local, so SEED_PASSWORD comes from there.
const PASSWORD = process.env.SEED_PASSWORD;
if (!PASSWORD) {
  console.error('SEED_PASSWORD is not set - add it to .env.local (see .env.example).');
  process.exit(1);
}

/** E-mail of the throwaway account created by this run (removed at the end). */
let createdEmail = null;

/** Phase 3 throwaway proposal (removed at the end). */
let smokeTitle = null;
let smokeProposalUrl = null;

/** Phase 9 throwaway proposal that double-books the venue (removed at the end). */
let smokeConflictTitle = null;

/** Phase 4 throwaway accomplishment report (removed at the end). */
let smokeReportTitle = null;
let smokeReportUrl = null;

/** Phase 4 throwaway other document (removed at the end). */
let smokeDocumentTitle = null;
let smokeDocumentUrl = null;

/** Phase 5 throwaway requirement (removed at the end). */
let smokeRequirementTitle = null;

/** Phase 7 throwaway template + announcement (removed at the end). */
const SMOKE_TEMPLATE_NAME = 'Smoke Template';
const SMOKE_ANNOUNCEMENT_TITLE = 'Smoke Bulletin';

/** Phase 6 throwaway checklist item + past school year (removed at the end). */
const SMOKE_ACCREDITATION_ITEM = 'Smoke Checklist Item';
const SMOKE_PAST_YEAR = '1998-1999';

/** Original A Squad membership figure (the org edit check overwrites it). */
let organizationMembership = null;

/**
 * Every throwaway record this run creates (the report is removed first because
 * nothing references it; a proposal may still be linked from a report).
 */
const SMOKE_MODULES = [
  {
    table: 'accomplishment_reports',
    recordType: 'accomplishment_report',
    noun: 'report',
    title: () => smokeReportTitle,
  },
  {
    table: 'other_documents',
    recordType: 'other_document',
    noun: 'document',
    title: () => smokeDocumentTitle,
  },
  {
    table: 'activity_proposals',
    recordType: 'activity_proposal',
    noun: 'proposal',
    title: () => smokeTitle,
  },
  {
    table: 'activity_proposals',
    recordType: 'activity_proposal',
    noun: 'conflicting proposal',
    title: () => smokeConflictTitle,
  },
];

let failures = 0;
function check(name, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

async function signIn(page, email, next) {
  // One run signs the same accounts in several times, and the brute-force
  // guard counts every attempt - clear it so the script never trips it.
  await clearLoginRateLimits();

  // The form action only exists after React hydrates, so the first click can
  // arrive too early (the browser then just reloads /login). Retry until the
  // client posts a Server Action.
  const loginUrl = next
    ? `${BASE}/login?next=${encodeURIComponent(next)}`
    : `${BASE}/login`;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', PASSWORD);

    const posted = page
      .waitForRequest(
        (request) => request.method() === 'POST' && request.url().includes('/login'),
        { timeout: 5000 }
      )
      .catch(() => null);

    await page.click('button[type="submit"]');

    if (await posted) {
      await page.waitForURL(
        (url) => !url.pathname.startsWith('/login'),
        { timeout: 30000 }
      );
      await page.waitForLoadState('networkidle');
      return;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`Could not sign in as ${email}`);
}

async function signOut(page, context) {
  // The dropdown is a client component and can be inert after a server-action
  // redirect (e.g. the school-year rollover). Prefer the menu, but fall back
  // to clearing the session cookie directly - the proxy only trusts the
  // cookie, so this is a real sign-out, not a shortcut around auth.
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (page.url().startsWith(`${BASE}/login`)) return;

    await page
      .getByTestId('user-menu-trigger')
      .click()
      .catch(() => null);

    const signOutItem = page.getByRole('menuitem', { name: 'Sign out' });
    if (await signOutItem.count()) {
      await signOutItem.click().catch(() => null);
      try {
        await page.waitForURL('**/login', { timeout: 15000 });
        return;
      } catch {
        // The click may have been swallowed; try again.
      }
    } else {
      await page.keyboard.press('Escape').catch(() => null);
      await page.waitForTimeout(500);
    }
  }

  // Fallback: drop the session cookie and land on the login screen.
  await context.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  if (!page.url().startsWith(`${BASE}/login`)) {
    throw new Error(`Could not sign out (still on ${page.url()})`);
  }
}

/**
 * E-mail of the dean of whichever college the organization belongs to
 * (seed: dean.<collegecode-lowercase>@acd.edu.ph).
 */
async function deanEmailForOrg(orgCode) {
  const admin = await adminClient();
  if (!admin) throw new Error('service-role client unavailable (check .env.local)');
  const { data, error } = await admin
    .from('organizations')
    .select('colleges(code)')
    .eq('code', orgCode)
    .maybeSingle();
  const code = data?.colleges?.code;
  if (error || !code) {
    throw new Error(`Could not resolve the college of ${orgCode}: ${error?.message}`);
  }
  return `dean.${code.toLowerCase()}@acd.edu.ph`;
}

/** Reads the status out of the "Workflow status" card on a proposal page. */
async function currentStatus(target) {
  const text = await target.locator('main').innerText();
  const match = text.match(/Current status\s+([A-Za-z ]+)/);
  return match ? match[1].trim() : null;
}

/** Waits until the detail page reports the expected status. */
async function waitForStatus(target, expected) {
  await target.waitForFunction(
    (value) => {
      const main = document.querySelector('main');
      return !!main && new RegExp(`Current status\\s+${value}`, 'i').test(main.innerText);
    },
    expected,
    { timeout: 30000 }
  );
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await captureOrganizationMembership();

  // ---- 1. proxy: no session => /login --------------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  check(
    'anonymous /dashboard redirects to /login',
    page.url().startsWith(`${BASE}/login`),
    page.url()
  );

  // ---- 2. super admin -------------------------------------------------------
  await signIn(page, 'its.admin@acd.edu.ph', '/admin/school-years');
  check(
    'login honours ?next= and returns to the requested page',
    page.url().includes('/admin/school-years'),
    page.url()
  );

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check('super admin lands on /dashboard', page.url().includes('/dashboard'), page.url());
  check(
    'greeting rendered',
    (await page.locator('h1').first().textContent())?.includes('Good') ?? false
  );
  check(
    'Administration nav group visible',
    (await page.locator('text=Administration').count()) > 0
  );

  await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
  check('super admin can open /admin/users', page.url().includes('/admin/users'));
  const userRows = await page.locator('table tbody tr').count();
  check('user table lists seeded accounts', userRows >= 30, `${userRows} rows`);

  // create a throwaway account end-to-end (server action + service role)
  await page.getByRole('button', { name: 'New account' }).click();
  await page.locator('[role="dialog"] input[name="full_name"]').fill('Smoke Test User');
  createdEmail = `smoke.test.${Date.now()}@acd.edu.ph`;
  await page
    .locator('[role="dialog"] input[name="email"]')
    .fill(createdEmail);
  await page.locator('[role="dialog"] input[name="password"]').fill(PASSWORD);
  await page.locator('[role="dialog"] input[name="position"]').fill('Tester');
  // officers must be attached to an organization (zod superRefine)
  await page.locator('[role="dialog"]').getByRole('combobox').nth(1).click();
  await page.getByRole('option').filter({ hasText: 'LITS' }).first().click();
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  check(
    'created account appears in the table',
    (await page.locator('table tbody tr', { hasText: 'Smoke Test User' }).count()) > 0
  );

  // ---- 3. organization record (OSA edit through a server action) ------------
  await page.goto(`${BASE}/organizations`, { waitUntil: 'networkidle' });
  const orgRows = await page.locator('table tbody tr').count();
  check('organization table lists all 18 orgs', orgRows === 18, `${orgRows} rows`);

  await page.locator('table tbody tr a').first().click();
  await page.waitForURL('**/organizations/**');
  await page.waitForLoadState('networkidle');
  check('organization detail opened', page.url().includes('/organizations/'));
  check(
    'officers card rendered',
    (await page.getByText('Officers').count()) > 0
  );

  await page.getByRole('button', { name: 'Edit record' }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await dialog.locator('input[name="membership_count"]').fill('123');
  await dialog.locator('button[type="submit"]').click();
  await dialog.waitFor({ state: 'detached', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const detailText = await page.locator('main').innerText();
  check(
    'organization update saved',
    /Members\s*123/.test(detailText),
    detailText.match(/Members[^\n]*/)?.[0]
  );

  await signOut(page, context);
  check('sign out returns to /login', page.url().startsWith(`${BASE}/login`));

  // ---- 4. officer: no admin nav, admin route blocked ------------------------
  await signIn(page, 'president.lits@acd.edu.ph');
  check('officer lands on /dashboard', page.url().includes('/dashboard'));
  check(
    'officer does not see Administration group',
    (await page.locator('text=Administration').count()) === 0
  );
  check(
    'officer does not see Review Queue',
    (await page.locator('text=Review Queue').count()) === 0
  );
  check(
    'officer does not see My Approvals',
    (await page.locator('text=My Approvals').count()) === 0
  );

  await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
  check(
    'officer opening /admin/users is turned away',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' });
  check(
    'officer opening /reviews is turned away',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(`${BASE}/organizations`, { waitUntil: 'networkidle' });
  check('officer can open /organizations', page.url().includes('/organizations'));
  await page.locator('table tbody tr a').first().click();
  await page.waitForURL(/\/organizations\/[0-9a-f-]{36}/);
  await page.waitForLoadState('networkidle');
  check(
    'officer cannot edit organization records',
    (await page.getByRole('button', { name: 'Edit record' }).count()) === 0
  );

  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  check('officer can open /profile', page.url().includes('/profile'));
  check(
    'profile shows the signed-in e-mail',
    (await page.locator('text=president.lits@acd.edu.ph').count()) > 0
  );
  check(
    'profile offers a password change form',
    (await page.locator('text=New password').count()) > 0
  );

  await signOut(page, context);

  // ---- 5. OSA admin: review queue + edit rights -----------------------------
  await signIn(page, 'osa.admin@acd.edu.ph');
  check(
    'OSA admin sees the OSA nav group',
    (await page.locator('text=Office of Student Affairs').count()) > 0
  );
  check(
    'OSA admin does not see Administration',
    (await page.locator('text=Administration').count()) === 0
  );

  await page.goto(`${BASE}/admin/school-years`, { waitUntil: 'networkidle' });
  check(
    'OSA admin cannot open /admin/school-years',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(`${BASE}/organizations`, { waitUntil: 'networkidle' });
  await page.locator('table tbody tr a').first().click();
  await page.waitForURL(/\/organizations\/[0-9a-f-]{36}/);
  await page.waitForLoadState('networkidle');
  check(
    'OSA admin can edit organization records',
    (await page.getByRole('button', { name: 'Edit record' }).count()) > 0
  );

  // Phase 8: the OSA maintains the four configurable approval chains
  await page.goto(`${BASE}/osa/approval-chains`, { waitUntil: 'networkidle' });
  check(
    'OSA can open /osa/approval-chains',
    page.url().includes('/osa/approval-chains'),
    page.url()
  );
  const chainSaveButtons = await page
    .getByRole('button', { name: 'Save chain' })
    .count();
  check(
    'chain editor lists every configured chain',
    chainSaveButtons === 4,
    `${chainSaveButtons} chains`
  );
  check(
    'proposal chain shows the full sequence',
    (await page.locator('main').innerText()).includes('Adviser → Dean → OSA')
  );

  // flip the proposal chain's last step to Dean and save (server action)
  await page
    .getByRole('combobox', { name: 'Step 3 role' })
    .first()
    .click();
  await page.getByRole('option', { name: 'Dean' }).first().click();
  await page.getByRole('button', { name: 'Save chain' }).first().click();
  await page.waitForFunction(
    () =>
      (document.querySelector('main')?.innerText ?? '').includes(
        'Adviser → Dean → Dean'
      ),
    null,
    { timeout: 30000 }
  );
  check('chain editor saved the edited step', true);

  // restore the original sequence so later submissions follow the seed chain
  await page
    .getByRole('combobox', { name: 'Step 3 role' })
    .first()
    .click();
  await page.getByRole('option', { name: 'OSA' }).first().click();
  await page.getByRole('button', { name: 'Save chain' }).first().click();
  await page.waitForFunction(
    () =>
      (document.querySelector('main')?.innerText ?? '').includes(
        'Adviser → Dean → OSA'
      ),
    null,
    { timeout: 30000 }
  );
  check('chain editor restored the original sequence', true);

  // ---- 6. session survives a fresh page load --------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check('session persists across reloads', page.url().includes('/dashboard'));

  // ---- 7. officer creates a draft, attaches a file, submits ----------------
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');

  await page.goto(`${BASE}/proposals`, { waitUntil: 'networkidle' });
  check(
    'officer sees the proposals list',
    (await page.locator('table tbody tr').count()) > 0
  );
  check(
    'officer sees the New proposal button',
    (await page.getByRole('link', { name: 'New proposal' }).count()) === 1
  );

  smokeTitle = `SOMS E2E Smoke Proposal ${Date.now()}`;
  await page.getByRole('link', { name: 'New proposal' }).click();
  await page.waitForURL('**/proposals/new');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="title"]').fill(smokeTitle);
  // Phase 4: pick the canonical venue (conflict-checked) instead of free text.
  const coveredCourtId = await page
    .locator('select[name="venue_id"] option', { hasText: 'Covered Court' })
    .first()
    .getAttribute('value');
  check(
    'proposal form lists the seeded venues',
    Boolean(coveredCourtId),
    coveredCourtId ?? 'option not found'
  );
  await page.selectOption('select[name="venue_id"]', coveredCourtId);
  await page.locator('input[name="activity_date"]').fill('2026-11-20');
  await page.locator('input[name="start_time"]').fill('13:00');
  await page.locator('input[name="end_time"]').fill('17:00');
  await page.locator('input[name="participants_count"]').fill('120');
  await page.locator('input[name="budget"]').fill('15000');
  await page.locator('input[name="source_of_funds"]').fill('Activity fees');
  await page.locator('textarea[name="description"]').fill(
    'End-to-end smoke test activity created by the Phase 3 browser test.'
  );
  await page.locator('textarea[name="objectives"]').fill(
    'Prove the draft -> submit -> endorse -> review -> approve path works.'
  );
  await page.waitForTimeout(600); // debounce of the live conflict lookup
  check(
    'free slot shows no venue conflict warning',
    (await page.locator('text=Venue already booked').count()) === 0
  );

  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/proposals\/[0-9a-f-]{36}$/, { timeout: 30000 });
  smokeProposalUrl = page.url();
  await page.waitForLoadState('networkidle');

  const draftText = await page.locator('main').innerText();
  check(
    'new proposal received a reference number',
    /SOMS-\d{4}-\d{4}/.test(draftText),
    draftText.match(/SOMS-\d{4}-\d{4}/)?.[0]
  );
  check(
    'new proposal starts as Draft',
    (await currentStatus(page)) === 'Draft',
    await currentStatus(page)
  );

  // attachment: storage upload + documents row + signed URL route
  await page.setInputFiles('input[type="file"]', {
    name: 'program.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% SOMS phase 3 smoke test\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Attach' }).click();
  await page.waitForSelector('a[href^="/api/files/"]', { timeout: 30000 });
  check(
    'attachment listed after upload',
    (await page.locator('a[href^="/api/files/"]').count()) === 1
  );

  const fileHref = await page
    .locator('a[href^="/api/files/"]')
    .first()
    .getAttribute('href');
  const fileResponse = await page.request.get(`${BASE}${fileHref}`);
  check(
    'attachment is served through a signed URL',
    fileResponse.status() === 200,
    `status ${fileResponse.status()}`
  );

  // Phase 5: the same file name supersedes as version 2; the old version
  // keeps its row, its storage object and its download link.
  await page.setInputFiles('ul li input[type="file"]', {
    name: 'program.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% SOMS phase 9 version 2 smoke test\n%%EOF\n'),
  });
  await page.waitForSelector('text=v2', { timeout: 30000 });
  check(
    'superseded attachment shows the v2 badge',
    (await page.locator('text=v2').count()) >= 1
  );
  await page.getByRole('button', { name: /History \(1\)/ }).click();
  check(
    'attachment history lists the previous version',
    (await page.locator('text=v1 · program.pdf').count()) === 1
  );
  const versionHrefs = await page
    .locator('a[href^="/api/files/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  check(
    'current and previous versions are both listed',
    versionHrefs.length === 2,
    `${versionHrefs.length} file links`
  );
  let previousVersionDownloadable = true;
  for (const href of versionHrefs) {
    const versionResponse = await page.request.get(`${BASE}${href}`);
    if (versionResponse.status() !== 200) previousVersionDownloadable = false;
  }
  check(
    'previous version stays downloadable',
    previousVersionDownloadable
  );

  await page.getByRole('button', { name: 'Submit for review' }).click();
  await waitForStatus(page, 'Submitted');
  check(
    'officer submission moved to Submitted',
    (await currentStatus(page)) === 'Submitted',
    await currentStatus(page)
  );
  check(
    'officer never sees the Approve action',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0
  );

  // ---- 7b. overlapping venue booking: warned, then refused ----------------
  smokeConflictTitle = `${smokeTitle} (double booking)`;
  await page.goto(`${BASE}/proposals/new`, { waitUntil: 'networkidle' });
  await page.locator('input[name="title"]').fill(smokeConflictTitle);
  await page.selectOption('select[name="venue_id"]', coveredCourtId);
  await page.locator('input[name="activity_date"]').fill('2026-11-20');
  await page.locator('input[name="start_time"]').fill('14:00');
  await page.locator('input[name="end_time"]').fill('16:00');
  await page.locator('input[name="participants_count"]').fill('50');
  await page.locator('input[name="budget"]').fill('1000');
  await page.locator('input[name="source_of_funds"]').fill('Activity fees');
  await page.waitForSelector('text=Venue already booked', { timeout: 15000 });
  check(
    'live conflict warning names the blocking activity',
    (await page.locator('main').innerText()).includes(smokeTitle)
  );

  // Drafts are allowed to be saved - the database refuses only the submit.
  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/proposals\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.waitForSelector('text=Venue conflict', { timeout: 30000 });
  check('overlapping submit is refused by the server', true);
  check(
    'conflicting proposal stays a draft',
    (await currentStatus(page)) === 'Draft',
    await currentStatus(page)
  );

  // ---- 7c. calendar shows the booking --------------------------------------
  await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' });
  check('officer can open /calendar', page.url().includes('/calendar'));
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.waitForTimeout(200);
  const calendarText = await page.locator('main').innerText();
  check(
    'calendar navigates to the activity month',
    calendarText.includes('November 2026')
  );
  check(
    'calendar lists the booked activity',
    calendarText.includes(smokeTitle)
  );
  await page.goto(`${BASE}/osa/venues`, { waitUntil: 'networkidle' });
  check(
    'officer is turned away from /osa/venues',
    page.url().includes('/dashboard'),
    page.url()
  );

  // ---- 8. adviser endorses --------------------------------------------------
  await signOut(page, context);
  const deanLitsEmail = await deanEmailForOrg('LITS');
  await signIn(page, 'adviser.lits@acd.edu.ph');

  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' });
  check(
    'adviser approval queue lists the submitted proposal',
    (await page.locator('table tbody tr', { hasText: smokeTitle }).count()) === 1
  );
  check(
    'adviser sees the My Approvals nav item',
    (await page.locator('text=My Approvals').count()) > 0
  );

  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });

  check(
    'adviser sees the submitted proposal',
    (await currentStatus(page)) === 'Submitted',
    await currentStatus(page)
  );
  check(
    'workflow card names the waiting approver',
    /Waiting on\s+Adviser/.test(await page.locator('main').innerText())
  );
  check(
    'adviser sees the Endorse action',
    (await page.getByRole('button', { name: 'Endorse proposal' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Endorse proposal' }).click();
  await waitForStatus(page, 'Endorsed');
  check(
    'adviser endorsement recorded',
    (await currentStatus(page)) === 'Endorsed',
    await currentStatus(page)
  );

  // ---- 9. dean requests a revision, officer resubmits, full chain re-walk ---
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');

  await page.goto(`${BASE}/proposals/new`, { waitUntil: 'domcontentloaded' });
  check(
    'OSA cannot open /proposals/new',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(`${BASE}/osa/reviews`, { waitUntil: 'networkidle' });
  check(
    'review queue skips a proposal resting at the dean step',
    (await page.locator('table tbody tr', { hasText: smokeTitle }).count()) === 0
  );

  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  check(
    'OSA has no decision buttons at the dean step',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Request revision' }).count()) === 0
  );

  await signOut(page, context);
  await signIn(page, deanLitsEmail);

  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' });
  check(
    'dean approval queue lists the endorsed proposal',
    (await page.locator('table tbody tr', { hasText: smokeTitle }).count()) === 1
  );
  check(
    'dean sees the My Approvals nav item',
    (await page.locator('text=My Approvals').count()) > 0
  );

  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  await page.locator('#remarks').fill('Please attach the venue contract.');
  await page.getByRole('button', { name: 'Request revision' }).click();
  await waitForStatus(page, 'Revision Requested');
  check(
    'dean revision request recorded',
    (await currentStatus(page)) === 'Revision Requested',
    await currentStatus(page)
  );
  check(
    'reviewer remarks are shown on the proposal',
    (await page.locator('main').innerText()).includes('Please attach the venue contract.')
  );

  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  await page.locator('#remarks').fill('Contract scanned - resubmitting.');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await waitForStatus(page, 'Submitted');
  check(
    'resubmission bumps the document version',
    (await page.locator('main').innerText()).includes('Version 2')
  );
  check(
    'officer still cannot approve',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0
  );

  // the chain restarts: adviser re-endorses after the resubmission
  await signOut(page, context);
  await signIn(page, 'adviser.lits@acd.edu.ph');
  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  check(
    'adviser sees the Endorse action again after resubmission',
    (await page.getByRole('button', { name: 'Endorse proposal' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Endorse proposal' }).click();
  await waitForStatus(page, 'Endorsed');
  check(
    'adviser re-endorsement recorded',
    (await currentStatus(page)) === 'Endorsed',
    await currentStatus(page)
  );

  // then the dean clears it so it finally reaches the OSA step
  await signOut(page, context);
  await signIn(page, deanLitsEmail);
  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  check(
    'dean sees the Approve action at the dean step',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 1
  );
  await page.locator('#remarks').fill('Cleared after resubmission.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await waitForStatus(page, 'Under Review');
  check(
    'dean approval recorded',
    (await currentStatus(page)) === 'Under Review',
    await currentStatus(page)
  );

  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/osa/reviews`, { waitUntil: 'networkidle' });
  check(
    'review queue lists the waiting proposal',
    (await page.locator('table tbody tr', { hasText: smokeTitle }).count()) === 1
  );

  await page.goto(smokeProposalUrl, { waitUntil: 'networkidle' });
  await page.locator('#remarks').fill('Approved for the semester calendar.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await waitForStatus(page, 'Approved');

  const finalText = await page.locator('main').innerText();
  check(
    'proposal approved by OSA',
    (await currentStatus(page)) === 'Approved',
    await currentStatus(page)
  );
  check(
    'review timeline keeps the full history',
    /Revision requested/.test(finalText) && /Approved/.test(finalText)
  );
  check(
    'timeline has one entry per status change',
    (await page.locator('main ol li').count()) >= 4,
    `${await page.locator('main ol li').count()} entries`
  );

  await page.goto(`${BASE}/osa/reviews`, { waitUntil: 'networkidle' });
  check(
    'approved proposal leaves the review queue',
    (await page.locator('table tbody tr', { hasText: smokeTitle }).count()) === 0
  );

  // Phase 4: the OSA venue manager and conflict register.
  await page.goto(`${BASE}/osa/venues`, { waitUntil: 'networkidle' });
  const venuesText = await page.locator('main').innerText();
  check(
    'OSA can open the venue manager',
    venuesText.includes('Venue list') && venuesText.includes('Booking conflicts')
  );
  check(
    'venue manager lists the seeded venues',
    venuesText.includes('Covered Court')
  );
  check(
    'conflict register has no pairs while only one booking is live',
    venuesText.includes('No overlapping bookings')
  );

  // ---- 10. officer: accomplishment report workflow --------------------------
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');

  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  check(
    'officer sees the New report button',
    (await page.getByRole('link', { name: 'New report' }).count()) === 1
  );

  smokeReportTitle = `SOMS E2E Smoke Report ${Date.now()}`;
  await page.getByRole('link', { name: 'New report' }).click();
  await page.waitForURL('**/reports/new');
  await page.waitForLoadState('networkidle');
  check(
    'linked activity picker rendered on /reports/new',
    (await page.locator('select[name="proposal_id"]').count()) === 1
  );

  await page.locator('input[name="title"]').fill(smokeReportTitle);
  await page.locator('input[name="attendance_count"]').fill('95');
  await page.locator('input[name="budget_spent"]').fill('4800');
  await page.locator('textarea[name="summary"]').fill(
    'End-to-end smoke test accomplishment report.'
  );
  await page.locator('textarea[name="outcomes"]').fill(
    'Phase 4 workflow covered by the browser test.'
  );
  await page.locator('textarea[name="liquidation_summary"]').fill('Receipts on file.');

  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 30000 });
  smokeReportUrl = page.url();
  await page.waitForLoadState('networkidle');

  const reportDraftText = await page.locator('main').innerText();
  check(
    'new report received a reference number',
    /SOMS-\d{4}-\d{4}/.test(reportDraftText),
    reportDraftText.match(/SOMS-\d{4}-\d{4}/)?.[0]
  );
  check(
    'new report starts as Draft',
    (await currentStatus(page)) === 'Draft',
    await currentStatus(page)
  );

  await page.setInputFiles('input[type="file"]', {
    name: 'liquidation.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% SOMS phase 4 smoke test\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Attach' }).click();
  await page.waitForSelector('a[href^="/api/files/"]', { timeout: 30000 });
  check(
    'report attachment listed after upload',
    (await page.locator('a[href^="/api/files/"]').count()) === 1
  );

  await page.getByRole('button', { name: 'Submit for review' }).click();
  await waitForStatus(page, 'Submitted');
  check(
    'report submission moved to Submitted',
    (await currentStatus(page)) === 'Submitted',
    await currentStatus(page)
  );
  check(
    'officer never sees Approve on a report',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0
  );

  // ---- 11. adviser endorses, dean clears, OSA approves the report ----------
  await signOut(page, context);
  await signIn(page, 'adviser.lits@acd.edu.ph');
  await page.goto(smokeReportUrl, { waitUntil: 'networkidle' });

  check(
    'adviser sees the Endorse report action',
    (await page.getByRole('button', { name: 'Endorse report' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Endorse report' }).click();
  await waitForStatus(page, 'Endorsed');
  check(
    'adviser endorsement recorded for the report',
    (await currentStatus(page)) === 'Endorsed',
    await currentStatus(page)
  );

  await signOut(page, context);
  await signIn(page, deanLitsEmail);
  await page.goto(smokeReportUrl, { waitUntil: 'networkidle' });
  check(
    'dean sees the Approve action on the report',
    (await page.getByRole('button', { name: 'Approve' }).count()) === 1
  );
  await page.locator('#remarks').fill('Cleared by the dean.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await waitForStatus(page, 'Under Review');
  check(
    'dean approval recorded for the report',
    (await currentStatus(page)) === 'Under Review',
    await currentStatus(page)
  );

  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');

  await page.goto(`${BASE}/reports/new`, { waitUntil: 'domcontentloaded' });
  check(
    'OSA cannot open /reports/new',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(smokeReportUrl, { waitUntil: 'networkidle' });
  await page.locator('#remarks').fill('Liquidation checked against the receipts.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await waitForStatus(page, 'Approved');
  check(
    'report approved by OSA',
    (await currentStatus(page)) === 'Approved',
    await currentStatus(page)
  );
  check(
    'report timeline records the workflow',
    (await page.locator('main ol li').count()) >= 3,
    `${await page.locator('main ol li').count()} entries`
  );

  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  check(
    'approved report appears in the reports list',
    (await page.locator('table tbody tr', { hasText: smokeReportTitle }).count()) === 1
  );

  // ---- 12. officer creates and submits an other document --------------------
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');

  await page.goto(`${BASE}/documents`, { waitUntil: 'networkidle' });
  check(
    'officer sees the New document button',
    (await page.getByRole('link', { name: 'New document' }).count()) === 1
  );

  smokeDocumentTitle = `SOMS E2E Smoke Document ${Date.now()}`;
  await page.getByRole('link', { name: 'New document' }).click();
  await page.waitForURL('**/documents/new');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="title"]').fill(smokeDocumentTitle);
  await page.locator('select[name="category"]').selectOption('resolution');
  await page.locator('textarea[name="description"]').fill(
    'End-to-end smoke test governed document.'
  );

  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 30000 });
  smokeDocumentUrl = page.url();
  await page.waitForLoadState('networkidle');

  const documentDraftText = await page.locator('main').innerText();
  check(
    'new document received a reference number',
    /SOMS-\d{4}-\d{4}/.test(documentDraftText),
    documentDraftText.match(/SOMS-\d{4}-\d{4}/)?.[0]
  );
  check(
    'new document starts as Draft',
    (await currentStatus(page)) === 'Draft',
    await currentStatus(page)
  );
  check(
    'document category rendered on the detail page',
    documentDraftText.includes('Resolution')
  );

  await page.getByRole('button', { name: 'Submit for review' }).click();
  await waitForStatus(page, 'Submitted');
  check(
    'document submission moved to Submitted',
    (await currentStatus(page)) === 'Submitted',
    await currentStatus(page)
  );

  // ---- 13. OSA starts the review and approves the document ------------------
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');

  await page.goto(`${BASE}/documents/new`, { waitUntil: 'domcontentloaded' });
  check(
    'OSA cannot open /documents/new',
    page.url().includes('/dashboard'),
    page.url()
  );

  await page.goto(smokeDocumentUrl, { waitUntil: 'networkidle' });
  check(
    'OSA sees the Start review action on the document',
    (await page.getByRole('button', { name: 'Start review' }).count()) === 1
  );
  await page.getByRole('button', { name: 'Start review' }).click();
  await waitForStatus(page, 'Under Review');
  check(
    'OSA review started for the document',
    (await currentStatus(page)) === 'Under Review',
    await currentStatus(page)
  );

  await page.locator('#remarks').fill('Approved for filing with the OSA records.');
  await page.getByRole('button', { name: 'Approve' }).click();
  await waitForStatus(page, 'Approved');
  check(
    'document approved by OSA',
    (await currentStatus(page)) === 'Approved',
    await currentStatus(page)
  );

  // ---- 14. OSA assigns a requirement (notify + audit trail viewer) ----------
  await page.goto(`${BASE}/requirements`, { waitUntil: 'networkidle' });
  check('OSA can open /requirements', page.url().includes('/requirements'));
  check(
    'OSA sees the New requirement button',
    (await page.getByRole('button', { name: 'New requirement' }).count()) === 1
  );

  await page.getByRole('button', { name: 'New requirement' }).click();
  const reqDialog = page.locator('[role="dialog"]');
  await reqDialog.waitFor({ state: 'visible', timeout: 15000 });
  smokeRequirementTitle = `Smoke requirement ${Date.now()}`;
  await reqDialog.locator('input[name="title"]').fill(smokeRequirementTitle);
  await reqDialog
    .locator('textarea[name="description"]')
    .fill('Phase 5 browser test requirement.');
  await reqDialog.getByRole('combobox').click();
  await page.getByRole('option').filter({ hasText: 'LITS' }).first().click();
  await reqDialog.locator('button[type="submit"]').click();
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  check(
    'assigned requirement appears in the table',
    (await page.locator('table tbody tr', { hasText: smokeRequirementTitle }).count()) > 0
  );

  const cronResponse = await page.request.get(`${BASE}/api/cron/reminders`);
  check(
    'cron reminders route rejects an unauthenticated caller',
    cronResponse.status() !== 200,
    `status ${cronResponse.status()}`
  );

  await page.goto(`${BASE}/osa/audit-trail`, { waitUntil: 'networkidle' });
  check('OSA can open /osa/audit-trail', page.url().includes('/osa/audit-trail'));
  const auditRows = await page.locator('table tbody tr').count();
  check('audit trail lists recorded changes', auditRows > 0, `${auditRows} rows`);

  // ---- 15. officer sees the requirement + the notification it produced ------
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');

  await page.goto(`${BASE}/requirements`, { waitUntil: 'networkidle' });
  check('officer can open /requirements', page.url().includes('/requirements'));
  check(
    'officer sees the assigned requirement',
    (await page.locator('table tbody tr', { hasText: smokeRequirementTitle }).count()) > 0
  );
  check(
    'officer does NOT see the New requirement button',
    (await page.getByRole('button', { name: 'New requirement' }).count()) === 0
  );
  check(
    'officer has an unread notification badge',
    (await page.locator('header button[aria-label^="Notifications"]').count()) > 0
  );

  await page.locator('header button[aria-label^="Notifications"]').first().click();
  await page.waitForTimeout(1000);
  check(
    'notification bell lists the requirement announcement',
    (await page.locator('[role="menu"] a', { hasText: 'New requirement' }).count()) > 0
  );
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle' });
  check('officer can open /notifications', page.url().includes('/notifications'));
  check(
    'inbox lists the requirement announcement',
    (await page.locator('main a', { hasText: 'New requirement' }).count()) > 0
  );

  await page.goto(`${BASE}/osa/audit-trail`, { waitUntil: 'networkidle' });
  check(
    'officer is turned away from /osa/audit-trail',
    page.url().includes('/dashboard'),
    page.url()
  );

  // ---- 16. Phase 6 - report screen and Excel/PDF exports -------------------
  // Section 15 leaves the browser signed in as a LITS officer, so the two
  // access checks come first and only one sign-in switch is needed.
  await page.goto(`${BASE}/osa/reports`, { waitUntil: 'networkidle' });
  check(
    'officer is turned away from /osa/reports',
    page.url().includes('/dashboard'),
    page.url()
  );

  const officerExport = await page.request.get(
    `${BASE}/api/exports/summary?scope=organizations&format=xlsx`
  );
  check(
    'officer cannot download a summary export',
    officerExport.status() === 403,
    `status ${officerExport.status()}`
  );

  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');

  await page.goto(`${BASE}/osa/reports`, { waitUntil: 'networkidle' });
  check('OSA can open /osa/reports', page.url().includes('/osa/reports'), page.url());

  const reportTables = page.locator('main table');
  const organizationRows = await reportTables.first().locator('tbody tr').count();
  check(
    'organization summary lists all 18 organizations',
    organizationRows === 18,
    `${organizationRows} rows`
  );
  const collegeRows = await reportTables.nth(1).locator('tbody tr').count();
  check(
    'college summary lists all 6 colleges',
    collegeRows === 6,
    `${collegeRows} rows`
  );

  const yearOptions = page.locator('select[name="year"] option');
  const yearCount = await yearOptions.count();
  check(
    'report screen offers every school year',
    yearCount >= 2,
    `${yearCount} school years`
  );
  if (yearCount >= 2) {
    const previousYear = await yearOptions.nth(1).getAttribute('value');
    await page.goto(`${BASE}/osa/reports?year=${previousYear}`, {
      waitUntil: 'networkidle',
    });
    const previousYearRows = await reportTables
      .first()
      .locator('tbody tr')
      .count();
    check(
      'previous school year still lists all 18 organizations',
      previousYearRows === 18,
      `${previousYearRows} rows`
    );
  }

  const excel = await page.request.get(
    `${BASE}/api/exports/summary?scope=organizations&format=xlsx`
  );
  const excelType = excel.headers()['content-type'] ?? '';
  const excelDisposition = excel.headers()['content-disposition'] ?? '';
  check(
    'Excel export downloads for OSA',
    excel.status() === 200 &&
      excelType.includes('spreadsheet') &&
      excelDisposition.includes('attachment'),
    `status ${excel.status()}, ${excelType}`
  );
  const excelBytes = await excel.body();
  check(
    'Excel export is a real xlsx archive',
    excelBytes.length > 500 && excelBytes[0] === 0x50 && excelBytes[1] === 0x4b,
    `${excelBytes.length} bytes`
  );

  const pdf = await page.request.get(
    `${BASE}/api/exports/summary?scope=colleges&format=pdf`
  );
  const pdfType = pdf.headers()['content-type'] ?? '';
  check(
    'PDF export downloads for OSA',
    pdf.status() === 200 && pdfType.includes('pdf'),
    `status ${pdf.status()}, ${pdfType}`
  );
  const pdfBytes = await pdf.body();
  check(
    'PDF export starts with the %PDF magic bytes',
    pdfBytes.slice(0, 5).toString('latin1') === '%PDF-',
    `${pdfBytes.length} bytes`
  );

  // ---- 17. Phase 6 - role-aware dashboards ---------------------------------
  // Section 16 leaves the browser signed in as the OSA admin.
  /** Scope line ("N records in your scope") off the status matrix card. */
  async function dashboardScope() {
    const text = await page.locator('main').innerText();
    return Number(/(\d+) records in your scope/.exec(text)?.[1] ?? 0);
  }

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  let dashText = await page.locator('main').innerText();
  check(
    'OSA dashboard shows the decision queue section',
    dashText.includes('Waiting for your decision'),
    dashText.match(/Waiting for[^\n]*/)?.[0]
  );
  check(
    'OSA dashboard shows the budget KPI',
    dashText.includes('Approved budget') && dashText.includes('₱'),
    dashText.match(/Approved budget[^\n]*/)?.[0]
  );
  const osaMatrixRows = await page.locator('main table tbody tr').count();
  check(
    'OSA status matrix has one row per workflow status',
    osaMatrixRows === 7,
    `${osaMatrixRows} rows`
  );
  const osaScope = await dashboardScope();
  check(
    'OSA matrix covers every seeded submission',
    osaScope >= 18,
    `${osaScope} records in scope`
  );

  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  dashText = await page.locator('main').innerText();
  check(
    'officer dashboard shows their own work queue',
    dashText.includes('Your work in progress'),
    dashText.match(/Your work[^\n]*/)?.[0]
  );
  check(
    'officer dashboard shows the action KPI',
    dashText.includes('Awaiting my action'),
    dashText.match(/Awaiting my action[^\n]*/)?.[0]
  );
  check(
    'officer dashboard hides the OSA decision queue',
    !dashText.includes('Waiting for your decision')
  );
  const officerScope = await dashboardScope();
  check(
    'officer matrix is scoped to their organization',
    officerScope >= 1 && officerScope < osaScope,
    `${officerScope} records in scope`
  );

  await signOut(page, context);
  await signIn(page, 'adviser.lits@acd.edu.ph');
  dashText = await page.locator('main').innerText();
  check(
    'adviser dashboard shows the endorsement queue',
    dashText.includes('Waiting for your endorsement'),
    dashText.match(/Waiting for[^\n]*/)?.[0]
  );
  check(
    'adviser dashboard counts their organizations',
    dashText.includes('Organizations advised'),
    dashText.match(/Organizations advised[^\n]*/)?.[0]
  );
  const adviserScope = await dashboardScope();
  check(
    'adviser matrix only covers their organizations',
    adviserScope >= 1 && adviserScope <= officerScope,
    `${adviserScope} records in scope`
  );

  await signOut(page, context);
  await signIn(page, deanLitsEmail);
  dashText = await page.locator('main').innerText();
  check(
    'dean dashboard shows the approval queue section',
    dashText.includes('Waiting for your approval'),
    dashText.match(/Waiting for[^\n]*/)?.[0]
  );
  check(
    'dean dashboard shows the action KPI',
    dashText.includes('Awaiting my approval'),
    dashText.match(/Awaiting my approval[^\n]*/)?.[0]
  );
  check(
    'dean dashboard counts the colleges organizations',
    dashText.includes('Organizations in my college'),
    dashText.match(/Organizations in my college[^\n]*/)?.[0]
  );
  check(
    'dean dashboard hides the OSA decision queue',
    !dashText.includes('Waiting for your decision')
  );
  check(
    'dean does not see Administration',
    (await page.locator('text=Administration').count()) === 0
  );
  check(
    'dean does not see the OSA nav items',
    (await page.locator('text=Approval Chains').count()) === 0 &&
      (await page.locator('text=Hardcopy Tracking').count()) === 0
  );
  const deanScope = await dashboardScope();
  check(
    'dean matrix is scoped to their college',
    deanScope >= 1 && deanScope < osaScope,
    `${deanScope} records in scope`
  );

  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' });
  check(
    'dean can open /reviews',
    page.url().includes('/reviews'),
    page.url()
  );

  // ---- 18. Phase 7 - template library ---------------------------------------
  // Section 17 leaves the browser signed in as the dean; OSA manages templates.
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/osa/templates`, { waitUntil: 'networkidle' });
  check(
    'OSA can open the template library',
    (await page.locator('main').innerText()).includes('Template library')
  );

  // Upload the first version of a new template.
  await page.getByRole('button', { name: 'Upload template' }).click();
  await page.fill('#template-name', 'Smoke Template');
  await page.fill('#template-description', 'e2e throwaway template');
  await page.setInputFiles('#template-file', {
    name: 'smoke-template.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% SOMS template smoke v1\n%%EOF\n'),
  });
  const uploadDialog = page.locator('[role="dialog"]');
  await uploadDialog.getByRole('button', { name: 'Upload', exact: true }).click();
  // The dialog closes only after the server action succeeds.
  await uploadDialog.waitFor({ state: 'detached', timeout: 30000 });
  await page.waitForSelector('text=Smoke Template', { timeout: 30000 });
  check(
    'template listed after upload with the v1 badge',
    (await page.locator('text=Smoke Template').count()) >= 1 &&
      (await page.locator('text=v1').count()) >= 1
  );

  const templateHrefs = await page
    .locator('a[href^="/api/templates/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  check(
    'template download link points at /api/templates/',
    templateHrefs.length >= 1,
    `${templateHrefs.length} links`
  );
  const templateResponse = await page.request.get(`${BASE}${templateHrefs[0]}`);
  check(
    'template is served through a signed URL',
    templateResponse.status() === 200,
    `status ${templateResponse.status()}`
  );

  // Supersede with v2 - the old version stays downloadable. Scope every
  // interaction to the Smoke Template group: the seeded template sorts
  // first and has its own "New version" button.
  const smokeGroup = page.locator('div.rounded-lg.border').filter({
    has: page.locator('p', { hasText: /^Smoke Template$/ }),
  });
  await smokeGroup.getByRole('button', { name: 'New version' }).click();
  const replaceDialog = page.locator('[role="dialog"]');
  await replaceDialog.locator('input[type="file"]').setInputFiles({
    name: 'smoke-template.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% SOMS template smoke v2\n%%EOF\n'),
  });
  await replaceDialog.getByRole('button', { name: /^Upload v\d+$/ }).click();
  // The replace dialog closes only after the new version row commits.
  await replaceDialog.waitFor({ state: 'detached', timeout: 30000 });
  // Wait for the revalidated board to show v2 on the Smoke group.
  await page.waitForFunction(() => document.body.innerText.includes('v2'), null, {
    timeout: 15000,
  });
  check(
    'superseded template shows the v2 badge',
    (await smokeGroup.innerText()).includes('v2')
  );
  await smokeGroup.getByRole('button', { name: /History \(1\)/ }).click();
  await page.waitForSelector('text=v1 · smoke-template.pdf', { timeout: 10000 });
  check(
    'template history lists the previous version',
    (await page.locator('text=v1 · smoke-template.pdf').count()) >= 1
  );
  const templateVersionHrefs = await smokeGroup
    .locator('a[href^="/api/templates/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  let templateVersionsDownloadable = true;
  for (const href of new Set(templateVersionHrefs)) {
    const versionResponse = await page.request.get(`${BASE}${href}`);
    if (versionResponse.status() !== 200) templateVersionsDownloadable = false;
  }
  check(
    'previous template version stays downloadable',
    templateVersionsDownloadable && templateVersionHrefs.length >= 2,
    `${templateVersionHrefs.length} file links`
  );

  // The public board shows the active version to every signed-in user.
  await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
  check(
    'public template board lists the new template',
    (await page.locator('main').innerText()).includes('Smoke Template')
  );

  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
  const officerTemplateText = await page.locator('main').innerText();
  check(
    'officer sees the template on the public board',
    officerTemplateText.includes('Smoke Template')
  );
  const officerDownload = await page.request.get(`${BASE}${templateHrefs[0]}`);
  check(
    'officer can download the template',
    officerDownload.status() === 200,
    `status ${officerDownload.status()}`
  );
  await page.goto(`${BASE}/osa/templates`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  check(
    'officer cannot open the OSA template library',
    !page.url().includes('/osa/templates'),
    page.url()
  );

  // ---- 19. Phase 7 - announcement board -------------------------------------
  // Still signed in as the LITS officer - check the seeded announcement first.
  await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
  const officerAnnouncementText = await page.locator('main').innerText();
  check(
    'officer sees the seeded all-community announcement',
    officerAnnouncementText.includes('Accreditation Requirements')
  );
  check(
    'officer does not see the Post announcement button',
    (await page.getByRole('button', { name: 'Post announcement' }).count()) === 0
  );

  // OSA posts an organization-targeted announcement and checks the audience.
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
  check(
    'OSA can open the announcement board',
    (await page.locator('main').innerText()).includes('Announcements')
  );
  await page.getByRole('button', { name: 'Post announcement' }).click();
  await page.fill('#announcement-title', 'Smoke Bulletin');
  await page.fill('#announcement-body', 'e2e throwaway announcement body');
  // Audience -> Organization (Radix Select: click trigger, pick the option).
  const composerDialog = page.locator('[role="dialog"]');
  await composerDialog.locator('[aria-label="Announcement audience"]').click();
  await page.getByRole('option', { name: 'Organization' }).click();
  // Pick LITS once the organization select appears.
  await composerDialog.locator('[aria-label="Target organization"]').waitFor({ timeout: 10000 });
  await composerDialog.locator('[aria-label="Target organization"]').click();
  await page.getByRole('option', { name: /LITS/ }).first().click();
  await composerDialog.getByRole('button', { name: 'Post announcement' }).click();
  // The composer closes only after the announcement + notifications commit.
  await composerDialog.waitFor({ state: 'detached', timeout: 30000 });
  await page.waitForSelector('text=Smoke Bulletin', { timeout: 30000 });
  const postedBoardText = await page.locator('main').innerText();
  check(
    'OSA announcement posted and listed on the board',
    postedBoardText.includes('Smoke Bulletin')
  );
  check(
    'posted announcement carries the Organization audience badge',
    postedBoardText.includes('Smoke Bulletin') && postedBoardText.includes('Organization')
  );

  // LITS officer: sees it + got the in-app notification.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
  check(
    'targeted officer sees the announcement',
    (await page.locator('main').innerText()).includes('Smoke Bulletin')
  );
  await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle' });
  check(
    'targeted officer received the in-app notification',
    (await page.locator('main').innerText()).includes('Smoke Bulletin')
  );

  // AFPHI officer: sees neither the announcement nor the notification.
  await signOut(page, context);
  await signIn(page, 'president.afphi@acd.edu.ph');
  await page.goto(`${BASE}/announcements`, { waitUntil: 'networkidle' });
  check(
    'untargeted officer does not see the announcement',
    !(await page.locator('main').innerText()).includes('Smoke Bulletin')
  );
  await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle' });
  check(
    'untargeted officer did not receive the notification',
    !(await page.locator('main').innerText()).includes('Smoke Bulletin')
  );

  // ---- 20. Phase 8 - global search ------------------------------------------
  // Still signed in as the AFPHI officer; search for a seeded organization.
  await page.goto(`${BASE}/search?q=LITS`, { waitUntil: 'networkidle' });
  const searchLits = await page.locator('main').innerText();
  check(
    'global search finds the LITS organization',
    searchLits.includes('LITS') || /Lightning|LITS/i.test(searchLits),
    searchLits.slice(0, 120)
  );

  await page.goto(`${BASE}/search?q=`, { waitUntil: 'networkidle' });
  check(
    'empty search shows the prompt, not results',
    (await page.locator('main').innerText()).includes('Type at least')
  );

  // The header search box exists for every signed-in user.
  check(
    'header exposes the global search box',
    (await page.locator('header input[type="search"]').count()) >= 1 ||
      (await page.locator('header a[href="/search"]').count()) >= 1
  );

  // Searching for a smoke title the officer cannot see returns nothing.
  await page.goto(`${BASE}/search?q=${encodeURIComponent(smokeTitle ?? 'zzzz')}`, {
    waitUntil: 'networkidle',
  });
  const searchHidden = await page.locator('main').innerText();
  check(
    'global search respects RLS - other-org draft is invisible',
    searchHidden.includes('No matches') ||
      !searchHidden.includes(smokeTitle ?? 'zzzz-nonexistent'),
    searchHidden.slice(0, 120)
  );

  // LITS officer can find their own proposal through global search.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/search?q=${encodeURIComponent(smokeTitle)}`, {
    waitUntil: 'networkidle',
  });
  const searchOwn = await page.locator('main').innerText();
  check(
    'global search finds the officer own proposal',
    searchOwn.includes(smokeTitle),
    searchOwn.slice(0, 120)
  );

  // ---- 21. Phase 6 - accreditation checklist --------------------------------
  // OSA publishes one checklist item for the current school year.
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/osa/accreditation`, { waitUntil: 'networkidle' });
  check(
    'OSA can open the accreditation manager',
    (await page.locator('main').innerText()).includes('Checklist items')
  );
  await page.getByTestId('accreditation-add-item').click();
  const itemDialog = page.locator('[role="dialog"]');
  await itemDialog.waitFor({ state: 'visible', timeout: 15000 });
  await itemDialog.locator('#item-title-create').fill(SMOKE_ACCREDITATION_ITEM);
  await itemDialog.locator('#item-description-create').fill('e2e throwaway checklist item');
  await itemDialog.getByRole('button', { name: 'Add item' }).click();
  // The dialog closes only after the insert commits.
  await itemDialog.waitFor({ state: 'detached', timeout: 30000 });
  await page.waitForSelector(`text=${SMOKE_ACCREDITATION_ITEM}`, { timeout: 30000 });
  check(
    'checklist item listed on the OSA manager',
    (await page.locator('main').innerText()).includes(SMOKE_ACCREDITATION_ITEM)
  );

  // LITS officer uploads a file for the item.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/accreditation`, { waitUntil: 'networkidle' });
  const checklistText = await page.locator('main').innerText();
  check(
    'officer sees the published checklist item',
    checklistText.includes(SMOKE_ACCREDITATION_ITEM)
  );
  // Scope every locator by the item's own testid, never a shared button name.
  const itemId = (await page.locator('[data-testid^="accreditation-file-"]').first().getAttribute('data-testid'))
    ?.replace('accreditation-file-', '');
  check('checklist upload control rendered', Boolean(itemId), itemId ?? 'missing');
  if (itemId) {
    await page.setInputFiles(`[data-testid="accreditation-file-${itemId}"]`, {
      name: 'constitution.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% SOMS phase 6 accreditation smoke test\n%%EOF\n'),
    });
    await page.getByTestId(`accreditation-submit-${itemId}`).click();
    // The badge flips from "Not uploaded" to "Pending" after the server action.
    await page
      .getByTestId(`accreditation-status-${SMOKE_ACCREDITATION_ITEM}`)
      .waitFor({ timeout: 30000 });
    const uploadBadge = await page
      .getByTestId(`accreditation-status-${SMOKE_ACCREDITATION_ITEM}`)
      .innerText();
    check('officer upload shows as pending', uploadBadge.includes('Pending'), uploadBadge);
    check(
      'uploaded file is downloadable through the signed-URL route',
      (await page.locator('a[href^="/api/accreditation/"]').count()) >= 1
    );
  }

  // OSA reviews and approves the upload.
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/osa/accreditation`, { waitUntil: 'networkidle' });
  const reviewRow = page.locator('tr', { hasText: SMOKE_ACCREDITATION_ITEM }).last();
  await reviewRow.getByRole('button', { name: 'Review' }).click();
  const reviewDialog = page.locator('[role="dialog"]');
  await reviewDialog.waitFor({ state: 'visible', timeout: 15000 });
  await reviewDialog.getByTestId('accreditation-approve').click();
  await reviewDialog.waitFor({ state: 'detached', timeout: 30000 });
  // The uploads table now shows the Approved badge for the row.
  const osaManagerText = await page.locator('main').innerText();
  check(
    'OSA approval shows the Approved badge on the upload row',
    osaManagerText.includes(SMOKE_ACCREDITATION_ITEM) &&
      /Approved/.test(osaManagerText)
  );

  // The officer sees the approved badge; an untargeted org sees no upload.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/accreditation`, { waitUntil: 'networkidle' });
  const approvedBadge = await page
    .getByTestId(`accreditation-status-${SMOKE_ACCREDITATION_ITEM}`)
    .innerText();
  check('officer upload shows as approved', approvedBadge.includes('Approved'), approvedBadge);

  await signOut(page, context);
  await signIn(page, 'president.afphi@acd.edu.ph');
  await page.goto(`${BASE}/accreditation`, { waitUntil: 'networkidle' });
  const afphiChecklist = await page.locator('main').innerText();
  check(
    'another organization sees the item but no upload of its own',
    afphiChecklist.includes(SMOKE_ACCREDITATION_ITEM) &&
      afphiChecklist.includes('Not uploaded')
  );

  // ---- 22. Phase 6 - officer turnover ---------------------------------------
  // LITS officers type the incoming list and submit it to OSA.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/turnover`, { waitUntil: 'networkidle' });
  check(
    'officer can open the turnover screen',
    (await page.locator('main').innerText()).includes('Officer turnover')
  );
  await page.getByRole('button', { name: 'Add officer' }).click();
  await page.getByRole('button', { name: 'Add officer' }).click();
  const nameInputs = page.getByLabel('Officer name');
  const positionInputs = page.getByLabel('Officer position');
  await nameInputs.nth(0).fill('Smoke Turnover President');
  await positionInputs.nth(0).fill('President');
  await nameInputs.nth(1).fill('Smoke Turnover Secretary');
  await positionInputs.nth(1).fill('Secretary');
  await page.getByTestId('turnover-submit').click();
  // The submit button saves the draft first, then flips it to submitted.
  // Scope to the badge: the frozen-state paragraph mentions "With OSA" too.
  await page.locator('[data-slot="badge"]', { hasText: 'With OSA' }).waitFor({ timeout: 30000 });
  check(
    'submitted officer list shows the With OSA badge',
    (await page.locator('[data-slot="badge"]', { hasText: 'With OSA' }).count()) === 1
  );
  // Save/Submit only render while the list is editable; Add officer stays in
  // the DOM but disabled.
  check(
    'submitted list is frozen for editing',
    (await page.getByTestId('turnover-save').count()) === 0 &&
      (await page.getByTestId('turnover-submit').count()) === 0 &&
      (await page.getByRole('button', { name: 'Add officer' }).isDisabled())
  );

  // OSA approves the list.
  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/osa/turnover`, { waitUntil: 'networkidle' });
  // The queue only holds this run's submitted list (seed data has none), so
  // the single review button is deterministic. Its testid carries the
  // organization's display name (BSIT-LITS), never the bare code.
  await page.locator('[data-testid^="turnover-review-"]').first().click();
  const turnoverDialog = page.locator('[role="dialog"]');
  await turnoverDialog.waitFor({ state: 'visible', timeout: 15000 });
  const turnoverDialogText = await turnoverDialog.innerText();
  check(
    'OSA review dialog lists both officers',
    turnoverDialogText.includes('Smoke Turnover President') &&
      turnoverDialogText.includes('Smoke Turnover Secretary')
  );
  await turnoverDialog.getByTestId('turnover-approve').click();
  await turnoverDialog.waitFor({ state: 'detached', timeout: 30000 });

  // The organization sees the approved badge.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/turnover`, { waitUntil: 'networkidle' });
  check(
    'approved officer list shows the Approved badge',
    (await page.locator('main').innerText()).includes('Approved')
  );
  check(
    'approved officer list stays frozen',
    (await page.getByTestId('turnover-save').count()) === 0 &&
      (await page.getByRole('button', { name: 'Add officer' }).isDisabled())
  );

  // ---- 23. Phase 6 - school-year archive + rollover -------------------------
  await signOut(page, context);
  await signIn(page, 'its.admin@acd.edu.ph');
  await page.goto(`${BASE}/admin/school-years`, { waitUntil: 'networkidle' });
  check(
    'school-years screen exposes the rollover control',
    (await page.getByTestId('school-year-rollover').count()) === 1
  );

  // Create a throwaway past year, archive it, then restore it. Scope to the
  // textbox role: the "Make this the current school year" checkbox label
  // also contains the words "School year".
  await page.getByRole('textbox', { name: 'School year' }).fill(SMOKE_PAST_YEAR);
  await page.getByRole('textbox', { name: 'Start date' }).fill('1998-06-01');
  await page.getByRole('textbox', { name: 'End date' }).fill('1999-03-31');
  await page.getByRole('button', { name: 'Create school year' }).click();
  const pastYearRow = page.getByTestId(`school-year-${SMOKE_PAST_YEAR}`);
  await pastYearRow.waitFor({ timeout: 30000 });
  check('throwaway school year created', true);

  await pastYearRow.getByRole('button', { name: 'Archive' }).click();
  await pastYearRow.getByRole('button', { name: 'Confirm archive' }).click();
  await pastYearRow.getByText('Archived').waitFor({ timeout: 30000 });
  check('archiving a past year marks it Archived', true);

  // The current year cannot be archived.
  const currentRow = page.getByTestId('school-year-2026-2027');
  check(
    'current year refuses archiving',
    (await currentRow.innerText()).includes('Cannot archive')
  );

  // Restore the throwaway year so cleanup can simply delete it.
  await pastYearRow.getByRole('button', { name: 'Restore' }).click();
  await pastYearRow.getByText('Archived').waitFor({ state: 'detached', timeout: 30000 });
  check('restoring an archived year clears the badge', true);

  // One-click rollover: next year becomes current, the old one is archived.
  const rolloverButton = page.getByTestId('school-year-rollover');
  await rolloverButton.click();
  await rolloverButton.click();
  const nextYearRow = page.getByTestId('school-year-2027-2028');
  await nextYearRow.waitFor({ timeout: 30000 });
  const nextYearText = await nextYearRow.innerText();
  check(
    'rollover creates the next school year as current',
    nextYearText.includes('Current'),
    nextYearText.replace(/\s+/g, ' ').slice(0, 80)
  );
  const archivedOldYear = await currentRow.innerText();
  check(
    'rollover archives the previous school year',
    archivedOldYear.includes('Archived'),
    archivedOldYear.replace(/\s+/g, ' ').slice(0, 80)
  );
  // The archived year is read-only: creating a requirement against it is
  // refused by the enforce_archived_school_year trigger (checked in RLS T41);
  // here we only confirm the UI state - cleanup restores the seed shape.

  // ---- 24. Phase 9 - per-role user guide -------------------------------------
  // The same /guide route renders different content for each role; the nav
  // entry and the role badge are the stable anchors.
  await signOut(page, context);
  await signIn(page, 'president.lits@acd.edu.ph');
  await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  check('officer can open the user guide', page.url().includes('/guide'));
  const officerGuide = await page.locator('main').innerText();
  check(
    'officer guide is role-aware (badge + headline)',
    officerGuide.includes('Officer') &&
      officerGuide.includes('prepare and submit'),
    officerGuide.slice(0, 100)
  );
  check(
    'officer guide shows the accreditation section',
    officerGuide.includes('Accreditation checklist and officer turnover')
  );
  check(
    'officer guide does not expose OSA-only admin sections',
    !officerGuide.includes('User accounts') &&
      !officerGuide.includes('One-click rollover')
  );

  await signOut(page, context);
  await signIn(page, 'osa.admin@acd.edu.ph');
  await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  const osaGuide = await page.locator('main').innerText();
  check(
    'OSA guide is role-aware (badge + headline)',
    osaGuide.includes('OSA Admin') && osaGuide.includes('run the office'),
    osaGuide.slice(0, 100)
  );
  check(
    'OSA guide includes the review-queue section',
    osaGuide.includes('Review queues and decisions')
  );

  await signOut(page, context);
  await signIn(page, 'its.admin@acd.edu.ph');
  await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  const adminGuide = await page.locator('main').innerText();
  check(
    'super-admin guide includes the account section',
    adminGuide.includes('User accounts') &&
      adminGuide.includes('One-click rollover')
  );
  check(
    'guide nav entry is visible for every role',
    (await page.locator('nav a[href="/guide"]').count()) >= 1
  );
} catch (error) {
  failures += 1;
  console.error('FAIL  unexpected error:', error);
} finally {
  await browser.close();
  await removeCreatedUser();
  await removeSmokeRecords();
  await removePhase6Records();
  await restoreSchoolYears();
  await restoreOrganizationMembership();
  await restoreApprovalChains();
}

/** Service-role client used by the cleanup helpers (never for app logic). */
async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Remembers the A Squad membership figure before the org edit check runs. */
async function captureOrganizationMembership() {
  const admin = await adminClient();
  if (!admin) return;
  const { data } = await admin
    .from('organizations')
    .select('membership_count')
    .eq('code', 'ASQUAD')
    .maybeSingle();
  if (data) organizationMembership = data.membership_count;
}

async function restoreOrganizationMembership() {
  const admin = await adminClient();
  if (!admin || organizationMembership === null) return;

  const { error } = await admin
    .from('organizations')
    .update({ membership_count: organizationMembership })
    .eq('code', 'ASQUAD');

  if (error) {
    console.warn('cleanup  could not restore membership count:', error.message);
  } else {
    console.log(`cleanup  restored A Squad membership count (${organizationMembership})`);
  }
}

/** Keeps repeated runs from piling up throwaway accounts in the seed data. */
async function removeCreatedUser() {
  if (!createdEmail) return;
  const admin = await adminClient();
  if (!admin) return;

  try {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = (data?.users ?? []).find((entry) => entry.email === createdEmail);
    if (user) {
      await admin.auth.admin.deleteUser(user.id);
      console.log(`cleanup  removed ${createdEmail}`);
    }
  } catch (error) {
    console.warn(`cleanup  could not remove ${createdEmail}:`, error.message);
  }
}

/** Keeps one run from tripping the login brute-force guard for itself. */
async function clearLoginRateLimits() {
  const admin = await adminClient();
  if (!admin) return;
  try {
    await admin.from('rate_limits').delete().neq('key', '');
  } catch (error) {
    console.warn('cleanup  could not clear rate limits:', error.message);
  }
}

/** Keeps repeated runs from piling up throwaway records in the seed data. */
async function removeSmokeRecords() {
  const admin = await adminClient();
  if (!admin) return;

  for (const mod of SMOKE_MODULES) {
    const title = mod.title();
    if (!title) continue;

    try {
      const { data: rows } = await admin
        .from(mod.table)
        .select('id')
        .eq('title', title);

      for (const row of rows ?? []) {
        const { data: docs } = await admin
          .from('documents')
          .select('storage_path')
          .eq('record_type', mod.recordType)
          .eq('record_id', row.id);

        if (docs?.length) {
          await admin.storage
            .from('submissions')
            .remove(docs.map((entry) => entry.storage_path));
        }

        await admin
          .from('documents')
          .delete()
          .eq('record_type', mod.recordType)
          .eq('record_id', row.id);
        await admin
          .from('review_logs')
          .delete()
          .eq('record_type', mod.recordType)
          .eq('record_id', row.id);
        await admin
          .from('approval_records')
          .delete()
          .eq('record_type', mod.recordType)
          .eq('record_id', row.id);
        await admin
          .from('notifications')
          .delete()
          .eq('record_type', mod.recordType)
          .eq('record_id', row.id);
        await admin.from(mod.table).delete().eq('id', row.id);
        console.log(`cleanup  removed ${mod.noun} ${row.id}`);
      }
    } catch (error) {
      console.warn(`cleanup  could not remove ${title}:`, error.message);
    }
  }

  // Phase 5 requirement: its notifications carry no record_type (the enum has
  // no `requirement` value), so they are matched by the announcement title.
  if (smokeRequirementTitle) {
    try {
      await admin
        .from('notifications')
        .delete()
        .ilike('title', `New requirement: ${smokeRequirementTitle}`);
      const { data: rows } = await admin
        .from('requirements')
        .delete()
        .eq('title', smokeRequirementTitle)
        .select('id');
      for (const row of rows ?? []) {
        console.log(`cleanup  removed requirement ${row.id}`);
      }
    } catch (error) {
      console.warn(
        'cleanup  could not remove the smoke requirement:',
        error.message
      );
    }
  }

  // Phase 7 template: rows + storage objects (matched by the throwaway name).
  try {
    const { data: templateRows } = await admin
      .from('templates')
      .select('id, storage_path')
      .eq('name', SMOKE_TEMPLATE_NAME);
    for (const row of templateRows ?? []) {
      await admin.storage.from('templates').remove([row.storage_path]);
      await admin.from('templates').delete().eq('id', row.id);
      console.log(`cleanup  removed template ${row.id}`);
    }
  } catch (error) {
    console.warn('cleanup  could not remove the smoke template:', error.message);
  }

  // Phase 7 announcement + its notifications (matched by the throwaway title).
  try {
    const { data: announcementRows } = await admin
      .from('announcements')
      .select('id, attachment_path')
      .eq('title', SMOKE_ANNOUNCEMENT_TITLE);
    for (const row of announcementRows ?? []) {
      if (row.attachment_path) {
        await admin.storage.from('announcements').remove([row.attachment_path]);
      }
      await admin.from('announcements').delete().eq('id', row.id);
      console.log(`cleanup  removed announcement ${row.id}`);
    }
    await admin.from('notifications').delete().eq('title', SMOKE_ANNOUNCEMENT_TITLE);
  } catch (error) {
    console.warn(
      'cleanup  could not remove the smoke announcement:',
      error.message
    );
  }
}

/**
 * Phase 6 throwaway rows: the accreditation item + its upload (storage
 * object included) and LITS's officer term (members cascade). Service role
 * bypasses the archived-year trigger, so this works even after the rollover.
 */
async function removePhase6Records() {
  const admin = await adminClient();
  if (!admin) return;

  // Accreditation item + submissions + storage objects.
  try {
    const { data: items } = await admin
      .from('accreditation_items')
      .select('id')
      .eq('title', SMOKE_ACCREDITATION_ITEM);
    for (const item of items ?? []) {
      const { data: subs } = await admin
        .from('accreditation_submissions')
        .select('id, storage_path')
        .eq('item_id', item.id);
      for (const sub of subs ?? []) {
        await admin.storage.from('org-documents').remove([sub.storage_path]);
      }
      await admin.from('accreditation_submissions').delete().eq('item_id', item.id);
      await admin.from('accreditation_items').delete().eq('id', item.id);
      console.log(`cleanup  removed accreditation item ${item.id}`);
    }
    await admin
      .from('notifications')
      .delete()
      .eq('type', 'accreditation')
      .ilike('title', '%Smoke Checklist Item%');
    await admin
      .from('notifications')
      .delete()
      .eq('type', 'accreditation')
      .ilike('title', 'Accreditation %');
  } catch (error) {
    console.warn('cleanup  could not remove accreditation records:', error.message);
  }

  // Officer term for LITS (cascade deletes the member list) + notifications.
  try {
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('code', 'LITS')
      .maybeSingle();
    if (org) {
      const { data: terms } = await admin
        .from('officer_terms')
        .select('id')
        .eq('organization_id', org.id);
      for (const term of terms ?? []) {
        await admin.from('officer_terms').delete().eq('id', term.id);
        console.log(`cleanup  removed officer term ${term.id}`);
      }
    }
    await admin.from('notifications').delete().ilike('title', 'Officer list%');
  } catch (error) {
    console.warn('cleanup  could not remove the officer term:', error.message);
  }
}

/**
 * Puts the school years back to their seed shape after the section 23
 * rollover: drop the rolled-over year, restore 2026-2027 as current, remove
 * the throwaway past year.
 */
async function restoreSchoolYears() {
  const admin = await adminClient();
  if (!admin) return;

  try {
    // Clear the rollover-created year's current flag first (partial unique
    // index on is_current), then restore the seeded year.
    await admin.from('school_years').update({ is_current: false }).eq('name', '2027-2028');
    await admin
      .from('school_years')
      .update({ is_current: true, is_archived: false })
      .eq('name', '2026-2027');
    await admin.from('school_years').delete().eq('name', '2027-2028');
    await admin.from('school_years').delete().eq('name', SMOKE_PAST_YEAR);
    console.log('cleanup  restored school years');
  } catch (error) {
    console.warn('cleanup  could not restore school years:', error.message);
  }
}

/**
 * Puts the approval chains back to their seed shape - a run that dies between
 * the two saves of the chain editor check would otherwise leave later runs
 * following a broken chain.
 */
async function restoreApprovalChains() {
  const admin = await adminClient();
  if (!admin) return;

  const seedChains = {
    activity_proposal: ['adviser', 'dean', 'osa_admin'],
    accomplishment_report: ['adviser', 'dean', 'osa_admin'],
    audit_document: ['adviser', 'dean', 'osa_admin'],
    other_document: ['osa_admin'],
  };

  try {
    for (const [recordType, roles] of Object.entries(seedChains)) {
      const { data: chain } = await admin
        .from('approval_chains')
        .select('id, steps:approval_chain_steps(step_number, step_role)')
        .eq('record_type', recordType)
        .maybeSingle();
      if (!chain) continue;

      const current = [...(chain.steps ?? [])]
        .sort((a, b) => a.step_number - b.step_number)
        .map((step) => step.step_role);
      if (current.join(',') === roles.join(',')) continue;

      await admin.from('approval_chain_steps').delete().eq('chain_id', chain.id);
      await admin.from('approval_chain_steps').insert(
        roles.map((role, index) => ({
          chain_id: chain.id,
          step_number: index + 1,
          step_role: role,
        }))
      );
      console.log(`cleanup  restored the ${recordType} approval chain`);
    }
  } catch (error) {
    console.warn('cleanup  could not restore approval chains:', error.message);
  }
}

console.log(
  failures === 0 ? '\nAll SOMS checks passed.' : `\n${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
