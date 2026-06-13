import { execFile, execFileSync } from "node:child_process";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const dbPath = join(rootDir, "database", "scouts.db");
const distDir = join(rootDir, "dist");
const port = Number(process.env.PORT ?? 4174);

function sqlString(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlBoolean(value) {
  return value ? 1 : 0;
}

async function query(sql) {
  const { stdout } = await execFileAsync("sqlite3", ["-json", dbPath, sql], {
    maxBuffer: 1024 * 1024 * 10
  });

  return stdout.trim() ? JSON.parse(stdout) : [];
}

async function execSql(sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "scouts-sql-"));
  const sqlPath = join(tempDir, "statement.sql");

  try {
    writeFileSync(sqlPath, sql, "utf8");
    await execFileAsync("sqlite3", [dbPath, `.read ${sqlPath.replaceAll("\\", "/")}`], {
      maxBuffer: 1024 * 1024 * 10
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function decodeExcelEscapes(value) {
  return String(value)
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function decodeCell(value = "") {
  return decodeExcelEscapes(decodeHtmlEntities(value))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countPattern(value, pattern) {
  return value.match(pattern)?.length ?? 0;
}

function decodeBufferWithEncoding(buffer, encoding) {
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return "";
  }
}

function scoreDecodedText(value) {
  const replacementCount = countPattern(value, /\uFFFD/g);
  const mojibakeCount = countPattern(value, /Ã|Â|Ø|Ù|Û|Ð/g);
  const arabicCount = countPattern(value, /[\u0600-\u06FF]/g);
  const accentedLatinCount = countPattern(value, /[À-ž]/g);

  return replacementCount * 100 + mojibakeCount * 8 - arabicCount * 3 - accentedLatinCount;
}

function decodeTextContent(content) {
  if (typeof content === "string") {
    return content.replace(/^\uFEFF/, "");
  }

  if (!content?.base64) {
    return "";
  }

  const buffer = Buffer.from(content.base64, "base64");

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  }

  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  if (!/\uFFFD/.test(utf8Text) && !/Ã|Â|Ø|Ù|Û|Ð/.test(utf8Text)) {
    return utf8Text.replace(/^\uFEFF/, "");
  }

  const candidates = ["utf-8", "windows-1256", "windows-1252"]
    .map((encoding) => ({
      encoding,
      text: decodeBufferWithEncoding(buffer, encoding)
    }))
    .filter((candidate) => candidate.text);
  const best = candidates.sort((a, b) => scoreDecodedText(a.text) - scoreDecodedText(b.text))[0];

  return (best?.text ?? "").replace(/^\uFEFF/, "");
}

function columnIndexFromCellRef(cellRef = "") {
  const letters = String(cellRef).match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function getXmlTagContent(xml, tagName) {
  return [...xml.matchAll(new RegExp(`<${tagName}[^>]*>(.*?)<\\/${tagName}>`, "gis"))].map(
    (match) => decodeCell(match[1])
  );
}

function expandZipFile(zipPath, destinationPath) {
  mkdirSync(destinationPath, { recursive: true });
  const powershellZipPath = zipPath.replaceAll("'", "''");
  const powershellDestinationPath = destinationPath.replaceAll("'", "''");

  try {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${powershellZipPath}' -DestinationPath '${powershellDestinationPath}' -Force`
    ]);
    return;
  } catch {
    // Fall through to common non-Windows unzip tools.
  }

  try {
    execFileSync("tar", ["-xf", zipPath, "-C", destinationPath]);
    return;
  } catch {
    // Fall through to final option.
  }

  execFileSync("unzip", ["-q", zipPath, "-d", destinationPath]);
}

function parseXlsxRows(base64Content) {
  const tempDir = mkdtempSync(join(tmpdir(), "scouts-xlsx-"));
  const xlsxPath = join(tempDir, "registration.xlsx");
  const zipPath = join(tempDir, "registration.zip");
  const extractDir = join(tempDir, "unzipped");

  try {
    writeFileSync(xlsxPath, Buffer.from(base64Content, "base64"));
    copyFileSync(xlsxPath, zipPath);
    expandZipFile(zipPath, extractDir);

    const sharedStringsPath = join(extractDir, "xl", "sharedStrings.xml");
    const sharedStrings = existsSync(sharedStringsPath)
      ? [...readFileSync(sharedStringsPath, "utf8").matchAll(/<si[^>]*>(.*?)<\/si>/gis)].map(
          (match) => getXmlTagContent(match[1], "t").join("")
        )
      : [];
    const worksheetsDir = join(extractDir, "xl", "worksheets");
    const firstWorksheet = readdirSync(worksheetsDir)
      .filter((fileName) => /^sheet\d+\.xml$/i.test(fileName))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];

    if (!firstWorksheet) {
      return [];
    }

    const worksheetXml = readFileSync(join(worksheetsDir, firstWorksheet), "utf8");
    return [...worksheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gis)].map((rowMatch) => {
      const row = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>(.*?)<\/c>/gis)) {
        const attributes = cellMatch[1];
        const cellXml = cellMatch[2];
        const ref = attributes.match(/\sr="([^"]+)"/i)?.[1] ?? "";
        const type = attributes.match(/\st="([^"]+)"/i)?.[1] ?? "";
        const columnIndex = columnIndexFromCellRef(ref);
        const rawValue = cellXml.match(/<v[^>]*>(.*?)<\/v>/is)?.[1] ?? "";
        const inlineValue = getXmlTagContent(cellXml, "t").join("");

        if (type === "s") {
          row[columnIndex] = sharedStrings[Number(rawValue)] ?? "";
        } else if (type === "inlineStr" || type === "str") {
          row[columnIndex] = inlineValue || decodeCell(rawValue);
        } else {
          row[columnIndex] = decodeCell(rawValue);
        }
      }
      return row.map((cell) => cell ?? "");
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let isQuoted = false;

  for (const char of line) {
    if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === delimiter && !isQuoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, "").replaceAll('""', '"'));
}

function parseSheetRows(content, fileName = "") {
  const looksLikeZipWorkbook =
    typeof content === "object" &&
    content?.base64 &&
    Buffer.from(content.base64, "base64").subarray(0, 2).toString("utf8") === "PK";

  if ((/\.xlsx$/i.test(fileName) || looksLikeZipWorkbook) && typeof content === "object" && content?.base64) {
    try {
      return parseXlsxRows(content.base64);
    } catch (error) {
      throw new Error(
        `Could not read this Excel workbook. Please re-save it as a clean .xlsx or .csv file and upload again. ${error.message}`
      );
    }
  }

  const text = decodeTextContent(content);

  if (/<Row[\s>]/i.test(text)) {
    return [...text.matchAll(/<Row[^>]*>(.*?)<\/Row>/gis)].map((rowMatch) =>
      [...rowMatch[1].matchAll(/<Cell[^>]*>.*?<Data[^>]*>(.*?)<\/Data>.*?<\/Cell>/gis)].map(
        (cellMatch) => decodeCell(cellMatch[1])
      )
    );
  }

  if (/<tr[\s>]/i.test(text)) {
    return [...text.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map((cellMatch) =>
        decodeCell(cellMatch[1])
      )
    );
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const delimiter = lines[0]?.includes("\t") ? "\t" : ",";
  return lines.map((line) => parseDelimitedLine(line, delimiter).map(decodeCell));
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const headerAliases = {
  name: ["name", "fullname", "scoutname", "membername", "studentname", "childname", "participantname"],
  schoolGrade: ["grade", "schoolgrade", "class", "year", "yeargroup", "studentgrade"],
  age: ["age", "ageyears", "yearsold", "studentage"],
  gender: ["gender", "sex", "malefemale", "boygirl"],
  school: ["school", "schoolname"],
  parentName: ["parent", "parentname", "guardian", "guardianname", "mother", "father"],
  parentPhone: ["phone", "mobile", "contact", "parentphone", "guardianphone", "telephone"],
  status: ["status", "registrationstatus"]
};

function findColumn(headerRow, field) {
  const normalized = headerRow.map(normalizeHeader);
  const aliases = headerAliases[field] ?? [];
  return normalized.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function extractNumber(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function formatGrade(value) {
  const grade = extractNumber(value);
  return grade ? `Grade ${grade}` : decodeCell(value);
}

function normalizeGender(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["m", "male", "boy", "boys"].includes(normalized)) {
    return "male";
  }

  if (["f", "female", "girl", "girls"].includes(normalized)) {
    return "female";
  }

  return "";
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getChiefDefaults(chiefLevel) {
  if (chiefLevel === "head") {
    return { canPublish: 1, canCreateGroupMeetings: 1, canEditScouts: 1 };
  }

  if (chiefLevel === "vice") {
    return { canPublish: 1, canCreateGroupMeetings: 1, canEditScouts: 0 };
  }

  return { canPublish: 0, canCreateGroupMeetings: 0, canEditScouts: 0 };
}

function pickGroupForScout(scout, rules, assignmentMode) {
  const basis = assignmentMode === "age" ? "age" : "schoolGrade";
  const grade = extractNumber(scout.schoolGrade);
  const age = extractNumber(scout.age);
  const gender = normalizeGender(scout.gender);
  const matchingRules = rules.filter((rule) => {
    const ruleBasis = rule.assignmentBasis ?? basis;
    if (basis === "age" || ruleBasis === "age") {
      return age !== null && age >= Number(rule.ageStart) && age <= Number(rule.ageEnd);
    }
    return grade !== null && grade >= Number(rule.gradeStart) && grade <= Number(rule.gradeEnd);
  });
  const genderMatch = matchingRules.find((rule) => rule.genderFilter === gender);
  const mixedMatch = matchingRules.find((rule) => (rule.genderFilter ?? "mixed") === "mixed");
  const matchingRule = genderMatch ?? mixedMatch ?? matchingRules[0];

  return matchingRule?.groupId ?? rules[0]?.groupId ?? "louvetoux";
}

async function getGroupingRules() {
  return query(`
    SELECT group_id AS groupId, assignment_basis AS assignmentBasis, grade_start AS gradeStart,
           grade_end AS gradeEnd, age_start AS ageStart, age_end AS ageEnd,
           gender_filter AS genderFilter,
           storage_key AS storageKey, last_updated AS lastUpdated, updated_by AS updatedBy
    FROM grouping_rules
    ORDER BY rowid
  `);
}

function parseRegistrationSheet(content, rules, assignmentMode, fileName = "") {
  const rows = parseSheetRows(content, fileName).filter((row) => row.some(Boolean));
  const headerIndex = rows.findIndex((row) => findColumn(row, "name") >= 0);
  const headers = rows[headerIndex] ?? [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  const columns = {
    name: findColumn(headers, "name"),
    schoolGrade: findColumn(headers, "schoolGrade"),
    age: findColumn(headers, "age"),
    gender: findColumn(headers, "gender"),
    school: findColumn(headers, "school"),
    parentName: findColumn(headers, "parentName"),
    parentPhone: findColumn(headers, "parentPhone"),
    status: findColumn(headers, "status")
  };

  if (columns.name < 0) {
    columns.name = 0;
  }

  return dataRows
    .map((row) => {
      const name = decodeCell(row[columns.name]);
      if (!name || /^name$/i.test(name)) {
        return null;
      }

      const scout = {
        name,
        schoolGrade: formatGrade(row[columns.schoolGrade]),
        age: extractNumber(row[columns.age]),
        gender: normalizeGender(row[columns.gender]),
        school: decodeCell(row[columns.school]),
        parentName: decodeCell(row[columns.parentName]),
        parentPhone: decodeCell(row[columns.parentPhone]),
        status: decodeCell(row[columns.status]) || "Registered"
      };

      return {
        ...scout,
        groupId: pickGroupForScout(scout, rules, assignmentMode)
      };
    })
    .filter(Boolean);
}

async function getUsers() {
  const users = await query(`
    SELECT id, name, role, group_id AS groupId, chief_level AS chiefLevel,
           can_publish AS canPublish, can_create_group_meetings AS canCreateGroupMeetings,
           can_edit_scouts AS canEditScouts, email, account_status AS accountStatus,
           created_at AS createdAt, updated_at AS updatedAt, last_login AS lastLogin
    FROM users
    ORDER BY role, name
  `);

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    groupId: user.groupId,
    chiefLevel: user.chiefLevel,
    email: user.email,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLogin: user.lastLogin,
    permissions: {
      canPublish: Boolean(user.canPublish),
      canCreateGroupMeetings: Boolean(user.canCreateGroupMeetings),
      canEditScouts: Boolean(user.canEditScouts)
    }
  }));
}

async function getGroups() {
  const groups = await query(`
    SELECT id, name, assignment_basis AS assignmentBasis, grade_range AS gradeRange,
           age_range AS ageRange
    FROM scout_groups
    ORDER BY rowid
  `);
  const scouts = await query(`
    SELECT id, group_id AS groupId, name, patrol, attendance
    FROM group_scouts
    ORDER BY id
  `);

  return groups.map((group) => ({
    ...group,
    scouts: scouts
      .filter((scout) => scout.groupId === group.id)
      .map(({ groupId, ...scout }) => scout)
  }));
}

async function getRegistrationData() {
  const [settings] = await query(`
    SELECT scout_year AS scoutYear, sort_by AS sortBy, assignment_mode AS assignmentMode,
           excel_file_name AS excelFileName
    FROM registration_import_settings
    WHERE id = 1
  `);
  const rules = await getGroupingRules();
  const registeredScouts = await query(`
    SELECT id, name, school_grade AS schoolGrade, age, gender, school, group_id AS groupId,
           parent_name AS parentName, parent_phone AS parentPhone, status, source
    FROM registered_scouts
    ORDER BY name
  `);
  const firstRule = rules[0] ?? {};

  return {
    registrationImportSettings: settings,
    registeredScouts,
    groupingRulesStore: {
      storageKey: firstRule.storageKey ?? "scout-grouping-rules",
      lastUpdated: firstRule.lastUpdated ?? "",
      updatedBy: firstRule.updatedBy ?? "",
      rules: rules.map(({ storageKey, lastUpdated, updatedBy, ...rule }) => rule)
    }
  };
}

async function getAttendanceData() {
  const meetings = await query(`
    SELECT id, group_id AS groupId, date, topic
    FROM scout_attendance_meetings
    ORDER BY date
  `);
  const records = await query(`
    SELECT meeting_id AS meetingId, scout_id AS scoutId, status
    FROM scout_attendance_records
  `);
  const attendanceSheets = await query(`
    SELECT group_id AS groupId, file_name AS fileName, saved_rows AS savedRows, last_saved AS lastSaved
    FROM attendance_sheets
    ORDER BY rowid
  `);
  const chiefMeetings = await query(`
    SELECT id, date, topic
    FROM chief_attendance_meetings
    ORDER BY date
  `);
  const chiefRecords = await query(`
    SELECT meeting_id AS meetingId, chief_id AS chiefId, status
    FROM chief_attendance_records
  `);
  const [chiefSheet] = await query(`
    SELECT sheet_file_name AS fileName, saved_rows AS savedRows, last_saved AS lastSaved
    FROM chief_attendance_meetings
    ORDER BY date DESC
    LIMIT 1
  `);

  return {
    attendanceMeetings: meetings.map((meeting) => ({
      ...meeting,
      records: Object.fromEntries(
        records
          .filter((record) => record.meetingId === meeting.id)
          .map((record) => [record.scoutId, record.status])
      )
    })),
    attendanceSheets,
    chiefAttendanceMeetings: chiefMeetings.map((meeting) => ({
      ...meeting,
      records: Object.fromEntries(
        chiefRecords
          .filter((record) => record.meetingId === meeting.id)
          .map((record) => [record.chiefId, record.status])
      )
    })),
    chiefAttendanceSheet: chiefSheet
  };
}

async function getEvents() {
  const rows = await query(`
    SELECT id, title, date, type, status, visibility, group_id AS groupId,
           approval_status AS approvalStatus, submitted_by AS submittedBy, updated_at AS updatedAt,
           visible_group_ids AS visibleGroupIds, location, description
    FROM planned_events
    ORDER BY date
  `);

  return rows.map((event) => ({
    ...event,
    visibleGroupIds: JSON.parse(event.visibleGroupIds || "[]")
  }));
}

async function getContent() {
  const blogPosts = await query(`
    SELECT id, slug, title, date, author, thumbnail_color AS thumbnailColor,
           album_id AS albumId, excerpt, body, approval_status AS approvalStatus,
           submitted_by AS submittedBy, created_at AS createdAt, updated_at AS updatedAt
    FROM blog_posts
    ORDER BY date DESC
  `);
  const albums = await query(`
    SELECT id, title, event_date AS eventDate, location, category, color,
           photo_count AS photoCount, cover_label AS coverLabel, approval_status AS approvalStatus,
           submitted_by AS submittedBy, created_at AS createdAt, updated_at AS updatedAt
    FROM gallery_albums
    ORDER BY event_date DESC
  `);
  const photos = await query(`
    SELECT id, album_id AS albumId, title, approval_status AS approvalStatus,
           submitted_by AS submittedBy, created_at AS createdAt, sort_order AS sortOrder
    FROM gallery_photos
    ORDER BY sort_order, id
  `);
  const allGalleryAlbums = albums.map((album) => ({
    ...album,
    photos: photos
      .filter((photo) => photo.albumId === album.id)
      .map(({ albumId, ...photo }) => photo)
  }));

  return {
    allBlogPosts: blogPosts,
    blogPosts: blogPosts.filter((post) => post.approvalStatus === "approved"),
    allGalleryAlbums,
    galleryAlbums: allGalleryAlbums
      .filter((album) => album.approvalStatus === "approved")
      .map((album) => ({
        ...album,
        photos: album.photos.filter((photo) => photo.approvalStatus === "approved")
      })),
    contentSubmissions: [
      ...blogPosts.map((post) => ({ ...post, contentType: "blog" })),
      ...allGalleryAlbums.map((album) => ({ ...album, contentType: "album" }))
    ]
  };
}

async function getBootstrap() {
  const [users, groups, registration, attendance, plannedEvents, content] = await Promise.all([
    getUsers(),
    getGroups(),
    getRegistrationData(),
    getAttendanceData(),
    getEvents(),
    getContent()
  ]);

  return {
    users,
    groups,
    ...registration,
    ...attendance,
    plannedEvents,
    ...content
  };
}

async function createEvent(body) {
  const id =
    body.id ??
    `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${body.date}`;
  const visibleGroupIds = JSON.stringify(body.visibleGroupIds ?? []);

  await execSql(`
    INSERT OR REPLACE INTO planned_events
      (id, title, date, type, status, approval_status, submitted_by, visibility, group_id,
       visible_group_ids, location, description)
    VALUES
      (${sqlString(id)}, ${sqlString(body.title)}, ${sqlString(body.date)},
       ${sqlString(body.type ?? "event")}, ${sqlString(body.status ?? "planned")},
       ${sqlString(body.approvalStatus ?? "approved")}, ${sqlString(body.submittedBy)},
       ${sqlString(body.visibility ?? "public")}, ${sqlString(body.groupId)},
       ${sqlString(visibleGroupIds)}, ${sqlString(body.location ?? "Scout Hall")},
       ${sqlString(body.description ?? "")})
  `);

  return { id };
}

async function deleteEvent(eventId) {
  await execSql(`DELETE FROM planned_events WHERE id = ${sqlString(eventId)}`);
  return { ok: true };
}

async function saveScoutAttendance(body) {
  const meetingId = `${body.groupId}-${body.date}`;
  const records = body.records ?? {};

  await execSql(`
    INSERT OR REPLACE INTO scout_attendance_meetings (id, group_id, date, topic)
    VALUES (${sqlString(meetingId)}, ${sqlString(body.groupId)}, ${sqlString(body.date)},
            ${sqlString(body.topic ?? "Meeting")})
  `);

  await execSql(`DELETE FROM scout_attendance_records WHERE meeting_id = ${sqlString(meetingId)}`);

  for (const [scoutId, status] of Object.entries(records)) {
    await execSql(`
      INSERT INTO scout_attendance_records (meeting_id, scout_id, status)
      VALUES (${sqlString(meetingId)}, ${Number(scoutId)}, ${sqlString(status)})
    `);
  }

  await execSql(`
    UPDATE attendance_sheets
    SET saved_rows = (
          SELECT COUNT(*)
          FROM scout_attendance_records records
          JOIN scout_attendance_meetings meetings ON meetings.id = records.meeting_id
          WHERE meetings.group_id = ${sqlString(body.groupId)}
        ),
        last_saved = ${sqlString(body.date)}
    WHERE group_id = ${sqlString(body.groupId)}
  `);

  return { id: meetingId };
}

async function saveChiefAttendance(body) {
  const meetingId = `chiefs-${body.date}`;
  const records = body.records ?? {};

  await execSql(`
    INSERT OR REPLACE INTO chief_attendance_meetings
      (id, date, topic, sheet_file_name, saved_rows, last_saved)
    VALUES (${sqlString(meetingId)}, ${sqlString(body.date)}, ${sqlString(body.topic ?? "Chief meeting")},
            'attendance-chiefs-2026-2027.xlsx',
            (SELECT COUNT(*) FROM chief_attendance_records),
            ${sqlString(body.date)})
  `);

  await execSql(`DELETE FROM chief_attendance_records WHERE meeting_id = ${sqlString(meetingId)}`);

  for (const [chiefId, status] of Object.entries(records)) {
    await execSql(`
      INSERT INTO chief_attendance_records (meeting_id, chief_id, status)
      VALUES (${sqlString(meetingId)}, ${sqlString(chiefId)}, ${sqlString(status)})
    `);
  }

  await execSql(`
    UPDATE chief_attendance_meetings
    SET saved_rows = (SELECT COUNT(*) FROM chief_attendance_records),
        last_saved = ${sqlString(body.date)}
    WHERE id = ${sqlString(meetingId)}
  `);

  return { id: meetingId };
}

async function saveRules(body) {
  await execSql(`
    UPDATE registration_import_settings
    SET sort_by = ${sqlString(body.sortBy)}, assignment_mode = ${sqlString(body.assignmentMode)}
    WHERE id = 1
  `);

  for (const rule of body.rules ?? []) {
    await execSql(`
      UPDATE grouping_rules
      SET assignment_basis = ${sqlString(rule.assignmentBasis)},
          grade_start = ${Number(rule.gradeStart)},
          grade_end = ${Number(rule.gradeEnd)},
          age_start = ${Number(rule.ageStart)},
          age_end = ${Number(rule.ageEnd)},
          gender_filter = ${sqlString(rule.genderFilter ?? "mixed")},
          last_updated = date('now'),
          updated_by = ${sqlString(body.updatedBy ?? "Group Admin")}
      WHERE group_id = ${sqlString(rule.groupId)}
    `);
  }

  await resortRegisteredScouts(body.assignmentMode);

  return { ok: true };
}

async function resortRegisteredScouts(assignmentMode) {
  const rules = await getGroupingRules();
  const scouts = await query(`
    SELECT id, school_grade AS schoolGrade, age, gender
    FROM registered_scouts
    WHERE source = 'excel'
  `);

  for (const scout of scouts) {
    const groupId = pickGroupForScout(scout, rules, assignmentMode);
    await execSql(`
      UPDATE registered_scouts
      SET group_id = ${sqlString(groupId)}
      WHERE id = ${Number(scout.id)}
    `);
  }
}

async function uploadRegistrationSheet(body) {
  if (!body.content && !body.contentBase64) {
    throw new Error("Missing sheet content.");
  }

  const [settings] = await query(`
    SELECT assignment_mode AS assignmentMode
    FROM registration_import_settings
    WHERE id = 1
  `);
  const rules = await getGroupingRules();
  const sheetContent = body.contentBase64 ? { base64: body.contentBase64 } : body.content;
  const scouts = parseRegistrationSheet(
    sheetContent,
    rules,
    settings?.assignmentMode ?? "schoolGrade",
    body.fileName ?? ""
  );

  await execSql("DELETE FROM registered_scouts WHERE source = 'excel'");

  for (const scout of scouts) {
    await execSql(`
      INSERT INTO registered_scouts
        (name, school_grade, age, gender, school, group_id, parent_name, parent_phone, status, source)
      VALUES
        (${sqlString(scout.name)}, ${sqlString(scout.schoolGrade)}, ${scout.age ?? "NULL"},
         ${sqlString(scout.gender)},
         ${sqlString(scout.school)}, ${sqlString(scout.groupId)}, ${sqlString(scout.parentName)},
         ${sqlString(scout.parentPhone)}, ${sqlString(scout.status)}, 'excel')
    `);
  }

  await execSql(`
    UPDATE registration_import_settings
    SET excel_file_name = ${sqlString(body.fileName ?? "registered-scouts.xls")}
    WHERE id = 1
  `);

  return { ok: true, count: scouts.length };
}

async function parseRegistrationUpload(body) {
  if (!body.content && !body.contentBase64) {
    throw new Error("Missing sheet content.");
  }

  const [settings] = await query(`
    SELECT assignment_mode AS assignmentMode
    FROM registration_import_settings
    WHERE id = 1
  `);
  const rules = await getGroupingRules();
  const sheetContent = body.contentBase64 ? { base64: body.contentBase64 } : body.content;
  const scouts = parseRegistrationSheet(
    sheetContent,
    rules,
    body.assignmentMode ?? settings?.assignmentMode ?? "schoolGrade",
    body.fileName ?? ""
  );

  return { ok: true, count: scouts.length, scouts };
}

async function moveRegisteredScout(scoutId, body) {
  await execSql(`
    UPDATE registered_scouts
    SET group_id = ${sqlString(body.groupId)}
    WHERE id = ${Number(scoutId)}
  `);

  return { ok: true };
}

async function updateRegisteredScout(scoutId, body) {
  await execSql(`
    UPDATE registered_scouts
    SET name = ${sqlString(body.name)},
        school_grade = ${sqlString(formatGrade(body.schoolGrade))},
        age = ${body.age ? Number(body.age) : "NULL"},
        gender = ${sqlString(normalizeGender(body.gender))},
        school = ${sqlString(body.school)},
        group_id = ${sqlString(body.groupId)},
        parent_name = ${sqlString(body.parentName)},
        parent_phone = ${sqlString(body.parentPhone)},
        status = ${sqlString(body.status ?? "Registered")}
    WHERE id = ${Number(scoutId)}
  `);

  return { ok: true };
}

async function addRegisteredScout(body) {
  await execSql(`
    INSERT INTO registered_scouts
      (name, school_grade, age, gender, school, group_id, parent_name, parent_phone, status, source)
    VALUES
      (${sqlString(body.name)}, ${sqlString(formatGrade(body.schoolGrade))},
       ${body.age ? Number(body.age) : "NULL"}, ${sqlString(normalizeGender(body.gender))},
       ${sqlString(body.school)},
       ${sqlString(body.groupId)}, ${sqlString(body.parentName)}, ${sqlString(body.parentPhone)},
       ${sqlString(body.status ?? "Registered")}, 'manual')
  `);

  const [scout] = await query("SELECT MAX(id) AS id FROM registered_scouts");
  return { id: scout.id };
}

async function createChief(body) {
  const chiefLevel = body.chiefLevel ?? "chief";
  const defaults = getChiefDefaults(chiefLevel);
  const id = body.id ?? `chief-${slugify(body.name) || Date.now()}`;

  await execSql(`
    INSERT INTO users
      (id, name, email, role, group_id, chief_level, can_publish, can_create_group_meetings,
       can_edit_scouts, account_status, updated_at)
    VALUES
      (${sqlString(id)}, ${sqlString(body.name)}, ${sqlString(body.email)}, 'chief', ${sqlString(body.groupId)},
       ${sqlString(chiefLevel)}, ${sqlBoolean(body.canPublish ?? defaults.canPublish)},
       ${sqlBoolean(body.canCreateGroupMeetings ?? defaults.canCreateGroupMeetings)},
       ${sqlBoolean(body.canEditScouts ?? defaults.canEditScouts)},
       ${sqlString(body.accountStatus ?? "active")}, CURRENT_TIMESTAMP)
  `);

  return { id };
}

async function updateChief(chiefId, body) {
  const chiefLevel = body.chiefLevel ?? "chief";
  const defaults = getChiefDefaults(chiefLevel);

  await execSql(`
    UPDATE users
    SET name = ${sqlString(body.name)},
        email = ${sqlString(body.email)},
        group_id = ${sqlString(body.groupId)},
        chief_level = ${sqlString(chiefLevel)},
        can_publish = ${sqlBoolean(body.canPublish ?? defaults.canPublish)},
        can_create_group_meetings = ${sqlBoolean(body.canCreateGroupMeetings ?? defaults.canCreateGroupMeetings)},
        can_edit_scouts = ${sqlBoolean(body.canEditScouts ?? defaults.canEditScouts)},
        account_status = ${sqlString(body.accountStatus ?? "active")},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(chiefId)} AND role = 'chief'
  `);

  return { ok: true };
}

async function createBlog(body) {
  const slug = body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await execSql(`
    INSERT INTO blog_posts
      (slug, title, date, author, thumbnail_color, album_id, excerpt, body, approval_status,
       submitted_by, updated_at)
    VALUES (${sqlString(slug)}, ${sqlString(body.title)}, date('now'), ${sqlString(body.author ?? "Group Admin")},
            ${sqlString(body.thumbnailColor ?? "#2f7d6d")}, ${sqlString(body.albumId)},
            ${sqlString(body.excerpt ?? "")}, ${sqlString(body.body ?? body.excerpt ?? "")},
            ${sqlString(body.approvalStatus ?? "pending")},
            ${sqlString(body.submittedBy ?? body.author)}, CURRENT_TIMESTAMP)
  `);
  return { slug };
}

async function updateBlog(postId, body) {
  await execSql(`
    UPDATE blog_posts
    SET title = ${sqlString(body.title)},
        slug = ${sqlString(body.slug ?? slugify(body.title))},
        author = ${sqlString(body.author ?? "Group Admin")},
        thumbnail_color = ${sqlString(body.thumbnailColor ?? "#2f7d6d")},
        album_id = ${sqlString(body.albumId)},
        excerpt = ${sqlString(body.excerpt ?? "")},
        body = ${sqlString(body.body ?? body.excerpt ?? "")},
        approval_status = ${sqlString(body.approvalStatus ?? "pending")},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${Number(postId)}
  `);

  return { ok: true };
}

async function deleteBlog(postId) {
  await execSql(`DELETE FROM blog_posts WHERE id = ${Number(postId)}`);
  return { ok: true };
}

async function createAlbum(body) {
  const id = body.id ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await execSql(`
    INSERT OR REPLACE INTO gallery_albums
      (id, title, event_date, location, category, color, photo_count, cover_label,
       approval_status, submitted_by, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(body.title)}, ${sqlString(body.eventDate)},
            ${sqlString(body.location ?? "Scout Hall")}, ${sqlString(body.category ?? "Event")},
            ${sqlString(body.color ?? "#2f7d6d")}, 0, ${sqlString(body.coverLabel ?? "Album")},
            ${sqlString(body.approvalStatus ?? "pending")},
            ${sqlString(body.submittedBy)}, CURRENT_TIMESTAMP)
  `);
  return { id };
}

async function updateAlbum(albumId, body) {
  await execSql(`
    UPDATE gallery_albums
    SET title = ${sqlString(body.title)},
        event_date = ${sqlString(body.eventDate)},
        location = ${sqlString(body.location ?? "Scout Hall")},
        category = ${sqlString(body.category ?? "Event")},
        color = ${sqlString(body.color ?? "#2f7d6d")},
        cover_label = ${sqlString(body.coverLabel ?? "Album")},
        approval_status = ${sqlString(body.approvalStatus ?? "pending")},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sqlString(albumId)}
  `);

  return { ok: true };
}

async function deleteAlbum(albumId) {
  await execSql(`DELETE FROM gallery_photos WHERE album_id = ${sqlString(albumId)}`);
  await execSql(`DELETE FROM gallery_albums WHERE id = ${sqlString(albumId)}`);
  return { ok: true };
}

async function addAlbumPhotos(albumId, body) {
  for (const title of body.photos ?? []) {
    await execSql(`
      INSERT INTO gallery_photos (album_id, title, approval_status, submitted_by)
      VALUES (${sqlString(albumId)}, ${sqlString(title)}, ${sqlString(body.approvalStatus ?? "pending")},
              ${sqlString(body.submittedBy)})
    `);
  }
  await execSql(`
    UPDATE gallery_albums
    SET photo_count = (SELECT COUNT(*) FROM gallery_photos WHERE album_id = ${sqlString(albumId)})
    WHERE id = ${sqlString(albumId)}
  `);
  return { ok: true };
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(response, 200, await getBootstrap());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/calendar/events") {
    sendJson(response, 201, await createEvent(await readJsonBody(request)));
    return;
  }

  const eventMatch = url.pathname.match(/^\/api\/calendar\/events\/([^/]+)$/);
  if (request.method === "DELETE" && eventMatch) {
    sendJson(response, 200, await deleteEvent(decodeURIComponent(eventMatch[1])));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/attendance/scouts") {
    sendJson(response, 201, await saveScoutAttendance(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/attendance/chiefs") {
    sendJson(response, 201, await saveChiefAttendance(await readJsonBody(request)));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/rules") {
    sendJson(response, 200, await saveRules(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/registration/upload") {
    sendJson(response, 201, await uploadRegistrationSheet(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/registration/parse") {
    sendJson(response, 200, await parseRegistrationUpload(await readJsonBody(request)));
    return;
  }

  const scoutGroupMatch = url.pathname.match(/^\/api\/registration\/scouts\/(\d+)\/group$/);
  if (request.method === "PUT" && scoutGroupMatch) {
    sendJson(response, 200, await moveRegisteredScout(scoutGroupMatch[1], await readJsonBody(request)));
    return;
  }

  const scoutMatch = url.pathname.match(/^\/api\/registration\/scouts\/(\d+)$/);
  if (request.method === "PUT" && scoutMatch) {
    sendJson(response, 200, await updateRegisteredScout(scoutMatch[1], await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/registration/scouts") {
    sendJson(response, 201, await addRegisteredScout(await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/chiefs") {
    sendJson(response, 201, await createChief(await readJsonBody(request)));
    return;
  }

  const chiefMatch = url.pathname.match(/^\/api\/admin\/chiefs\/([^/]+)$/);
  if (request.method === "PUT" && chiefMatch) {
    sendJson(response, 200, await updateChief(chiefMatch[1], await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/blogs") {
    sendJson(response, 201, await createBlog(await readJsonBody(request)));
    return;
  }

  const blogMatch = url.pathname.match(/^\/api\/blogs\/(\d+)$/);
  if (request.method === "PUT" && blogMatch) {
    sendJson(response, 200, await updateBlog(blogMatch[1], await readJsonBody(request)));
    return;
  }

  if (request.method === "DELETE" && blogMatch) {
    sendJson(response, 200, await deleteBlog(blogMatch[1]));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/albums") {
    sendJson(response, 201, await createAlbum(await readJsonBody(request)));
    return;
  }

  const albumMatch = url.pathname.match(/^\/api\/albums\/([^/]+)$/);
  if (request.method === "PUT" && albumMatch) {
    sendJson(response, 200, await updateAlbum(albumMatch[1], await readJsonBody(request)));
    return;
  }

  if (request.method === "DELETE" && albumMatch) {
    sendJson(response, 200, await deleteAlbum(albumMatch[1]));
    return;
  }

  const albumPhotoMatch = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos$/);
  if (request.method === "POST" && albumPhotoMatch) {
    sendJson(response, 201, await addAlbumPhotos(albumPhotoMatch[1], await readJsonBody(request)));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(distDir, requested));

  if (!filePath.startsWith(resolve(distDir)) || !existsSync(filePath)) {
    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      response.writeHead(200, { "Content-Type": "text/html" });
      createReadStream(indexPath).pipe(response);
      return;
    }
    response.writeHead(404);
    response.end("Build the app first with npm run build.");
    return;
  }

  const contentTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml"
  };
  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "text/plain" });
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}).listen(port, () => {
  console.log(`Scouts app server running at http://127.0.0.1:${port}`);
});
