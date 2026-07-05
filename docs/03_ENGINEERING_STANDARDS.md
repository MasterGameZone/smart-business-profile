# Smart Business Profile
# Engineering Standards

Version: 1.0

Document Purpose

This document defines the engineering standards that every contributor must follow while working on the Smart Business Profile project.

These standards ensure consistency, maintainability, scalability, security, and long-term code quality.

Every new feature, bug fix, refactor, or architectural change must comply with these standards.

--------------------------------------------------

1. Engineering Philosophy

The project follows the following engineering principles.

- Build production-ready software.
- Prioritize readability over cleverness.
- Prefer simplicity over complexity.
- Maintain consistency across the project.
- Write maintainable code.
- Protect existing functionality.
- Keep architectural boundaries clear.
- Minimize technical debt.
- Optimize only when necessary.

--------------------------------------------------

2. General Coding Standards

Code should always be:

- Readable
- Predictable
- Reusable
- Testable
- Type-safe
- Well-structured
- Self-explanatory

Avoid writing code that requires excessive comments to understand.

The code itself should clearly communicate its purpose.

--------------------------------------------------

3. React Standards

Use Functional Components only.

Do not use Class Components.

Each component should have a single responsibility.

Components should remain as small as reasonably possible.

Avoid deeply nested JSX.

Prefer composition over inheritance.

Prefer reusable components over duplicated UI.

Business logic should not live inside UI components.

Keep render functions simple.

Never access Supabase directly inside components.

Component responsibilities

Presentation Components

- Display data
- Handle user interaction
- Receive data through props

Container Components

- Coordinate business logic
- Connect hooks with presentation components

Reusable Components

- Must remain generic
- Must not depend on specific pages

--------------------------------------------------

4. TypeScript Standards

Always use TypeScript.

Avoid using "any".

Prefer explicit interfaces.

Prefer type safety over convenience.

Create shared types inside the types directory.

Every API response should have a defined type.

Every function should have clear parameter types.

Every exported function should define a return type.

Never suppress TypeScript errors without approval.

--------------------------------------------------

5. Naming Conventions

Folders

Use lowercase.

Example

components
services
hooks
utils

Files

Use PascalCase for React components.

BusinessProfileCard.tsx

DashboardLayout.tsx

Use camelCase for utility files.

slugGenerator.ts

validation.ts

Hooks

Always begin with "use".

Examples

useAuth

useBusinessProfile

useSearch

Components

PascalCase

BusinessCard

ProfileEditor

DashboardPage

Variables

camelCase

Functions

camelCase

Constants

UPPER_SNAKE_CASE

Interfaces

PascalCase

BusinessProfile

Appointment

Enums

PascalCase

--------------------------------------------------

6. Folder Conventions

components

Reusable UI.

pages

Application routes.

hooks

Reusable business logic.

services

Backend communication.

types

Shared types.

utils

Utility functions.

assets

Images and static assets.

docs

Project documentation.

Each file should exist only in the folder that matches its responsibility.

--------------------------------------------------

7. Import Order

Imports should always follow the same order.

1. React

2. Third-party libraries

3. Internal services

4. Hooks

5. Components

6. Utilities

7. Types

8. Assets

Example

React

External Libraries

Services

Hooks

Components

Utilities

Types

Assets

Maintain one blank line between import groups.

Avoid unnecessary imports.

Remove unused imports immediately.

--------------------------------------------------

8. Component Standards

Each component should:

Have one responsibility.

Receive data through props.

Avoid direct API access.

Avoid database logic.

Avoid authentication logic.

Avoid duplicate UI.

Component file should normally contain:

Imports

Types

Component

Helper functions

Export

Large components should be divided into smaller reusable components.

--------------------------------------------------

9. Service Layer Standards

All communication with Supabase must occur inside the service layer.

Services should:

Perform CRUD operations.

Handle API errors.

Return typed responses.

Never manipulate UI.

Never access browser-specific functionality.

Keep services independent from React components.

--------------------------------------------------

10. Hook Standards

Hooks should contain reusable business logic.

Hooks may:

Load data.

Manage state.

Handle pagination.

Handle filtering.

Coordinate services.

Hooks should not contain UI.

--------------------------------------------------

11. Error Handling Standards

Every asynchronous operation should handle errors.

Use try/catch where appropriate.

Display user-friendly messages.

Log useful debugging information during development.

Never expose internal implementation details to users.

--------------------------------------------------

12. Performance Guidelines

Avoid unnecessary rendering.

Use memoization only when justified.

Avoid premature optimization.

Reuse components.

Minimize API requests.

Lazy load large modules where appropriate.

Avoid duplicated state.

Avoid expensive calculations during rendering.

--------------------------------------------------

13. Security Guidelines

Never commit secrets.

Never commit .env.

Never expose API keys.

Always validate user input.

Always sanitize uploaded files.

Never trust client-side validation alone.

Always rely on Supabase Row Level Security.

Never bypass authentication.

Never disable security policies without approval.

--------------------------------------------------

14. Dependency Management

Do not install new packages without architectural approval.

Before adding a dependency:

Determine whether the functionality already exists.

Evaluate long-term maintenance.

Consider bundle size.

Review security implications.

Avoid unnecessary libraries.

--------------------------------------------------

15. Git Standards

GitHub is the single source of truth.

One feature equals one commit.

Commit messages should be descriptive.

Examples

Version 3.2 - Added business directory search

Version 3.3 - Fixed profile image upload

Never commit:

.env

node_modules

dist

Temporary files

Debug files

--------------------------------------------------

16. Code Review Standards

Every implementation should be reviewed before merging.

Review should verify:

Architecture

Readability

Type safety

Security

Performance

Consistency

Backward compatibility

Documentation

--------------------------------------------------

17. Testing Standards

Every feature should be tested before commit.

Minimum verification includes:

Application builds successfully.

Application starts successfully.

No console errors.

No TypeScript errors.

No lint errors.

Existing functionality continues working.

New functionality works correctly.

Responsive layout verified.

--------------------------------------------------

18. Documentation Standards

Every significant architectural decision should be documented.

Major features should update:

Architecture

Database

Workflow

Changelog

Roadmap

Documentation should evolve with the project.

--------------------------------------------------

19. Refactoring Standards

Refactoring should never occur alongside unrelated feature development.

Only refactor when:

Improving maintainability.

Removing duplication.

Fixing architectural issues.

Improving readability.

Every refactor should preserve behavior.

--------------------------------------------------

20. AI Engineering Standards

AI-generated code is not automatically accepted.

Every implementation must:

Follow project architecture.

Follow naming conventions.

Follow folder conventions.

Pass build verification.

Pass manual testing.

Preserve backward compatibility.

Minimize unrelated changes.

Respect documented engineering standards.

--------------------------------------------------

21. Definition of Done

A task is considered complete only when:

Implementation is finished.

Application builds successfully.

Application runs successfully.

No console errors exist.

No TypeScript errors exist.

Manual testing passes.

Documentation is updated if necessary.

Code review is complete.

Git status is clean.

Commit is created.

Changes are pushed to GitHub.

--------------------------------------------------

22. Final Statement

Engineering quality is a long-term investment.

Every contributor, including AI assistants, must follow these standards to ensure that the Smart Business Profile platform remains consistent, maintainable, scalable, secure, and production-ready throughout its lifetime.

These standards are mandatory unless an approved architectural decision explicitly overrides them.
