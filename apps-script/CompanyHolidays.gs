/**
 * Ensures PT KSB Indonesia company-specific leave days are present in
 * InternTrackHolidays and immediately visible to every InternTrack device.
 */
function syncCompanyHolidaysNow() {
  const updatedAt = new Date().toISOString();
  const companySource = 'PT KSB Indonesia & PT KSB Sales Indonesia - Company Calendar 2026';
  const companyHolidays = [
    ['2026-03-20', 'Idul Fitri 1447 H Leave'],
    ['2026-03-23', 'Idul Fitri 1447 H Leave'],
    ['2026-03-24', 'Idul Fitri 1447 H Leave'],
    ['2026-03-25', 'Idul Fitri 1447 H Leave'],
    ['2026-03-26', 'Idul Fitri 1447 H Leave'],
    ['2026-03-27', 'Idul Fitri 1447 H Leave'],
    ['2026-05-26', 'Idul Adha 1447 H Leave'],
    ['2026-12-24', 'Christmas Leave']
  ];

  const sheet = getHolidaysSheet_();
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HOLIDAYS_HEADERS.length).getValues()
    : [];
  const byDate = {};

  rows.forEach(function(row) {
    const date = String(row[0] || '').trim();
    if (!date) return;
    byDate[date] = [
      date,
      String(row[1] || ''),
      String(row[2] || 'national'),
      String(row[3] || 'Indonesia'),
      String(row[4] || ''),
      updatedAt
    ];
  });

  companyHolidays.forEach(function(item) {
    byDate[item[0]] = [item[0], item[1], 'company', 'Indonesia', companySource, updatedAt];
  });

  const nextRows = Object.keys(byDate).sort().map(function(date) { return byDate[date]; });
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, INTERNTRACK_HOLIDAYS_HEADERS.length).clearContent();
  }
  if (nextRows.length) {
    sheet.getRange(2, 1, nextRows.length, INTERNTRACK_HOLIDAYS_HEADERS.length).setValues(nextRows);
  }

  PropertiesService.getScriptProperties().setProperty('INTERNTRACK_HOLIDAYS_SYNCED_AT', updatedAt);
  PropertiesService.getScriptProperties().setProperty('INTERNTRACK_COMPANY_HOLIDAYS_SYNCED_AT', updatedAt);

  return 'Synced ' + companyHolidays.length + ' PT KSB company holidays.';
}

function verifyCompanyHolidays() {
  const requiredDates = ['2026-03-20','2026-03-23','2026-03-24','2026-03-25','2026-03-26','2026-03-27','2026-05-26','2026-12-24'];
  const present = {};
  readIndonesiaHolidays_().forEach(function(holiday) {
    if (holiday.type === 'company') present[holiday.date] = true;
  });
  const missing = requiredDates.filter(function(date) { return !present[date]; });
  return missing.length ? 'Missing company holidays: ' + missing.join(', ') : 'All PT KSB company holidays are synced.';
}

function installCompanyHolidaySync() {
  syncCompanyHolidaysNow();
  const handler = 'syncCompanyHolidaysNow';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(4).create();
  }
  return verifyCompanyHolidays();
}
