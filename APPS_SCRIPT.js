/**
 * Ireland - St. Patrick's Trip App
 * Google Apps Script — paste this into your Apps Script editor
 *
 * SETUP:
 *  1. Open your Google Sheet → Extensions → Apps Script
 *  2. Replace all default code with this file
 *  3. Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Copy the deployment URL → paste into src/environments/environment.ts
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Tab names must exactly match these (case-sensitive):
const TABS = ['Users', 'Flights', 'Itinerary', 'Accommodations', 'Finance', 'Recs', 'RentalCar'];
const SUGGESTIONS_TAB = 'PackingSuggestions';

// ── doGet: return all sheet data as JSON ─────────────────────────────────────
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {};

    for (const tabName of TABS) {
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        result[tabName] = [];
        continue;
      }
      result[tabName] = sheetToObjects(sheet);
    }

    // Also include packing suggestions if the tab exists
    const sugSheet = ss.getSheetByName(SUGGESTIONS_TAB);
    if (sugSheet) {
      result[SUGGESTIONS_TAB] = sheetToObjects(sugSheet);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doPost: write a packing suggestion ───────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(SUGGESTIONS_TAB);
    if (!sheet) {
      sheet = ss.insertSheet(SUGGESTIONS_TAB);
      // Write header row
      sheet.appendRow(['id', 'from', 'to', 'item', 'sentAt', 'status']);
    }

    sheet.appendRow([
      data.id     ?? '',
      data.from   ?? '',
      data.to     ?? '',
      data.item   ?? '',
      data.sentAt ?? Date.now(),
      data.status ?? 'pending'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a sheet's rows to an array of objects using row 1 as headers.
 * Dates stored as Date objects are converted to YYYY-MM-DD strings.
 */
function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip entirely empty rows
    if (row.every(cell => cell === '' || cell === null)) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      let val = row[c];

      // Convert Date objects → YYYY-MM-DD string
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }

      obj[key] = val !== undefined && val !== null ? val : '';
    }
    rows.push(obj);
  }

  return rows;
}
