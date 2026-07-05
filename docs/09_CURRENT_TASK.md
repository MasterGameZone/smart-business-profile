# Current Task - Version 4.1

Last Updated: 2026-07-06
Status: Implemented / Awaiting Deployment Verification
Owner: Project Owner
Implementation: Codex / Project AI
Planning & Review: ChatGPT

---

# Version 4.1 - Vercel Deployment Preparation and Production Readiness

## 1. Objective

Prepare Smart Business Profile for first Vercel deployment while preserving existing application behavior.

This version is deployment-readiness work only. It does not add product features.

---

## 2. Implemented Scope

- Audited Vite build readiness.
- Audited React Router direct-route refresh behavior.
- Audited Supabase environment variable usage.
- Audited public profile/share URL generation.
- Added Vercel SPA rewrite configuration.
- Documented Vercel deployment settings.
- Documented required Supabase Auth URL configuration.
- Updated project status and handoff documentation.

---

## 3. Deployment Configuration

Vercel build command:

```bash
npm run build
```

Vercel output directory:

```text
dist
```

Required Vercel environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not add service role keys or private secrets to the frontend.

---

## 4. Supabase Auth Setup Required After Deployment

The project owner must update Supabase Auth URL Configuration manually after the first Vercel deployment.

Include:

```text
http://localhost:5000
https://your-production-domain.vercel.app
https://your-production-domain.vercel.app/reset-password
```

Use the real Vercel production domain when it is known.

---

## 5. Production Verification Required

After deployment, verify:

- production home page loads
- refresh works on `/directory`
- refresh works on `/login`
- refresh works on `/signup`
- refresh works on `/dashboard`
- refresh works on `/business/{real-slug}`
- logged-out protected route redirects still work
- login/logout still works
- password reset redirect returns to production `/reset-password`
- public profile QR/share URLs use the production domain
- public image URLs still load from Supabase Storage

---

## 6. Constraints Still Active

Do not:

- add new product features
- add dependencies
- modify `.env`
- add database migrations
- change Supabase policies
- change Supabase schema
- modify package scripts unless explicitly approved
- deploy unless explicitly instructed

---

## 7. Next Step

Project owner should review Version 4.1, then deploy to Vercel manually or provide explicit deployment instructions.
