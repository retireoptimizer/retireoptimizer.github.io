-- Phase 0 placeholder: schema is defined but not yet applied.
-- Full schema will be added in Phase 1 (task: 0001_schema.sql).
-- This migration intentionally left minimal for Phase 0 bootstrap.

-- Enable extensions needed later
create extension if not exists "pg_trgm";
