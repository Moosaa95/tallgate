-- Tighten the course-content storage path guards.
--
-- 20261007160000_harden_course_content_storage_policies.sql guarded the uuid
-- casts with `(storage.foldername(name))[N] ~ '^[0-9a-fA-F-]{36}$'`. That
-- pattern still matches 36-character strings that are not valid UUIDs (for
-- example 36 hyphens), so a crafted object name can still make the `::uuid`
-- cast raise and abort policy evaluation for the request. Require a real
-- hyphen-segmented UUID shape before casting.

drop policy if exists "Preview lesson videos are publicly readable" on storage.objects;
create policy "Preview lesson videos are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'course-content'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.lessons
      join public.course_modules on course_modules.id = lessons.module_id
      join public.courses on courses.id = course_modules.course_id
      where lessons.id = (storage.foldername(name))[2]::uuid
        and lessons.is_preview
        and courses.is_published
    )
  );

drop policy if exists "Enrolled learners can read course videos" on storage.objects;
create policy "Enrolled learners can read course videos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'course-content'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.course_enrollments
      where course_enrollments.course_id = (storage.foldername(name))[1]::uuid
        and course_enrollments.user_id = (select auth.uid())
        and course_enrollments.status in ('active', 'completed')
    )
  );
