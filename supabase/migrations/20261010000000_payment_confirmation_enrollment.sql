-- Atomic payment confirmation -> course access.
--
-- The platform records offline payments in public.payment_requests and has no
-- payment gateway. Confirming a payment must grant the linked learner access to
-- the linked course in the same transaction, and refunding must revoke it, so
-- that course access can never drift from the recorded payment state.
--
-- This function is the single trusted write path for a payment's status. It is
-- SECURITY DEFINER and gated by public.is_admin(), so it can write
-- public.course_enrollments while direct inserts from anon/authenticated remain
-- revoked (see 20261007000000_rate_limit_and_enrollment_hardening.sql).

create or replace function public.update_payment_request_status(
  p_payment_id uuid,
  p_next_status text,
  p_note text default null,
  p_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payment_requests;
  v_admin uuid := (select auth.uid());
  v_enrolled boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update payment requests.'
      using errcode = '42501';
  end if;

  select *
    into v_row
    from public.payment_requests
   where id = p_payment_id
     for update;

  if not found then
    raise exception 'Payment request not found.'
      using errcode = 'P0002';
  end if;

  if not (
    (v_row.status = 'pending'   and p_next_status in ('confirmed', 'declined'))
    or (v_row.status = 'confirmed' and p_next_status = 'refunded')
    or (v_row.status = 'declined'  and p_next_status = 'confirmed')
  ) then
    raise exception 'Invalid payment status transition.'
      using errcode = '22023';
  end if;

  if p_next_status = 'confirmed'
     and (v_row.user_id is null or v_row.course_id is null) then
    raise exception 'A learner and course are required before confirming.'
      using errcode = '23514';
  end if;

  update public.payment_requests
     set status = p_next_status,
         note = case
           when p_note is null or p_note = '' then note
           else p_note
         end,
         reference = case
           when p_reference is null or p_reference = '' then reference
           else p_reference
         end,
         reviewed_by = v_admin,
         reviewed_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   where id = p_payment_id
   returning * into v_row;

  if p_next_status = 'confirmed' then
    -- Reactivate a previously dropped enrollment, but never downgrade one that
    -- is already active or completed.
    insert into public.course_enrollments as ce (user_id, course_id, status)
    values (v_row.user_id, v_row.course_id, 'active')
    on conflict (user_id, course_id) do update
      set status = case
        when ce.status = 'dropped' then 'active'
        else ce.status
      end;
    v_enrolled := true;
  elsif p_next_status = 'refunded' then
    update public.course_enrollments
       set status = 'dropped'
     where user_id = v_row.user_id
       and course_id = v_row.course_id
       and status = 'active';
    v_enrolled := false;
  end if;

  return v_enrolled;
end;
$$;

revoke all on function public.update_payment_request_status(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_payment_request_status(uuid, text, text, text)
  to authenticated;
