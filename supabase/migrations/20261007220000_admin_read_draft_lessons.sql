-- Allow admins to read lessons of unpublished (draft) courses.
--
-- 20260829000000_lesson_content_gating.sql made the only SELECT policy on
-- public.lessons require `courses.is_published` at the top level, with the
-- admin check buried inside the same expression:
--
--   and courses.is_published
--   and (lessons.is_preview or public.is_admin() or <enrolled>)
--
-- so `is_admin()` never sees draft courses. That contradicts the sibling
-- course_modules policy (20261006000000_public_api_hardening.sql), which reads
-- `courses.is_published or public.is_admin()`. The effect is that admins cannot
-- load a draft course's lessons, and admin INSERT/UPDATE on public.lessons
-- returns no rows (PostgREST applies the SELECT policy to RETURNING), making
-- the client-side "did the write stick?" checks fail with a false error and
-- making curriculum seeding re-create lessons that already exist.
--
-- Recreate the policy with a top-level admin bypass to match course_modules.

drop policy if exists "Published lessons are viewable by preview or enrolled users"
  on public.lessons;

create policy "Published lessons are viewable by preview or enrolled users"
  on public.lessons
  for select
  to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.course_modules
      join public.courses on courses.id = course_modules.course_id
      where course_modules.id = lessons.module_id
        and courses.is_published
        and (
          lessons.is_preview
          or exists (
            select 1
            from public.course_enrollments
            where course_enrollments.course_id = courses.id
              and course_enrollments.user_id = (select auth.uid())
              and course_enrollments.status in ('active', 'completed')
          )
        )
    )
  );
