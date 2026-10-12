-- Assessments: questions, quizzes, attempts, grading, active recall.
--
-- Design notes
--   * Correct answers live in public.question_answers, which is service-role
--     only. Learners have no grant and no policy, so answers can never be read
--     through PostgREST.
--   * Grading is server-side only. start/save/submit and admin grading are
--     SECURITY DEFINER functions with search_path = ''. Learners never write
--     to quiz_attempts or attempt_answers directly.
--   * course completion is derived only from database state by
--     recompute_course_completion.

-- ---------------------------------------------------------------------------
-- courses.auto_issue_certificate
-- ---------------------------------------------------------------------------
alter table public.courses
  add column if not exists auto_issue_certificate boolean not null default false;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  type text not null check (type in ('single', 'multiple', 'true_false', 'short', 'essay')),
  prompt text not null check (char_length(prompt) between 1 and 4000),
  explanation text check (explanation is null or char_length(explanation) <= 4000),
  points integer not null default 1 check (points >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_course_id_idx on public.questions(course_id);
create index if not exists questions_module_id_idx on public.questions(module_id);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 1000),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists question_options_question_id_idx on public.question_options(question_id);

create table if not exists public.question_answers (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_ids uuid[] not null default '{}',
  accepted_answers text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid references public.course_modules(id) on delete set null,
  kind text not null default 'quiz' check (kind in ('quiz', 'practice', 'exam')),
  title text not null check (char_length(title) between 1 and 200),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  pass_mark_percent integer not null default 50 check (pass_mark_percent between 0 and 100),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  retake_cooldown_minutes integer check (retake_cooldown_minutes is null or retake_cooldown_minutes >= 0),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  feedback_mode text not null default 'after_submit' check (feedback_mode in ('immediate', 'after_submit')),
  question_count integer check (question_count is null or question_count > 0),
  is_required boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quizzes_course_id_idx on public.quizzes(course_id);
create index if not exists quizzes_module_id_idx on public.quizzes(module_id);

create table if not exists public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  display_order integer not null default 0,
  primary key (quiz_id, question_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  attempt_no integer not null default 1,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  question_order jsonb not null default '[]'::jsonb,
  score_points numeric not null default 0,
  max_points numeric not null default 0,
  percent numeric check (percent is null or (percent >= 0 and percent <= 100)),
  passed boolean,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'pending_grading', 'graded')),
  tab_switch_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_id_idx on public.quiz_attempts(user_id);
create index if not exists quiz_attempts_quiz_id_idx on public.quiz_attempts(quiz_id);

-- At most one in-progress attempt per learner per quiz.
create unique index if not exists quiz_attempts_one_in_progress_idx
  on public.quiz_attempts(user_id, quiz_id)
  where status = 'in_progress';

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  text_answer text check (text_answer is null or char_length(text_answer) <= 5000),
  is_correct boolean,
  points_awarded numeric not null default 0,
  grader_feedback text check (grader_feedback is null or char_length(grader_feedback) <= 4000),
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists attempt_answers_attempt_id_idx on public.attempt_answers(attempt_id);

create table if not exists public.recall_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  box integer not null default 1 check (box between 1 and 3),
  next_review_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_enrollments
    where user_id = (select auth.uid())
      and course_id = p_course_id
      and status in ('active', 'completed')
  );
$$;

revoke all on function public.is_enrolled(uuid) from public;
grant execute on function public.is_enrolled(uuid) to anon, authenticated;

create or replace function public._uuid_array_set_equal(a uuid[], b uuid[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select array(select distinct x from unnest(a) as x order by 1))
    = (select array(select distinct x from unnest(b) as x order by 1)),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answers enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.recall_progress enable row level security;

-- questions / question_options: enrolled learners read published questions.
drop policy if exists "Enrolled learners can read published questions" on public.questions;
create policy "Enrolled learners can read published questions" on public.questions
  for select to authenticated
  using (is_published = true and (public.is_admin() or public.is_enrolled(course_id)));

drop policy if exists "Admins can manage questions" on public.questions;
create policy "Admins can manage questions" on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Enrolled learners can read question options" on public.question_options;
create policy "Enrolled learners can read question options" on public.question_options
  for select to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_options.question_id
        and q.is_published = true
        and (public.is_admin() or public.is_enrolled(q.course_id))
    )
  );

drop policy if exists "Admins can manage question options" on public.question_options;
create policy "Admins can manage question options" on public.question_options
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- question_answers: admin-only. No learner grant or policy exists.
drop policy if exists "Admins can manage question answers" on public.question_answers;
create policy "Admins can manage question answers" on public.question_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- quizzes / quiz_questions: enrolled learners read published quizzes.
drop policy if exists "Enrolled learners can read published quizzes" on public.quizzes;
create policy "Enrolled learners can read published quizzes" on public.quizzes
  for select to authenticated
  using (is_published = true and (public.is_admin() or public.is_enrolled(course_id)));

drop policy if exists "Admins can manage quizzes" on public.quizzes;
create policy "Admins can manage quizzes" on public.quizzes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Enrolled learners can read quiz questions" on public.quiz_questions;
create policy "Enrolled learners can read quiz questions" on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes z
      where z.id = quiz_questions.quiz_id
        and z.is_published = true
        and (public.is_admin() or public.is_enrolled(z.course_id))
    )
  );

drop policy if exists "Admins can manage quiz questions" on public.quiz_questions;
create policy "Admins can manage quiz questions" on public.quiz_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- quiz_attempts: learners read only their own; admins full.
drop policy if exists "Learners can read own quiz attempts" on public.quiz_attempts;
create policy "Learners can read own quiz attempts" on public.quiz_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "Admins can manage quiz attempts" on public.quiz_attempts;
create policy "Admins can manage quiz attempts" on public.quiz_attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Learners can read own attempt answers" on public.attempt_answers;
create policy "Learners can read own attempt answers" on public.attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = attempt_answers.attempt_id
        and ((select auth.uid()) = a.user_id or public.is_admin())
    )
  );

drop policy if exists "Admins can manage attempt answers" on public.attempt_answers;
create policy "Admins can manage attempt answers" on public.attempt_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- recall_progress: learners own rows; admins full.
drop policy if exists "Learners can read own recall progress" on public.recall_progress;
create policy "Learners can read own recall progress" on public.recall_progress
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "Learners can write own recall progress" on public.recall_progress;
create policy "Learners can write own recall progress" on public.recall_progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Learners can update own recall progress" on public.recall_progress;
create policy "Learners can update own recall progress" on public.recall_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can manage recall progress" on public.recall_progress;
create policy "Admins can manage recall progress" on public.recall_progress
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- grants
-- ---------------------------------------------------------------------------
revoke all on public.questions from anon;
revoke all on public.question_options from anon;
revoke all on public.question_answers from anon;
revoke all on public.quizzes from anon;
revoke all on public.quiz_questions from anon;
revoke all on public.quiz_attempts from anon;
revoke all on public.attempt_answers from anon;
revoke all on public.recall_progress from anon;

grant select on public.questions to authenticated;
grant select on public.question_options to authenticated;
grant select on public.quizzes to authenticated;
grant select on public.quiz_questions to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.attempt_answers to authenticated;
grant select, insert, update on public.recall_progress to authenticated;

-- question_answers is service-role only.
revoke all on public.question_answers from authenticated;
grant all on public.question_answers to service_role;

-- Learners never write attempts/answers directly.
revoke insert, update, delete on public.quiz_attempts from authenticated;
revoke insert, update, delete on public.attempt_answers from authenticated;

grant all on public.questions to service_role;
grant all on public.question_options to service_role;
grant all on public.quizzes to service_role;
grant all on public.quiz_questions to service_role;
grant all on public.quiz_attempts to service_role;
grant all on public.attempt_answers to service_role;
grant all on public.recall_progress to service_role;

-- ---------------------------------------------------------------------------
-- start_quiz_attempt
-- ---------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_quiz public.quizzes%rowtype;
  v_attempt public.quiz_attempts%rowtype;
  v_existing public.quiz_attempts%rowtype;
  v_attempt_count integer;
  v_last_submitted timestamptz;
  v_order jsonb;
  v_max_points numeric;
  v_attempt_no integer;
  v_resumed boolean := false;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'QUIZ_NOT_FOUND';
  end if;
  if not v_quiz.is_published and not public.is_admin() then
    raise exception using errcode = '42501', message = 'QUIZ_NOT_PUBLISHED';
  end if;
  if not public.is_admin() and not public.is_enrolled(v_quiz.course_id) then
    raise exception using errcode = '42501', message = 'NOT_ENROLLED';
  end if;

  -- Resume an in-progress attempt when it is still valid.
  select * into v_existing
  from public.quiz_attempts
  where user_id = v_user and quiz_id = p_quiz_id and status = 'in_progress'
  order by started_at desc
  limit 1;

  if found then
    if v_existing.expires_at is null
       or now() <= v_existing.expires_at + interval '30 seconds' then
      return jsonb_build_object(
        'attemptId', v_existing.id,
        'resumed', true,
        'startedAt', v_existing.started_at,
        'expiresAt', v_existing.expires_at,
        'maxPoints', v_existing.max_points,
        'status', v_existing.status,
        'questionOrder', v_existing.question_order
      );
    end if;
    -- Expired: finalize it so a fresh attempt can begin.
    perform public._finalize_quiz_attempt(v_existing.id);
  end if;

  select count(*) into v_attempt_count
  from public.quiz_attempts where user_id = v_user and quiz_id = p_quiz_id;

  if v_quiz.max_attempts is not null and v_attempt_count >= v_quiz.max_attempts then
    raise exception using errcode = '22023', message = 'ATTEMPT_LIMIT';
  end if;

  select max(submitted_at) into v_last_submitted
  from public.quiz_attempts
  where user_id = v_user and quiz_id = p_quiz_id and submitted_at is not null;

  if v_quiz.retake_cooldown_minutes is not null
     and v_last_submitted is not null
     and now() < v_last_submitted + make_interval(mins => v_quiz.retake_cooldown_minutes) then
    raise exception using errcode = '22023', message = 'COOLDOWN';
  end if;

  v_attempt_no := v_attempt_count + 1;

  -- Build the question snapshot.
  if exists (select 1 from public.quiz_questions where quiz_id = p_quiz_id) then
    select coalesce(jsonb_agg(q_json order by ord), '[]'::jsonb)
    into v_order
    from (
      select
        zq.display_order as ord,
        jsonb_build_object(
          'questionId', q.id,
          'optionIds', coalesce(
            (select jsonb_agg(o.id order by
                case when v_quiz.shuffle_options then random() else o.display_order::double precision end)
             from public.question_options o where o.question_id = q.id),
            '[]'::jsonb
          )
        ) as q_json
      from public.quiz_questions zq
      join public.questions q on q.id = zq.question_id
      where zq.quiz_id = p_quiz_id and q.is_published
      order by case when v_quiz.shuffle_questions then random() else zq.display_order::double precision end
      limit coalesce(v_quiz.question_count, 2147483647)
    ) picked;
  else
    select coalesce(jsonb_agg(q_json order by random()), '[]'::jsonb)
    into v_order
    from (
      select jsonb_build_object(
        'questionId', q.id,
        'optionIds', coalesce(
          (select jsonb_agg(o.id order by
              case when v_quiz.shuffle_options then random() else o.display_order::double precision end)
           from public.question_options o where o.question_id = q.id),
          '[]'::jsonb
        )
      ) as q_json
      from public.questions q
      where q.course_id = v_quiz.course_id
        and q.is_published
        and (v_quiz.module_id is null or q.module_id = v_quiz.module_id)
      order by random()
      limit coalesce(v_quiz.question_count, 2147483647)
    ) picked;
  end if;

  if jsonb_array_length(v_order) = 0 then
    raise exception using errcode = '22023', message = 'NO_QUESTIONS';
  end if;

  select coalesce(sum(q.points), 0) into v_max_points
  from public.questions q
  where q.id in (
    select (elem ->> 'questionId')::uuid
    from jsonb_array_elements(v_order) as elem
  );

  insert into public.quiz_attempts (
    user_id, quiz_id, attempt_no, started_at, expires_at, question_order, max_points, status
  ) values (
    v_user,
    p_quiz_id,
    v_attempt_no,
    now(),
    case when v_quiz.time_limit_minutes is not null
      then now() + make_interval(mins => v_quiz.time_limit_minutes) else null end,
    v_order,
    v_max_points,
    'in_progress'
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'resumed', v_resumed,
    'startedAt', v_attempt.started_at,
    'expiresAt', v_attempt.expires_at,
    'maxPoints', v_attempt.max_points,
    'status', v_attempt.status,
    'questionOrder', v_attempt.question_order
  );
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public;
grant execute on function public.start_quiz_attempt(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- save_attempt_answer (autosave)
-- ---------------------------------------------------------------------------
create or replace function public.save_attempt_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_ids uuid[] default null,
  p_text_answer text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt public.quiz_attempts%rowtype;
  v_in_snapshot boolean;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found or v_attempt.user_id <> v_user then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception using errcode = '22023', message = 'ATTEMPT_NOT_EDITABLE';
  end if;
  if v_attempt.expires_at is not null
     and now() > v_attempt.expires_at + interval '30 seconds' then
    raise exception using errcode = '22023', message = 'ATTEMPT_EXPIRED';
  end if;

  select exists (
    select 1 from jsonb_array_elements(v_attempt.question_order) as elem
    where (elem ->> 'questionId')::uuid = p_question_id
  ) into v_in_snapshot;
  if not v_in_snapshot then
    raise exception using errcode = '22023', message = 'QUESTION_NOT_IN_ATTEMPT';
  end if;

  if p_text_answer is not null and char_length(p_text_answer) > 5000 then
    raise exception using errcode = '22023', message = 'TEXT_TOO_LONG';
  end if;

  insert into public.attempt_answers (
    attempt_id, question_id, selected_option_ids, text_answer, updated_at
  ) values (
    p_attempt_id, p_question_id, coalesce(p_selected_option_ids, '{}'), p_text_answer, now()
  )
  on conflict (attempt_id, question_id) do update
    set selected_option_ids = coalesce(excluded.selected_option_ids, '{}'),
        text_answer = excluded.text_answer,
        updated_at = now();

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.save_attempt_answer(uuid, uuid, uuid[], text) from public;
grant execute on function public.save_attempt_answer(uuid, uuid, uuid[], text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- _finalize_quiz_attempt (internal)
-- ---------------------------------------------------------------------------
create or replace function public._finalize_quiz_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_pending integer;
  v_score numeric;
  v_percent numeric;
  v_pass boolean;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;
  if v_attempt.status <> 'in_progress' then
    return;
  end if;

  -- Auto-grade objective answers.
  update public.attempt_answers aa
  set
    is_correct = case
      when q.type in ('single', 'true_false', 'multiple') then
        public._uuid_array_set_equal(
          aa.selected_option_ids,
          coalesce(ans.correct_option_ids, '{}')
        )
      when q.type = 'short' then
        exists (
          select 1
          from unnest(coalesce(ans.accepted_answers, '{}')) as accepted(value)
          where lower(btrim(accepted.value)) = lower(btrim(coalesce(aa.text_answer, '')))
        )
      else null
    end,
    points_awarded = case
      when q.type in ('single', 'true_false', 'multiple') then
        case when public._uuid_array_set_equal(
          aa.selected_option_ids, coalesce(ans.correct_option_ids, '{}')
        ) then q.points else 0 end
      when q.type = 'short' then
        case when exists (
          select 1 from unnest(coalesce(ans.accepted_answers, '{}')) as accepted(value)
          where lower(btrim(accepted.value)) = lower(btrim(coalesce(aa.text_answer, '')))
        ) then q.points else 0 end
      else 0
    end,
    updated_at = now()
  from public.questions q
  left join public.question_answers ans on ans.question_id = q.id
  where aa.attempt_id = p_attempt_id and aa.question_id = q.id;

  -- Ensure every snapshotted question has an answer row.
  insert into public.attempt_answers (attempt_id, question_id)
  select p_attempt_id, (elem ->> 'questionId')::uuid
  from jsonb_array_elements(v_attempt.question_order) as elem
  on conflict (attempt_id, question_id) do nothing;

  select count(*) into v_pending
  from public.attempt_answers
  where attempt_id = p_attempt_id and is_correct is null;

  select coalesce(sum(points_awarded), 0) into v_score
  from public.attempt_answers where attempt_id = p_attempt_id;

  v_percent := case
    when v_attempt.max_points > 0 then round((v_score / v_attempt.max_points) * 100, 2)
    else 0
  end;

  if v_pending > 0 then
    v_pass := null;
  else
    v_pass := v_percent >= (select pass_mark_percent from public.quizzes where id = v_attempt.quiz_id);
  end if;

  update public.quiz_attempts
  set status = case when v_pending > 0 then 'pending_grading' else 'graded' end,
      submitted_at = coalesce(submitted_at, now()),
      score_points = v_score,
      percent = v_percent,
      passed = v_pass
  where id = p_attempt_id;
end;
$$;

revoke all on function public._finalize_quiz_attempt(uuid) from public;

-- ---------------------------------------------------------------------------
-- submit_quiz_attempt (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt public.quiz_attempts%rowtype;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found or v_attempt.user_id <> v_user then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'attemptId', v_attempt.id,
      'status', v_attempt.status,
      'scorePoints', v_attempt.score_points,
      'maxPoints', v_attempt.max_points,
      'percent', v_attempt.percent,
      'passed', v_attempt.passed,
      'submittedAt', v_attempt.submitted_at
    );
  end if;

  if v_attempt.expires_at is not null
     and now() > v_attempt.expires_at + interval '30 seconds' then
    raise exception using errcode = '22023', message = 'ATTEMPT_EXPIRED';
  end if;

  perform public._finalize_quiz_attempt(p_attempt_id);

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'status', v_attempt.status,
    'scorePoints', v_attempt.score_points,
    'maxPoints', v_attempt.max_points,
    'percent', v_attempt.percent,
    'passed', v_attempt.passed,
    'submittedAt', v_attempt.submitted_at
  );
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid) from public;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- log_attempt_tab_switch (informational; never affects grading)
-- ---------------------------------------------------------------------------
create or replace function public.log_attempt_tab_switch(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt public.quiz_attempts%rowtype;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found or v_attempt.user_id <> v_user then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  update public.quiz_attempts
  set tab_switch_count = tab_switch_count + 1
  where id = p_attempt_id;

  return jsonb_build_object('tabSwitchCount', v_attempt.tab_switch_count + 1);
end;
$$;

revoke all on function public.log_attempt_tab_switch(uuid) from public;
grant execute on function public.log_attempt_tab_switch(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_attempt_review
--   Returns the attempt snapshot with per-question results. The answer key is
--   only revealed when the attempt is finished OR the quiz is in immediate
--   feedback mode and the question has been answered. Owner or admin only.
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select a.id, a.quiz_id, a.user_id, a.status, a.started_at, a.expires_at,
           a.submitted_at, a.score_points, a.max_points, a.percent, a.passed,
           a.tab_switch_count, a.question_order,
           z.feedback_mode, z.pass_mark_percent, z.title as quiz_title, z.kind
    from public.quiz_attempts a
    join public.quizzes z on z.id = a.quiz_id
    where a.id = p_attempt_id
      and (a.user_id = (select auth.uid()) or public.is_admin())
  )
  select jsonb_build_object(
    'attemptId', t.id,
    'quizId', t.quiz_id,
    'quizTitle', t.quiz_title,
    'kind', t.kind,
    'status', t.status,
    'feedbackMode', t.feedback_mode,
    'passMarkPercent', t.pass_mark_percent,
    'scorePoints', t.score_points,
    'maxPoints', t.max_points,
    'percent', t.percent,
    'passed', t.passed,
    'startedAt', t.started_at,
    'expiresAt', t.expires_at,
    'submittedAt', t.submitted_at,
    'tabSwitchCount', t.tab_switch_count,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'questionId', q.id,
        'type', q.type,
        'prompt', q.prompt,
        'points', q.points,
        'explanation', q.explanation,
        'selectedOptionIds', coalesce(aa.selected_option_ids, '{}'::uuid[]),
        'textAnswer', aa.text_answer,
        'isCorrect', aa.is_correct,
        'pointsAwarded', aa.points_awarded,
        'graderFeedback', aa.grader_feedback,
        'correctOptionIds', case when reveal.on then coalesce(ans.correct_option_ids, '{}'::uuid[]) else null end,
        'acceptedAnswers', case when reveal.on then coalesce(ans.accepted_answers, '{}'::text[]) else null end,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'isCorrect', case when reveal.on then (o.id = any(coalesce(ans.correct_option_ids, '{}'::uuid[]))) else null end
          ) order by o.display_order), '[]'::jsonb)
          from public.question_options o
          where o.question_id = q.id
        )
      ) order by elem.ord), '[]'::jsonb)
      from jsonb_array_elements(t.question_order) with ordinality as elem(value, ord)
      join public.questions q on q.id = (elem.value ->> 'questionId')::uuid
      left join public.attempt_answers aa on aa.attempt_id = t.id and aa.question_id = q.id
      left join public.question_answers ans on ans.question_id = q.id
      cross join lateral (
        select (
          t.status in ('submitted', 'pending_grading', 'graded')
          or (t.feedback_mode = 'immediate' and aa.id is not null)
        ) as on
      ) reveal
    )
  )
  from t;
$$;

revoke all on function public.get_attempt_review(uuid) from public;
grant execute on function public.get_attempt_review(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- grade_attempt_answer (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.grade_attempt_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_points numeric,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempt public.quiz_attempts%rowtype;
  v_max numeric;
  v_pending integer;
  v_score numeric;
  v_percent numeric;
begin
  if v_user is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  select q.points into v_max
  from public.questions q
  join public.attempt_answers aa
    on aa.question_id = q.id and aa.attempt_id = p_attempt_id
  where q.id = p_question_id;
  if v_max is null then
    raise exception using errcode = 'P0002', message = 'ANSWER_NOT_FOUND';
  end if;

  p_points := greatest(0, least(coalesce(p_points, 0), v_max));

  update public.attempt_answers
  set points_awarded = p_points,
      is_correct = (p_points >= v_max),
      grader_feedback = p_feedback,
      graded_at = now(),
      graded_by = v_user,
      updated_at = now()
  where attempt_id = p_attempt_id and question_id = p_question_id;

  select count(*) into v_pending
  from public.attempt_answers
  where attempt_id = p_attempt_id and is_correct is null;

  select coalesce(sum(points_awarded), 0) into v_score
  from public.attempt_answers where attempt_id = p_attempt_id;

  v_percent := case
    when v_attempt.max_points > 0 then round((v_score / v_attempt.max_points) * 100, 2)
    else 0
  end;

  update public.quiz_attempts
  set score_points = v_score,
      percent = v_percent,
      status = case when v_pending > 0 then 'pending_grading' else 'graded' end,
      passed = case
        when v_pending > 0 then null
        else v_percent >= (select pass_mark_percent from public.quizzes where id = v_attempt.quiz_id)
      end,
      submitted_at = coalesce(submitted_at, now())
  where id = p_attempt_id;

  return jsonb_build_object(
    'attemptId', p_attempt_id,
    'scorePoints', v_score,
    'maxPoints', v_attempt.max_points,
    'percent', v_percent,
    'status', case when v_pending > 0 then 'pending_grading' else 'graded' end
  );
end;
$$;

-- Execute is granted to authenticated (in addition to service_role) because
-- the function is SECURITY DEFINER and enforces public.is_admin() itself, so a
-- non-admin session can never invoke it even though it is callable.
revoke all on function public.grade_attempt_answer(uuid, uuid, numeric, text) from public;
grant execute on function public.grade_attempt_answer(uuid, uuid, numeric, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- recompute_course_completion (DB-derived only)
-- ---------------------------------------------------------------------------
create or replace function public.recompute_course_completion(
  p_user_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_lessons integer;
  v_completed_lessons integer;
  v_required_quizzes integer;
  v_satisfied_quizzes integer;
  v_was_completed boolean;
  v_is_complete boolean;
  v_progress integer;
  v_denominator integer;
begin
  select count(*) into v_total_lessons
  from public.lessons l
  join public.course_modules m on m.id = l.module_id
  where m.course_id = p_course_id;

  select count(*) into v_completed_lessons
  from public.lessons l
  join public.course_modules m on m.id = l.module_id
  join public.lesson_progress lp
    on lp.lesson_id = l.id and lp.user_id = p_user_id and lp.is_completed = true
  where m.course_id = p_course_id;

  select count(*) into v_required_quizzes
  from public.quizzes z
  where z.course_id = p_course_id
    and z.is_required = true
    and z.is_published = true
    and z.kind <> 'practice';

  select count(*) into v_satisfied_quizzes
  from public.quizzes z
  where z.course_id = p_course_id
    and z.is_required = true
    and z.is_published = true
    and z.kind <> 'practice'
    and exists (
      select 1 from public.quiz_attempts a
      where a.quiz_id = z.id
        and a.user_id = p_user_id
        and a.status = 'graded'
        and a.passed = true
    );

  v_is_complete :=
    (v_completed_lessons = v_total_lessons)
    and (v_satisfied_quizzes = v_required_quizzes)
    and (v_total_lessons > 0 or v_required_quizzes > 0);

  v_denominator := v_total_lessons + v_required_quizzes;
  if v_denominator > 0 then
    v_progress := round(((v_completed_lessons + v_satisfied_quizzes)::numeric / v_denominator) * 100);
  else
    v_progress := 0;
  end if;

  select status = 'completed' into v_was_completed
  from public.course_enrollments
  where user_id = p_user_id and course_id = p_course_id;

  update public.course_enrollments
  set progress_percent = greatest(progress_percent, least(100, v_progress)),
      status = case when v_is_complete then 'completed' else status end,
      completed_at = case
        when v_is_complete then coalesce(completed_at, now())
        else completed_at
      end
  where user_id = p_user_id and course_id = p_course_id;

  return jsonb_build_object(
    'isComplete', v_is_complete,
    'newlyCompleted', v_is_complete and coalesce(not v_was_completed, false),
    'progressPercent', greatest(0, least(100, v_progress))
  );
end;
$$;

revoke all on function public.recompute_course_completion(uuid, uuid) from public;
grant execute on function public.recompute_course_completion(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- rate limit: add an "assessment" bucket
-- ---------------------------------------------------------------------------
alter table public.api_rate_limits drop constraint if exists api_rate_limits_bucket_check;
alter table public.api_rate_limits
  add constraint api_rate_limits_bucket_check
  check (bucket in (
    'contact', 'consultation', 'startup', 'enrollment', 'email', 'verification',
    'assessment'
  ));

create or replace function public.consume_public_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_bucket not in (
    'contact', 'consultation', 'startup', 'enrollment', 'email', 'verification',
    'assessment'
  ) then
    raise exception 'Unknown rate limit bucket: %', p_bucket using errcode = '22023';
  end if;

  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Rate limit key hash must be a 64-character lowercase hex string'
      using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Rate limit must be between 1 and 100' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Rate limit window must be between 60 and 86400 seconds'
      using errcode = '22023';
  end if;

  delete from public.api_rate_limits
  where window_started < v_now - interval '1 day';

  insert into public.api_rate_limits (bucket, key_hash, window_started, request_count)
  values (p_bucket, p_key_hash, v_now, 1)
  on conflict (bucket, key_hash) do update
    set request_count = case
          when public.api_rate_limits.window_started < v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.api_rate_limits.request_count + 1
        end,
        window_started = case
          when public.api_rate_limits.window_started < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.api_rate_limits.window_started
        end
  returning request_count, window_started into v_count, v_window_started;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, text, integer, integer)
  to service_role;
