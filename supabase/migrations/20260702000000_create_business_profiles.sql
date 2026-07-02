-- Migration: Create business_profiles table
-- Version 2.1 - Business Profile Database Schema
-- This migration creates the initial production schema for storing Business Profiles.
-- NOTE: This migration is schema design only. It does not connect the app to the database.

create extension if not exists "pgcrypto";

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  business_category text not null,
  phone_number text not null,
  whatsapp_number text,
  email text,
  website text,
  address text,
  about_business text,
  logo_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Automatically keep updated_at current on every row update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_business_profiles_updated_at on public.business_profiles;

create trigger set_business_profiles_updated_at
before update on public.business_profiles
for each row
execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.business_profiles enable row level security;

-- ============================================================================
-- TEMPORARY DEVELOPMENT POLICIES
-- These policies allow anonymous (anon) users to insert, select, and update
-- rows without restriction. They exist only to support development before
-- authentication is implemented.
--
-- THESE POLICIES MUST BE REPLACED once user authentication is added, so that
-- users can only access/manage their own business profiles.
-- ============================================================================

drop policy if exists "Temporary: allow anon insert" on public.business_profiles;
create policy "Temporary: allow anon insert"
on public.business_profiles
for insert
to anon
with check (true);

drop policy if exists "Temporary: allow anon select" on public.business_profiles;
create policy "Temporary: allow anon select"
on public.business_profiles
for select
to anon
using (true);

drop policy if exists "Temporary: allow anon update" on public.business_profiles;
create policy "Temporary: allow anon update"
on public.business_profiles
for update
to anon
using (true)
with check (true);
