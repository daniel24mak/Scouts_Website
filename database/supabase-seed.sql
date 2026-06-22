-- Starter data for a new Supabase Scouts project.
-- Run after supabase-schema.sql.

INSERT INTO roles (id, name) VALUES
  ('admin', 'Admin'),
  ('chief', 'Chief')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO permissions (id, description) VALUES
  ('scout_attendance', 'Take and view scout attendance for assigned groups'),
  ('chief_attendance', 'Take and view chief attendance'),
  ('publishing', 'Submit or publish posts, albums, and photos'),
  ('blog_management', 'Create, edit, approve, archive, and delete posts'),
  ('gallery_management', 'Create, edit, approve, archive, and delete albums and images'),
  ('calendar_management', 'Create and manage calendar events'),
  ('scout_editing', 'Edit registered scout names and details'),
  ('group_management', 'Manage group assignment rules'),
  ('registration_upload', 'Upload registered scout lists'),
  ('admin_tools', 'Access admin dashboard modules'),
  ('archive_access', 'View and export archived years'),
  ('reports', 'View and export reports'),
  ('user_management', 'Create and manage internal users'),
  ('manage_form_templates', 'Create, edit, draft, and manage reusable form templates'),
  ('view_all_forms', 'View all posted forms and all submitted responses'),
  ('post_forms', 'Prepare and submit forms for posting')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO groups
  (id, name, sort_order, assignment_basis, grade_range, age_range, grade_start, grade_end, age_start, age_end, gender_filter)
VALUES
  ('louvetoux', 'Louvetoux', 1, 'schoolGrade', 'Grades 4-6', 'Ages 9-11', 4, 6, 9, 11, 'male'),
  ('jeanettes', 'Jeanettes', 2, 'schoolGrade', 'Grades 4-6', 'Ages 9-11', 4, 6, 9, 11, 'female'),
  ('scout-guide', 'Scout / Guide', 3, 'schoolGrade', 'Grades 7-8', 'Ages 12-13', 7, 8, 12, 13, 'mixed'),
  ('pioneer', 'Pioneer', 4, 'schoolGrade', 'Grades 9-10', 'Ages 14-15', 9, 10, 14, 15, 'mixed'),
  ('routier', 'Routier', 5, 'schoolGrade', 'Grade 11', 'Age 16', 11, 11, 16, 16, 'mixed'),
  ('patrols', 'Patrols', 6, 'schoolGrade', 'Grade 12', 'Age 17', 12, 12, 17, 17, 'mixed')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  assignment_basis = EXCLUDED.assignment_basis,
  grade_range = EXCLUDED.grade_range,
  age_range = EXCLUDED.age_range,
  grade_start = EXCLUDED.grade_start,
  grade_end = EXCLUDED.grade_end,
  age_start = EXCLUDED.age_start,
  age_end = EXCLUDED.age_end,
  gender_filter = EXCLUDED.gender_filter;

INSERT INTO grouping_rules
  (group_id, assignment_basis, grade_start, grade_end, age_start, age_end, gender_filter)
SELECT id, assignment_basis, grade_start, grade_end, age_start, age_end, gender_filter
FROM groups
ON CONFLICT (group_id) DO UPDATE SET
  assignment_basis = EXCLUDED.assignment_basis,
  grade_start = EXCLUDED.grade_start,
  grade_end = EXCLUDED.grade_end,
  age_start = EXCLUDED.age_start,
  age_end = EXCLUDED.age_end,
  gender_filter = EXCLUDED.gender_filter,
  updated_at = now();

INSERT INTO scout_years (label, sort_by, assignment_mode, is_active)
VALUES ('2025-2026', 'schoolGrade', 'schoolGrade', true)
ON CONFLICT (label) DO UPDATE SET is_active = EXCLUDED.is_active;
