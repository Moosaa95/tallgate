-- Certificate email delivery tracking
-- Adds columns to track email delivery status, timestamp, error details, and retry count
-- Safe to apply on existing data: defaults to 'pending' for historical certificates

alter table public.certificates
  add column if not exists email_status text
    check (email_status in ('pending', 'sent', 'failed'))
    default 'pending',
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_retry_count int default 0;

-- Index for querying failed emails for retry
create index if not exists idx_certificates_email_status
  on public.certificates (email_status)
  where email_status = 'failed';

-- Grant permissions for the new columns
grant select, update (email_status, email_sent_at, email_error, email_retry_count)
  on public.certificates to authenticated;