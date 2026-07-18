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
| availability_override | TEXT | Yes | Manual availability override: `open`, `closed`, or null |
| availability_override_updated_at | TIMESTAMP WITH TIME ZONE | Yes | Last manual availability override update timestamp |
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

## Table: business_owner_profiles

Purpose

Stores personal Business Owner account details for authenticated users inside the Business Account menu. Account email remains managed by Supabase Auth and is not duplicated in this table.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| user_id | UUID | No | Primary key and reference to `auth.users.id` |
| name | TEXT | Yes | Business Owner display name |
| phone_number | TEXT | Yes | Business Owner phone number |
| preferred_city | TEXT | Yes | Business Owner preferred city |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated users may select, insert, and update only their own Business Owner profile.

---

## Table: business_owner_subscriptions

Purpose

Stores the account-level subscription state for a Business Owner. A single subscription belongs to `auth.users.id` and applies to every business profile owned by that account. Free is represented by the absence of a subscription row.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| owner_id | UUID | No | Subscription owner; reference to `auth.users.id` |
| plan_id | TEXT | No | Paid plan identifier: `pro_analytics` |
| billing_provider | TEXT | No | Future billing provider identifier (1–50 characters) |
| provider_customer_id | TEXT | Yes | Future provider customer identifier |
| provider_subscription_id | TEXT | Yes | Future provider subscription identifier |
| provider_plan_id | TEXT | Yes | Future provider plan identifier |
| status | TEXT | No | `incomplete`, `active`, `past_due`, `canceled`, or `expired` |
| billing_interval | TEXT | No | `monthly` only |
| currency | TEXT | No | `INR` only |
| amount_minor_units | INTEGER | No | Price in minor units; currently `4500` for ₹45/month |
| current_period_start | TIMESTAMP WITH TIME ZONE | Yes | Current paid-period start |
| current_period_end | TIMESTAMP WITH TIME ZONE | Yes | Current paid-period end |
| cancel_at_period_end | BOOLEAN | No | Whether cancellation is scheduled for period end |
| grace_period_end | TIMESTAMP WITH TIME ZONE | Yes | End of a permitted past-due grace period |
| canceled_at | TIMESTAMP WITH TIME ZONE | Yes | Cancellation timestamp |
| ended_at | TIMESTAMP WITH TIME ZONE | Yes | Subscription-end timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Each owner may have only one row. The plan, interval, currency, amount, provider length, and current-period ordering are constrained in the database. Provider subscription IDs are additionally unique per provider when present. Indexes support provider/customer lookups and status/period-expiry processing.

RLS is enabled. Authenticated users can read only their own row and only the safe lookup columns (`owner_id`, plan/status/billing fields, period fields, cancellation flag, and grace-period end). They receive no direct insert, update, or delete permission and cannot access provider identifiers, lifecycle audit timestamps, or another owner's subscription. Trusted backend processes use server-side credentials for writes.

Effective Pro access is true only for an unexpired `active` period, a `past_due` row with an unexpired grace period, or a `canceled` row with an unexpired paid period. Scheduling `cancel_at_period_end = true` does not remove access before that valid active period ends. Expiration never deletes analytics or business-profile data.

---

## Table: subscription_webhook_events

Purpose

Provides an account/subscription webhook audit and idempotency foundation for future trusted billing-provider processing. It is not exposed to the frontend.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| billing_provider | TEXT | No | Provider identifier (1–50 characters) |
| provider_event_id | TEXT | No | Non-blank provider event identifier |
| event_type | TEXT | No | Non-blank provider event type |
| subscription_id | UUID | Yes | Reference to `business_owner_subscriptions.id`; set null if removed |
| owner_id | UUID | Yes | Reference to `auth.users.id`; set null if removed |
| provider_customer_id | TEXT | Yes | Future provider customer identifier |
| provider_subscription_id | TEXT | Yes | Future provider subscription identifier |
| provider_created_at | TIMESTAMP WITH TIME ZONE | Yes | Provider event timestamp |
| processing_status | TEXT | No | `received`, `processed`, `ignored`, or `failed` |
| processing_attempts | INTEGER | No | Processing retry count, zero or greater |
| payload | JSONB | No | Sanitized, signature-verified event object only |
| last_error | TEXT | Yes | Last trusted-processing error |
| received_at | TIMESTAMP WITH TIME ZONE | No | Receipt timestamp |
| processed_at | TIMESTAMP WITH TIME ZONE | Yes | Processing-completion timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

The unique `(billing_provider, provider_event_id)` constraint makes provider events idempotent. Indexes support subscription correlation, processing queues, and owner-related webhook event lookups. The `owner_id` index supports the `owner_id` foreign key and efficient foreign-key maintenance when an `auth.users` record is deleted. RLS is enabled with no anonymous or authenticated policies or table privileges. Only trusted backend processes may access it. Payloads must be JSON objects and must be sanitized; they must never contain secrets, API keys, webhook secrets, card data, or payment credentials.

---

## Function: get_my_business_subscription()

`get_my_business_subscription()` is an authenticated-only, stable, security-invoker lookup that relies on the owner-only subscription RLS policy. It returns exactly one safe row and never exposes provider identifiers or webhook information.

The returned fields are `plan_id`, `subscription_status`, `billing_interval`, `currency`, `amount_minor_units`, current-period bounds, `cancel_at_period_end`, `grace_period_end`, and `has_pro_access`. If no subscription exists (or no row is visible), it safely returns Free: `free` plan/status, `INR`, zero minor units, null period fields, `false` cancellation, and `false` Pro access. Its Pro-access calculation follows the effective-access rules documented for `business_owner_subscriptions`.

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
| status | TEXT | No | `Nominated`, `Invitation Shared`, `Business Signed Up`, `Switched to Business Owner`, or `Profile Published` |
| published_profile_id | UUID | Yes | Linked published `business_profiles.id`, when an invited owner completes profile publishing |
| invitation_shared_at | TIMESTAMP WITH TIME ZONE | Yes | Last share/copy timestamp |
| invitation_opened_at | TIMESTAMP WITH TIME ZONE | Yes | First timestamp when the public support invitation link was opened |
| invitation_open_count | INTEGER | No | Total public opens recorded for the support invitation link |
| invited_owner_user_id | UUID | Yes | Authenticated invited business owner account that claimed the support invitation |
| business_signed_up_at | TIMESTAMP WITH TIME ZONE | Yes | First timestamp when the support invitation was claimed by an authenticated account |
| business_owner_switched_at | TIMESTAMP WITH TIME ZONE | Yes | First timestamp when the invited owner entered Business Owner mode after claiming the support invitation |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated users may select, insert, and update only their own supported businesses. No public or anonymous read access is granted. A narrow `mark_support_invite_profile_published` RPC validates authenticated profile ownership and public profile state before linking an invitation to a published profile. A public-safe `mark_support_invite_opened` RPC updates only invitation open tracking fields for a matching invitation token and returns no customer private data. A public-safe `get_support_invite_preview` RPC returns only the inviter display name for the invite landing page. An authenticated-only `mark_support_invite_business_signed_up` RPC claims a matching invitation token for the current user without exposing private customer data or overwriting another linked invited owner. An authenticated-only `mark_support_invite_business_owner_switched` RPC marks the first Business Owner mode entry for the invited owner without exposing private support data. An authenticated-only `mark_current_user_support_invite_business_owner_switched` fallback RPC marks eligible claimed, non-published support invites for the current authenticated invited owner when the original invite token is unavailable. An authenticated-only `get_customer_support_invite_profile_states` RPC returns only support row id and profile-started state for the current customer's support rows.

---

## Table: customer_notifications

Purpose

Stores private customer-owned notifications for customer activity, supported-business updates, report status updates, and saved-business updates.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| customer_id | UUID | No | Reference to `auth.users.id` |
| type | TEXT | No | Notification type |
| title | TEXT | No | Short notification title |
| message | TEXT | No | Notification message |
| action_label | TEXT | Yes | Optional action label |
| action_url | TEXT | Yes | Optional internal action URL |
| related_entity_type | TEXT | Yes | Optional related entity type |
| related_entity_id | UUID | Yes | Optional related entity id |
| is_read | BOOLEAN | No | Whether the customer has read the notification |
| read_at | TIMESTAMP WITH TIME ZONE | Yes | Timestamp when marked read |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated customers may select their own notifications and update only the `is_read` and `read_at` columns on their own notifications. Support invite milestone RPCs create deduplicated notifications for first invite open, first business sign-up, first Business Owner mode switch, profile publication, and supporter-level unlock events. Shape the Platform participation RPCs create deduplicated notifications for feature votes and feature suggestion submissions. Supporter programme announcement sync creates deduplicated notifications for new benefit announcements, benefit status updates, and supporter-only announcements.

---

## Table: supporter_program_announcements

Purpose

Stores published supporter programme announcements that can be synced into each customer's private notification inbox.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| announcement_type | TEXT | No | `new_benefit_announced`, `benefit_status_updated`, or `supporter_only_announcement` |
| benefit_key | TEXT | Yes | Optional stable benefit key |
| benefit_name | TEXT | Yes | Optional supporter benefit name |
| old_status | TEXT | Yes | Optional previous benefit status |
| new_status | TEXT | Yes | Optional new benefit status |
| title | TEXT | No | Notification title |
| message | TEXT | No | Notification message/body |
| action_target | TEXT | Yes | Optional safe internal action target |
| is_published | BOOLEAN | No | Whether the announcement is published |
| published_at | TIMESTAMP WITH TIME ZONE | Yes | Publication timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Allowed benefit status values are `Active / Improving`, `Planned`, `Coming Soon`, and `Under Review`.

Authenticated users may select only published announcements where `is_published = true`, `published_at` is present, and `published_at <= now()`. No anonymous access is granted. No frontend insert, update, or delete grants are provided.

The authenticated-only `sync_supporter_program_announcement_notifications` RPC creates missing `customer_notifications` rows for the current user from published announcements. Notifications are deduped per user, notification type, and `supporter_program_announcement` related entity id. Benefit announcement and benefit status notifications open Customer Account -> Community -> Benefit. Supporter-only announcements default to Customer Account -> Community unless their `action_target` matches an allowed internal Community target.

---

## Table: business_owner_notifications

Purpose

Stores private Business Owner notifications for profile update reminders and future support, review/report, and subscription/payment updates. Customer notifications remain separate in `customer_notifications`.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| owner_id | UUID | No | Reference to `auth.users.id` |
| type | TEXT | No | Notification type |
| title | TEXT | No | Short notification title |
| message | TEXT | No | Notification message |
| action_label | TEXT | Yes | Optional action label |
| action_url | TEXT | Yes | Optional internal action URL |
| related_entity_type | TEXT | Yes | Optional related entity type |
| related_entity_id | UUID | Yes | Optional related entity id |
| dedupe_key | TEXT | Yes | Optional key used to prevent duplicate notification creation |
| is_read | BOOLEAN | No | Whether the Business Owner has read the notification |
| read_at | TIMESTAMP WITH TIME ZONE | Yes | Timestamp when marked read |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated Business Owners may select and insert only their own notifications and update only the `is_read` and `read_at` columns on their own notifications.

---

## Table: business_owner_notification_preferences

Purpose

Stores private Business Owner in-app notification On/Off preferences. Missing rows are interpreted by the application as notifications enabled.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| owner_id | UUID | No | Primary key and reference to `auth.users.id` |
| notifications_enabled | BOOLEAN | No | Whether Business Owner in-app notifications are enabled |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated Business Owners may select, insert, and update only their own notification preference row. No customer notification settings are stored in this table.

---

## Table: business_owner_help_suggestions

Purpose

Stores private Business Owner suggestions, help requests, issue reports, and profile-improvement help submissions from the Business Account menu.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| owner_id | UUID | No | Reference to `auth.users.id` |
| type | TEXT | No | `suggestion`, `help_request`, `issue_problem`, or `profile_improvement_help` |
| subject | TEXT | No | Submission subject |
| message | TEXT | No | Submission message |
| status | TEXT | No | Submission status, defaulting to `submitted` |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated Business Owners may insert and select only their own submissions. The MVP does not provide update/delete UI or reply/status tracking inside the menu.

---

## Table: customer_feature_votes

Purpose

Stores private customer votes for predefined upcoming platform features.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| customer_id | UUID | No | Reference to `auth.users.id` |
| feature_key | TEXT | No | Stable predefined feature key |
| feature_title | TEXT | No | Display title for the voted feature |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Each customer may vote once per feature through a unique `(customer_id, feature_key)` constraint. Access is restricted by RLS to the authenticated owner of each row. Authenticated customers may select, insert, and delete only their own feature votes. No anonymous or public access is granted.

---

## Table: customer_platform_suggestions

Purpose

Stores private customer-submitted feature suggestions, category suggestions, and platform improvement ideas.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| customer_id | UUID | No | Reference to `auth.users.id` |
| suggestion_type | TEXT | No | `Feature Suggestion`, `Category Suggestion`, or `Platform Improvement` |
| title | TEXT | No | Short suggestion title |
| message | TEXT | No | Suggestion details |
| status | TEXT | No | Suggestion status, defaulting to `Submitted` |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to the authenticated owner of each row. Authenticated customers may select and insert only their own suggestions, and new customer-created suggestions must start with `Submitted` status. No customer update/delete UI or anonymous/public access is provided in the MVP.

---

## Table: customer_help_feedback_requests

Purpose

Stores private customer-submitted support requests, problem reports, and general feedback.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| customer_id | UUID | No | Reference to `auth.users.id` |
| request_type | TEXT | No | `Contact Support`, `Problem Report`, or `Feedback` |
| category | TEXT | Yes | Selected support category, problem category, or feedback type |
| title | TEXT | No | Subject, short problem description, or derived feedback title |
| message | TEXT | No | Customer-submitted request details |
| satisfaction_level | TEXT | Yes | Optional customer satisfaction level for feedback requests |
| status | TEXT | No | Request status, defaulting to `Submitted` |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | No | Last update timestamp |

Access is restricted by RLS to authenticated customer-owned inserts. Customers can submit their own requests with `Submitted` status only. The MVP does not grant customer read/update/delete access and does not expose support ticket history or status tracking UI.

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

## Table: business_profile_followers

Purpose

Stores authenticated user follows for public business profiles. Follow is separate from Saved Businesses/Favorites and is intended for follower counts and future business updates.

### Columns

| Column | Type | Nullable | Description |
|----------|------|----------|-------------|
| id | UUID | No | Primary key |
| profile_id | UUID | No | Reference to `business_profiles.id` |
| user_id | UUID | No | Reference to `auth.users.id` |
| created_at | TIMESTAMP WITH TIME ZONE | No | Record creation timestamp |

Each user may follow a business profile once through a unique `(profile_id, user_id)` constraint. Authenticated users may select and delete only their own follow records and may insert only their own follow records for public profiles they do not own. Anonymous users cannot insert or delete follows. A narrow `get_business_profile_followers_count` RPC returns public follower counts without exposing follower rows.

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
| 4.26 | Customer notifications MVP | Migration created; apply to Supabase |
| 4.27 | Customer Shape the Platform MVP | Migration created; apply to Supabase |
| 4.28 | Customer Help & Feedback MVP | Migration created; apply to Supabase |
| 4.29 | Business availability manual override | Migration created; apply to Supabase |
| 4.30 | Business Owner notification preferences | Migration created; apply to Supabase |
| 4.31 | Business profile followers | Migration created; apply to Supabase |
| 4.32 | 20260718160000_add_business_owner_subscription_foundation.sql | Applied to Supabase|
| 4.33 | 20260718160001_add_subscription_webhook_owner_index.sql | Applied to Supabase |
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
