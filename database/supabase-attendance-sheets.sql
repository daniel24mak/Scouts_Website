-- Attendance Sheets migration
-- This keeps attendance in normalized Supabase tables separated by group_id.
-- It avoids creating one physical table per group, so new groups work automatically
-- and existing attendance_sessions / attendance_records data is preserved.

CREATE OR REPLACE FUNCTION public.can_manage_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND group_id = target_group_id
      AND role IN ('admin', 'chief')
      AND chief_level IN ('head', 'vice')
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_take_equipe_attendance(target_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.equipes e
    JOIN public.user_profiles p ON p.group_id = e.group_id
    WHERE e.id = target_equipe_id
      AND p.id = auth.uid()
      AND p.chief_level IN ('head', 'vice')
      AND p.account_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.equipe_leaders
    WHERE equipe_id = target_equipe_id
      AND chief_id = auth.uid()
      AND is_active = true
  );
$$;

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'group' CHECK (scope IN ('group', 'equipe')),
ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'Meeting',
ADD COLUMN IF NOT EXISTS taken_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_group_date
  ON attendance_sessions (group_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_group_scope_date
  ON attendance_sessions (group_id, scope, date);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_equipe_date
  ON attendance_sessions (equipe_id, date)
  WHERE equipe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_session
  ON attendance_records (session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_scout
  ON attendance_records (scout_id);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance by assigned chiefs" ON attendance_sessions;
CREATE POLICY "attendance by assigned chiefs" ON attendance_sessions
  FOR ALL USING (
    public.is_admin()
    OR group_id = (
      SELECT group_id
      FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'chief')
        AND account_status = 'active'
    )
    OR public.can_manage_group(group_id)
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  ) WITH CHECK (
    public.is_admin()
    OR group_id = (
      SELECT group_id
      FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'chief')
        AND account_status = 'active'
    )
    OR public.can_manage_group(group_id)
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  );

DROP POLICY IF EXISTS "attendance records follow session" ON attendance_records;
CREATE POLICY "attendance records follow session" ON attendance_records
  FOR ALL USING (
    public.is_admin()
    OR session_id IN (
      SELECT id
      FROM attendance_sessions
      WHERE group_id = (
          SELECT group_id
          FROM user_profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'chief')
            AND account_status = 'active'
        )
        OR public.can_manage_group(group_id)
        OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
    )
  ) WITH CHECK (
    public.is_admin()
    OR session_id IN (
      SELECT id
      FROM attendance_sessions
      WHERE group_id = (
          SELECT group_id
          FROM user_profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'chief')
            AND account_status = 'active'
        )
        OR public.can_manage_group(group_id)
        OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
    )
  );

CREATE OR REPLACE FUNCTION public.can_manage_attendance_session(target_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_sessions
    WHERE id = target_session_id
      AND (public.is_admin() OR public.can_manage_group(group_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.update_attendance_session_date(target_session_id uuid, target_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_attendance_session(target_session_id) THEN
    RAISE EXCEPTION 'Not allowed to update this attendance session date' USING ERRCODE = '42501';
  END IF;

  UPDATE public.attendance_sessions
  SET date = target_date
  WHERE id = target_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_attendance_session(target_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_attendance_session(target_session_id) THEN
    RAISE EXCEPTION 'Not allowed to delete this attendance session' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.attendance_sessions
  WHERE id = target_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_attendance_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_attendance_session_date(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_attendance_session(uuid) TO authenticated;
