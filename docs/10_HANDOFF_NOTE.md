# Smart Business Profile – Handoff Note

Last Updated: 2026-07-06  
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
- navigation/routing/layout stabilization
- Vercel deployment preparation
- Vercel SPA route refresh configuration
- landing page positioning for business owners and visitors
- landing page audience expansion

---

## Most Recent Implementation

Version 4.4 - Landing Page Audience Expansion

Status:

- Implemented locally
- Awaiting project owner review

Summary:

- landing page now includes a `Who It Is For` section
- local business category chips are static and non-clickable
- landing page now includes a final CTA section
- CTA routes preserve existing behavior

---

## Current Main Issue

The app is prepared for first Vercel deployment, but production deployment and verification have not been completed.

Known concerns:

- Vercel project has not been deployed yet
- Vercel environment variables need to be configured
- Supabase Auth production URLs need to be configured
- production route refresh behavior needs verification
- production auth/reset redirects need verification
- production QR/share and Supabase Storage URLs need verification

---

## Current Recommended Task

Production deployment and verification after project owner approval

Focus:

- deploy to Vercel
- configure Vercel environment variables
- configure Supabase Auth URL settings
- verify direct route refreshes
- verify auth, QR/share, public profiles, directory, and image loading in production

Do not add new business features during deployment verification.

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

7. Do not add new features while preparing or verifying deployment.

8. Keep changes minimal and testable.

---

## To Verify

- Confirm `npm run build` passes after pulling latest code.
- Confirm local app runs at `http://localhost:5000`.
- Confirm Vercel environment variables are configured.
- Confirm Supabase Auth URL Configuration includes local and production URLs.
- Confirm direct route refreshes work after production deployment.
