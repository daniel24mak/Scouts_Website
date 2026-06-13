PRAGMA foreign_keys = ON;

INSERT INTO users (id, name, role, group_id, chief_level, can_publish, can_create_group_meetings, can_edit_scouts) VALUES
  ('chief-north', 'Chief Layla', 'chief', 'louvetoux', 'head', 1, 1, 1),
  ('chief-east', 'Chief Omar', 'chief', 'scout-guide', 'vice', 1, 1, 0),
  ('admin', 'Group Admin', 'admin', NULL, NULL, 1, 0, 1);

INSERT INTO scout_groups (id, name, assignment_basis, grade_range, age_range) VALUES
  ('louvetoux', 'Louvetoux', 'schoolGrade', 'Grade 4 to Grade 6', 'Age 9 to 11'),
  ('jeanettes', 'Jeanettes', 'schoolGrade', 'Grade 4 to Grade 6', 'Age 9 to 11'),
  ('scout-guide', 'Scout and Guide', 'schoolGrade', 'Grade 7 to Grade 8', 'Age 12 to 13'),
  ('pioneer', 'Pioneer', 'schoolGrade', 'Grade 9 to Grade 10', 'Age 14 to 15'),
  ('routier', 'Routier', 'schoolGrade', 'Grade 11', 'Age 16'),
  ('patrols', 'Patrols', 'schoolGrade', 'Grade 12', 'Age 17');

INSERT INTO registered_scouts (id, name, school_grade, age, gender, school, group_id, parent_name, parent_phone, status, source) VALUES
  (1, 'Adam N.', 'Grade 6', 11, 'male', 'Green Valley School', 'louvetoux', 'Nadia N.', '+971 50 000 0001', 'Registered', 'excel'),
  (2, 'Sara M.', 'Grade 5', 10, 'female', 'Green Valley School', 'jeanettes', 'Mona M.', '+971 50 000 0002', 'Registered', 'excel'),
  (3, 'Yousef A.', 'Grade 6', 11, 'male', 'Al Noor Academy', 'louvetoux', 'Ahmed A.', '+971 50 000 0003', 'Registered', 'excel'),
  (4, 'Mariam S.', 'Grade 7', 12, 'female', 'Al Noor Academy', 'scout-guide', 'Salma S.', '+971 50 000 0004', 'Registered', 'excel'),
  (5, 'Khalid R.', 'Grade 8', 13, 'male', 'City International', 'scout-guide', 'Rashed R.', '+971 50 000 0005', 'Registered', 'excel'),
  (6, 'Nora H.', 'Grade 7', 12, 'female', 'City International', 'scout-guide', 'Huda H.', '+971 50 000 0006', 'Registered', 'excel');

INSERT INTO group_scouts (id, group_id, name, patrol, attendance) VALUES
  (1, 'louvetoux', 'Adam N.', 'Falcons', '92%'),
  (2, 'jeanettes', 'Sara M.', 'Falcons', '88%'),
  (3, 'louvetoux', 'Yousef A.', 'Wolves', '95%'),
  (4, 'scout-guide', 'Mariam S.', 'Trailblazers', '90%'),
  (5, 'scout-guide', 'Khalid R.', 'Trailblazers', '84%'),
  (6, 'scout-guide', 'Nora H.', 'Rangers', '97%');

INSERT INTO registration_import_settings (id, scout_year, sort_by, assignment_mode, excel_file_name) VALUES
  (1, '2026-2027', 'schoolGrade', 'schoolGrade', 'registered-scouts.xls');

INSERT INTO grouping_rules (group_id, assignment_basis, grade_start, grade_end, age_start, age_end, gender_filter, storage_key, last_updated, updated_by) VALUES
  ('louvetoux', 'schoolGrade', 4, 6, 9, 11, 'male', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin'),
  ('jeanettes', 'schoolGrade', 4, 6, 9, 11, 'female', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin'),
  ('scout-guide', 'schoolGrade', 7, 8, 12, 13, 'mixed', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin'),
  ('pioneer', 'schoolGrade', 9, 10, 14, 15, 'mixed', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin'),
  ('routier', 'schoolGrade', 11, 11, 16, 16, 'mixed', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin'),
  ('patrols', 'schoolGrade', 12, 12, 17, 17, 'mixed', 'scout-grouping-rules-2026-2027', '2026-06-03', 'Group Admin');

INSERT INTO attendance_sheets (group_id, file_name, saved_rows, last_saved) VALUES
  ('louvetoux', 'attendance-louvetoux-2026-2027.xlsx', 6, '2026-05-22'),
  ('jeanettes', 'attendance-jeanettes-2026-2027.xlsx', 0, NULL),
  ('scout-guide', 'attendance-scout-guide-2026-2027.xlsx', 6, '2026-05-23'),
  ('pioneer', 'attendance-pioneer-2026-2027.xlsx', 0, NULL),
  ('routier', 'attendance-routier-2026-2027.xlsx', 0, NULL),
  ('patrols', 'attendance-patrols-2026-2027.xlsx', 0, NULL);

INSERT INTO scout_attendance_meetings (id, group_id, date, topic) VALUES
  ('louvetoux-2026-05-22', 'louvetoux', '2026-05-22', 'Compass basics'),
  ('scout-guide-2026-05-23', 'scout-guide', '2026-05-23', 'First aid review');

INSERT INTO scout_attendance_records (meeting_id, scout_id, status) VALUES
  ('louvetoux-2026-05-22', 1, 'Present'),
  ('louvetoux-2026-05-22', 2, 'Present'),
  ('louvetoux-2026-05-22', 3, 'Excused'),
  ('scout-guide-2026-05-23', 4, 'Present'),
  ('scout-guide-2026-05-23', 5, 'Absent'),
  ('scout-guide-2026-05-23', 6, 'Present');

INSERT INTO chief_attendance_meetings (id, date, topic, sheet_file_name, saved_rows, last_saved) VALUES
  ('chiefs-2026-05-24', '2026-05-24', 'Monthly chiefs meeting', 'attendance-chiefs-2026-2027.xlsx', 2, '2026-05-24');

INSERT INTO chief_attendance_records (meeting_id, chief_id, status) VALUES
  ('chiefs-2026-05-24', 'chief-north', 'Present'),
  ('chiefs-2026-05-24', 'chief-east', 'Late');

INSERT INTO planned_events (id, title, date, type, status, visibility, group_id, visible_group_ids, location, description) VALUES
  ('community-camp-2026', 'Community Camp', '2026-06-20', 'event', 'planned', 'public', NULL, '[]', 'Mountain Camp', 'Weekend camp for all scout groups.'),
  ('badge-night-2026', 'Badge Night', '2026-05-28', 'event', 'passed', 'public', NULL, '[]', 'Main Hall', 'Group ceremony for badges and patrol awards.'),
  ('louvetoux-meeting-2026-06-07', 'Louvetoux Weekly Meeting', '2026-06-07', 'meeting', 'planned', 'group', 'louvetoux', '["louvetoux"]', 'Scout Hall Room A', 'Scheduled meeting visible only to logged-in Louvetoux chiefs.'),
  ('scout-guide-meeting-2026-06-08', 'Scout and Guide Weekly Meeting', '2026-06-08', 'meeting', 'planned', 'group', 'scout-guide', '["scout-guide"]', 'Scout Hall Room B', 'Scheduled meeting visible only to logged-in Scout and Guide chiefs.'),
  ('leaders-briefing-2026-06-14', 'Leaders Briefing', '2026-06-14', 'event', 'planned', 'logged-in', NULL, '[]', 'Scout Hall', 'Logged-in members can view this planning briefing.');

INSERT INTO blog_posts (id, slug, title, date, author, thumbnail_color, album_id, excerpt, body) VALUES
  (1, 'campfire-skills-weekend', 'Campfire skills weekend', '2026-05-14', 'Chief Layla', '#2f7d6d', 'campfire-skills', 'Scouts practiced fire safety, camp cooking, and evening reflection circles.', 'The weekend focused on practical campfire safety, simple outdoor cooking routines, and patrol reflection. Scouts rotated through skill stations and closed the event with a group circle.'),
  (2, 'community-clean-up-report', 'Community clean-up report', '2026-04-29', 'Chief Omar', '#b86f32', 'community-cleanup', 'Our patrols worked with neighbors to clean the park trail and sort recyclables.', 'Patrols divided the park into zones, collected litter, sorted recyclable materials, and logged the work completed for the service record.');

INSERT INTO gallery_albums (id, title, event_date, location, category, color, photo_count, cover_label) VALUES
  ('campfire-skills', 'Campfire Skills Weekend', '2026-05-14', 'Mountain Camp', 'Camps', '#2f7d6d', 24, 'Fire safety'),
  ('community-cleanup', 'Community Clean-up', '2026-04-29', 'Neighborhood Park', 'Service', '#b86f32', 18, 'Service day'),
  ('first-aid-training', 'First Aid Training', '2026-03-18', 'Scout Hall', 'Training', '#4f6fa8', 15, 'Skills station'),
  ('badge-ceremony', 'Badge Ceremony', '2026-02-22', 'Main Hall', 'Awards', '#7a5c99', 31, 'Awards night');

INSERT INTO gallery_photos (id, album_id, title) VALUES
  (1, 'campfire-skills', 'Camp setup'),
  (2, 'campfire-skills', 'Cooking practice'),
  (3, 'campfire-skills', 'Evening circle'),
  (4, 'community-cleanup', 'Trail team'),
  (5, 'community-cleanup', 'Sorting station'),
  (6, 'community-cleanup', 'Final group photo'),
  (7, 'first-aid-training', 'Bandage drill'),
  (8, 'first-aid-training', 'Emergency call practice'),
  (9, 'first-aid-training', 'Team review'),
  (10, 'badge-ceremony', 'Opening flag'),
  (11, 'badge-ceremony', 'Badge awards'),
  (12, 'badge-ceremony', 'Chief remarks');
