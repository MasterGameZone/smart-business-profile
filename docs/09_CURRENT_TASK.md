# Current Task - Version 4.3

Last Updated: 2026-07-06
Status: Implemented / Awaiting Review
Owner: Project Owner
Implementation: Codex / Project AI
Planning & Review: ChatGPT

---

# Version 4.3 - Landing Page Positioning Update

## 1. Objective

Update the landing page so it clearly supports two current journeys:

- business owners who create and manage public business profiles
- visitors who browse public businesses without signing up

This is a UI/content/navigation positioning update only.

---

## 2. Implemented Scope

- Updated hero copy to explain both profile creation and business discovery.
- Added clear hero CTAs:
  - `Get Started`
  - `Browse Businesses`
- Routed `Browse Businesses` to `/directory`.
- Preserved the existing protected owner get-started flow through `/create-profile`.
- Added concise business-owner value content.
- Added concise visitor value content.
- Added a two-path How It Works section.
- Updated feature copy to cover both profile management and public discovery.
- Updated the logged-out header primary CTA label to `Get Started` while preserving the `/signup` route.

---

## 3. Constraints Preserved

No changes were made to:

- authentication logic
- visitor accounts
- dashboard ownership behavior
- directory filtering logic
- public profile behavior
- QR/share logic
- Supabase configuration
- database schema
- migrations
- package dependencies
- `.env`

---

## 4. Verification Required

Before approval, verify locally:

- landing page loads cleanly
- `Get Started` opens the existing owner creation/login path
- `Browse Businesses` opens `/directory`
- logged-out Login still opens `/login`
- logged-out Get Started still opens `/signup` from the header
- logged-in navigation still shows Home, Dashboard, Directory, Create Business, Logout
- directory search/category/location filters still work
- public profile pages still work
- QR/share behavior still works
- mobile landing layout remains clean

---

## 5. Next Step

Project owner should manually review the Version 4.3 landing page positioning update.
