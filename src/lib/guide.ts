// Per-role user guide content (spec Phase 9). One module describes every
// section of /guide; the page renders only the sections the signed-in role
// needs. Wording, button labels and routes must stay in step with the app -
// the e2e smoke test asserts the role headings and a few key phrases.

import type { UserRole } from '@/lib/navigation';

export interface GuideTask {
  title: string;
  steps: string[];
}

export interface GuideSection {
  id: string;
  title: string;
  intro: string;
  tasks: GuideTask[];
}

/** Sections every signed-in role reads first (shell, profile, support). */
export const COMMON_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    intro:
      'Sign in with the account OSA created for you, then complete these three steps before doing any real work.',
    tasks: [
      {
        title: 'Sign in',
        steps: [
          'Open the SOMS address OSA gave you. Anonymous visits are redirected to the sign-in page automatically.',
          'Enter your e-mail and the temporary password from OSA, then choose Sign in.',
          'Five failed attempts on the same e-mail lock that address for 15 minutes - wait it out or ask OSA to reset your password.',
        ],
      },
      {
        title: 'Replace the temporary password',
        steps: [
          'Open My Profile from the avatar menu in the top-right corner.',
          'Under "Change password", type the current password, a new password of at least 8 characters, and confirm it.',
          'The OSA Admin keeps your role, organization, college and e-mail - only a super admin can change those.',
        ],
      },
      {
        title: 'Find your way around',
        steps: [
          'The left sidebar lists the modules your role may open; the avatar menu holds My Profile and Sign out.',
          'The header search box finds organizations, announcements and the records you are allowed to see.',
          'The bell icon opens your notifications; a blue badge means unread items.',
        ],
      },
    ],
  },
  {
    id: 'account-and-support',
    title: 'Your account and getting help',
    intro:
      'Your role decides what you can do. It is not editable from My Profile - OSA and IT assign it.',
    tasks: [
      {
        title: 'Who to contact',
        steps: [
          'Password trouble or a wrong role/organization: the OSA office or the IT super admin (its.admin@acd.edu.ph).',
          'Question about a specific submission: the adviser of your organization for anything you have not sent yet, the dean of your college once it is endorsed, and OSA for everything else.',
          'A missing feature or a broken page: report it with the page address (URL) and the exact steps you took.',
        ],
      },
    ],
  },
];

/** Role landing blurb shown at the top of /guide. */
export const ROLE_LANDING: Record<UserRole, { headline: string; body: string }> = {
  officer: {
    headline: 'You prepare and submit the paperwork for your organization',
    body: 'Draft activity proposals, accomplishment reports and documents, attach files, submit them for review, follow their status, upload accreditation requirements and send the incoming officer list for approval.',
  },
  adviser: {
    headline: 'You endorse what your organization submits',
    body: 'You see every submission of the organizations assigned to you, check the details, add remarks, and either endorse it to the dean or send it back with a revision request.',
  },
  dean: {
    headline: 'You approve submissions from the colleges you head',
    body: 'Endorsed proposals and reports from your college arrive in My Approvals; you approve them, request a revision with remarks, or reject them - OSA makes the final decision after you.',
  },
  osa_admin: {
    headline: 'You run the office: queues, templates, announcements and settings',
    body: 'Approve or reject submissions, maintain approval chains and the venue list, review accreditation uploads and officer turnover lists, publish templates and announcements, and export the report pack.',
  },
  super_admin: {
    headline: 'You administer accounts, school years and the system itself',
    body: 'Everything the OSA does, plus user accounts, password resets, school-year creation/archiving/rollover, and the full audit trail.',
  },
};

function task(title: string, ...steps: string[]): GuideTask {
  return { title, steps };
}

const OFFICER_SECTIONS: GuideSection[] = [
  {
    id: 'submissions',
    title: 'Proposals, reports and documents',
    intro:
      'Three modules use the same pattern: create a draft, attach files, submit it, then follow the status while it climbs the approval chain.',
    tasks: [
      task(
        'Create an activity proposal',
        'Open Activity Proposals in the sidebar, then New proposal.',
        'Fill in the activity title, description, dates, venue and budget. The venue list is the canonical campus list - pick one of the venues (free-typing a venue name is not allowed).',
        'If the venue is already booked for that date and time, a warning names the blocking activity. You can still save the draft, but the database refuses to submit a double booking.',
        'Save as draft, or Save and submit to send it to your adviser straight away. Either way you get a SOMS-YYYY-NNNN reference number.',
      ),
      task(
        'Create an accomplishment report',
        'Open Accomplishment Reports, then New report.',
        'Give the report a reference number, pick the approved activity it belongs to, write the summary and attach the report file (PDF preferred).',
        'Submit when the form is complete - the same adviser → dean → OSA chain applies.',
      ),
      task(
        'Create an other document (resolution, letter, minutes, certificate)',
        'Open Other Documents, then New document.',
        'Pick the category, add a title and description, attach the signed file and submit. Other documents go straight to OSA for review.',
      ),
      task(
        'Attach and version files',
        'On any submission detail page, scroll to Attachments and choose the file (10 MB max; PDF, DOC, DOCX, XLS, XLSX, JPG or PNG).',
        'Replacing a file never overwrites the old one: the new upload becomes the current version (v2, v3, ...) and the previous version stays in History and stays downloadable.',
        'Remove only the newest version - older versions keep the chain intact.',
      ),
      task(
        'Follow the status',
        'Every detail page shows the current status badge, the approval chain (which step owns it now) and the review timeline with remarks.',
        'While something is still a draft, you can edit it. After submitting, the only thing you can do is wait - or fix it if OSA or the dean requests a revision.',
      ),
      task(
        'Handle a revision request',
        'Open the submission from the list - its status is Revision Requested and the remarks say what to fix.',
        'Choose Edit, correct the details or replace the attachment, then save. The record becomes Version 2 and re-enters the chain from the top.',
      ),
    ],
  },
  {
    id: 'accreditation-turnover',
    title: 'Accreditation checklist and officer turnover',
    intro:
      'Two year-end chores an organization officer owns: the accreditation uploads and the incoming officer list.',
    tasks: [
      task(
        'Upload accreditation requirements',
        'Open Accreditation in the sidebar - the list shows every item OSA requires this school year.',
        'Upload one file per required item (same file types and 10 MB cap as attachments).',
        'The badge starts as Pending, becomes Approved (or Rejected with remarks) after OSA reviews it. A rejected item can be re-uploaded; an approved one is frozen.',
      ),
      task(
        'Submit the incoming officer list',
        'Open Officer Turnover. Add the incoming officers: name and position (they do not need SOMS accounts yet), reorder with the arrow buttons, optionally add notes for OSA.',
        'Save keeps it a draft for you to finish later. Submit for review freezes the list and notifies OSA.',
        'OSA can approve it or send it back with notes - sent-back lists return to Draft so you can edit and resubmit.',
      ),
    ],
  },
  {
    id: 'daily-tools',
    title: 'Calendar, announcements and requirements',
    intro: 'The read-mostly tools every officer uses week to week.',
    tasks: [
      task(
        'Check the activity calendar',
        'Open Activity Calendar. Approved activities are public to every signed-in user; your own organization also sees drafts and work-in-progress.',
        'Click a day to list the events; open one to jump to its proposal.',
      ),
      task(
        'Read announcements and notifications',
        'Open Announcements for the office bulletin: all-community posts, or posts targeted at your college or your organization.',
        'The bell menu and the Notifications page list personal alerts - status changes, comments, requirements and accreditation decisions. Mark one as read, or clear them all at once.',
      ),
      task(
        'Complete your requirements',
        'Open Requirements: every assignment aimed at your organization with its due date.',
        'The badge says Open, Completed, Overdue or Waived - use the row action to record completion.',
      ),
      task(
        'Download blank forms',
        'Open Form Templates for the official OSA forms (proposal, liquidation, accomplishment report). Each download is the active version; older versions stay available in History.',
      ),
    ],
  },
];

const ADVISER_SECTIONS: GuideSection[] = [
  {
    id: 'endorsement',
    title: 'Reviewing and endorsing',
    intro:
      'Your job is the first serious checkpoint: verify the substance, then pass it on or send it back.',
    tasks: [
      task(
        'Work the My Approvals queue',
        'Open My Approvals in the sidebar: submissions from your organizations that currently sit at the adviser step.',
        'Open one, read the details, the attachments and the timeline, then decide.',
      ),
      task(
        'Endorse to the dean',
        'Click Endorse proposal (or Endorse report / Endorse document). Add optional remarks, then confirm.',
        'The record moves to the dean of that college and the officers are notified.',
      ),
      task(
        'Request a revision',
        'Click Request revision and explain what to change - remarks are mandatory.',
        'The submission returns to the originating officer as Revision Requested; when they resubmit, it comes back through your queue as Version 2.',
      ),
      task(
        'Add a comment',
        'Use the comment box on the detail page for questions that do not change the status - comments land in the same timeline as status changes.',
      ),
    ],
  },
  {
    id: 'visibility',
    title: 'What you can and cannot see',
    intro: 'Your view is scoped to the organizations assigned to you.',
    tasks: [
      task(
        'Organization scope',
        'You see the submissions of the organization(s) listed on your profile, and only while you are the assigned adviser for the current school year.',
        'Other colleges, other organizations and the OSA-only screens stay invisible - a direct URL lands you back on the dashboard.',
      ),
      task(
        'You are not an approver',
        'Approve and Reject only appear at the dean and OSA steps. As an adviser you endorse, comment or send back for revision.',
      ),
    ],
  },
];

const DEAN_SECTIONS: GuideSection[] = [
  {
    id: 'approval',
    title: 'Approving for your college',
    intro:
      'Endorsed proposals and reports from the colleges you head arrive in My Approvals.',
    tasks: [
      task(
        'Work the queue',
        'Open My Approvals: everything currently at the dean step for your college.',
        'Open a record, read the proposal or report and the adviser remarks, then decide.',
      ),
      task(
        'Approve, request a revision or reject',
        'Approve moves it to the OSA step with your remarks.',
        'Request revision (remarks required) sends it back to the officer; it re-enters the chain from the top when resubmitted.',
        'Reject (remarks required) closes the record - officers can see the decision and the reasons in the timeline.',
      ),
      task(
        'Your dashboard',
        'The dean dashboard lists "Waiting for your approval" with the college scope - it never shows the OSA queue or other colleges.',
      ),
    ],
  },
];

const OSA_SECTIONS: GuideSection[] = [
  {
    id: 'osa-queues',
    title: 'Review queues and decisions',
    intro:
      'OSA owns the last step of every chain plus the documents that go straight to the office.',
    tasks: [
      task(
        'The OSA review queue',
        'Open Review Queue: everything waiting on OSA - endorsed proposals/reports at the final step, plus other documents and audit documents.',
        'Start the review (the record becomes Under Review), then Approve, Request revision or Reject with remarks. The officer, adviser and dean are notified automatically.',
      ),
      task(
        'Hardcopy tracking',
        'Open Hardcopy Tracking for approved records that also need a paper copy. Mark a copy as received; the copy badge moves from Softcopy only to Hardcopy received to Complete.',
      ),
      task(
        'Approval chains',
        'Open Approval Chains to reconfigure the steps of each module (default: Adviser → Dean → OSA). Save a change and the new order applies to every submission from the next version onwards.',
      ),
      task(
        'Accreditation and turnover reviews',
        'Accreditation Review lists every upload of the current school year - approve or reject each with remarks.',
        'Turnover Review lists submitted officer lists with the roster inline - approve or send back with notes.',
      ),
    ],
  },
  {
    id: 'osa-content',
    title: 'Venues, templates and announcements',
    intro: 'The office also maintains the shared lists everyone else reads.',
    tasks: [
      task(
        'Venues and conflicts',
        'Open Venues & Conflicts: add or deactivate campus venues (the proposal form only offers active ones) and inspect the conflict register of refused double bookings.',
      ),
      task(
        'Template library',
        'Open Template Library to upload the official blank forms. Replacing a file creates a new version - the previous one stays downloadable; everyone else sees the active version on the public Form Templates board.',
      ),
      task(
        'Announcement board',
        'Open Announcements (or the composer on the board) to post a bulletin: title, body, optional attachment, optional expiry, and an audience - every signed-in user, one college, or one organization.',
        'Posting fans out a notification to exactly the targeted users. Expired bullets disappear for officers/advisers/deans but stay visible to OSA.',
      ),
      task(
        'Organizations',
        'Open Organizations to inspect records, officer lists and accreditation status; OSA may edit organization details (membership counts, accreditation status, contact person).',
      ),
    ],
  },
  {
    id: 'osa-exports',
    title: 'Reports, exports and the audit trail',
    intro: 'Everything the office has to hand up to administration.',
    tasks: [
      task(
        'Reports & exports',
        'Open Reports & Exports, pick a school year and a scope (all colleges, one college, or one organization).',
        'The screen shows the status matrix and module summaries; download the same numbers as Excel (.xlsx) or PDF.',
      ),
      task(
        'Audit trail',
        'Open Audit Trail: every recorded change - who changed what, when, from which value to which value. Read-only; export is not required but the table is filterable by eye.',
      ),
    ],
  },
];

const SUPER_ADMIN_SECTIONS: GuideSection[] = [
  {
    id: 'admin-accounts',
    title: 'User accounts',
    intro: 'The super admin owns credentials; OSA can edit organization data but not accounts.',
    tasks: [
      task(
        'Create an account',
        'Open User Accounts, then New account. Fill in name, e-mail, role and position.',
        'Officers must also pick their organization; advisers and deans are matched through the college / adviser assignment.',
        'OSA gives the person the temporary password out of band - the dialog does not show it again.',
      ),
      task(
        'Edit, reset and deactivate',
        'Edit fixes name/position/role/organization. Reset password sets a new temporary password. Deactivate cuts off access at the next request (the session is bounced to the sign-in page).',
        'Reactivate restores access without changing the password.',
      ),
      task(
        'Who to create as whom',
        'Officer = member of an organization who prepares submissions. Adviser = faculty assigned to one or more organizations (they endorse). Dean = one per college (they approve). OSA Admin = office staff (they approve finally and configure the system). Super Admin = IT-level access, including this screen.',
      ),
    ],
  },
  {
    id: 'admin-school-years',
    title: 'School years',
    intro: 'One school year is current; submissions and checklists belong to a year.',
    tasks: [
      task(
        'Create a year',
        'Open School Years, then fill the name (YYYY-YYYY), start and end dates. Only one year can be marked current - the form refuses overlaps.',
      ),
      task(
        'Switch the current year',
        'Set current on a row; the previous current year loses the flag automatically.',
      ),
      task(
        'Archive and restore',
        'Archive freezes a year: every insert or update against its rows is refused for signed-in users (the trigger still lets service role and migrations fix data). The current year itself cannot be archived - switch first.',
        'Restore unfreezes it again.',
      ),
      task(
        'One-click rollover',
        'The Rollover button creates the next school year (the day after the current one ends), makes it current and archives the old one - with an overlap check against existing years.',
      ),
    ],
  },
  {
    id: 'admin-everything',
    title: 'Everything the OSA does',
    intro:
      'Super admin includes the OSA Admin role: the same queues, templates, announcements, exports and accreditation/turnover screens are available under the Office of Student Affairs sidebar group, plus the audit trail of every configuration change.',
    tasks: [
      task(
        'Recommended split',
        'Keep day-to-day approvals with the OSA Admin accounts; use super admin for account lifecycle, school years and anything that needs the audit trail.',
      ),
    ],
  },
];

const SECTIONS_BY_ROLE: Record<UserRole, GuideSection[]> = {
  officer: OFFICER_SECTIONS,
  adviser: ADVISER_SECTIONS,
  dean: DEAN_SECTIONS,
  osa_admin: OSA_SECTIONS,
  super_admin: SUPER_ADMIN_SECTIONS,
};

export function guideSectionsForRole(role: UserRole): GuideSection[] {
  return [...COMMON_SECTIONS, ...SECTIONS_BY_ROLE[role]];
}
