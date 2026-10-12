-- Grade bands and threshold configuration
-- Adds grade_thresholds to courses and grade_band tracking to quiz_attempts

-- 1. Courses grade_thresholds column
alter table public.courses
  add column if not exists grade_thresholds jsonb not null
  default '{"distinction": 80, "merit": 65, "pass": 50}'::jsonb;

-- 2. Quiz attempts grade_band column
alter table public.quiz_attempts
  add column if not exists grade_band text
  check (grade_band is null or grade_band in ('Distinction', 'Merit', 'Pass'));

-- 3. Update _finalize_quiz_attempt to set grade_band on graded attempts
create or replace function public._finalize_quiz_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_quiz public.quizzes%rowtype;
  v_pending integer;
  v_score numeric;
  v_percent numeric;
  v_pass boolean;
  v_grade_band text;
  v_distinction numeric := 80;
  v_merit numeric := 65;
  v_pass_threshold numeric := 50;
  v_thresholds jsonb;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;
  if v_attempt.status <> 'in_progress' then
    return;
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  -- Load course custom grade thresholds if configured
  select grade_thresholds into v_thresholds
  from public.courses
  where id = v_quiz.course_id;

  if v_thresholds is not null then
    if (v_thresholds ->> 'distinction') is not null then
      v_distinction := (v_thresholds ->> 'distinction')::numeric;
    end if;
    if (v_thresholds ->> 'merit') is not null then
      v_merit := (v_thresholds ->> 'merit')::numeric;
    end if;
    if (v_thresholds ->> 'pass') is not null then
      v_pass_threshold := (v_thresholds ->> 'pass')::numeric;
    end if;
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
    v_grade_band := null;
  else
    v_pass := v_percent >= v_quiz.pass_mark_percent;
    if v_pass then
      if v_percent >= v_distinction then
        v_grade_band := 'Distinction';
      elsif v_percent >= v_merit then
        v_grade_band := 'Merit';
      else
        v_grade_band := 'Pass';
      end if;
    else
      v_grade_band := null;
    end if;
  end if;

  update public.quiz_attempts
  set status = case when v_pending > 0 then 'pending_grading' else 'graded' end,
      submitted_at = coalesce(submitted_at, now()),
      score_points = v_score,
      percent = v_percent,
      passed = v_pass,
      grade_band = v_grade_band
  where id = p_attempt_id;
end;
$$;

-- 4. Update grade_attempt_answer to set grade_band on manual grading completion
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
  v_quiz public.quizzes%rowtype;
  v_max numeric;
  v_pending integer;
  v_score numeric;
  v_percent numeric;
  v_pass boolean;
  v_grade_band text;
  v_distinction numeric := 80;
  v_merit numeric := 65;
  v_pass_threshold numeric := 50;
  v_thresholds jsonb;
begin
  if v_user is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

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

  -- Load course custom grade thresholds if configured
  select grade_thresholds into v_thresholds
  from public.courses
  where id = v_quiz.course_id;

  if v_thresholds is not null then
    if (v_thresholds ->> 'distinction') is not null then
      v_distinction := (v_thresholds ->> 'distinction')::numeric;
    end if;
    if (v_thresholds ->> 'merit') is not null then
      v_merit := (v_thresholds ->> 'merit')::numeric;
    end if;
  end if;

  if v_pending > 0 then
    v_pass := null;
    v_grade_band := null;
  else
    v_pass := v_percent >= v_quiz.pass_mark_percent;
    if v_pass then
      if v_percent >= v_distinction then
        v_grade_band := 'Distinction';
      elsif v_percent >= v_merit then
        v_grade_band := 'Merit';
      else
        v_grade_band := 'Pass';
      end if;
    else
      v_grade_band := null;
    end if;
  end if;

  update public.quiz_attempts
  set score_points = v_score,
      percent = v_percent,
      status = case when v_pending > 0 then 'pending_grading' else 'graded' end,
      passed = v_pass,
      grade_band = v_grade_band,
      submitted_at = coalesce(submitted_at, now())
  where id = p_attempt_id;

  return jsonb_build_object(
    'attemptId', p_attempt_id,
    'scorePoints', v_score,
    'maxPoints', v_attempt.max_points,
    'percent', v_percent,
    'gradeBand', v_grade_band,
    'status', case when v_pending > 0 then 'pending_grading' else 'graded' end
  );
end;
$$;

-- 5. Update get_attempt_review to expose gradeBand
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
           a.grade_band, a.tab_switch_count, a.question_order,
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
    'gradeBand', t.grade_band,
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
