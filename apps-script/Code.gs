/**
 * InternTrack Google Sheets backend.
 *
 * Recommended setup:
 * 1. Create a Google Sheet.
 * 2. Open Extensions > Apps Script.
 * 3. Replace Code.gs with this file.
 * 4. Run setup() once and approve access.
 * 5. Deploy as a Web app, executing as you, with access set to Anyone.
 * 6. Paste the /exec deployment URL into public/config.js.
 */

const INTERNTRACK_SHEET_NAME = 'InternTrackData';
const INTERNTRACK_USERS_SHEET_NAME = 'InternTrackUsers';
const INTERNTRACK_ATTENDANCE_SHEET_NAME = 'InternTrackAttendance';
const INTERNTRACK_ACTIVITIES_SHEET_NAME = 'InternTrackActivities';
const INTERNTRACK_NOTES_SHEET_NAME = 'InternTrackNotes';
const INTERNTRACK_CALENDAR_SHEET_NAME = 'InternTrackCalendar';
const INTERNTRACK_SETTINGS_SHEET_NAME = 'InternTrackSettings';
const INTERNTRACK_HOLIDAYS_SHEET_NAME = 'InternTrackHolidays';
const INTERNTRACK_HEADERS = [
  'workspace_id',
  'storage_key',
  'chunk_index',
  'value_chunk',
  'is_deleted',
  'updated_at',
  'encoding'
];
const INTERNTRACK_USERS_HEADERS = [
  'workspace_id',
  'user_id',
  'name',
  'first_name',
  'role',
  'department',
  'initials',
  'start_date',
  'email',
  'phone',
  'mentor',
  'updated_at'
];
const INTERNTRACK_ATTENDANCE_HEADERS = [
  'workspace_id', 'user_id', 'date', 'clock_in', 'clock_out', 'type', 'updated_at'
];
const INTERNTRACK_ACTIVITIES_HEADERS = [
  'workspace_id', 'user_id', 'activity_id', 'title', 'description', 'time', 'color', 'updated_at'
];
const INTERNTRACK_NOTES_HEADERS = [
  'workspace_id', 'user_id', 'note_id', 'kind', 'title', 'content', 'tags', 'created_at', 'updated_at', 'gradient'
];
const INTERNTRACK_CALENDAR_HEADERS = [
  'workspace_id', 'user_id', 'event_id', 'title', 'date', 'start_hour', 'end_hour', 'color', 'updated_at'
];
const INTERNTRACK_SETTINGS_HEADERS = [
  'workspace_id', 'user_id', 'work_hours', 'email', 'phone', 'mentor',
  'clock_reminder', 'daily_summary', 'weekly_report', 'mentor_updates',
  'system_alerts', 'quick_note', 'updated_at'
];
const INTERNTRACK_HOLIDAYS_HEADERS = [
  'date', 'title', 'type', 'country', 'source', 'updated_at'
];
const INTERNTRACK_HOLIDAY_CALENDAR_IDS = [
  'id.indonesian#holiday@group.v.calendar.google.com',
  'en.indonesian#holiday@group.v.calendar.google.com'
];
const INTERNTRACK_CHUNK_SIZE = 45000;

function setup() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Open the target Google Sheet, then run setup() from its bound Apps Script project.');
  PropertiesService.getScriptProperties().setProperty('INTERNTRACK_SPREADSHEET_ID', active.getId());

  const dataSheet = getDataSheet_();
  dataSheet.setFrozenRows(1);
  dataSheet.autoResizeColumns(1, INTERNTRACK_HEADERS.length);

  prepareReadableSheet_(getUsersSheet_(), INTERNTRACK_USERS_HEADERS);
  prepareReadableSheet_(getAttendanceSheet_(), INTERNTRACK_ATTENDANCE_HEADERS);
  prepareReadableSheet_(getActivitiesSheet_(), INTERNTRACK_ACTIVITIES_HEADERS);
  prepareReadableSheet_(getNotesSheet_(), INTERNTRACK_NOTES_HEADERS);
  prepareReadableSheet_(getCalendarSheet_(), INTERNTRACK_CALENDAR_HEADERS);
  prepareReadableSheet_(getSettingsSheet_(), INTERNTRACK_SETTINGS_HEADERS);
  prepareReadableSheet_(getHolidaysSheet_(), INTERNTRACK_HOLIDAYS_HEADERS);

  rebuildAllReadableMirrors_();
  syncIndonesiaHolidays();
  ensureHolidaySyncTrigger_();
  return 'InternTrack backend is ready. App data and Indonesian national holidays are stored in Sheets.';
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'health';
    let payload;

    if (action === 'dump') {
      const workspaceId = requireWorkspace_(params.workspaceId);
      maybeSyncIndonesiaHolidays_();
      const data = dumpWorkspace_(workspaceId);
      const holidays = readIndonesiaHolidays_();
      data.it_holidays_id = {
        value: JSON.stringify(holidays),
        deleted: false,
        updatedAt: holidays.length ? holidays[0].updatedAt : new Date().toISOString()
      };
      payload = {
        ok: true,
        data: data,
        serverTime: new Date().toISOString()
      };
    } else {
      payload = {
        ok: true,
        service: 'InternTrack Google Sheets backend',
        version: 6,
        serverTime: new Date().toISOString()
      };
    }

    return output_(payload, params.callback);
  } catch (error) {
    return output_({ ok: false, error: String(error && error.message || error) }, e && e.parameter && e.parameter.callback);
  }
}

/**
 * Imports Indonesia's national-holiday calendar into InternTrackHolidays.
 * Google Calendar is the primary source. The official 2026 national-holiday
 * schedule is bundled as a fallback so the app remains correct even before
 * Calendar read access is approved.
 */
function syncIndonesiaHolidays() {
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const endYear = now.getFullYear() + 1;
  const updatedAt = new Date().toISOString();
  const byDate = {};
  let source = 'Google Calendar — Holidays in Indonesia';

  try {
    let calendar = null;
    for (let index = 0; index < INTERNTRACK_HOLIDAY_CALENDAR_IDS.length && !calendar; index += 1) {
      calendar = CalendarApp.getCalendarById(INTERNTRACK_HOLIDAY_CALENDAR_IDS[index]);
    }
    if (!calendar) throw new Error('Indonesia holiday calendar was not available.');

    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear + 1, 0, 1);
    calendar.getEvents(start, end).forEach(function(event) {
      if (!event.isAllDayEvent()) return;
      const title = String(event.getTitle() || '').trim();
      if (!title || /cuti bersama|collective leave/i.test(title)) return;
      const date = Utilities.formatDate(event.getStartTime(), 'Asia/Jakarta', 'yyyy-MM-dd');
      const year = Number(date.slice(0, 4));
      if (year < startYear || year > endYear) return;
      byDate[date] = {
        date: date,
        title: title,
        type: 'national',
        country: 'Indonesia',
        source: source,
        updatedAt: updatedAt
      };
    });
  } catch (error) {
    source = 'Official Indonesia 2026 national-holiday schedule (bundled fallback)';
    console.log('Holiday calendar import used fallback: ' + String(error && error.message || error));
  }

  indonesiaNationalHolidays2026_().forEach(function(holiday) {
    byDate[holiday.date] = {
      date: holiday.date,
      title: holiday.title,
      type: 'national',
      country: 'Indonesia',
      source: holiday.source || 'SKB 3 Menteri — Libur Nasional 2026',
      updatedAt: updatedAt
    };
  });

  const holidays = Object.keys(byDate)
    .sort()
    .map(function(date) { return byDate[date]; });

  const sheet = getHolidaysSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HOLIDAYS_HEADERS.length).clearContent();
  }
  if (holidays.length) {
    const rows = holidays.map(function(holiday) {
      return [holiday.date, holiday.title, holiday.type, holiday.country, holiday.source, holiday.updatedAt];
    });
    sheet.getRange(2, 1, rows.length, INTERNTRACK_HOLIDAYS_HEADERS.length).setValues(rows);
  }

  PropertiesService.getScriptProperties().setProperty('INTERNTRACK_HOLIDAYS_SYNCED_AT', updatedAt);
  return 'Synced ' + holidays.length + ' Indonesia national holidays.';
}

function maybeSyncIndonesiaHolidays_() {
  const properties = PropertiesService.getScriptProperties();
  const lastSync = Date.parse(properties.getProperty('INTERNTRACK_HOLIDAYS_SYNCED_AT') || '') || 0;
  const sheet = getHolidaysSheet_();
  const stale = Date.now() - lastSync > 24 * 60 * 60 * 1000;
  if (sheet.getLastRow() < 2 || stale) syncIndonesiaHolidays();
}

function ensureHolidaySyncTrigger_() {
  const functionName = 'syncIndonesiaHolidays';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === functionName;
  });
  if (!exists) {
    ScriptApp.newTrigger(functionName).timeBased().everyDays(1).atHour(3).create();
  }
}

function readIndonesiaHolidays_() {
  const sheet = getHolidaysSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HOLIDAYS_HEADERS.length).getValues();
  return rows
    .filter(function(row) { return String(row[0] || '').trim(); })
    .map(function(row) {
      return {
        date: String(row[0] || ''),
        title: String(row[1] || ''),
        type: String(row[2] || 'national'),
        country: String(row[3] || 'Indonesia'),
        source: String(row[4] || ''),
        updatedAt: normalizeDate_(row[5])
      };
    })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });
}

function indonesiaNationalHolidays2026_() {
  const source = 'SKB 3 Menteri — Libur Nasional 2026';
  return [
    { date: '2026-01-01', title: 'Tahun Baru Masehi', source: source },
    { date: '2026-01-16', title: 'Isra Mikraj Nabi Muhammad SAW', source: source },
    { date: '2026-02-17', title: 'Tahun Baru Imlek 2577 Kongzili', source: source },
    { date: '2026-03-19', title: 'Hari Suci Nyepi — Tahun Baru Saka 1948', source: source },
    { date: '2026-03-21', title: 'Idulfitri 1447 Hijriah', source: source },
    { date: '2026-03-22', title: 'Idulfitri 1447 Hijriah', source: source },
    { date: '2026-04-03', title: 'Wafat Yesus Kristus', source: source },
    { date: '2026-04-05', title: 'Kebangkitan Yesus Kristus — Paskah', source: source },
    { date: '2026-05-01', title: 'Hari Buruh Internasional', source: source },
    { date: '2026-05-14', title: 'Kenaikan Yesus Kristus', source: source },
    { date: '2026-05-27', title: 'Iduladha 1447 Hijriah', source: source },
    { date: '2026-05-31', title: 'Hari Raya Waisak 2570 BE', source: source },
    { date: '2026-06-01', title: 'Hari Lahir Pancasila', source: source },
    { date: '2026-06-16', title: 'Tahun Baru Islam 1448 Hijriah', source: source },
    { date: '2026-08-17', title: 'Hari Kemerdekaan Republik Indonesia', source: source },
    { date: '2026-08-25', title: 'Maulid Nabi Muhammad SAW', source: source },
    { date: '2026-12-25', title: 'Hari Raya Natal', source: source }
  ];
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'batch') throw new Error('Unsupported action.');

    const workspaceId = requireWorkspace_(body.workspaceId);
    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 250) : [];
    if (!changes.length) return output_({ ok: true, saved: 0 });

    const result = saveBatch_(workspaceId, changes);
    return output_({
      ok: true,
      saved: result.saved,
      skippedAsStale: result.skippedAsStale,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return output_({ ok: false, error: String(error && error.message || error) });
  }
}

function dumpWorkspace_(workspaceId) {
  const sheet = getDataSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const rows = sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HEADERS.length).getValues();
  const newest = {};

  rows.forEach(function(row) {
    if (String(row[0]) !== workspaceId) return;
    const key = String(row[1] || '');
    if (!key) return;
    const updatedAt = normalizeDate_(row[5]);
    const stamp = Date.parse(updatedAt) || 0;

    if (!newest[key] || stamp > newest[key].stamp) {
      newest[key] = {
        stamp: stamp,
        updatedAt: updatedAt,
        deleted: toBoolean_(row[4]),
        chunks: {},
        encoding: String(row[6] || 'plain')
      };
    }

    if (stamp === newest[key].stamp) {
      newest[key].chunks[Number(row[2]) || 0] = String(row[3] || '');
      newest[key].deleted = toBoolean_(row[4]);
      newest[key].encoding = String(row[6] || newest[key].encoding || 'plain');
    }
  });

  const result = {};
  Object.keys(newest).forEach(function(key) {
    const record = newest[key];
    const storedValue = Object.keys(record.chunks)
      .map(Number)
      .sort(function(a, b) { return a - b; })
      .map(function(index) { return record.chunks[index]; })
      .join('');
    const value = record.deleted ? '' : decodeValue_(storedValue, record.encoding);

    result[key] = {
      value: value,
      deleted: record.deleted,
      updatedAt: record.updatedAt
    };
  });
  return result;
}

function saveBatch_(workspaceId, changes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getDataSheet_();
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HEADERS.length).getValues()
      : [];

    const newestStampByKey = {};
    existing.forEach(function(row) {
      if (String(row[0]) !== workspaceId) return;
      const key = String(row[1] || '');
      if (!key) return;
      const stamp = Date.parse(normalizeDate_(row[5])) || 0;
      newestStampByKey[key] = Math.max(newestStampByKey[key] || 0, stamp);
    });

    const accepted = [];
    let skippedAsStale = 0;
    changes.forEach(function(change) {
      const key = sanitizeKey_(change && change.key);
      const updatedAt = normalizeDate_(change && change.updatedAt);
      const incomingStamp = Date.parse(updatedAt) || 0;
      const currentStamp = newestStampByKey[key] || 0;

      if (incomingStamp < currentStamp) {
        skippedAsStale += 1;
        return;
      }

      accepted.push({
        key: key,
        deleted: Boolean(change && change.deleted),
        updatedAt: updatedAt,
        value: String(change && change.value != null ? change.value : '')
      });
      newestStampByKey[key] = incomingStamp;
    });

    if (!accepted.length) {
      return { saved: 0, skippedAsStale: skippedAsStale };
    }

    const changedKeys = {};
    accepted.forEach(function(change) { changedKeys[change.key] = true; });

    const nextRows = existing.filter(function(row) {
      return !(String(row[0]) === workspaceId && changedKeys[String(row[1])]);
    });

    accepted.forEach(function(change) {
      const value = change.deleted ? '' : change.value;
      const encodedValue = change.deleted ? '' : encodeValue_(value);
      const chunks = change.deleted ? [''] : splitChunks_(encodedValue);

      chunks.forEach(function(chunk, index) {
        nextRows.push([
          workspaceId,
          change.key,
          index,
          chunk,
          change.deleted,
          change.updatedAt,
          'base64url'
        ]);
      });
    });

    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HEADERS.length).clearContent();
    }
    if (nextRows.length) {
      sheet.getRange(2, 1, nextRows.length, INTERNTRACK_HEADERS.length).setValues(nextRows);
    }

    syncReadableMirrors_(workspaceId, nextRows);

    return { saved: accepted.length, skippedAsStale: skippedAsStale };
  } finally {
    lock.releaseLock();
  }
}

function rebuildAllReadableMirrors_() {
  const sheet = getDataSheet_();
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HEADERS.length).getValues()
    : [];
  const workspaceIds = {};
  rows.forEach(function(row) {
    const workspaceId = String(row[0] || '').trim();
    if (workspaceId) workspaceIds[workspaceId] = true;
  });

  clearReadableData_(getUsersSheet_(), INTERNTRACK_USERS_HEADERS);
  clearReadableData_(getAttendanceSheet_(), INTERNTRACK_ATTENDANCE_HEADERS);
  clearReadableData_(getActivitiesSheet_(), INTERNTRACK_ACTIVITIES_HEADERS);
  clearReadableData_(getNotesSheet_(), INTERNTRACK_NOTES_HEADERS);
  clearReadableData_(getCalendarSheet_(), INTERNTRACK_CALENDAR_HEADERS);
  clearReadableData_(getSettingsSheet_(), INTERNTRACK_SETTINGS_HEADERS);

  Object.keys(workspaceIds).forEach(function(workspaceId) {
    syncReadableMirrors_(workspaceId, rows);
  });
}

function syncReadableMirrors_(workspaceId, dataRows) {
  const usersRecord = readRecordFromRows_(dataRows, workspaceId, 'it_users');
  const parsedUsers = usersRecord && !usersRecord.deleted
    ? safeJsonParse_(usersRecord.value, [])
    : [];
  const users = Array.isArray(parsedUsers) ? parsedUsers : [];

  const userRows = [];
  const attendanceRows = [];
  const activityRows = [];
  const noteRows = [];
  const calendarRows = [];
  const settingsRows = [];

  users.forEach(function(user) {
    if (!user || !user.id) return;
    const userId = String(user.id);
    const settingsRecord = readRecordFromRows_(dataRows, workspaceId, 'it_settings_' + userId);
    const settings = settingsRecord && !settingsRecord.deleted
      ? safeJsonParse_(settingsRecord.value, {})
      : {};
    const profile = settings && settings.profile ? settings.profile : {};
    const notifications = settings && settings.notifications ? settings.notifications : {};
    const userUpdatedAt = latestRecordTime_([usersRecord, settingsRecord]);

    userRows.push([
      workspaceId,
      userId,
      String(user.name || ''),
      String(user.firstName || ''),
      String(user.role || ''),
      String(user.department || ''),
      String(user.initials || ''),
      String(user.startDate || ''),
      String(profile.email || ''),
      String(profile.phone || ''),
      String(profile.mentor || ''),
      userUpdatedAt
    ]);

    const attendanceRecord = readRecordFromRows_(dataRows, workspaceId, 'it_att_' + userId);
    const attendance = jsonArrayFromRecord_(attendanceRecord);
    attendance.forEach(function(record) {
      if (!record || !record.date) return;
      attendanceRows.push([
        workspaceId,
        userId,
        String(record.date || ''),
        String(record.clockIn || ''),
        String(record.clockOut || ''),
        String(record.type || ''),
        attendanceRecord.updatedAt
      ]);
    });

    const activitiesRecord = readRecordFromRows_(dataRows, workspaceId, 'it_act_' + userId);
    const activities = jsonArrayFromRecord_(activitiesRecord);
    activities.forEach(function(activity) {
      if (!activity) return;
      activityRows.push([
        workspaceId,
        userId,
        String(activity.id || ''),
        String(activity.title || ''),
        String(activity.description || ''),
        String(activity.time || ''),
        String(activity.color || ''),
        activitiesRecord.updatedAt
      ]);
    });

    const notesRecord = readRecordFromRows_(dataRows, workspaceId, 'it_notesv2_' + userId);
    const notes = jsonArrayFromRecord_(notesRecord);
    notes.forEach(function(note) {
      if (!note) return;
      noteRows.push([
        workspaceId,
        userId,
        String(note.id || ''),
        'note',
        String(note.title || ''),
        String(note.content || ''),
        Array.isArray(note.tags) ? note.tags.join(', ') : String(note.tags || ''),
        String(note.createdAt || ''),
        String(note.updatedAt || notesRecord.updatedAt || ''),
        Number(note.gradient || 0)
      ]);
    });

    const calendarRecord = readRecordFromRows_(dataRows, workspaceId, 'it_cal_' + userId);
    const events = jsonArrayFromRecord_(calendarRecord);
    events.forEach(function(event) {
      if (!event) return;
      calendarRows.push([
        workspaceId,
        userId,
        String(event.id || ''),
        String(event.title || ''),
        String(event.date || ''),
        Number(event.startHour || 0),
        Number(event.endHour || 0),
        String(event.color || ''),
        calendarRecord.updatedAt
      ]);
    });

    const workHoursRecord = readRecordFromRows_(dataRows, workspaceId, 'it_wh_' + userId);
    const quickNoteRecord = readRecordFromRows_(dataRows, workspaceId, 'it_note_' + userId);
    const workHours = workHoursRecord && !workHoursRecord.deleted
      ? Number(workHoursRecord.value || 9)
      : 9;
    const quickNote = quickNoteRecord && !quickNoteRecord.deleted
      ? String(quickNoteRecord.value || '')
      : '';

    settingsRows.push([
      workspaceId,
      userId,
      isNaN(workHours) ? 9 : workHours,
      String(profile.email || ''),
      String(profile.phone || ''),
      String(profile.mentor || ''),
      notifications.clockReminder !== false,
      notifications.dailySummary !== false,
      notifications.weeklyReport === true,
      notifications.mentorUpdates !== false,
      notifications.systemAlerts !== false,
      quickNote,
      latestRecordTime_([settingsRecord, workHoursRecord, quickNoteRecord])
    ]);
  });

  replaceWorkspaceRows_(getUsersSheet_(), INTERNTRACK_USERS_HEADERS, workspaceId, userRows);
  replaceWorkspaceRows_(getAttendanceSheet_(), INTERNTRACK_ATTENDANCE_HEADERS, workspaceId, attendanceRows);
  replaceWorkspaceRows_(getActivitiesSheet_(), INTERNTRACK_ACTIVITIES_HEADERS, workspaceId, activityRows);
  replaceWorkspaceRows_(getNotesSheet_(), INTERNTRACK_NOTES_HEADERS, workspaceId, noteRows);
  replaceWorkspaceRows_(getCalendarSheet_(), INTERNTRACK_CALENDAR_HEADERS, workspaceId, calendarRows);
  replaceWorkspaceRows_(getSettingsSheet_(), INTERNTRACK_SETTINGS_HEADERS, workspaceId, settingsRows);
}

function jsonArrayFromRecord_(record) {
  if (!record || record.deleted) return [];
  const parsed = safeJsonParse_(record.value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function latestRecordTime_(records) {
  let newest = 0;
  (records || []).forEach(function(record) {
    if (!record || !record.updatedAt) return;
    newest = Math.max(newest, Date.parse(record.updatedAt) || 0);
  });
  return new Date(newest || Date.now()).toISOString();
}

function replaceWorkspaceRows_(sheet, headers, workspaceId, newRows) {
  const lastRow = sheet.getLastRow();
  const existing = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    : [];
  const nextRows = existing.filter(function(row) {
    return String(row[0]) !== workspaceId;
  }).concat(newRows);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (nextRows.length) {
    sheet.getRange(2, 1, nextRows.length, headers.length).setValues(nextRows);
  }
}

function clearReadableData_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
}

function prepareReadableSheet_(sheet, headers) {
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function readRecordFromRows_(rows, workspaceId, key) {
  let newest = null;

  rows.forEach(function(row) {
    if (String(row[0]) !== workspaceId || String(row[1]) !== key) return;
    const updatedAt = normalizeDate_(row[5]);
    const stamp = Date.parse(updatedAt) || 0;

    if (!newest || stamp > newest.stamp) {
      newest = {
        stamp: stamp,
        updatedAt: updatedAt,
        deleted: toBoolean_(row[4]),
        encoding: String(row[6] || 'plain'),
        chunks: {}
      };
    }

    if (newest && stamp === newest.stamp) {
      newest.chunks[Number(row[2]) || 0] = String(row[3] || '');
      newest.deleted = toBoolean_(row[4]);
      newest.encoding = String(row[6] || newest.encoding || 'plain');
    }
  });

  if (!newest) return null;
  const storedValue = Object.keys(newest.chunks)
    .map(Number)
    .sort(function(a, b) { return a - b; })
    .map(function(index) { return newest.chunks[index]; })
    .join('');

  return {
    value: newest.deleted ? '' : decodeValue_(storedValue, newest.encoding),
    deleted: newest.deleted,
    updatedAt: newest.updatedAt
  };
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('INTERNTRACK_SPREADSHEET_ID');
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('Run setup() once from the Apps Script project bound to your Google Sheet.');
    }
    spreadsheetId = spreadsheet.getId();
    properties.setProperty('INTERNTRACK_SPREADSHEET_ID', spreadsheetId);
  }
  return spreadsheet;
}

function getDataSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_HEADERS);
  return sheet;
}

function getUsersSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_USERS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_USERS_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_USERS_HEADERS);
  return sheet;
}

function getAttendanceSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_ATTENDANCE_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_ATTENDANCE_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_ATTENDANCE_HEADERS);
  return sheet;
}

function getActivitiesSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_ACTIVITIES_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_ACTIVITIES_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_ACTIVITIES_HEADERS);
  return sheet;
}

function getNotesSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_NOTES_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_NOTES_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_NOTES_HEADERS);
  return sheet;
}

function getCalendarSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_CALENDAR_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_CALENDAR_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_CALENDAR_HEADERS);
  return sheet;
}

function getHolidaysSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_HOLIDAYS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_HOLIDAYS_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_HOLIDAYS_HEADERS);
  return sheet;
}

function getSettingsSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_SETTINGS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_SETTINGS_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_SETTINGS_HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (currentHeaders.join('|') !== headers.join('|')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#fce7f3');
  }
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function requireWorkspace_(value) {
  const workspaceId = String(value || '').trim();
  if (!workspaceId) throw new Error('workspaceId is required.');
  if (workspaceId.length > 120) throw new Error('workspaceId is too long.');
  return workspaceId;
}

function sanitizeKey_(value) {
  const key = String(value || '').trim();
  if (!/^it_[a-zA-Z0-9_.-]+$/.test(key)) throw new Error('Invalid storage key.');
  return key;
}

function safeJsonParse_(value, fallback) {
  try {
    return JSON.parse(String(value || ''));
  } catch (error) {
    return fallback;
  }
}

function encodeValue_(value) {
  return Utilities.base64EncodeWebSafe(String(value || '')); // Apps Script encodes strings as UTF-8
}

function decodeValue_(value, encoding) {
  if (encoding !== 'base64url') return String(value || '');
  if (!value) return '';
  const bytes = Utilities.base64DecodeWebSafe(value);
  return Utilities.newBlob(bytes).getDataAsString(); // Defaults to UTF-8
}

function splitChunks_(value) {
  if (!value) return [''];
  const chunks = [];
  for (let index = 0; index < value.length; index += INTERNTRACK_CHUNK_SIZE) {
    chunks.push(value.slice(index, index + INTERNTRACK_CHUNK_SIZE));
  }
  return chunks;
}

function normalizeDate_(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}
