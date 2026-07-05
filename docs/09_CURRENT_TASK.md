# Current Task – Version 4.0

Last Updated: 2026-07-05  
Status: Recommended Next Task  
Owner: Project Owner  
Implementation: Codex / Project AI  
Planning & Review: ChatGPT  

---

# Version 4.0 – Navigation, Routing, and App Layout Stabilization

## 1. Objective

Stabilize the application structure, navigation, routing behavior, and overall layout flow.

The product already has many strong features. The next priority is making the app feel like one polished, connected SaaS product instead of separate pages stitched together.

This version must focus on structure and flow, not new business features.

---

## 2. Core Problem

The website layout, navigation, button placement, redirects, and page-to-page flow currently feel weak or inconsistent.

Observed examples:

- poor navigation between pages
- dashboard lacks helpful navigation structure
- logout button placement feels illogical in some screens
- save flow does not redirect well
- users must manually go back multiple times
- edit/create/profile pages do not feel well connected
- overall app does not feel structurally polished yet

This creates friction even though the underlying features work.

---

## 3. Scope

Version 4.0 should improve:

### Navigation

- consistent top navigation
- clear logged-in vs logged-out states
- logical placement for Dashboard, Directory, Create Business, Login, Sign Up, Logout
- avoid confusing duplicate navigation

### App Layout

- consistent page shell/layout
- consistent spacing
- consistent page headers
- consistent primary action placement
- mobile-friendly layout behavior

### Dashboard Flow

- make dashboard the central management hub
- improve access to:
  - create profile
  - edit profile
  - view public profile
  - directory
  - logout/account action

### Create/Edit Flow

- improve route flow after save
- reduce unnecessary manual backtracking
- make preview/edit/public profile relationship clearer
- ensure users understand what happened after save

### Redirect Behavior

Improve redirects where appropriate:

- after profile creation
- after profile update
- after login
- after logout
- when accessing protected pages unauthenticated

---

## 4. Constraints

Do NOT add new business features.

Do NOT implement:

- verification badge
- reviews
- analytics
- subscriptions
- appointment booking
- CRM
- WhatsApp automation
- themes
- visitor saved profiles
- new database fields
- new Supabase migrations
- new Storage policies
- new dependencies

Do NOT modify carelessly:

- authentication logic
- owner_id authorization
- RLS behavior
- storage policies
- business profile persistence
- QR/share logic
- public/private profile visibility

---

## 5. Implementation Priorities

Priority 1:

Create or stabilize a reusable app layout/navigation structure.

Priority 2:

Improve dashboard as the main owner control center.

Priority 3:

Improve create/edit/save redirect flow.

Priority 4:

Improve button placement and page-level actions.

Priority 5:

Ensure mobile navigation works cleanly.

Priority 6:

Preserve all existing functionality.

---

## 6. Recommended UX Direction

### Logged-Out Navigation

Show:

- Home
- Directory
- Login
- Sign Up

Do not show owner-only actions.

### Logged-In Navigation

Show:

- Dashboard
- Directory
- Create Business
- Logout or Account menu

Do not make users hunt for dashboard or create actions.

### Dashboard

Dashboard should act as the owner home base.

It should clearly show:

- welcome/user context
- create new business action
- business list
- edit profile action
- view public profile action
- visibility status if available
- clear path back to directory/public app

### Save Flow

Recommended behavior:

After creating a profile:

- redirect to dashboard or preview with clear success state

After editing a profile:

- redirect to dashboard or preview with clear success state

Avoid leaving users stranded or forcing repeated browser back actions.

---

## 7. Acceptance Criteria

Version 4.0 is complete only if:

- navigation is consistent across major pages
- logged-out users see appropriate navigation
- logged-in users see appropriate navigation
- dashboard feels like the main owner hub
- create profile action is easy to find
- edit profile action is easy to find
- view public profile action is easy to find
- logout placement feels logical
- save flow after create is improved
- save flow after edit is improved
- protected route redirects still work
- public routes remain public
- private profile visibility remains safe
- dashboard still shows owner profiles
- create profile still works
- edit profile still works
- public profile still works
- directory still works
- QR/share still works
- image uploads still work
- enrichment fields still work
- `npm run build` passes
- `.env` is not modified
- no migrations are added
- no dependencies are added

---

## 8. Testing Checklist

Run:

npm run build

Then:

npm run dev

Test logged-out flow:

1. Open home page.
2. Confirm logged-out navigation looks correct.
3. Open directory.
4. Open a public profile.
5. Try opening dashboard while logged out.
6. Confirm redirect to login works.

Test login flow:

7. Login.
8. Confirm logged-in navigation appears.
9. Confirm Dashboard is easy to access.
10. Confirm Create Business is easy to access.
11. Confirm Logout is logically placed.

Test dashboard:

12. Open dashboard.
13. Confirm business list displays.
14. Confirm create new business action works.
15. Confirm edit profile action works.
16. Confirm view public profile action works.
17. Confirm private profiles still appear to owner.

Test create flow:

18. Create a new business profile.
19. Save.
20. Confirm redirect is logical.
21. Confirm success feedback is clear.
22. Confirm user is not stranded.

Test edit flow:

23. Edit an existing business profile.
24. Save.
25. Confirm redirect is logical.
26. Confirm updated values persist.
27. Confirm user can easily view the public profile afterward.

Regression test:

28. Directory search works.
29. Category filter works.
30. Location filter works.
31. Public profile displays enrichment fields.
32. Preview displays enrichment fields.
33. Logo upload works.
34. Cover banner upload works.
35. Gallery upload works.
36. QR code appears.
37. Share works.
38. Private profile is not publicly exposed.
39. Browser console has no errors.

---

## 9. Risks

Risk:

Changing navigation can accidentally break protected route behavior.

Mitigation:

Test logged-in and logged-out flows carefully.

Risk:

Changing save redirects can break create/edit flow.

Mitigation:

Test create, edit, preview, dashboard, and public profile after changes.

Risk:

Shared layout changes can affect many pages.

Mitigation:

Use minimal changes and avoid redesigning unrelated UI.

Risk:

Logout placement may conflict with existing auth state code.

Mitigation:

Reuse existing auth/logout logic. Do not rewrite auth.

---

## 10. Rollback Thinking

If Version 4.0 causes issues:

1. Revert only files modified for Version 4.0.
2. Do not revert database migrations.
3. Do not modify Supabase.
4. Do not modify Storage.
5. Do not modify `.env`.
6. Restore previous navigation/layout behavior.
7. Run `npm run build`.
8. Run `npm run dev`.
9. Confirm core profile functionality still works.

---

## 11. Codex Instruction Summary

Codex should:

- read project docs first
- inspect current routing and navigation
- preserve architecture
- make minimal changes
- avoid unrelated refactoring
- not add dependencies
- not add database changes
- not modify `.env`
- focus only on app structure, layout, navigation, and redirects
- stop after Version 4.0