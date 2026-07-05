# Smart Business Profile
# Architecture Documentation

Version: 1.0

Document Purpose

This document defines the technical architecture of the Smart Business Profile platform.

Its purpose is to provide a complete understanding of how the application is designed, how the different modules interact, how data flows through the system, and how future features should integrate into the existing architecture.

This document is intended for:

- Developers
- Architects
- AI Coding Assistants
- Future Contributors

This document should be read before making architectural or structural changes to the project.

--------------------------------------------------

1. Architecture Philosophy

The Smart Business Profile platform follows the following engineering principles.

- Modular architecture
- Component-based UI
- Separation of concerns
- Single responsibility principle
- Type safety
- API abstraction
- Secure backend integration
- Scalable project structure
- Minimal coupling
- High maintainability

Every new feature should integrate into the existing architecture instead of introducing parallel implementations.

--------------------------------------------------

2. High Level Architecture

System Overview

                    User
                      │
                      ▼
                React Application
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
  UI Components               Business Logic
        │                           │
        └─────────────┬─────────────┘
                      ▼
                Service Layer
                      │
                      ▼
                 Supabase SDK
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   PostgreSQL                 Storage Bucket
        │
        ▼
 Authentication

The frontend never communicates directly with the database.

All communication should happen through the service layer.

--------------------------------------------------

3. Folder Structure

Current Project Structure

src/

Contains all application source code.

components/

Reusable UI components.

pages/

Application pages.

services/

Supabase services.

hooks/

Custom React hooks.

types/

Shared TypeScript types.

utils/

Utility functions.

assets/

Static assets used by the application.

public/

Public static files.

supabase/

SQL migrations.

docs/

Project documentation.

.github/

GitHub configuration.

.vscode/

Workspace configuration.

--------------------------------------------------

4. Folder Responsibilities

components/

Contains reusable UI elements.

Examples

- Buttons
- Cards
- Inputs
- Forms
- Navigation
- Dialogs

Rules

Components should not directly communicate with Supabase.

Components should receive data through props or hooks.

--------------------------------------------------

pages/

Each route should correspond to one page.

Examples

Home

Dashboard

Business Profile

Public Profile

Directory

Settings

--------------------------------------------------

services/

Responsible for all backend communication.

Responsibilities

- Database queries
- Authentication
- Storage
- API abstraction

Rules

Supabase client should only be used inside this layer.

--------------------------------------------------

hooks/

Contains reusable business logic.

Examples

Authentication

Data loading

Pagination

Search

Filtering

State synchronization

--------------------------------------------------

types/

Contains all shared TypeScript interfaces.

Examples

BusinessProfile

User

Category

Review

Appointment

--------------------------------------------------

utils/

Contains helper functions.

Examples

Slug generation

Validation

Formatting

Date utilities

QR utilities

--------------------------------------------------

5. Component Architecture

Application follows a layered component hierarchy.

Page

↓

Layout

↓

Feature Component

↓

Reusable Component

↓

Primitive Component

Example

Dashboard Page

↓

Dashboard Layout

↓

Business Card

↓

Profile Card

↓

Button

Business logic should never exist inside primitive UI components.

--------------------------------------------------

6. Routing Architecture

Current Routing

/

Landing Page

/login

Authentication

/dashboard

User Dashboard

/profile

Business Profile Editor

/business/:slug

Public Business Profile

Future Routes

/directory

/search

/settings

/admin

/subscription

/analytics

Rules

Every route should represent one feature.

Route components should remain lightweight.

Heavy logic should be delegated to hooks and services.

--------------------------------------------------

7. State Management

Current State Management

React State

React Context

Supabase

Future

If application complexity increases significantly, a dedicated state management solution may be introduced after architectural review.

Current Principles

Prefer local state whenever possible.

Avoid unnecessary global state.

Server data should remain in Supabase.

Derived values should not be duplicated.

--------------------------------------------------

8. API Flow

Request Lifecycle

User Action

↓

React Component

↓

Custom Hook

↓

Service Layer

↓

Supabase Client

↓

Database

↓

Response

↓

Service Layer

↓

Hook

↓

Component

↓

UI Update

No component should call Supabase directly.

--------------------------------------------------

9. Supabase Architecture

Supabase Services

Authentication

Database

Storage

Row Level Security

Future

Realtime

Edge Functions

--------------------------------------------------

10. Authentication Architecture

Current

Email and Password

Future

Google Login

Apple Login

Phone Authentication

Authentication Flow

User Login

↓

Supabase Auth

↓

JWT

↓

Authenticated Session

↓

Protected Routes

--------------------------------------------------

11. Database Architecture

Current Primary Table

business_profiles

Future Tables

reviews

appointments

customers

subscriptions

analytics

payments

notifications

services

products

Relationships should be introduced only when required.

--------------------------------------------------

12. Storage Architecture

Current

Business Images

Future

Gallery Images

Documents

Verification Files

Marketing Assets

Storage Rules

Never store sensitive data publicly.

Always validate uploaded files.

Restrict bucket permissions.

--------------------------------------------------

13. Security Model

Principles

Least privilege

Authenticated access

Row Level Security

Secure environment variables

No secrets inside source code

Rules

Never commit .env.

Never expose Supabase keys.

Always validate user input.

Always sanitize uploaded files.

Never bypass RLS.

--------------------------------------------------

14. Error Handling Strategy

Errors should be handled at three levels.

Service Layer

Handles API errors.

Hook Layer

Handles loading and retry.

UI Layer

Displays user-friendly messages.

Never expose internal errors directly to users.

--------------------------------------------------

15. Performance Strategy

Current Goals

Fast page load

Minimal API calls

Lazy loading where appropriate

Component reuse

Future Goals

Caching

Image optimization

Code splitting

Virtualization

--------------------------------------------------

16. Scalability Strategy

The architecture should support:

Multiple business profiles

Thousands of users

Large directories

Advanced analytics

AI integrations

Subscription platform

Enterprise organizations

Future expansion should require minimal architectural changes.

--------------------------------------------------

17. Future Architecture

Planned Modules

Business Directory

Search Engine

CRM

Appointment System

Reviews

Analytics

Payments

Subscription Platform

AI Assistant

Admin Panel

API Platform

These modules should integrate into the existing architecture instead of replacing it.

--------------------------------------------------

18. Architectural Constraints

The following rules are mandatory.

Do not introduce duplicate business logic.

Do not bypass the service layer.

Do not directly query Supabase from UI components.

Do not place API logic inside components.

Do not introduce unnecessary dependencies.

Do not perform unrelated refactoring during feature implementation.

Preserve backward compatibility whenever possible.

--------------------------------------------------

19. Architecture Decision Process

Every major architectural change must include:

Problem Statement

Proposed Solution

Alternative Solutions

Risk Analysis

Expected Impact

Rollback Plan

Testing Strategy

Architecture changes require approval before implementation.

--------------------------------------------------

20. Final Statement

This document defines the architectural foundation of the Smart Business Profile platform.

All future development should respect the principles described in this document.

Whenever implementation details conflict with this document, the architecture should be reviewed before changes are made.

The objective is to build a scalable, maintainable, secure, and production-grade software platform that can evolve for many years without requiring major structural redesign.
