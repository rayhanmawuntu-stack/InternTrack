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
const INTERNTRACK_AUTH_SHEET_NAME = 'InternTrackAuth';
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
const INTERNTRACK_AUTH_HEADERS = [
  'workspace_id', 'user_id', 'salt', 'pin_hash', 'failed_attempts', 'locked_until', 'updated_at'
];
const INTERNTRACK_HOLIDAY_CALENDAR_IDS = [
  'id.indonesian#holiday@group.v.calendar.google.com',
  'en.indonesian#holiday@group.v.calendar.google.com'
];
const INTERNTRACK_CHUNK_SIZE = 45000;
const INTERNTRACK_PIN_LENGTH = 6;
const INTERNTRACK_MAX_PIN_ATTEMPTS = 5;
const INTERNTRACK_PIN_LOCK_MS = 15 * 60 * 1000;
const INTERNTRACK_SESSION_TTL_SECONDS = 6 * 60 * 60;
const INTERNTRACK_AUTH_RESULT_TTL_SECONDS = 90;

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
  prepareReadableSheet_(getAuthSheet_(), INTERNTRACK_AUTH_HEADERS);

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

    if (action === 'profiles') {
      const workspaceId = requireWorkspace_(params.workspaceId);
      payload = {
        ok: true,
        profiles: listPublicProfiles_(workspaceId),
        serverTime: new Date().toISOString()
      };
    } else if (action === 'auth_result') {
      payload = takeAuthResult_(params.requestId);
    } else if (action === 'dump') {
      const workspaceId = requireWorkspace_(params.workspaceId);
      const session = requireSession_(workspaceId, params.sessionToken);
      maybeSyncIndonesiaHolidays_();
      const data = dumpWorkspaceForUser_(workspaceId, session.userId);
      const holidays = readIndonesiaHolidays_();
      data.it_holidays_id = {
        value: JSON.stringify(holidays),
        deleted: false,
        updatedAt: holidays.length ? holidays[0].updatedAt : new Date().toISOString()
      };
      payload = {
        ok: true,
        data: data,
        sessionExpiresAt: session.expiresAt,
        serverTime: new Date().toISOString()
      };
    } else {
      payload = {
        ok: true,
        service: 'InternTrack Google Sheets backend',
        version: 8,
        pinAuthentication: true,
        serverTime: new Date().toISOString()
      };
    }

    return output_(payload, params.callback);
  } catch (error) {
    return output_({
      ok: false,
      code: String(error && error.code || 'REQUEST_ERROR'),
      error: String(error && error.message || error)
    }, e && e.parameter && e.parameter.callback);
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

  companySpecificHolidays2026_().forEach(function(holiday) {
    byDate[holiday.date] = {
      date: holiday.date,
      title: holiday.title,
      type: 'company',
      country: 'Indonesia',
      source: holiday.source,
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

function companySpecificHolidays2026_() {
  const source = 'PT KSB Indonesia & PT KSB Sales Indonesia - Company Calendar 2026';
  return [
    { date: '2026-03-20', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-03-23', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-03-24', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-03-25', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-03-26', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-03-27', title: 'Idul Fitri 1447 H Leave', source: source },
    { date: '2026-05-26', title: 'Idul Adha 1447 H Leave', source: source },
    { date: '2026-12-24', title: 'Christmas Leave', source: source }
  ];
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    if (['verify_pin', 'claim_pin', 'register_profile', 'sign_out'].indexOf(action) >= 0) {
      const requestId = requireRequestId_(body.requestId);
      try {
        const authPayload = handleAuthAction_(action, body);
        storeAuthResult_(requestId, authPayload);
      } catch (authError) {
        storeAuthResult_(requestId, authErrorPayload_(authError));
      }
      return output_({ ok: true, accepted: true });
    }

    if (action !== 'batch') throw new Error('Unsupported action.');

    const workspaceId = requireWorkspace_(body.workspaceId);
    const session = requireSession_(workspaceId, body.sessionToken);
    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 250) : [];
    if (!changes.length) return output_({ ok: true, saved: 0 });

    const result = saveAuthorizedBatch_(workspaceId, session.userId, changes);
    if (result.profileDeleted) {
      deletePinRecord_(workspaceId, session.userId);
    }
    return output_({
      ok: true,
      saved: result.saved,
      skippedAsStale: result.skippedAsStale,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return output_({
      ok: false,
      code: String(error && error.code || 'REQUEST_ERROR'),
      error: String(error && error.message || error)
    });
  }
}

function handleAuthAction_(action, body) {
  const workspaceId = requireWorkspace_(body.workspaceId);

  if (action === 'sign_out') {
    requireSession_(workspaceId, body.sessionToken);
    revokeSession_(body.sessionToken);
    return { ok: true, signedOut: true };
  }

  const pin = requirePin_(body.pin);
  if (action === 'register_profile') {
    return registerProfile_(workspaceId, body.profile, pin, body.sessionToken);
  }

  const userId = requireUserId_(body.userId);
  if (action === 'claim_pin') {
    return claimPin_(workspaceId, userId, pin);
  }
  if (action === 'verify_pin') {
    return verifyPin_(workspaceId, userId, pin);
  }
  throw new Error('Unsupported authentication action.');
}

function registerProfile_(workspaceId, rawProfile, pin, sponsorToken) {
  const profile = sanitizeProfile_(rawProfile);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const data = dumpWorkspace_(workspaceId);
    const users = readUsersFromData_(data);
    if (users.length) requireSession_(workspaceId, sponsorToken);
    if (users.some(function(user) { return String(user.id) === profile.id; })) {
      throw authError_('PROFILE_EXISTS', 'That profile already exists.');
    }

    users.push(profile);
    const currentUsersStamp = data.it_users ? Date.parse(data.it_users.updatedAt || '') || 0 : 0;
    saveBatchUnlocked_(workspaceId, [{
      key: 'it_users',
      value: JSON.stringify(users),
      deleted: false,
      updatedAt: new Date(Math.max(Date.now(), currentUsersStamp + 1)).toISOString()
    }]);
    createPinRecord_(workspaceId, profile.id, pin);

    const session = issueSession_(workspaceId, profile.id);
    if (sponsorToken) revokeSession_(sponsorToken);
    return {
      ok: true,
      profile: publicProfile_(profile, true),
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt
    };
  } finally {
    lock.releaseLock();
  }
}

function claimPin_(workspaceId, userId, pin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    requireExistingProfile_(workspaceId, userId);
    const existing = readPinRecord_(workspaceId, userId);
    if (existing && existing.pinHash) {
      throw authError_('PIN_ALREADY_SET', 'This profile already has a PIN. Enter the existing PIN instead.');
    }
    createPinRecord_(workspaceId, userId, pin);
    const session = issueSession_(workspaceId, userId);
    return {
      ok: true,
      claimed: true,
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt
    };
  } finally {
    lock.releaseLock();
  }
}

function verifyPin_(workspaceId, userId, pin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    requireExistingProfile_(workspaceId, userId);
    const record = readPinRecord_(workspaceId, userId);
    if (!record || !record.pinHash) {
      throw authError_('PIN_NOT_SET', 'Create a PIN for this profile before continuing.');
    }

    const lockedUntilMs = Date.parse(record.lockedUntil || '') || 0;
    if (lockedUntilMs > Date.now()) {
      const lockedError = authError_('PIN_LOCKED', 'Too many incorrect attempts. Try again after the lock expires.');
      lockedError.lockedUntil = new Date(lockedUntilMs).toISOString();
      throw lockedError;
    }

    const candidate = pinHash_(workspaceId, userId, pin, record.salt);
    if (!constantTimeEquals_(candidate, record.pinHash)) {
      const failedAttempts = (record.failedAttempts || 0) + 1;
      const shouldLock = failedAttempts >= INTERNTRACK_MAX_PIN_ATTEMPTS;
      record.failedAttempts = shouldLock ? 0 : failedAttempts;
      record.lockedUntil = shouldLock ? new Date(Date.now() + INTERNTRACK_PIN_LOCK_MS).toISOString() : '';
      record.updatedAt = new Date().toISOString();
      writePinRecord_(record);

      const invalidError = authError_(shouldLock ? 'PIN_LOCKED' : 'INVALID_PIN', shouldLock
        ? 'Too many incorrect attempts. This profile is locked for 15 minutes.'
        : 'Incorrect PIN.');
      invalidError.attemptsRemaining = shouldLock ? 0 : INTERNTRACK_MAX_PIN_ATTEMPTS - failedAttempts;
      invalidError.lockedUntil = record.lockedUntil || null;
      throw invalidError;
    }

    record.failedAttempts = 0;
    record.lockedUntil = '';
    record.updatedAt = new Date().toISOString();
    writePinRecord_(record);

    const session = issueSession_(workspaceId, userId);
    return {
      ok: true,
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt
    };
  } finally {
    lock.releaseLock();
  }
}

function listPublicProfiles_(workspaceId) {
  const data = dumpWorkspace_(workspaceId);
  const pinUsers = pinUserMap_(workspaceId);
  return readUsersFromData_(data).map(function(user) {
    return publicProfile_(user, Boolean(pinUsers[String(user.id)]));
  });
}

function dumpWorkspaceForUser_(workspaceId, userId) {
  const data = dumpWorkspace_(workspaceId);
  const allowed = userStorageKeyMap_(userId);
  const filtered = {};

  Object.keys(data).forEach(function(key) {
    if (allowed[key]) filtered[key] = data[key];
  });

  filtered.it_users = {
    value: JSON.stringify(listPublicProfiles_(workspaceId)),
    deleted: false,
    updatedAt: data.it_users ? data.it_users.updatedAt : new Date().toISOString()
  };
  return filtered;
}

function readUsersFromData_(data) {
  if (!data.it_users || data.it_users.deleted) return [];
  const users = safeJsonParse_(data.it_users.value, []);
  return Array.isArray(users) ? users.filter(function(user) { return user && user.id; }) : [];
}

function requireExistingProfile_(workspaceId, userId) {
  const user = readUsersFromData_(dumpWorkspace_(workspaceId)).find(function(entry) {
    return String(entry.id) === userId;
  });
  if (!user) throw authError_('PROFILE_NOT_FOUND', 'Profile not found. Refresh and try again.');
  return user;
}

function sanitizeProfile_(rawProfile) {
  const source = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const id = requireUserId_(source.id);
  const name = String(source.name || '').trim().slice(0, 120);
  const role = String(source.role || '').trim().slice(0, 120);
  const department = String(source.department || '').trim().slice(0, 120);
  if (!name || !role || !department) throw authError_('INVALID_PROFILE', 'Name, role, and department are required.');
  const firstName = name.split(/\s+/)[0];
  const initials = name.split(/\s+/).map(function(part) { return part.charAt(0).toUpperCase(); }).join('').slice(0, 2);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.startDate || ''))
    ? String(source.startDate)
    : Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  return { id: id, name: name, firstName: firstName, role: role, department: department, initials: initials, startDate: startDate };
}

function publicProfile_(user, hasPin) {
  const profile = sanitizeProfile_(user);
  profile.hasPin = Boolean(hasPin);
  return profile;
}

function userStorageKeyMap_(userId) {
  const map = {};
  ['it_act_', 'it_note_', 'it_att_', 'it_wh_', 'it_notesv2_', 'it_cal_', 'it_settings_'].forEach(function(prefix) {
    map[prefix + userId] = true;
  });
  return map;
}

function saveAuthorizedBatch_(workspaceId, userId, changes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const data = dumpWorkspace_(workspaceId);
    const existingUsers = readUsersFromData_(data);
    const allowedKeys = userStorageKeyMap_(userId);
    const sanitizedChanges = [];
    let profileDeleted = false;

    changes.forEach(function(change) {
      const key = sanitizeKey_(change && change.key);
      if (key === 'it_users') {
        const submitted = safeJsonParse_(change && change.value, []);
        if (!Array.isArray(submitted)) throw new Error('Invalid users payload.');
        const ownSubmitted = submitted.find(function(user) { return user && String(user.id) === userId; });
        const currentIndex = existingUsers.findIndex(function(user) { return String(user.id) === userId; });
        if (currentIndex < 0) throw new Error('Authenticated profile no longer exists.');

        const nextUsers = existingUsers.slice();
        if (ownSubmitted) nextUsers[currentIndex] = sanitizeProfile_(ownSubmitted);
        else {
          nextUsers.splice(currentIndex, 1);
          profileDeleted = true;
        }
        sanitizedChanges.push({
          key: 'it_users',
          value: JSON.stringify(nextUsers),
          deleted: false,
          updatedAt: change.updatedAt
        });
        return;
      }

      if (!allowedKeys[key]) throw new Error('This session cannot modify data for another profile.');
      sanitizedChanges.push(change);
    });

    const result = saveBatchUnlocked_(workspaceId, sanitizedChanges);
    result.profileDeleted = profileDeleted && result.savedKeys.indexOf('it_users') >= 0;
    return result;
  } finally {
    lock.releaseLock();
  }
}

function createPinRecord_(workspaceId, userId, pin) {
  const salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  writePinRecord_({
    workspaceId: workspaceId,
    userId: userId,
    salt: salt,
    pinHash: pinHash_(workspaceId, userId, pin, salt),
    failedAttempts: 0,
    lockedUntil: '',
    updatedAt: new Date().toISOString()
  });
}

function pinHash_(workspaceId, userId, pin, salt) {
  const properties = PropertiesService.getScriptProperties();
  let pepper = properties.getProperty('INTERNTRACK_PIN_PEPPER');
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty('INTERNTRACK_PIN_PEPPER', pepper);
  }
  const value = workspaceId + '\n' + userId + '\n' + pin + '\n' + salt;
  const signature = Utilities.computeHmacSha256Signature(value, pepper, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(signature);
}

function readPinRecord_(workspaceId, userId) {
  const sheet = getAuthSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_AUTH_HEADERS.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (String(row[0]) === workspaceId && String(row[1]) === userId) {
      return {
        rowNumber: index + 2,
        workspaceId: workspaceId,
        userId: userId,
        salt: String(row[2] || ''),
        pinHash: String(row[3] || ''),
        failedAttempts: Number(row[4]) || 0,
        lockedUntil: normalizeOptionalDate_(row[5]),
        updatedAt: normalizeDate_(row[6])
      };
    }
  }
  return null;
}

function writePinRecord_(record) {
  const sheet = getAuthSheet_();
  const existing = readPinRecord_(record.workspaceId, record.userId);
  const row = [[
    record.workspaceId,
    record.userId,
    record.salt,
    record.pinHash,
    Number(record.failedAttempts) || 0,
    record.lockedUntil || '',
    normalizeDate_(record.updatedAt)
  ]];
  if (existing) sheet.getRange(existing.rowNumber, 1, 1, INTERNTRACK_AUTH_HEADERS.length).setValues(row);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, INTERNTRACK_AUTH_HEADERS.length).setValues(row);
}

function deletePinRecord_(workspaceId, userId) {
  const record = readPinRecord_(workspaceId, userId);
  if (record) getAuthSheet_().deleteRow(record.rowNumber);
}

function pinUserMap_(workspaceId) {
  const sheet = getAuthSheet_();
  const lastRow = sheet.getLastRow();
  const result = {};
  if (lastRow < 2) return result;
  sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_AUTH_HEADERS.length).getValues().forEach(function(row) {
    if (String(row[0]) === workspaceId && String(row[3] || '')) result[String(row[1])] = true;
  });
  return result;
}

function issueSession_(workspaceId, userId) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const expiresAt = new Date(Date.now() + INTERNTRACK_SESSION_TTL_SECONDS * 1000).toISOString();
  CacheService.getScriptCache().put(sessionCacheKey_(token), JSON.stringify({
    workspaceId: workspaceId,
    userId: userId,
    expiresAt: expiresAt
  }), INTERNTRACK_SESSION_TTL_SECONDS);
  return { token: token, expiresAt: expiresAt };
}

function requireSession_(workspaceId, tokenValue) {
  const token = String(tokenValue || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) throw authError_('SESSION_REQUIRED', 'Enter your PIN to continue.');
  const raw = CacheService.getScriptCache().get(sessionCacheKey_(token));
  const session = safeJsonParse_(raw, null);
  if (!session || session.workspaceId !== workspaceId || !session.userId || Date.parse(session.expiresAt || '') <= Date.now()) {
    throw authError_('SESSION_EXPIRED', 'Your secure session expired. Enter your PIN again.');
  }
  return session;
}

function revokeSession_(tokenValue) {
  const token = String(tokenValue || '').trim();
  if (/^[a-f0-9]{64}$/i.test(token)) CacheService.getScriptCache().remove(sessionCacheKey_(token));
}

function sessionCacheKey_(token) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return 'session:' + Utilities.base64EncodeWebSafe(digest);
}

function storeAuthResult_(requestId, payload) {
  CacheService.getScriptCache().put('auth-result:' + requestId, JSON.stringify(payload), INTERNTRACK_AUTH_RESULT_TTL_SECONDS);
}

function takeAuthResult_(requestIdValue) {
  const requestId = requireRequestId_(requestIdValue);
  const cache = CacheService.getScriptCache();
  const key = 'auth-result:' + requestId;
  const raw = cache.get(key);
  if (!raw) return { ok: true, pending: true };
  return safeJsonParse_(raw, { ok: false, error: 'Authentication result could not be read.' });
}

function authErrorPayload_(error) {
  return {
    ok: false,
    code: String(error && error.code || 'AUTH_ERROR'),
    error: String(error && error.message || error || 'Authentication failed.'),
    attemptsRemaining: error && error.attemptsRemaining != null ? error.attemptsRemaining : null,
    lockedUntil: error && error.lockedUntil || null
  };
}

function authError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireRequestId_(value) {
  const requestId = String(value || '').trim();
  if (!/^[a-f0-9-]{20,80}$/i.test(requestId)) throw new Error('Invalid request ID.');
  return requestId;
}

function requireUserId_(value) {
  const userId = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{5,80}$/.test(userId)) throw authError_('INVALID_PROFILE', 'Invalid profile ID.');
  return userId;
}

function requirePin_(value) {
  const pin = String(value || '').trim();
  if (!new RegExp('^\\d{' + INTERNTRACK_PIN_LENGTH + '}$').test(pin)) {
    throw authError_('INVALID_PIN_FORMAT', 'PIN must contain exactly ' + INTERNTRACK_PIN_LENGTH + ' digits.');
  }
  return pin;
}

function constantTimeEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(index % Math.max(1, b.length)) || 0);
  }
  return difference === 0;
}

function normalizeOptionalDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
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
    return saveBatchUnlocked_(workspaceId, changes);
  } finally {
    lock.releaseLock();
  }
}

function saveBatchUnlocked_(workspaceId, changes) {
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
    return { saved: 0, skippedAsStale: skippedAsStale, savedKeys: [] };
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

  return {
    saved: accepted.length,
    skippedAsStale: skippedAsStale,
    savedKeys: accepted.map(function(change) { return change.key; })
  };
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

function getAuthSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(INTERNTRACK_AUTH_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(INTERNTRACK_AUTH_SHEET_NAME);
  ensureHeaders_(sheet, INTERNTRACK_AUTH_HEADERS);
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
