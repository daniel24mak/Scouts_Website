-- Shared, additive workflow and task engine for operational workspaces.
-- Run after supabase-access-control-foundation.sql and supabase-workspace-access.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  workspace_key text NOT NULL CHECK (workspace_key IN ('finance','storage','scouting','media','admin')),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.workflow_template_versions(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  name text NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  execution_mode text NOT NULL DEFAULT 'ordered' CHECK (execution_mode IN ('ordered','parallel')),
  required_decisions integer NOT NULL DEFAULT 1 CHECK (required_decisions > 0),
  required_permission text REFERENCES public.permissions(id),
  approver_user_id uuid REFERENCES public.user_profiles(id),
  approver_role_id text REFERENCES public.roles(id),
  approver_team_id uuid REFERENCES public.teams(id),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_after interval,
  UNIQUE (template_version_id, stage_key),
  UNIQUE (template_version_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.workflow_template_versions(id),
  workspace_key text NOT NULL CHECK (workspace_key IN ('finance','storage','scouting','media','admin')),
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','changes_requested','cancelled')),
  current_stage_sequence integer,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_key, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_stage_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  workflow_stage_id uuid NOT NULL REFERENCES public.workflow_stages(id),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','approved','rejected','changes_requested','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (workflow_instance_id, workflow_stage_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_instance_id uuid NOT NULL REFERENCES public.workflow_stage_instances(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES public.user_profiles(id),
  assigned_by uuid REFERENCES public.user_profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','changes_requested','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_instance_id, assigned_to)
);

CREATE TABLE IF NOT EXISTS public.workflow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.workflow_assignments(id),
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  workspace_key text NOT NULL CHECK (workspace_key IN ('finance','storage','scouting','media','admin')),
  task_type text NOT NULL,
  title text NOT NULL,
  related_label text,
  assigned_to uuid NOT NULL REFERENCES public.user_profiles(id),
  required_permission text REFERENCES public.permissions(id),
  permission_scope jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','due-soon','overdue','action-required')),
  due_at timestamptz,
  deep_link text NOT NULL CHECK (deep_link LIKE '/dashboard/%'),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_instances_requester_status_idx ON public.workflow_instances(requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_instances_source_idx ON public.workflow_instances(workspace_key, source_type, source_id);
CREATE INDEX IF NOT EXISTS workflow_assignments_assignee_status_idx ON public.workflow_assignments(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS workflow_comments_instance_created_idx ON public.workflow_comments(workflow_instance_id, created_at);
CREATE INDEX IF NOT EXISTS workspace_tasks_assignee_status_due_idx ON public.workspace_tasks(assigned_to, status, due_at);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stage_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read active workflow templates" ON public.workflow_templates;
CREATE POLICY "authenticated read active workflow templates" ON public.workflow_templates FOR SELECT TO authenticated USING (workflow_templates.is_active);
DROP POLICY IF EXISTS "authenticated read published workflow versions" ON public.workflow_template_versions;
CREATE POLICY "authenticated read published workflow versions" ON public.workflow_template_versions FOR SELECT TO authenticated USING (workflow_template_versions.is_published);
DROP POLICY IF EXISTS "authenticated read published workflow stages" ON public.workflow_stages;
CREATE POLICY "authenticated read published workflow stages" ON public.workflow_stages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workflow_template_versions v WHERE v.id=workflow_stages.template_version_id AND v.is_published));

DROP POLICY IF EXISTS "workflow participants read instances" ON public.workflow_instances;
CREATE POLICY "workflow participants read instances" ON public.workflow_instances FOR SELECT TO authenticated USING (
  workflow_instances.requester_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_stage_instances si JOIN public.workflow_assignments a ON a.stage_instance_id=si.id WHERE si.workflow_instance_id=workflow_instances.id AND a.assigned_to=auth.uid())
);
DROP POLICY IF EXISTS "workflow participants read stages" ON public.workflow_stage_instances;
CREATE POLICY "workflow participants read stages" ON public.workflow_stage_instances FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id=workflow_stage_instances.workflow_instance_id AND (i.requester_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_assignments a WHERE a.stage_instance_id=workflow_stage_instances.id AND a.assigned_to=auth.uid()))));
DROP POLICY IF EXISTS "assignees read workflow assignments" ON public.workflow_assignments;
CREATE POLICY "assignees read workflow assignments" ON public.workflow_assignments FOR SELECT TO authenticated USING (workflow_assignments.assigned_to=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_stage_instances si JOIN public.workflow_instances i ON i.id=si.workflow_instance_id WHERE si.id=workflow_assignments.stage_instance_id AND i.requester_id=auth.uid()));
DROP POLICY IF EXISTS "participants read workflow decisions" ON public.workflow_decisions;
CREATE POLICY "participants read workflow decisions" ON public.workflow_decisions FOR SELECT TO authenticated USING (workflow_decisions.actor_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_assignments a JOIN public.workflow_stage_instances si ON si.id=a.stage_instance_id JOIN public.workflow_instances i ON i.id=si.workflow_instance_id WHERE a.id=workflow_decisions.assignment_id AND (a.assigned_to=auth.uid() OR i.requester_id=auth.uid())));
DROP POLICY IF EXISTS "participants read workflow comments" ON public.workflow_comments;
CREATE POLICY "participants read workflow comments" ON public.workflow_comments FOR SELECT TO authenticated USING (workflow_comments.author_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id=workflow_comments.workflow_instance_id AND (i.requester_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workflow_stage_instances si JOIN public.workflow_assignments a ON a.stage_instance_id=si.id WHERE si.workflow_instance_id=i.id AND a.assigned_to=auth.uid()))));
DROP POLICY IF EXISTS "users read own workspace tasks" ON public.workspace_tasks;
CREATE POLICY "users read own workspace tasks" ON public.workspace_tasks FOR SELECT TO authenticated USING (workspace_tasks.assigned_to=auth.uid());

CREATE OR REPLACE FUNCTION public.start_workspace_workflow(
  target_template_key text,
  target_source_type text,
  target_source_id text,
  target_title text,
  target_context jsonb DEFAULT '{}'::jsonb
)
RETURNS public.workflow_instances
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE template_row public.workflow_templates; version_row public.workflow_template_versions; stage_row public.workflow_stages; saved public.workflow_instances; active_stage_instance_id uuid; approver_id uuid; start_permission text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT t.* INTO template_row FROM public.workflow_templates t WHERE t.template_key=target_template_key AND t.is_active FOR UPDATE;
  IF template_row.id IS NULL THEN RAISE EXCEPTION 'Workflow template is unavailable' USING ERRCODE='P0002'; END IF;
  SELECT v.* INTO version_row FROM public.workflow_template_versions v WHERE v.template_id=template_row.id AND v.is_published ORDER BY v.version_number DESC LIMIT 1;
  IF version_row.id IS NULL THEN RAISE EXCEPTION 'Workflow template has no published version' USING ERRCODE='P0002'; END IF;
  start_permission := version_row.configuration->>'start_permission';
  IF start_permission IS NOT NULL AND NOT public.has_permission(start_permission) THEN RAISE EXCEPTION 'Workflow start permission denied' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO stage_row FROM public.workflow_stages s WHERE s.template_version_id=version_row.id ORDER BY s.sequence_number LIMIT 1;
  IF stage_row.id IS NULL THEN RAISE EXCEPTION 'Workflow has no stages' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.workflow_instances(template_version_id,workspace_key,source_type,source_id,title,requester_id,current_stage_sequence,context,due_at)
  VALUES(version_row.id,template_row.workspace_key,btrim(target_source_type),btrim(target_source_id),btrim(target_title),auth.uid(),stage_row.sequence_number,COALESCE(target_context,'{}'::jsonb),CASE WHEN stage_row.due_after IS NULL THEN NULL ELSE now()+stage_row.due_after END)
  RETURNING * INTO saved;
  INSERT INTO public.workflow_stage_instances(workflow_instance_id,workflow_stage_id,status,started_at) VALUES(saved.id,stage_row.id,'active',now()) RETURNING id INTO active_stage_instance_id;
  FOR approver_id IN
    SELECT candidate.user_id FROM (
      SELECT stage_row.approver_user_id AS user_id
      UNION
      SELECT ura.user_id FROM public.user_role_assignments ura WHERE stage_row.approver_role_id IS NOT NULL AND ura.role_id=stage_row.approver_role_id AND ura.starts_at<=now() AND (ura.expires_at IS NULL OR ura.expires_at>now())
      UNION
      SELECT utm.user_id FROM public.user_team_memberships utm WHERE stage_row.approver_team_id IS NOT NULL AND utm.team_id=stage_row.approver_team_id AND utm.starts_at<=now() AND (utm.expires_at IS NULL OR utm.expires_at>now())
    ) candidate WHERE candidate.user_id IS NOT NULL AND candidate.user_id<>auth.uid()
  LOOP
    INSERT INTO public.workflow_assignments(stage_instance_id,assigned_to,assigned_by,due_at) VALUES(active_stage_instance_id,approver_id,auth.uid(),saved.due_at) ON CONFLICT DO NOTHING;
    INSERT INTO public.workspace_tasks(workflow_instance_id,workspace_key,task_type,title,related_label,assigned_to,required_permission,due_at,deep_link)
    VALUES(saved.id,saved.workspace_key,'approval',saved.title,target_source_type,approver_id,stage_row.required_permission,saved.due_at,'/dashboard/'||saved.workspace_key||'/approvals') ON CONFLICT DO NOTHING;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.workflow_assignments a WHERE a.stage_instance_id=active_stage_instance_id) THEN RAISE EXCEPTION 'Workflow stage has no eligible approver' USING ERRCODE='P0002'; END IF;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.decide_workspace_workflow(target_assignment_id uuid, target_decision text, target_comment text DEFAULT NULL)
RETURNS public.workflow_instances
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE assignment_row public.workflow_assignments; instance_row public.workflow_instances; stage_row public.workflow_stages; next_stage public.workflow_stages; stage_instance_id uuid; next_stage_instance_id uuid; remaining integer; approver_id uuid; next_due_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF target_decision NOT IN ('approved','rejected','changes_requested') THEN RAISE EXCEPTION 'Illegal workflow decision' USING ERRCODE='22023'; END IF;
  SELECT a.* INTO assignment_row FROM public.workflow_assignments a WHERE a.id=target_assignment_id FOR UPDATE;
  IF NOT FOUND OR assignment_row.status <> 'pending' THEN RAISE EXCEPTION 'Assignment is not pending' USING ERRCODE='P0002'; END IF;
  SELECT si.id INTO stage_instance_id FROM public.workflow_stage_instances si WHERE si.id=assignment_row.stage_instance_id FOR UPDATE;
  SELECT i.* INTO instance_row FROM public.workflow_instances i JOIN public.workflow_stage_instances si ON si.workflow_instance_id=i.id WHERE si.id=stage_instance_id FOR UPDATE OF i;
  SELECT s.* INTO stage_row FROM public.workflow_stages s JOIN public.workflow_stage_instances si ON si.workflow_stage_id=s.id WHERE si.id=stage_instance_id;
  IF assignment_row.assigned_to <> auth.uid() AND NOT public.has_permission(COALESCE(stage_row.required_permission,'workflow.decide')) THEN RAISE EXCEPTION 'Assignment does not belong to current user' USING ERRCODE='42501'; END IF;
  IF instance_row.requester_id = auth.uid() THEN RAISE EXCEPTION 'Requester cannot approve their own workflow' USING ERRCODE='42501'; END IF;
  INSERT INTO public.workflow_decisions(assignment_id,actor_id,decision,comment) VALUES(target_assignment_id,auth.uid(),target_decision,NULLIF(btrim(target_comment),''));
  UPDATE public.workflow_assignments SET status=target_decision, completed_at=now() WHERE id=target_assignment_id;
  IF target_decision IN ('rejected','changes_requested') THEN
    UPDATE public.workflow_stage_instances SET status=target_decision, completed_at=now() WHERE id=stage_instance_id;
    UPDATE public.workflow_instances SET status=target_decision, completed_at=now(), updated_at=now() WHERE id=instance_row.id RETURNING * INTO instance_row;
  ELSE
    SELECT count(*) INTO remaining FROM public.workflow_assignments pending_assignment WHERE pending_assignment.stage_instance_id=assignment_row.stage_instance_id AND pending_assignment.status='pending';
    IF remaining=0 THEN
      UPDATE public.workflow_stage_instances SET status='approved', completed_at=now() WHERE id=stage_instance_id;
      SELECT s.* INTO next_stage FROM public.workflow_stages s
      WHERE s.template_version_id=instance_row.template_version_id AND s.sequence_number>stage_row.sequence_number
      ORDER BY s.sequence_number LIMIT 1;
      IF next_stage.id IS NULL THEN
        UPDATE public.workflow_instances SET status='approved', completed_at=now(), updated_at=now() WHERE id=instance_row.id RETURNING * INTO instance_row;
      ELSE
        next_due_at := CASE WHEN next_stage.due_after IS NULL THEN NULL ELSE now()+next_stage.due_after END;
        INSERT INTO public.workflow_stage_instances(workflow_instance_id,workflow_stage_id,status,started_at)
        VALUES(instance_row.id,next_stage.id,'active',now()) RETURNING id INTO next_stage_instance_id;
        UPDATE public.workflow_instances SET current_stage_sequence=next_stage.sequence_number,due_at=next_due_at,updated_at=now() WHERE id=instance_row.id RETURNING * INTO instance_row;
        FOR approver_id IN
          SELECT candidate.user_id FROM (
            SELECT next_stage.approver_user_id AS user_id
            UNION SELECT ura.user_id FROM public.user_role_assignments ura WHERE next_stage.approver_role_id IS NOT NULL AND ura.role_id=next_stage.approver_role_id AND ura.starts_at<=now() AND (ura.expires_at IS NULL OR ura.expires_at>now())
            UNION SELECT utm.user_id FROM public.user_team_memberships utm WHERE next_stage.approver_team_id IS NOT NULL AND utm.team_id=next_stage.approver_team_id AND utm.starts_at<=now() AND (utm.expires_at IS NULL OR utm.expires_at>now())
          ) candidate WHERE candidate.user_id IS NOT NULL AND candidate.user_id<>instance_row.requester_id
        LOOP
          INSERT INTO public.workflow_assignments(stage_instance_id,assigned_to,assigned_by,due_at) VALUES(next_stage_instance_id,approver_id,auth.uid(),next_due_at) ON CONFLICT DO NOTHING;
          INSERT INTO public.workspace_tasks(workflow_instance_id,workspace_key,task_type,title,related_label,assigned_to,required_permission,due_at,deep_link)
          VALUES(instance_row.id,instance_row.workspace_key,'approval',instance_row.title,instance_row.source_type,approver_id,next_stage.required_permission,next_due_at,'/dashboard/'||instance_row.workspace_key||'/approvals') ON CONFLICT DO NOTHING;
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM public.workflow_assignments a WHERE a.stage_instance_id=next_stage_instance_id) THEN RAISE EXCEPTION 'Next workflow stage has no eligible approver' USING ERRCODE='P0002'; END IF;
      END IF;
    END IF;
  END IF;
  UPDATE public.workspace_tasks SET status='completed',completed_at=now(),updated_at=now() WHERE workflow_instance_id=instance_row.id AND assigned_to=auth.uid() AND status IN ('open','in_progress');
  RETURN instance_row;
END $$;

CREATE OR REPLACE FUNCTION public.complete_workspace_task(target_task_id uuid)
RETURNS public.workspace_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved public.workspace_tasks;
BEGIN
  UPDATE public.workspace_tasks SET status='completed',completed_at=now(),updated_at=now()
  WHERE id=target_task_id AND assigned_to=auth.uid() AND status IN ('open','in_progress') RETURNING * INTO saved;
  IF saved.id IS NULL THEN RAISE EXCEPTION 'Task is unavailable' USING ERRCODE='42501'; END IF;
  RETURN saved;
END $$;

REVOKE ALL ON FUNCTION public.decide_workspace_workflow(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_workspace_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_workspace_workflow(text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_workspace_workflow(text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_workspace_workflow(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workspace_task(uuid) TO authenticated;

COMMIT;
