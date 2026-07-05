# Smart Business Profile

## Project Bible

**Version:** 1.0

---

# Purpose

This document is the single source of truth for the vision, objectives, engineering philosophy, and long-term direction of the Smart Business Profile project.

Every contributor, AI assistant, engineer, or future maintainer must read this document before making architectural or product decisions.

If any future document conflicts with this Project Bible, **this document takes precedence**.

---

# 1. Vision

Smart Business Profile aims to become the simplest and most powerful platform for creating, managing, and sharing digital business identities for individuals, professionals, and businesses.

The platform should allow anyone to create a professional online business profile within minutes without requiring technical knowledge, website development skills, or expensive software.

The long-term vision is to become the default digital identity platform for small and medium businesses.

---

# 2. Mission

Our mission is to replace traditional visiting cards, static business directories, and fragmented online business information with a modern, centralized, intelligent business profile platform.

The platform should help businesses:

- establish an online presence
- increase discoverability
- simplify customer communication
- manage digital identity
- build trust
- grow their business

without unnecessary complexity.

---

# 3. Product Goals

The project follows the principle of continuous evolution.

The primary product goals are:

### Goal 1

Allow anyone to create a professional digital business profile within minutes.

### Goal 2

Provide a beautiful public business profile page that can be shared using links or QR codes.

### Goal 3

Make profile management extremely simple.

### Goal 4

Provide reliable cloud storage using Supabase.

### Goal 5

Support future AI-powered business tools.

### Goal 6

Scale from a simple profile application into a complete business platform.

---

# 4. Target Users

Primary Users

- Small Businesses
- Shop Owners
- Local Service Providers
- Freelancers
- Consultants
- Professionals
- Startups

Secondary Users

- Restaurants
- Hotels
- Clinics
- Salons
- Educational Institutes
- Agencies
- Retail Stores

Future Users

- Enterprise Businesses
- Franchise Networks
- Multi-location Businesses

---

# 5. Long-Term Roadmap

The roadmap represents the long-term product direction.

Actual implementation order may change.

## Phase 1

Foundation

- Authentication
- Business Profile
- Dashboard
- Public Profile
- QR Code
- Sharing

---

## Phase 2

Business Growth

- Analytics
- Reviews
- Business Directory
- Search
- Categories
- Location Discovery

---

## Phase 3

Customer Management

- Appointments
- CRM
- Leads
- Contact Management
- Notifications

---

## Phase 4

Monetization

- Subscription Plans
- Premium Features
- Payment Gateway
- Business Verification

---

## Phase 5

AI Platform

- AI Assistant
- AI Profile Optimization
- AI Content Generation
- AI Business Insights

---

## Phase 6

Enterprise Platform

- Teams
- Organization Accounts
- Multiple Branches
- Advanced Analytics
- API Platform

---

# 6. Core Principles

Every engineering decision must follow these principles.

## Simplicity

Simple solutions are preferred over complex solutions.

---

## Reliability

Working software is more important than clever software.

---

## Scalability

The architecture should support future growth without major redesign.

---

## Maintainability

Code should be easy to understand, modify, and review.

---

## Security

Security must never be sacrificed for convenience.

---

## Performance

Optimize only when necessary.

Avoid premature optimization.

---

## Stability

Do not break existing functionality while implementing new features.

---

## Incremental Development

Implement one feature at a time.

Every feature must be fully tested before moving to the next.

---

## Documentation First

Major architectural decisions should always be documented.

---

# 7. Version History

| Version | Description            | Status      |
| ------- | ---------------------- | ----------- |
| 0.x     | Foundation Development | Completed   |
| 1.x     | Frontend MVP           | Completed   |
| 2.x     | Supabase Integration   | Completed   |
| 3.x     | Active Development     | In Progress |

Future releases will continue to be documented in CHANGELOG.md.

---

# 8. Non-Negotiable Rules

The following rules must never be violated.

## Product Rules

- Existing functionality must not break.
- Backward compatibility should be preserved whenever possible.
- Every feature must have clear acceptance criteria.
- Every release must be manually verified.

---

## Engineering Rules

- GitHub is the single source of truth.
- Never commit secrets.
- Never commit `.env`.
- Never modify production directly.
- Never perform unrelated refactoring during feature implementation.
- Never introduce unnecessary dependencies.
- Every change must have a rollback path.
- Every migration must be reversible.
- Every implementation must pass verification before commit.

---

## Database Rules

- Database changes must use migrations.
- Manual production changes should be avoided.
- RLS policies must remain enabled unless intentionally changed.

---

## AI Rules

AI assistants must follow the documented workflow.

No AI assistant may independently redesign architecture without explicit approval.

---

# 9. AI Roles

The project follows clearly defined AI responsibilities.

## ChatGPT

Role:

Virtual CTO

Responsibilities

- Product Planning
- Architecture
- System Design
- Database Design
- Engineering Decisions
- Prompt Engineering
- Code Review
- Debugging Strategy
- Documentation
- Risk Analysis
- Release Planning

---

## Codex

Role:

Lead Software Engineer

Responsibilities

- Read project documentation
- Implement approved engineering tasks
- Modify only approved files
- Run builds
- Fix compile errors
- Follow engineering standards
- Stop after implementation
- Wait for review

Codex must not redesign architecture without approval.

---

# 10. Technology Stack

Frontend

- React
- TypeScript
- Vite
- React Router

UI

- Tailwind CSS

Backend

- Supabase

Database

- PostgreSQL

Authentication

- Supabase Authentication

Storage

- Supabase Storage

Version Control

- Git
- GitHub

Development

- VS Code

Hosting

- Vercel

AI

- ChatGPT
- Codex

---

# Project Philosophy

This project prioritizes:

- reliability over speed
- maintainability over shortcuts
- architecture over quick fixes
- documentation over assumptions
- verification over blind implementation

Every significant engineering decision should improve the long-term quality of the project.

---

# Final Statement

The Smart Business Profile project is intended to be developed as a production-grade software platform.

Every feature, architectural decision, database migration, deployment, and code change should align with the principles defined in this Project Bible.

This document is the foundation upon which the entire project is built.

Any future engineering, architectural, or product decision should be evaluated against the standards established here.
