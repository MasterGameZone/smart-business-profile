# Smart Business Profile – Handoff Note

Last Updated: 2026-07-05  
Use this note when starting a new chat.

---

## Project

Smart Business Profile is a SaaS-style platform for creating stylish digital business profiles, like a premium digital visiting card plus lightweight public business page.

Business owners can create, edit, manage, upload images, and share profiles.

Visitors can open public profiles without login and quickly contact businesses.

---

## Current Workflow

Use the current workflow only:

- ChatGPT = planning, architecture, debugging, reviews, task breakdown
- Codex / Project AI = implementation
- VS Code = local development
- GitHub = source of truth
- Supabase = database/auth/storage
- Vercel = deployment target
- Replit = inactive unless explicitly reintroduced

Local app:

http://localhost:5000

Run locally:

npm run dev

Build:

npm run build

---

## Current Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- GitHub
- VS Code
- Codex

---

## Completed Scope

Completed major features:

- landing page
- authentication
- protected routes
- business ownership with `owner_id`
- multi-business dashboard
- create/edit business profile
- public profile by slug
- public directory
- search/category/location filters
- QR code
- sharing
- profile enrichment fields
- working hours editing
- Google Maps link
- social links
- keywords/tags
- profile visibility
- public profile enrichment display
- preview enrichment display
- Supabase Storage foundation
- logo upload
- cover banner upload/display
- gallery upload/display

---

## Current Main Issue

The app has strong features but the overall navigation, routing, layout, button placement, and save/edit flow need stabilization.

Known concerns:

- navigation between pages feels weak
- dashboard needs stronger structure
- logout placement feels illogical in some screens
- save flow does not redirect cleanly
- users may need to go back manually multiple times
- create/edit/profile pages do not feel connected enough

---

## Current Recommended Task

Version 4.0 – Navigation, Routing, and App Layout Stabilization

Focus:

- improve app layout
- improve navigation
- improve dashboard flow
- improve create/edit/save redirects
- make the app feel structurally polished

Do not add new business features in Version 4.0.

---

## Instructions for Next AI

Before suggesting or implementing anything:

1. Read:
   - `docs/00_PROJECT_BIBLE.md`
   - `docs/02_CURRENT_STATUS.md`
   - `docs/07_CHANGELOG.md`
   - `docs/09_CURRENT_TASK.md`
   - `docs/10_HANDOFF_NOTE.md`

2. Treat GitHub as source of truth.

3. Keep the workflow:
   - ChatGPT plans
   - Codex implements
   - user tests locally
   - changes are reviewed
   - then commit and push

4. Do not modify `.env`.

5. Do not add migrations unless explicitly required and reviewed.

6. Do not weaken auth, ownership, RLS, or private profile visibility.

7. Do not add new features while working on Version 4.0.

8. Keep changes minimal and testable.

---

## To Verify

- Confirm latest Version 3.9 changes are committed and pushed to GitHub.
- Confirm `npm run build` passes after pulling latest code.
- Confirm local app runs at `http://localhost:5000`.