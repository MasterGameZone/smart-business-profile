# Smart Business Profile
# Development Workflow

Version: 1.0

Document Purpose

This document defines the complete Software Development Life Cycle (SDLC) for the Smart Business Profile project.

It explains how every feature should be planned, designed, implemented, tested, reviewed, deployed, and maintained.

Every contributor must follow this workflow.

This workflow applies to:

- New Features
- Bug Fixes
- Improvements
- Refactoring
- Database Changes
- Releases

No development work should bypass this workflow.

--------------------------------------------------

1. Development Philosophy

The project follows the following principles.

Safety over speed.

Planning before implementation.

Architecture before coding.

Verification before commit.

Small changes over large changes.

One feature at a time.

GitHub is always the source of truth.

Production stability has the highest priority.

--------------------------------------------------

2. Team Responsibilities

Founder

Responsibilities

- Product vision
- Feature approval
- Priority decisions
- Manual verification
- Final release approval

--------------------------------------------------

ChatGPT

Role

Virtual CTO

Responsibilities

- Product planning
- Architecture
- Database design
- Technical design
- Engineering decisions
- Risk analysis
- Engineering tickets
- Code review
- Debugging strategy
- Documentation
- Release planning

ChatGPT decides what should be built.

--------------------------------------------------

Codex

Role

Lead Software Engineer

Responsibilities

- Read project documentation
- Understand current implementation
- Implement approved engineering tasks
- Modify approved files
- Follow engineering standards
- Run build verification
- Fix compilation issues
- Stop after implementation

Codex decides how to implement the approved design.

--------------------------------------------------

VS Code

Responsibilities

- Development
- Debugging
- Local testing
- Git operations
- Build verification

--------------------------------------------------

GitHub

Responsibilities

- Source of truth
- Version history
- Backup
- Collaboration

--------------------------------------------------

Supabase

Responsibilities

- Database
- Authentication
- Storage

--------------------------------------------------

Vercel

Responsibilities

- Production deployment
- Hosting

--------------------------------------------------

3. Complete Development Lifecycle

Every feature follows exactly the same lifecycle.

Idea

↓

Discussion

↓

Planning

↓

Architecture

↓

Engineering Ticket

↓

Implementation

↓

Testing

↓

Review

↓

Approval

↓

Commit

↓

Push

↓

Release

No step may be skipped.

--------------------------------------------------

4. Phase 1 - Planning

Objective

Understand what needs to be built.

Activities

Discuss feature.

Identify business value.

Define objectives.

Identify risks.

Identify affected modules.

Define acceptance criteria.

Deliverables

Feature Specification

No coding occurs during this phase.

--------------------------------------------------

5. Phase 2 - Architecture

Objective

Design the solution before implementation.

Activities

Review current architecture.

Identify impacted modules.

Review database impact.

Review routing impact.

Review security impact.

Review performance impact.

Review scalability.

Deliverables

Technical Design

Architecture Review

Rollback Strategy

No implementation occurs during this phase.

--------------------------------------------------

6. Phase 3 - Engineering Ticket

Objective

Create a precise implementation task.

Engineering Ticket must include

Feature Name

Objective

Business Requirements

Technical Requirements

Files Allowed

Files Restricted

Implementation Plan

Acceptance Criteria

Testing Checklist

Rollback Plan

Codex implements only the approved ticket.

--------------------------------------------------

7. Phase 4 - Implementation

Objective

Implement the approved feature.

Implementation Rules

Read documentation first.

Implement only requested functionality.

Modify only approved files.

Minimize unrelated changes.

Preserve backward compatibility.

Do not refactor unrelated code.

Do not redesign architecture.

Run build verification.

Stop after implementation.

--------------------------------------------------

8. Phase 5 - Local Testing

Objective

Verify implementation locally.

Minimum Verification

Application starts successfully.

Application builds successfully.

No TypeScript errors.

No console errors.

No runtime errors.

Existing features continue working.

New feature works correctly.

Responsive layout verified.

Database operations verified.

Authentication verified.

--------------------------------------------------

9. Phase 6 - Code Review

Objective

Ensure implementation meets engineering standards.

Review includes

Architecture

Code Quality

Readability

Performance

Security

Backward Compatibility

Documentation

Review must identify

Potential bugs

Regression risks

Security concerns

Maintainability issues

--------------------------------------------------

10. Phase 7 - Bug Fixing

If issues are discovered

Reproduce

↓

Identify Root Cause

↓

Minimal Fix

↓

Retest

↓

Review Again

Never apply random fixes.

Every fix should address the root cause.

--------------------------------------------------

11. Phase 8 - Git Verification

Before creating a commit

Run

git status

Review every modified file.

Confirm no accidental files exist.

Verify

No secrets.

No temporary files.

No debug code.

No unrelated modifications.

--------------------------------------------------

12. Phase 9 - Commit

Commit Rules

One feature equals one commit.

Commit messages should be descriptive.

Examples

Version 3.4 - Added business directory

Version 3.5 - Implemented search filters

Version 3.6 - Fixed image upload

Avoid generic commit messages.

--------------------------------------------------

13. Phase 10 - Push

Objective

Synchronize local repository with GitHub.

Before push

Ensure review completed.

Ensure testing completed.

Ensure commit completed.

After push

Verify GitHub contains latest commit.

GitHub becomes the new source of truth.

--------------------------------------------------

14. Phase 11 - Release

Objective

Prepare production deployment.

Release Checklist

Application builds successfully.

Application runs locally.

Manual testing complete.

Documentation updated.

Migration verified.

GitHub updated.

Production deployment approved.

Deploy to Vercel.

Verify production environment.

--------------------------------------------------

15. Database Workflow

Every database change follows

Design

↓

Review

↓

Migration

↓

Verification

↓

Testing

↓

Commit

↓

Push

↓

Deploy

Manual production schema changes are prohibited.

--------------------------------------------------

16. Bug Fix Workflow

Bug Report

↓

Reproduce

↓

Root Cause Analysis

↓

Engineering Ticket

↓

Implementation

↓

Testing

↓

Review

↓

Commit

↓

Push

--------------------------------------------------

17. Daily Development Workflow

Start of Day

Open VS Code

↓

Open Project

↓

git pull

↓

Review latest changes

↓

npm install

Only if package dependencies changed.

↓

npm run dev

↓

Verify application

↓

Start development

--------------------------------------------------

18. End of Day Workflow

Manual testing

↓

git status

↓

Review changes

↓

Commit

↓

Push

↓

Verify GitHub

↓

Close project

--------------------------------------------------

19. Release Workflow

Feature Complete

↓

Manual Testing

↓

Code Review

↓

Git Commit

↓

Git Push

↓

Production Build

↓

Deploy to Vercel

↓

Production Verification

↓

Release Complete

--------------------------------------------------

20. Emergency Workflow

If unexpected problems occur

Stop immediately.

Do not continue implementation.

Investigate.

Identify root cause.

Review affected files.

Restore if necessary.

Restart implementation only after understanding the problem.

Never continue blindly.

--------------------------------------------------

21. Documentation Workflow

Whenever architecture changes

Update

ARCHITECTURE.md

Whenever database changes

Update

DATABASE.md

Whenever workflow changes

Update

WORKFLOW.md

Whenever standards change

Update

ENGINEERING_STANDARDS.md

Whenever new releases occur

Update

CHANGELOG.md

Documentation should always match the current implementation.

--------------------------------------------------

22. Definition of Done

A task is complete only when

Planning completed.

Architecture approved.

Implementation completed.

Application builds successfully.

Application runs successfully.

Testing completed.

Code review completed.

Documentation updated.

Git status verified.

Commit created.

Changes pushed.

GitHub updated.

--------------------------------------------------

23. Workflow Violations

The following actions are prohibited

Skipping planning.

Skipping architecture review.

Skipping testing.

Skipping code review.

Direct production edits.

Committing secrets.

Large unrelated refactoring.

Changing architecture without approval.

Deploying unverified code.

--------------------------------------------------

24. Final Statement

The Smart Business Profile project follows a structured software development lifecycle designed for long-term maintainability and production reliability.

Every feature, bug fix, database change, and release must follow this workflow.

Following this process ensures that the project remains stable, scalable, secure, and easy to maintain as it grows.
