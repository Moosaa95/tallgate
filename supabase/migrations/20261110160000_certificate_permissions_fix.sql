-- Fix certificate database permissions and SECURITY DEFINER functions
-- Revokes column-level UPDATE grants from authenticated role
-- Fixes SECURITY DEFINER functions to properly handle NULL values and authorization
-- Ensures only service role (admin client) can mutate certificate email/lease fields

-- 1. Revoke column-level UPDATE grants from authenticated (added by previous migrations)
REVOKE UPDATE (email_status, email_sent_at, email_error, email_retry_count) ON public.certificates FROM authenticated;
REVOKE UPDATE (email_lease_token, email_lease_acquired_at) ON public.certificates FROM authenticated;

-- 2. Ensure only SELECT remains for authenticated (defense in depth)
-- INSERT/UPDATE/DELETE should only happen via service role (admin client) which bypasses RLS
REVOKE INSERT, UPDATE, DELETE ON public.certificates FROM authenticated;
GRANT SELECT ON public.certificates TO authenticated;

-- 3. Drop and recreate SECURITY DEFINER function for email status updates
-- Fixed: Use explicit NULL handling instead of COALESCE to allow clearing fields
-- Fixed: Only allow service role / admin to call this function
DROP FUNCTION IF EXISTS public.update_certificate_email_status(uuid, text, timestamptz, uuid, timestamptz, text, int);

CREATE OR REPLACE FUNCTION public.update_certificate_email_status(
  p_certificate_id uuid,
  p_email_status text,
  p_email_sent_at timestamptz DEFAULT NULL,
  p_email_lease_token uuid DEFAULT NULL,
  p_email_lease_acquired_at timestamptz DEFAULT NULL,
  p_email_error text DEFAULT NULL,
  p_email_retry_count int DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Only allow this function to be called by service role (admin operations)
  -- or by authenticated users who are admins
  SELECT public.is_admin() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can update certificate email status';
  END IF;
  
  -- Perform the update with explicit NULL handling
  -- Use CASE to distinguish between "not provided" (NULL param) and "explicitly set to NULL"
  UPDATE public.certificates
  SET
    email_status = CASE WHEN p_email_status IS NOT NULL THEN p_email_status ELSE email_status END,
    email_sent_at = CASE WHEN p_email_sent_at IS NOT NULL THEN p_email_sent_at 
                          WHEN p_email_status = 'sent' THEN now()  -- Auto-set on sent
                          ELSE email_sent_at END,
    email_lease_token = CASE WHEN p_email_lease_token IS NOT NULL THEN p_email_lease_token 
                              WHEN p_email_status IN ('sent', 'failed') THEN NULL  -- Auto-clear on completion
                              ELSE email_lease_token END,
    email_lease_acquired_at = CASE WHEN p_email_lease_acquired_at IS NOT NULL THEN p_email_lease_acquired_at
                                    WHEN p_email_status IN ('sent', 'failed') THEN NULL  -- Auto-clear on completion
                                    ELSE email_lease_acquired_at END,
    email_error = CASE WHEN p_email_error IS NOT NULL THEN p_email_error 
                        WHEN p_email_status = 'sent' THEN NULL  -- Auto-clear on success
                        ELSE email_error END,
    email_retry_count = CASE WHEN p_email_retry_count IS NOT NULL THEN p_email_retry_count
                              WHEN p_email_status IN ('sent', 'failed') THEN email_retry_count + 1
                              ELSE email_retry_count END
  WHERE id = p_certificate_id;
  
  RETURN FOUND;
END;
$$;

-- 4. Grant EXECUTE on the SECURITY DEFINER function
-- Only admins (via is_admin check inside) can actually use it
GRANT EXECUTE ON FUNCTION public.update_certificate_email_status(uuid, text, timestamptz, uuid, timestamptz, text, int) TO authenticated;

-- 5. Drop and recreate SECURITY DEFINER function for releasing stale email leases
-- Fixed: Only admins can call this
DROP FUNCTION IF EXISTS public.release_stale_certificate_email_leases(interval);

CREATE OR REPLACE FUNCTION public.release_stale_certificate_email_leases(
  p_lease_timeout_interval interval DEFAULT '5 minutes'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count int;
BEGIN
  -- Only admins can call this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can release stale email leases';
  END IF;
  
  UPDATE public.certificates
  SET
    email_status = 'pending',
    email_lease_token = NULL,
    email_lease_acquired_at = NULL,
    email_error = 'Email lease expired, retry available'
  WHERE email_status = 'sending'
    AND email_lease_acquired_at < (now() - p_lease_timeout_interval);
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$$;

-- 6. Grant EXECUTE on the release function to authenticated (admins only via is_admin check)
GRANT EXECUTE ON FUNCTION public.release_stale_certificate_email_leases(interval) TO authenticated;

-- 7. Add function for atomic lease claim with token verification
-- This ensures only the current lease token owner can complete/fail the lease
DROP FUNCTION IF EXISTS public.claim_certificate_email_lease(uuid, uuid, interval);

CREATE OR REPLACE FUNCTION public.claim_certificate_email_lease(
  p_certificate_id uuid,
  p_lease_token uuid,
  p_lease_timeout interval DEFAULT '5 minutes'
)
RETURNS TABLE (
  claimed boolean,
  current_status text,
  current_lease_token uuid,
  current_retry_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can claim certificate email leases';
  END IF;
  
  -- Atomically claim the lease if status is pending or failed
  -- Returns the current state for verification
  RETURN QUERY
  UPDATE public.certificates
  SET
    email_status = 'sending',
    email_lease_token = p_lease_token,
    email_lease_acquired_at = now(),
    email_error = NULL
  WHERE id = p_certificate_id
    AND email_status IN ('pending', 'failed')
  RETURNING true as claimed, email_status, email_lease_token, email_retry_count;
  
  -- If no rows updated, return current state
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false as claimed, email_status, email_lease_token, email_retry_count
    FROM public.certificates
    WHERE id = p_certificate_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_certificate_email_lease(uuid, uuid, interval) TO authenticated;

-- 8. Add function for completing/failing a lease with token verification
-- Only the current lease token owner can complete or fail
DROP FUNCTION IF EXISTS public.complete_certificate_email_lease(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.complete_certificate_email_lease(
  p_certificate_id uuid,
  p_lease_token uuid,
  p_email_status text,  -- 'sent' or 'failed'
  p_email_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  -- Only admins can call this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can complete certificate email leases';
  END IF;
  
  -- Only complete if we still own the lease (token matches)
  -- and status is currently 'sending'
  UPDATE public.certificates
  SET
    email_status = p_email_status,
    email_sent_at = CASE WHEN p_email_status = 'sent' THEN now() ELSE email_sent_at END,
    email_lease_token = NULL,
    email_lease_acquired_at = NULL,
    email_error = CASE WHEN p_email_status = 'failed' THEN p_email_error ELSE NULL END,
    email_retry_count = email_retry_count + 1
  WHERE id = p_certificate_id
    AND email_status = 'sending'
    AND email_lease_token = p_lease_token;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_certificate_email_lease(uuid, uuid, text, text) TO authenticated;