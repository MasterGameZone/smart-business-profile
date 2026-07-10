-- Adds an optional display name for uploaded business profile documents.

alter table public.business_profile_documents
  add column if not exists document_name text;
