# Smart Business Profile
## Database Documentation

**Version:** 1.0

---

# Purpose

This document defines the database architecture of the Smart Business Profile project.

It serves as the authoritative reference for:

- Database schema
- Tables
- Relationships
- Indexes
- Row Level Security (RLS)
- Storage buckets
- Migration history
- Future database roadmap

This document must always reflect the current production database.

---

# Database Overview

Database Provider

- Supabase

Database Engine

- PostgreSQL

Authentication

- Supabase Authentication

Storage

- Supabase Storage

Security

- Row Level Security (RLS)

Migration Strategy

- SQL Migrations

---

# Database Design Principles

The database is designed around the following principles:

- Simplicity
- Data Integrity
- Scalability
- Security
- Maintainability
- Backward Compatibility

Every schema modification must be performed using SQL migrations.

Manual production schema changes should be avoided.

---

# Current Database Schema

## Table: business_profiles

Purpose

Stores the primary business profile for each authenticated user.

---

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary Key |
| business_name | TEXT | No | Business name |
| owner_name | TEXT | Yes | Owner's name |
| business_category | TEXT | Yes | Business category |
| phone_number | TEXT | Yes | Primary phone number |
| whatsapp_number | TEXT | Yes | WhatsApp number |
| email | TEXT | Yes | Business email |
| website | TEXT | Yes | Website URL |
| address | TEXT | Yes | Business address |
| about_business | TEXT | Yes | Business description |
| tagline | TEXT | Yes | Short business tagline for future profile enrichment |
| services | JSONB | Yes | Future editable list of business services |
| working_hours | JSONB | Yes | Weekly business hours |
| google_maps_url | TEXT | Yes | Google Maps profile or location link |
| social_links | JSONB | Yes | Future social media links |
| keywords | TEXT[] | Yes | Business keywords/tags for future discovery |
| cover_banner_url | TEXT | Yes | Future cover banner image URL |
| gallery_images | TEXT[] | Yes | Future gallery image URLs |
| is_public | BOOLEAN | Yes | Profile visibility flag |
| profile_image_url | TEXT | Yes | Business logo/profile image |
| profile_qr_code | TEXT | Yes | Generated QR code URL |
| slug | TEXT | No | Public unique slug |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

---

# Primary Key

```sql
id
```

---

# Unique Constraints

```sql
slug
```

Every business profile must have a unique public slug.

---

# Relationships

Current Version

No foreign-key relationships currently exist.

Future versions will introduce relational tables.

---

# Indexes

Current indexes:

| Index | Purpose |
|--------|----------|
| Primary Key (id) | Fast lookups |
| Unique Index (slug) | Public profile retrieval |

Additional indexes will be added only when required.

---

# Row Level Security (RLS)

Status

Enabled

---

## Security Policy

Authenticated users may:

- Create their own profile
- Read their own profile
- Update their own profile
- Delete their own profile

Public users may:

- Read public business profiles where applicable

Users may never access another user's private records.

---

# Authentication

Authentication Provider

Supabase Authentication

Current authentication method:

- Email & Password

Future authentication methods may include:

- Google
- Apple
- Phone OTP

---

# Storage

Storage Provider

Supabase Storage

---

## Current Buckets

| Bucket | Purpose |
|----------|----------|
| business-images | Business logos and profile images |
| business-assets | Public business profile images for logos, future cover banners, and future gallery images |

Future buckets may include:

- Documents
- Verification Files

---

## Bucket: business-assets

Purpose

Stores public-facing image assets for business profiles.

Status

Migration prepared in Version 3.8. Manual Supabase review and execution required before production use.

Folder structure

```
business-profiles/{owner_id}/{business_profile_id}/logo/{file}
business-profiles/{owner_id}/{business_profile_id}/cover/{file}
business-profiles/{owner_id}/{business_profile_id}/gallery/{file}
```

Allowed image types

- image/jpeg
- image/png
- image/webp

Maximum file size

- 5 MB

Access model

- Public read for displaying public profile and directory images.
- Authenticated upload/update/delete for assets inside the authenticated user's owner_id folder.
- Application code generates controlled asset paths.

Developer notes

Version 3.8 adds helper functions for logo, cover, and gallery uploads. Only logo upload is integrated into the current UI. Cover banner and gallery UI are intentionally not implemented yet.

---

# Migration History

| Version | Migration | Status |
|----------|-----------|--------|
| 2.1 | Initial business_profiles table | Completed |
| 2.2 | Supabase CRUD integration | Completed |
| 2.3 | Public slug support | Completed |
| 3.5 | Profile enrichment schema foundation | Pending |
| 3.8 | Supabase Storage foundation for business-assets bucket | Pending manual review |
| Future | Additional modules | Planned |

Detailed migration SQL should remain inside the `/supabase/migrations` directory.

---

# Planned Tables

The following tables are planned but do not yet exist.

| Table | Status |
|---------|--------|
| reviews | Planned |
| appointments | Planned |
| customers | Planned |
| crm_contacts | Planned |
| analytics | Planned |
| subscriptions | Planned |
| payments | Planned |
| notifications | Planned |
| business_gallery | Planned |
| business_services | Planned |
| business_products | Planned |

These tables should not be created until their corresponding feature is approved.

---

# Database Naming Conventions

Tables

- snake_case
- plural nouns

Examples

```
business_profiles
appointments
customers
reviews
```

Columns

- snake_case

Examples

```
created_at
updated_at
phone_number
business_name
```

Primary Keys

```
id
```

Foreign Keys

```
user_id
business_id
appointment_id
```

---

# Migration Rules

Every database change must:

- Use SQL migrations
- Be reversible
- Be reviewed before execution
- Preserve existing production data
- Include rollback strategy

Never modify production schema manually.

---

# Backup Strategy

The database must always support recovery.

Before major schema changes:

- Verify current production state
- Backup important data if necessary
- Review migration
- Execute migration
- Verify migration
- Test application

---

# Future Database Roadmap

Phase 1

- Business Profiles

Completed

---

Phase 2

- Public Directory
- Search
- Categories

Planned

---

Phase 3

- Reviews
- CRM
- Appointments

Planned

---

Phase 4

- Payments
- Subscriptions

Planned

---

Phase 5

- AI Features
- Analytics

Planned

---

# Non-Negotiable Rules

- Never manually edit production tables.
- Never disable RLS without approval.
- Never delete production data.
- Never rename production columns without migration.
- Never modify schema outside SQL migrations.
- Every migration must be verified.
- Every migration must have a rollback plan.
- Data integrity always takes priority over feature speed.

---

# Final Statement

The database is one of the most critical components of the Smart Business Profile platform.

Every schema modification must prioritize:

- data integrity
- security
- scalability
- maintainability
- backward compatibility

This document must always reflect the current production database and should be updated whenever a migration is introduced.
