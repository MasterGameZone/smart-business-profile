# Smart Business Profile
# Changelog

Version: 1.0

Document Purpose

This document records the complete development history of the Smart Business Profile project.

Every completed version must be documented here.

The changelog provides a chronological history of:

- Features
- Improvements
- Bug Fixes
- Database Changes
- Documentation Updates
- Deployment Status

This document should always reflect the latest released version.

--------------------------------------------------

Change Log Format

Every version should follow this structure.

Version

Release Date

Status

Summary

Added

Changed

Improved

Fixed

Database

Documentation

Breaking Changes

Migration Required

Testing Status

Deployment Status

Developer Notes

--------------------------------------------------

Version 3.0

Release Date

Not Released

Status

Completed

Summary

Implemented the Public Business Directory foundation and completed the migration from Replit to a professional VS Code based development workflow.

Added

Public Business Directory foundation.

Business listing infrastructure.

Public profile architecture.

Development documentation.

Engineering workflow.

Codex integration planning.

Changed

Development workflow migrated from Replit to VS Code.

GitHub established as the single source of truth.

Engineering process redesigned around ChatGPT and Codex.

Improved

Project documentation.

Development workflow.

Engineering standards.

Project architecture.

Fixed

Migration related development issues.

Package lock consistency.

Local development environment.

Database

No schema changes.

Documentation

Created Project Bible.

Created Architecture documentation.

Created Database documentation.

Created Engineering Standards.

Created Workflow documentation.

Created Codex Instructions.

Created Feature Template.

Created Changelog.

Created Roadmap.

Breaking Changes

None.

Migration Required

No.

Testing Status

Verified.

Deployment Status

Development.

Developer Notes

This version establishes the foundation for long-term development.

--------------------------------------------------

Version 3.1

Release Date

Pending

Status

Planned

Summary

Reserved for future implementation.

Added

None.

Changed

None.

Improved

None.

Fixed

None.

Database

None.

Documentation

None.

Breaking Changes

None.

Migration Required

No.

Testing Status

Pending.

Deployment Status

Pending.

Developer Notes

Reserved.

--------------------------------------------------

Version 3.2

Release Date

Pending

Status

Planned

Summary

Reserved.

--------------------------------------------------

Version 3.3

Release Date

Pending

Status

Planned

Summary

Reserved.

--------------------------------------------------

Version 3.4

Release Date

Pending

Status

Planned

Summary

Reserved.

--------------------------------------------------

Version 3.5

Release Date

Pending

Status

Implemented

Summary

Added the schema and TypeScript foundation for future richer business profiles.

Added

Profile enrichment migration for tagline, services, working hours, Google Maps URL, social links, keywords, cover banner URL, gallery images, and profile visibility.

Changed

Business profile TypeScript types now include optional enrichment fields.

Database

Created migration 20260705010000_add_profile_enrichment_fields.sql.

Documentation

Updated database schema documentation and roadmap notes for profile enrichment foundation.

Breaking Changes

None.

Migration Required

Yes. Requires manual Supabase review and execution.

Testing Status

Pending build verification.

Deployment Status

Development.

Developer Notes

No UI, storage bucket, upload flow, public profile display, or form editing was added in this version.

--------------------------------------------------

Version 3.6

Release Date

Pending

Status

Implemented

Summary

Added create/edit form support for profile enrichment fields.

Added

Business tagline, services, working hours, Google Maps URL, social media links, keywords, and profile visibility inputs.

Changed

Business profile create/update payload mapping now saves enrichment fields.

Improved

Edit mode now hydrates saved enrichment values back into the form.

Database

No schema changes. Uses Version 3.5 enrichment columns.

Documentation

Updated changelog and roadmap notes for Version 3.6.

Breaking Changes

None.

Migration Required

No.

Testing Status

Pending build verification.

Deployment Status

Development.

Developer Notes

No public profile display upgrade, image upload, gallery upload, Google Maps embed, or Supabase Storage work was added.

--------------------------------------------------

Version 3.7

Release Date

Pending

Status

Implemented

Summary

Upgraded the public business profile to display enrichment fields and enforced private profile visibility rules for public surfaces.

Added

Public display for tagline, services, working hours, Google Maps link, social links, and keywords when data exists.

Changed

Public profile metadata now uses richer business context.

Improved

Directory retrieval now excludes private profiles.

Fixed

Public business routes no longer expose profiles marked as private.

Database

No schema changes. Uses Version 3.5 enrichment columns.

Documentation

Updated changelog and roadmap notes for Version 3.7.

Breaking Changes

None.

Migration Required

No.

Testing Status

Pending build verification.

Deployment Status

Development.

Developer Notes

No cover banner display, gallery display, image upload, Storage work, map embedding, or verification badges were added.

--------------------------------------------------

Version 3.8

Release Date

Pending

Status

Implemented

Summary

Added the Supabase Storage foundation for public business profile assets and integrated persistent logo uploads.

Added

Created the business-assets Storage migration and reusable storage helper functions for logo, cover, and gallery assets.

Changed

Business logo saving now uploads selected logo files to Supabase Storage and stores the returned public URL in logo_url.

Improved

Logo validation now allows JPG, PNG, and WebP images up to 5 MB.

Fixed

Editing without selecting a new logo preserves the existing logo_url.

Database

Created migration 20260705020000_create_business_assets_storage.sql. Migration must be manually reviewed and applied in Supabase.

Documentation

Updated database storage documentation and roadmap notes for Version 3.8.

Breaking Changes

None.

Migration Required

Yes. Requires manual Supabase review and execution.

Testing Status

Pending build verification.

Deployment Status

Development.

Developer Notes

No cover banner UI, gallery UI, image cropper, compression package, Storage bucket application, or Version 3.9 work was added.

--------------------------------------------------

Release Categories

Added

Completely new functionality.

Changed

Existing functionality modified.

Improved

Performance, maintainability, usability, or developer experience improvements.

Fixed

Bug fixes.

Deprecated

Features scheduled for removal.

Removed

Features removed.

Security

Security improvements.

Documentation

Documentation updates.

Database

Schema or migration changes.

--------------------------------------------------

Version Numbering

Major Version

Breaking architectural changes.

Example

4.0

Minor Version

New feature release.

Example

3.5

Patch Version

Bug fixes and small improvements.

Example

3.5.1

--------------------------------------------------

Release Rules

Every completed release must:

Be fully tested.

Be manually verified.

Pass build verification.

Be committed to Git.

Be pushed to GitHub.

Update documentation if necessary.

Be recorded in this changelog.

--------------------------------------------------

Documentation Rules

If a release changes architecture

Update

ARCHITECTURE.md

If a release changes database

Update

DATABASE.md

If a release changes workflow

Update

WORKFLOW.md

If a release changes standards

Update

ENGINEERING_STANDARDS.md

If a release changes project direction

Update

PROJECT_BIBLE.md

--------------------------------------------------

Breaking Change Policy

Breaking changes should be avoided whenever possible.

If unavoidable, document:

Reason

Affected Modules

Migration Steps

Rollback Strategy

Expected Impact

--------------------------------------------------

Database Change Policy

Every schema modification should include:

Migration Name

Migration Purpose

Affected Tables

Rollback Strategy

Verification Status

--------------------------------------------------

Deployment Policy

Each release should record:

Development

Testing

Production

Rollback Completed

Deployment Date

--------------------------------------------------

Testing Policy

Every release must verify:

Application starts.

Application builds.

Authentication works.

Database works.

Storage works.

Routing works.

Responsive layout verified.

No console errors.

No TypeScript errors.

--------------------------------------------------

Developer Notes

Every release should include engineering notes.

Examples

Architectural decisions.

Known limitations.

Future improvements.

Technical debt.

Lessons learned.

--------------------------------------------------

Current Project Status

Current Stable Version

3.0

Development Status

Active Development

Primary Branch

main

Source of Truth

GitHub

Development Environment

VS Code

Production Hosting

Vercel

Backend

Supabase

--------------------------------------------------

Final Statement

This changelog serves as the official release history of the Smart Business Profile project.

Every completed version should be recorded here before beginning the next version.

Maintaining an accurate changelog provides traceability, simplifies debugging, supports future development, and preserves the historical evolution of the project.
