-- Private Finance and Storage attachments. Run after workspace access.
BEGIN;
INSERT INTO storage.buckets(id,name,public) VALUES ('finance-private','finance-private',false),('storage-private','storage-private',false) ON CONFLICT(id) DO UPDATE SET public=false;
CREATE TABLE IF NOT EXISTS public.workspace_private_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_key text NOT NULL CHECK(workspace_key IN ('finance','storage')),bucket_id text NOT NULL CHECK(bucket_id IN ('finance-private','storage-private')),object_path text NOT NULL UNIQUE,resource_type text NOT NULL,resource_id uuid,original_name text NOT NULL,content_type text NOT NULL,size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=20971520),uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz);
CREATE INDEX IF NOT EXISTS workspace_private_files_resource_idx ON public.workspace_private_files(workspace_key,resource_type,resource_id) WHERE deleted_at IS NULL;
ALTER TABLE public.workspace_private_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace users read private file metadata" ON public.workspace_private_files;
DROP POLICY IF EXISTS "workspace users insert private file metadata" ON public.workspace_private_files;
CREATE POLICY "workspace users read private file metadata" ON public.workspace_private_files FOR SELECT TO authenticated USING(deleted_at IS NULL AND public.has_permission(workspace_key||'.workspace.access'));
CREATE POLICY "workspace users insert private file metadata" ON public.workspace_private_files FOR INSERT TO authenticated WITH CHECK(uploaded_by=auth.uid() AND public.has_permission(workspace_key||'.files.manage'));
COMMIT;
