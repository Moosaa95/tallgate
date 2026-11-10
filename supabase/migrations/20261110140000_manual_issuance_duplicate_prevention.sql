-- Manual issuance duplicate prevention and email lease ownership
-- Adds partial unique index for (user_id, course_title, issue_date) where course_id IS NULL
-- Adds lease token and separate lease acquisition timestamp for email delivery ownership
-- Safe to apply on existing data

-- 1. Report any existing duplicate (user_id, course_title, issue_date) combinations for manual issuance
DO $$
DECLARE
    dup_count integer;
BEGIN
    SELECT count(*)
    INTO dup_count
    FROM (
        SELECT user_id, course_title, issue_date, count(*) as cnt
        FROM public.certificates
        WHERE course_id IS NULL
        GROUP BY user_id, course_title, issue_date
        HAVING count(*) > 1
    ) dups;
    
    IF dup_count > 0 THEN
        RAISE NOTICE 'Found % duplicate (user_id, course_title, issue_date) combinations for manual issuance. Constraint will fail.', dup_count;
        -- Log the duplicates for manual review
        RAISE NOTICE 'Duplicates:';
        FOR dup IN (
            SELECT user_id, course_title, issue_date, count(*) as cnt, array_agg(id) as cert_ids
            FROM public.certificates
            WHERE course_id IS NULL
            GROUP BY user_id, course_title, issue_date
            HAVING count(*) > 1
        ) LOOP
            RAISE NOTICE '  user_id: %, course_title: %, issue_date: %, count: %, cert_ids: %', dup.user_id, dup.course_title, dup.issue_date, dup.cnt, dup.cert_ids;
        END LOOP;
    ELSE
        RAISE NOTICE 'No duplicate (user_id, course_title, issue_date) combinations found for manual issuance. Safe to add constraint.';
    END IF;
END $$;

-- 2. Add partial unique index for manual issuance duplicate prevention
-- Only applies when course_id IS NULL (course-based issuance covered by certificates_user_course_unique)
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_title_date_unique
ON public.certificates (user_id, course_title, issue_date)
WHERE course_id IS NULL;

-- 3. Add email lease token column for ownership tracking
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS email_lease_token uuid;

-- 4. Add separate lease acquisition timestamp (distinct from email_sent_at which is for successful delivery)
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS email_lease_acquired_at timestamptz;

-- 5. Add index for finding certificates with 'sending' status older than lease timeout (for cleanup)
-- Uses the new lease acquisition timestamp
CREATE INDEX IF NOT EXISTS idx_certificates_email_sending_stale
ON public.certificates (email_lease_acquired_at)
WHERE email_status = 'sending';

-- 6. Grant permissions for new columns
GRANT SELECT, UPDATE (email_lease_token, email_lease_acquired_at)
ON public.certificates TO authenticated;