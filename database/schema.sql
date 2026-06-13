PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS gallery_photos;
DROP TABLE IF EXISTS gallery_albums;
DROP TABLE IF EXISTS blog_posts;
DROP TABLE IF EXISTS planned_events;
DROP TABLE IF EXISTS chief_attendance_records;
DROP TABLE IF EXISTS chief_attendance_meetings;
DROP TABLE IF EXISTS scout_attendance_records;
DROP TABLE IF EXISTS scout_attendance_meetings;
DROP TABLE IF EXISTS attendance_sheets;
DROP TABLE IF EXISTS grouping_rules;
DROP TABLE IF EXISTS registration_import_settings;
DROP TABLE IF EXISTS registered_scouts;
DROP TABLE IF EXISTS group_scouts;
DROP TABLE IF EXISTS scout_groups;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('chief', 'admin')),
  group_id TEXT,
  chief_level TEXT CHECK (chief_level IN ('head', 'vice', 'chief')),
  can_publish INTEGER NOT NULL DEFAULT 0,
  can_create_group_meetings INTEGER NOT NULL DEFAULT 0,
  can_edit_scouts INTEGER NOT NULL DEFAULT 0,
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT
);

CREATE TABLE scout_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  assignment_basis TEXT NOT NULL CHECK (assignment_basis IN ('schoolGrade', 'age')),
  grade_range TEXT NOT NULL,
  age_range TEXT NOT NULL
);

CREATE TABLE registered_scouts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  school_grade TEXT,
  age INTEGER,
  gender TEXT,
  school TEXT,
  group_id TEXT NOT NULL REFERENCES scout_groups(id),
  parent_name TEXT,
  parent_phone TEXT,
  status TEXT NOT NULL DEFAULT 'Registered',
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE group_scouts (
  id INTEGER PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES scout_groups(id),
  name TEXT NOT NULL,
  patrol TEXT NOT NULL,
  attendance TEXT NOT NULL
);

CREATE TABLE registration_import_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  scout_year TEXT NOT NULL,
  sort_by TEXT NOT NULL,
  assignment_mode TEXT NOT NULL,
  excel_file_name TEXT NOT NULL
);

CREATE TABLE grouping_rules (
  group_id TEXT PRIMARY KEY REFERENCES scout_groups(id),
  assignment_basis TEXT NOT NULL,
  grade_start INTEGER NOT NULL,
  grade_end INTEGER NOT NULL,
  age_start INTEGER NOT NULL,
  age_end INTEGER NOT NULL,
  gender_filter TEXT NOT NULL DEFAULT 'mixed' CHECK (gender_filter IN ('male', 'female', 'mixed')),
  storage_key TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE attendance_sheets (
  group_id TEXT PRIMARY KEY REFERENCES scout_groups(id),
  file_name TEXT NOT NULL,
  saved_rows INTEGER NOT NULL,
  last_saved TEXT
);

CREATE TABLE scout_attendance_meetings (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES scout_groups(id),
  date TEXT NOT NULL,
  topic TEXT NOT NULL
);

CREATE TABLE scout_attendance_records (
  meeting_id TEXT NOT NULL REFERENCES scout_attendance_meetings(id),
  scout_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (meeting_id, scout_id)
);

CREATE TABLE chief_attendance_meetings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  sheet_file_name TEXT NOT NULL,
  saved_rows INTEGER NOT NULL,
  last_saved TEXT
);

CREATE TABLE chief_attendance_records (
  meeting_id TEXT NOT NULL REFERENCES chief_attendance_meetings(id),
  chief_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  PRIMARY KEY (meeting_id, chief_id)
);

CREATE TABLE planned_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  submitted_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visibility TEXT NOT NULL,
  group_id TEXT REFERENCES scout_groups(id),
  visible_group_ids TEXT NOT NULL DEFAULT '[]',
  location TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  author TEXT NOT NULL,
  thumbnail_color TEXT NOT NULL,
  album_id TEXT,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  submitted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gallery_albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  photo_count INTEGER NOT NULL,
  cover_label TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  submitted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gallery_photos (
  id INTEGER PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES gallery_albums(id),
  title TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  submitted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT CURRENT_DATE,
  visibility TEXT NOT NULL DEFAULT 'public',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  submitted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  submitted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
