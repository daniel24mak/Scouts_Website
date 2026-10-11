-- Atomic attendance saves. Apply before deploying the attendance RPC client.
-- Function errors propagate: record replacement and its audit either both commit or both roll back.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_scout_attendance(
  target_group_id text,
  target_equipe_id uuid,
  target_scope text,
  target_date date,
  target_topic text,
  target_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  active_year_ids uuid[];
  active_year_id uuid;
  saved_session_id uuid;
  existing_session boolean;
  saved_record_count integer;
  saved_topic text := COALESCE(NULLIF(btrim(target_topic), ''), 'Meeting');
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = caller_id AND account_status = 'active') THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id ORDER BY id) INTO active_year_ids
  FROM (SELECT id FROM public.scout_years WHERE is_active = true FOR SHARE) AS active_years;
  active_year_id := active_year_ids[1];
  IF active_year_id IS NULL OR cardinality(active_year_ids) <> 1 THEN
    RAISE EXCEPTION 'Exactly one active scouting year is required' USING ERRCODE = '22023';
  END IF;
  IF target_date IS NULL THEN
    RAISE EXCEPTION 'Attendance date is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(target_records) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Attendance records must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF target_group_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.groups WHERE id = target_group_id) THEN
    RAISE EXCEPTION 'Attendance group does not exist' USING ERRCODE = '22023';
  END IF;
  IF target_scope IS NULL OR target_scope NOT IN ('group', 'equipe')
    OR (target_scope = 'group' AND target_equipe_id IS NOT NULL)
    OR (target_scope = 'equipe' AND target_equipe_id IS NULL) THEN
    RAISE EXCEPTION 'Attendance scope and equipe do not match' USING ERRCODE = '22023';
  END IF;
  IF target_scope = 'equipe' AND NOT EXISTS (
    SELECT 1 FROM public.equipes
    WHERE id = target_equipe_id AND group_id = target_group_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Attendance equipe must belong to the selected group and be active' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.is_admin()
    OR public.can_manage_group(target_group_id)
    OR public.is_coordinator_for_group(target_group_id)
    OR (target_scope = 'equipe' AND public.can_take_equipe_attendance(target_equipe_id))
  ) THEN
    RAISE EXCEPTION 'Not allowed to save attendance for this scope' USING ERRCODE = '42501';
  END IF;

  -- Validate the entire payload before casting IDs or touching saved attendance.
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records)
    WHERE key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Attendance record IDs must be UUIDs' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records)
    WHERE value IS NULL OR value NOT IN ('Present', 'Absent', 'Late', 'Excused')
  ) THEN
    RAISE EXCEPTION 'Invalid attendance status' USING ERRCODE = '22023';
  END IF;
  -- Keep referenced scouts in the validated year/group/equipe through replacement.
  PERFORM scout.id FROM public.scouts AS scout
  JOIN jsonb_each_text(target_records) AS record ON scout.id = record.key::uuid
  ORDER BY scout.id FOR SHARE OF scout;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records) AS record
    WHERE NOT EXISTS (
      SELECT 1 FROM public.scouts
      WHERE id = record.key::uuid
        AND scout_year_id = active_year_id
        AND group_id = target_group_id
        AND (target_scope = 'group' OR equipe_id = target_equipe_id)
    )
  ) THEN
    RAISE EXCEPTION 'Attendance scouts must belong to the active year and selected scope' USING ERRCODE = '22023';
  END IF;

  -- NULL equipes and legacy duplicate sessions prevent relying on a unique-key upsert.
  -- All RPC saves of the same session identity share this transaction-scoped lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array('scout_attendance', active_year_id, target_group_id, target_scope, target_equipe_id, target_date)::text, 0
  ));
  SELECT id INTO saved_session_id FROM public.attendance_sessions
  WHERE scout_year_id = active_year_id
    AND group_id = target_group_id
    AND scope = target_scope
    AND equipe_id IS NOT DISTINCT FROM target_equipe_id
    AND date = target_date
  ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  existing_session := saved_session_id IS NOT NULL;
  IF existing_session THEN
    UPDATE public.attendance_sessions SET topic = saved_topic, taken_by = caller_id
    WHERE id = saved_session_id;
  ELSE
    INSERT INTO public.attendance_sessions (scout_year_id, group_id, equipe_id, scope, date, topic, taken_by)
    VALUES (active_year_id, target_group_id, target_equipe_id, target_scope, target_date, saved_topic, caller_id)
    RETURNING id INTO saved_session_id;
  END IF;

  DELETE FROM public.attendance_records WHERE session_id = saved_session_id;
  INSERT INTO public.attendance_records (session_id, scout_id, status)
  SELECT saved_session_id, key::uuid, value
  FROM jsonb_each_text(target_records);
  GET DIAGNOSTICS saved_record_count = ROW_COUNT;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    caller_id,
    CASE WHEN existing_session THEN 'attendance_updated_after_submission' ELSE 'attendance_taken' END,
    'Attendance', saved_session_id::text,
    jsonb_build_object('groupId', target_group_id, 'equipeId', target_equipe_id, 'scope', target_scope,
      'date', target_date, 'topic', saved_topic, 'recordCount', saved_record_count)
  );
  RETURN jsonb_build_object('id', saved_session_id, 'recordCount', saved_record_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_chief_attendance(
  target_date date,
  target_topic text,
  target_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  active_year_ids uuid[];
  active_year_id uuid;
  saved_session_id uuid;
  existing_session boolean;
  saved_record_count integer;
  saved_topic text := COALESCE(NULLIF(btrim(target_topic), ''), 'Chief meeting');
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may save chief attendance' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id ORDER BY id) INTO active_year_ids
  FROM (SELECT id FROM public.scout_years WHERE is_active = true FOR SHARE) AS active_years;
  active_year_id := active_year_ids[1];
  IF active_year_id IS NULL OR cardinality(active_year_ids) <> 1 THEN
    RAISE EXCEPTION 'Exactly one active scouting year is required' USING ERRCODE = '22023';
  END IF;
  IF target_date IS NULL THEN
    RAISE EXCEPTION 'Attendance date is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(target_records) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Attendance records must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records)
    WHERE key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Attendance record IDs must be UUIDs' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records)
    WHERE value IS NULL OR value NOT IN ('Present', 'Absent', 'Late', 'Excused')
  ) THEN
    RAISE EXCEPTION 'Invalid attendance status' USING ERRCODE = '22023';
  END IF;
  PERFORM profile.id FROM public.user_profiles AS profile
  JOIN jsonb_each_text(target_records) AS record ON profile.id = record.key::uuid
  ORDER BY profile.id FOR SHARE OF profile;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(target_records) AS record
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = record.key::uuid AND account_status = 'active'
        -- Matches the chief role synthesized by normalizeProfile for the attendance UI.
        AND (role = 'chief' OR group_id IS NOT NULL OR chief_level IS NOT NULL
          OR cardinality(coordinator_group_ids) > 0)
    )
  ) THEN
    RAISE EXCEPTION 'Chief attendance records must reference active chiefs' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array('chief_attendance', active_year_id, target_date)::text, 0
  ));
  SELECT id INTO saved_session_id FROM public.chief_attendance_sessions
  WHERE scout_year_id = active_year_id AND date = target_date
  ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  existing_session := saved_session_id IS NOT NULL;
  IF existing_session THEN
    UPDATE public.chief_attendance_sessions SET topic = saved_topic, taken_by = caller_id
    WHERE id = saved_session_id;
  ELSE
    INSERT INTO public.chief_attendance_sessions (scout_year_id, date, topic, taken_by)
    VALUES (active_year_id, target_date, saved_topic, caller_id)
    RETURNING id INTO saved_session_id;
  END IF;

  DELETE FROM public.chief_attendance_records WHERE session_id = saved_session_id;
  INSERT INTO public.chief_attendance_records (session_id, chief_id, status)
  SELECT saved_session_id, key::uuid, value
  FROM jsonb_each_text(target_records);
  GET DIAGNOSTICS saved_record_count = ROW_COUNT;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    caller_id,
    CASE WHEN existing_session THEN 'attendance_updated_after_submission' ELSE 'attendance_taken' END,
    'Chief attendance', saved_session_id::text,
    jsonb_build_object('date', target_date, 'topic', saved_topic, 'recordCount', saved_record_count)
  );
  RETURN jsonb_build_object('id', saved_session_id, 'recordCount', saved_record_count);
END;
$$;

REVOKE ALL ON FUNCTION public.save_scout_attendance(text, uuid, text, date, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_chief_attendance(date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_scout_attendance(text, uuid, text, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_chief_attendance(date, text, jsonb) TO authenticated;

COMMIT;
