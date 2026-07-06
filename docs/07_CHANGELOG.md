# Smart Business Profile – Changelog

Last Updated: 2026-07-06
Status: Active

---

## Version 0.1 – Landing Page Foundation

Status: Completed

- Replaced default starter screen with Smart Business Profile landing page.
- Added basic project branding and entry point.

---

## Version 0.2 – Routing Foundation

Status: Completed

- Added React Router.
- Added create profile route.
- Added basic navigation between home and create profile page.

---

## Version 0.3 – Business Profile Form

Status: Completed

- Added form for basic business profile details.
- Added required field validation.
- Added initial logo selection UI.

---

## Version 0.4 – Profile Preview

Status: Completed

- Added preview interface.
- Displayed entered business details.
- Added basic contact actions.

---

## Version 0.5 – Session State

Status: Completed

- Added session-level state handling for profile data.
- Improved form-to-preview continuity.

---

## Version 0.6 – Local Storage

Status: Completed

- Added local persistence for profile form data.
- Added clear form behavior.

---

## Version 0.7 – QR Code and Sharing

Status: Completed

- Added QR code generation.
- Added share profile behavior.

---

## Version 0.8 – Professional Profile UI

Status: Completed

- Improved visual presentation of profile preview.
- Added more polished business-card style layout.

---

## Version 0.9 – Public Profile Layout

Status: Completed

- Improved public-facing profile structure.
- Added sections such as contact, about, address, and static business hours.

---

## Version 1.0 – Frontend MVP Polish

Status: Completed

- Polished frontend MVP.
- Improved responsiveness and user interface consistency.

---

## Version 1.0.1 – Save and QR Improvements

Status: Completed

- Added Save Profile behavior.
- Added better toast feedback.
- Added QR download/share improvements.

---

## Version 2.0 – Supabase Connection

Status: Completed

- Connected app to Supabase.
- Added Supabase client setup.
- Added environment variable usage.
- Important fix: Supabase URL must be base project URL, not REST endpoint.

---

## Version 2.1 – Business Profile Schema

Status: Completed

- Created `business_profiles` table.
- Added basic business profile fields.
- Enabled RLS.
- Added initial development policies.

---

## Version 2.2 – Save Profile to Supabase

Status: Completed

- Added save-to-Supabase behavior.
- Fixed duplicated `/rest/v1` Supabase URL issue.
- Confirmed profile rows insert successfully.

---

## Version 2.3 – Slug and Profile Retrieval

Status: Completed

- Added profile slug.
- Added unique slug handling.
- Added public profile retrieval by slug.

---

## Version 2.4 – Public Business Profile Page

Status: Completed

- Added public route for business profiles.
- Added loading, not found, and public profile display states.

---

## Version 2.5 – Business Profile Editing

Status: Completed

- Added edit flow for existing profiles.
- Preserved ID, slug, and created timestamp.
- Updated profiles instead of duplicating rows.

---

## Version 2.6 – Authentication UI

Status: Completed

- Added login page.
- Added signup page.
- Added forgot password page.
- Added reset password page.
- UI only at this stage.

---

## Version 2.7 – Supabase Authentication

Status: Completed

- Connected auth pages to Supabase Auth.
- Added signup, login, logout, and session handling.
- Added password reset flow.
- Email verification works.
- Supabase rate limit may appear during repeated auth testing.

---

## Version 2.8 – Protected Routes and Business Ownership

Status: Completed

- Added `owner_id`.
- Protected create/edit routes.
- New profiles store authenticated user ID.
- Unauthorized edit access returns access denied behavior.
- RLS ownership rules verified through app testing.

---

## Version 2.9 – Business Dashboard

Status: Completed

- Added protected dashboard.
- Added basic dashboard layout.
- Added owned business profile display.
- Added dashboard empty state.

---

## Version 2.9.1 – Multi-Business Dashboard

Status: Completed

- Updated dashboard to support multiple business profiles per user.
- Replaced single-profile assumption.
- Resolved Supabase multiple-row `.single()` issue.

---

## Version 3.0 – Public Business Directory

Status: Completed

- Added `/directory`.
- Added public list of business profiles.
- Added directory cards and profile links.

---

## Version 3.1 – Directory Search

Status: Completed

- Added real-time client-side directory search.
- Search supports business name, category, and owner name.

---

## Version 3.2 – Category Filters

Status: Completed

- Added dynamic category filter.
- Added combined search and category filtering.
- Added result counter and clear filters behavior.

---

## Version 3.3 – Location Filter

Status: Completed

- Added directory location/address filter.
- Combined search, category, and location filtering.
- Added clear filters support for all directory filters.

---

## Version 3.4 – SEO and Metadata Foundation

Status: Completed

- Added default app metadata.
- Added page-specific titles and descriptions.
- Added public profile metadata foundation.
- Added Open Graph and Twitter metadata foundation.

Note:

- This is client-side metadata only.
- No SSR, prerendering, sitemap, or deployment SEO was implemented.

---

## Version 3.5 – Profile Enrichment Schema Foundation

Status: Completed

- Added enrichment fields:
  - tagline
  - services
  - working_hours
  - google_maps_url
  - social_links
  - keywords
  - cover_banner_url
  - gallery_images
  - is_public
- Updated TypeScript types.
- Updated database documentation.
- Fixed unrelated TypeScript build blockers before commit.

---

## Version 3.6 – Profile Enrichment Form Editing

Status: Completed

- Added form inputs for:
  - tagline
  - services
  - working hours
  - Google Maps link
  - social links
  - keywords/tags
  - profile visibility
- Added create/edit persistence.
- Added edit-mode reload for enrichment fields.
- Public display was not part of this version.

---

## Version 3.7 – Public Profile Display Upgrade

Status: Completed

- Displayed enrichment fields on public profile pages.
- Displayed enrichment fields in preview mode.
- Added public visibility behavior:
  - private profiles hidden from directory
  - private profiles not publicly exposed
- Preserved dashboard and edit access for private profile owners.

---

## Version 3.8 – Supabase Storage Foundation

Status: Completed

- Created `business-assets` Supabase Storage bucket.
- Added public read and authenticated write policies.
- Added image validation:
  - JPG
  - PNG
  - WebP
  - max 5 MB
- Added storage helper service.
- Added persistent logo upload.
- Stored logo URL in `logo_url`.

---

## Version 3.9 – Cover Banner and Gallery UI

Status: Completed / To Verify Commit Status

- Added cover banner upload UI.
- Added gallery image upload UI.
- Used Supabase Storage foundation.
- Saved `cover_banner_url`.
- Saved `gallery_images`.
- Displayed cover banner and gallery in preview mode.
- Displayed cover banner and gallery on public profile page.
- Preserved private profile visibility behavior.

To Verify:

- Confirm latest Version 3.9 changes have been committed and pushed to GitHub.

---

## Version 4.0 – Navigation, Routing, and App Layout Stabilization

Status: Completed

- Added shared app navigation/header.
- Added appropriate logged-in and logged-out navigation states.
- Improved dashboard as the owner hub.
- Improved create/edit save redirects.
- Improved navigation consistency across landing, auth, dashboard, directory, preview, and public profile pages.
- Corrected active navigation styling and logged-in Home access during approval cleanup.

---

## Version 4.1 – Vercel Deployment Preparation and Production Readiness

Status: Implemented / Not Deployed

- Added Vercel single-page app routing support.
- Confirmed Vite build command remains `npm run build`.
- Confirmed Vercel output directory remains `dist`.
- Confirmed safe frontend Supabase environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Documented Vercel deployment setup.
- Documented Supabase Auth production URL configuration requirements.
- Confirmed public profile/share URLs use runtime browser URL behavior rather than hardcoded localhost URLs.

Note:

- Production deployment has not been performed yet.
- Production auth redirects and storage/public URLs still require verification after deployment.

---

## Version 4.3 - Landing Page Positioning Update

Status: Implemented

- Updated landing page messaging to clearly serve business owners and visitors.
- Added hero CTAs for `Get Started` and `Browse Businesses`.
- Routed `Browse Businesses` to `/directory`.
- Preserved existing owner get-started flow through protected profile creation.
- Added concise business-owner and visitor value sections.
- Added a two-path How It Works section.
- Updated landing feature copy so it represents profile creation and business discovery.
- Updated logged-out header primary CTA label to `Get Started` while preserving the existing signup route.

---

## Version 4.4 - Landing Page Audience Expansion

Status: Implemented

- Added a `Who It Is For` landing page section.
- Added static local business category chips.
- Added a final landing page CTA section.
- Preserved existing `Get Started` and `Browse Businesses` CTA routes.
- Avoided unavailable feature claims and kept the update frontend-only.

---

## Next Recommended Step

Deploy to Vercel after owner approval, configure Vercel/Supabase settings, and verify production routes, auth redirects, storage URLs, and public sharing.
