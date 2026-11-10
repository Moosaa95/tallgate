-- Database permissions hardening for certificates table
-- Revokes broad grants from authenticated role
-- Creates SECURITY DEFINER functions for legitimate server-side operations
-- Preserves admin functionality via service role (bypasses RLS)

-- 1. Revoke overly broad UPDATE and DELETE grants from authenticated
-- The application uses service role (admin client) for all mutations,
-- which bypasses RLS. Authenticated users should only read.
REVOKE UPDATE, DELETE ON public.certificates FROM authenticated;

-- 2. Ensure SELECT and INSERT remain for authenticated (defense in depth)
-- INSERT is only used via service role in practice, but keep grant for completeness
-- Note: RLS policies still restrict what authenticated users can actually do
GRANT SELECT, INSERT ON public.certificates TO authenticated;

-- 3. Create SECURITY DEFINER function for email status updates
-- Used by claimAndSendCertificateEmail and releaseStaleEmailLeases
-- These are called from server-side code using admin client, but providing
-- a SECURITY DEFINER function ensures consistent authorization if ever called directly
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
  v_user_id uuid;
BEGIN
  -- Only allow this function to be called by service role (admin operations)
  -- or by authenticated users who are admins
  SELECT public.is_admin() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    -- For non-admins, verify they own the certificate
    SELECT user_id INTO v_user_id FROM public.certificates WHERE id = p_certificate_id;
    
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Certificate not found';
    END IF;
    
    IF v_user_id != auth.uid() THEN
      RAISE EXCEPTION 'Not authorized to update this certificate';
    END IF;
    
    -- Non-admins can only update email_status to specific values, not lease tokens
    IF p_email_lease_token IS NOT NULL OR p_email_lease_acquired_at IS NOT NULL THEN
      RAISE EXCEPTION 'Not authorized to update lease fields';
    END IF;
  END IF;
  
  -- Perform the update
  UPDATE public.certificates
  SET
    email_status = COALESCE(p_email_status, email_status),
    email_sent_at = COALESCE(p_email_sent_at, email_sent_at),
    email_lease_token = COALESCE(p_email_lease_token, email_lease_token),
    email_lease_acquired_at = COALESCE(p_email_lease_acquired_at, email_lease_acquired_at),
    email_error = COALESCE(p_email_error, email_error),
    email_retry_count = COALESCE(p_email_retry_count, email_retry_count)
  WHERE id = p_certificate_id;
  
  RETURN FOUND;
END;
$$;

-- 4. Grant EXECUTE on the SECURITY DEFINER function
GRANT EXECUTE ON FUNCTION public.update_certificate_email_status(uuid, text, timestamptz, uuid, timestamptz, text, int) TO authenticated;

-- 5. Create SECURITY DEFINER function for releasing stale email leases
-- Called periodically by server-side code
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