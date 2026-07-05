# AGENTS.md

# Smart Business Profile
# AI Engineering Operating Manual

Version: 1.0

--------------------------------------------------

Purpose

This repository contains the Smart Business Profile platform.

This file defines the mandatory operating rules for every AI coding agent working on this repository.

These instructions apply to every implementation task regardless of the coding agent being used.

Failure to follow these instructions may result in architectural inconsistency, data loss, security issues, or unstable software.

These rules are mandatory.

--------------------------------------------------

Repository Purpose

Smart Business Profile is a production-grade web application built for creating, managing and sharing digital business profiles.

The project is intended to become a scalable business platform over multiple development phases.

This is not an experimental repository.

Every change must prioritize long-term maintainability over short-term convenience.

--------------------------------------------------

Repository Documentation

Before making ANY code changes, read the following documentation in order.

README.md

↓

docs/00_PROJECT_BIBLE.md

↓

docs/01_ARCHITECTURE.md

↓

docs/02_DATABASE.md

↓

docs/03_ENGINEERING_STANDARDS.md

↓

docs/04_WORKFLOW.md

↓

docs/05_CODEX_INSTRUCTIONS.md

↓

Current Engineering Ticket

Never begin implementation without understanding the project documentation.

--------------------------------------------------

Project Authority

Engineering authority follows this hierarchy.

Founder

↓

Project Documentation

↓

Approved Engineering Ticket

↓

AI Coding Agent

The AI coding agent is an implementation assistant.

The AI coding agent is NOT responsible for product decisions or architecture.

--------------------------------------------------

Primary Responsibility

Implement ONLY the approved engineering task.

Nothing more.

Nothing less.

--------------------------------------------------

Primary Objective

Your objective is NOT to maximize the amount of code written.

Your objective is to:

Preserve stability.

Maintain architecture.

Write production-quality code.

Avoid regressions.

Minimize implementation risk.

Leave the repository in a better state than before.

--------------------------------------------------

Implementation Philosophy

Before writing code:

Understand the feature.

Understand the existing implementation.

Understand affected modules.

Understand dependencies.

Understand possible side effects.

Then implement the smallest possible change that solves the problem.

--------------------------------------------------

Golden Rule

When uncertain,

DO NOT GUESS.

Stop.

Explain the uncertainty.

Request clarification.

--------------------------------------------------

Mandatory Development Process

Every implementation must follow this sequence.

Read Documentation

↓

Understand Existing Code

↓

Understand Current Architecture

↓

Review Engineering Ticket

↓

Identify Files

↓

Implement

↓

Build

↓

Test

↓

Verify

↓

Stop

Do not continue beyond the approved scope.

--------------------------------------------------

Scope Control

Only implement the requested feature.

Do NOT perform unrelated improvements.

Do NOT perform cleanup outside the approved scope.

Do NOT perform opportunistic refactoring.

Do NOT redesign existing systems.

Do NOT modify unrelated modules.

Small focused implementations are always preferred.

--------------------------------------------------

Architecture Protection

Preserve existing architecture.

Do not introduce new architectural patterns.

Do not replace existing architecture.

Do not reorganize project structure.

Do not move files without approval.

Do not rename folders without approval.

Do not redesign routing.

Do not redesign authentication.

Do not redesign state management.

Do not redesign service architecture.

--------------------------------------------------

Dependency Policy

Do not install packages unless explicitly approved.

Before adding any dependency, determine whether the required functionality already exists within the current project or standard library.

Avoid dependency bloat.

Avoid duplicate libraries.

Avoid unnecessary abstractions.

--------------------------------------------------

Database Protection

Never modify the production schema directly.

All database changes must use migrations.

Never delete existing tables.

Never rename production columns.

Never remove constraints without approval.

Never disable Row Level Security.

Never expose private data.

Preserve backward compatibility.

--------------------------------------------------

Environment Variables

Never expose secrets.

Never print secrets.

Never commit secrets.

Never commit .env.

Never modify production credentials.

Never hardcode API keys.

Never hardcode tokens.

Never hardcode passwords.

--------------------------------------------------

File Protection

Never modify files outside the approved scope.

Never delete files without explicit approval.

Never rename files without approval.

Never overwrite configuration files unnecessarily.

Never regenerate the entire project.

Never replace working code with generated boilerplate.

--------------------------------------------------

Code Modification Rules

Always modify the minimum number of files required.

Prefer extending existing implementations over replacing them.

Reuse existing utilities.

Reuse existing components.

Reuse existing hooks.

Reuse existing services.

Avoid duplicate code.

Avoid parallel implementations.

--------------------------------------------------

React Standards

Use functional components.

Do not use class components.

Keep components focused.

One responsibility per component.

Avoid deeply nested JSX.

Prefer composition over duplication.

Keep presentation separate from business logic.

--------------------------------------------------

TypeScript Standards

Do not use "any" unless explicitly approved.

Use interfaces where appropriate.

Prefer explicit types.

Do not suppress compiler errors.

Do not disable strict checking.

Every exported function should have a defined return type.

--------------------------------------------------

Service Layer Rules

All backend communication belongs inside the service layer.

Never communicate with Supabase directly from UI components.

Keep services framework-independent whenever possible.

Return typed results.

Handle errors gracefully.

--------------------------------------------------

Component Rules

Components should not:

Query the database.

Contain authentication logic.

Contain routing logic.

Contain business rules.

Contain storage logic.

Components should:

Receive props.

Render UI.

Trigger events.

Delegate business logic.

--------------------------------------------------

State Management Rules

Prefer local state.

Avoid unnecessary global state.

Do not duplicate server state.

Keep state predictable.

--------------------------------------------------

Performance Rules

Avoid unnecessary rendering.

Avoid unnecessary API requests.

Avoid duplicate calculations.

Avoid unnecessary object creation.

Optimize only after identifying a real performance problem.

--------------------------------------------------

Security Rules

Validate all user input.

Assume client-side validation can be bypassed.

Protect authentication boundaries.

Respect Row Level Security.

Never bypass authorization.

Never trust user-provided data.

--------------------------------------------------

Build Verification

Before considering any task complete, execute:

npm run build

The build must succeed.

Compilation errors must be resolved.

--------------------------------------------------

Development Verification

Run:

npm run dev

Verify:

Application starts.

No runtime errors.

No console errors.

Feature behaves correctly.

Existing functionality still works.

--------------------------------------------------

Required Testing

Every implementation must verify:

Successful build.

Successful startup.

No TypeScript errors.

No runtime errors.

No console errors.

No broken routes.

No broken imports.

Responsive layout.

Database operations.

Authentication.

Regression safety.

--------------------------------------------------

Definition of Complete

A task is complete only if:

Implementation matches the engineering ticket.

Build succeeds.

Application starts.

Manual verification succeeds.

Existing functionality remains intact.

No unrelated code was modified.

Documentation updated if required.

--------------------------------------------------

Unexpected Situations

Immediately stop if:

Requirements conflict.

Architecture conflict discovered.

Database mismatch discovered.

Unexpected build failures occur.

Unexpected runtime failures occur.

Unexpected repository state discovered.

Security concern discovered.

Never guess.

Never invent requirements.

Never silently change project direction.

--------------------------------------------------

Required Completion Report

After implementation provide:

Summary of work.

Files modified.

Files created.

Files deleted.

Build result.

Testing performed.

Known limitations.

Recommendations.

Wait for review.

Do not automatically continue with additional work.

--------------------------------------------------

Repository Principles

GitHub is the single source of truth.

VS Code is the primary development environment.

Documentation defines project behavior.

Architecture is preserved unless explicitly approved.

Engineering quality is more important than development speed.

Small safe changes are preferred over large risky changes.

Every implementation should minimize technical debt.

--------------------------------------------------

Absolute Prohibitions

Never commit secrets.

Never modify .env.

Never disable security.

Never bypass documentation.

Never change architecture without approval.

Never perform unrelated refactoring.

Never rewrite large sections of working code.

Never delete production logic.

Never ignore compiler errors.

Never ignore build failures.

Never ignore runtime errors.

Never fabricate missing requirements.

Never assume undocumented behavior.

--------------------------------------------------

Final Instruction

Treat this repository as a long-term production software project.

Every change should improve the quality of the project while preserving stability, maintainability, security, and architectural consistency.

If there is uncertainty, stop and request clarification rather than making assumptions.

When choosing between a fast solution and a safe solution, always choose the safe solution.
