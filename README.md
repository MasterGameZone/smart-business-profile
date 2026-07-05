Smart Business Profile

Production-grade digital business profile platform built using React, TypeScript, Vite and Supabase.

--------------------------------------------------

Project Status

Current Version

3.x

Status

Active Development

--------------------------------------------------

Technology Stack

Frontend

React

TypeScript

Vite

Backend

Supabase

Database

PostgreSQL

Hosting

Vercel

Version Control

GitHub

Development Environment

VS Code

--------------------------------------------------

Repository Structure

src/

Application source code

docs/

Engineering documentation

supabase/

Database migrations

public/

Static assets

--------------------------------------------------

Developer Onboarding

Every contributor should read the following documents before making changes.

1. docs/00_PROJECT_BIBLE.md

Project vision and engineering philosophy.

2. docs/01_ARCHITECTURE.md

System architecture.

3. docs/02_DATABASE.md

Database documentation.

4. docs/03_ENGINEERING_STANDARDS.md

Coding standards.

5. docs/04_WORKFLOW.md

Development lifecycle.

6. docs/05_CODEX_INSTRUCTIONS.md

Engineering operating manual.

7. docs/06_FEATURE_TEMPLATE.md

Engineering ticket template.

8. docs/07_CHANGELOG.md

Release history.

9. docs/08_ROADMAP.md

Product roadmap.

--------------------------------------------------

Quick Start

Clone repository

Install dependencies

npm install

Configure environment

Copy

.env.example

to

.env

Update Supabase credentials.

Start development

npm run dev

Build project

npm run build

Preview production build

npm run preview

--------------------------------------------------

Vercel Deployment

Deployment target

Vercel

Build command

npm run build

Output directory

dist

Required Vercel environment variables

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Use the public Supabase project URL and anon key only.
Do not add service role keys or private secrets to the frontend.

Direct route refresh support

The project includes vercel.json with a single-page app rewrite so routes such as:

/directory

/login

/signup

/dashboard

/create-profile

/profile-preview

/business/{slug}

load the React app when opened directly or refreshed in production.

Supabase Auth URL configuration

After the first Vercel deployment, update Supabase Auth URL Configuration manually.

Include:

http://localhost:5000

https://your-production-domain.vercel.app

https://your-production-domain.vercel.app/reset-password

The reset password flow uses the current runtime origin, so local development redirects to the local app and production redirects to the deployed Vercel domain.

--------------------------------------------------

Development Workflow

Feature Request

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

Commit

↓

Push

↓

Release

--------------------------------------------------

Git Workflow

Start development

git pull

npm run dev

Before commit

git status

npm run build

Commit

git add .

git commit -m "Version X.X - Feature"

git push

--------------------------------------------------

Source of Truth

GitHub is the only source of truth.

Never modify production directly.

Never commit secrets.

Never commit .env.

--------------------------------------------------

Documentation

All engineering documentation is located inside the docs directory.

Documentation should always be updated together with the implementation.

--------------------------------------------------

Project Philosophy

Reliable software over fast software.

Maintainability over shortcuts.

Architecture before implementation.

Documentation before assumptions.

Verification before deployment.
