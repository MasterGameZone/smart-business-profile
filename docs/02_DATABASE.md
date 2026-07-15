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
| cover_banner_url | TEXT | Yes | Cover banner image URL |
| gallery_images | TEXT[] | Yes | Gallery image URLs |
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

## Table: user_account_preferences

Purpose

Stores the authenticated user's Business Owner access state and preferred account mode. Customer capability remains available for every authenticated user.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| user_id | UUID | No | Primary key and reference to `auth.users.id` |
| owner_enabled | BOOLEAN | No | Whether Business Owner onboarding has been completed |
| preferred_account_mode | TEXT | No | `customer` or `business_owner` |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Missing rows are interpreted by the application as customer mode with Business Owner access disabled.

---

## Table: customer_profiles

Purpose

Stores basic customer profile and location preference fields for authenticated users. Account email remains managed by Supabase Auth and is not duplicated in this table.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| user_id | UUID | No | Primary key and reference to `auth.users.id` |
| customer_name | TEXT | Yes | Customer display name |
| phone_number | TEXT | Yes | Customer phone number |
| preferred_city | TEXT | Yes | Customer preferred city |
| preferred_area | TEXT | Yes | Customer preferred area or locality |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated users may select, insert, and update only their own customer profile.

---

## Table: customer_business_supports

Purpose

Stores customer-owned nominations/invitations for trusted local businesses. These records do not create or modify business profiles.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| customer_id | UUID | No | Reference to `auth.users.id` |
| business_name | TEXT | No | Nominated business name |
| business_category | TEXT | No | Selected category or `Not specified` |
| business_location | TEXT | No | Single customer-entered location field |
| custom_message | TEXT | Yes | Optional invitation message from the customer |
| invitation_token | UUID | No | Shareable future tracking token |
| status | TEXT | No | `Nominated`, `Invitation Shared`, or `Profile Published` |
| published_profile_id | UUID | Yes | Linked published `business_profiles.id`, when an invited owner completes profile publishing |
| invitation_shared_at | TIMESTAMP WITH TIME ZONE | Yes | Last share/copy timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated users may select, insert, and update only their own supported businesses. No public or anonymous read access is granted. A narrow `mark_support_invite_profile_published` RPC validates authenticated profile ownership and public profile state before linking an invitation to a published profile.

---

## Table: business_profile_documents

Purpose

Stores metadata for optional documents uploaded for a business profile. File bytes are stored in Supabase Storage.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| business_profile_id | UUID | No | Reference to `business_profiles.id` |
| owner_id | UUID | No | Reference to `auth.users.id` |
| document_name | TEXT | Yes | Optional display name for the uploaded document |
| file_name | TEXT | No | Original uploaded file name |
| file_path | TEXT | No | Supabase Storage object path |
| mime_type | TEXT | No | Uploaded document MIME type |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |

Access is restricted by RLS to the owner of the connected business profile.

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

Version 3.8 added helper functions for logo, cover, and gallery uploads. Version 3.9 integrates cover banner and gallery upload/display UI using the same business-assets bucket.

---

# Migration History

| Version | Migration | Status |
|----------|-----------|--------|
| 2.1 | Initial business_profiles table | Completed |
| 2.2 | Supabase CRUD integration | Completed |
| 2.3 | Public slug support | Completed |
| 3.5 | Profile enrichment schema foundation | Pending |
| 3.8 | Supabase Storage foundation for business-assets bucket | Pending manual review |
| 4.21 | Persistent user account-mode preferences | Migration created; apply to Supabase |
| 4.22 | Optional business document display names | Migration created; apply to Supabase |
| 4.23 | Customer profile and location preferences | Migration created; apply to Supabase |
| 4.24 | Customer supported business nominations | Migration created; apply to Supabase |
| 4.25 | Support invite published-profile linking RPC | Migration created; apply to Supabase |
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
