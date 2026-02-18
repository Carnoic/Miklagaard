/**
 * Google Apps Script - Web App för Miklagaard rodddata
 *
 * INSTRUKTIONER:
 * 1. Öppna ditt Google Sheet
 * 2. Gå till Tillägg → Apps Script
 * 3. Klistra in denna kod (ersätt allt)
 * 4. Klicka "Distribuera" → "Ny distribution"
 * 5. Välj typ: "Webbapp"
 * 6. Kör som: "Jag" (ditt konto)
 * 7. Åtkomst: "Alla" (Anyone)
 * 8. Kopiera webappens URL och klistra in i CONFIG i input.html och app.js
 *
 * Sheetet förväntas ha kolumnerna: Datum | Meter | Anteckning (rad 1 = rubriker)
 */

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return jsonResponse([]);
    }

    var headers = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var dateIdx = findIndex(headers, ['date', 'datum']);
    var metersIdx = findIndex(headers, ['meters', 'meter']);
    var noteIdx = findIndex(headers, ['note', 'not', 'anteckning']);

    if (dateIdx === -1 || metersIdx === -1) {
      return jsonResponse({ error: 'Kolumner saknas: behöver Datum och Meter' });
    }

    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var date = data[i][dateIdx];
      var meters = parseInt(data[i][metersIdx], 10);

      if (!date || !meters || meters <= 0) continue;

      // Format date as YYYY-MM-DD
      if (date instanceof Date) {
        date = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        date = date.toString().trim();
      }

      var entry = { date: date, meters: meters };
      if (noteIdx !== -1 && data[i][noteIdx]) {
        entry.note = data[i][noteIdx].toString().trim();
      }
      rows.push(entry);
    }

    return jsonResponse(rows);

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var date = params.date;
    var meters = parseInt(params.meters, 10);
    var note = params.note || '';

    if (!date || !meters || meters <= 0) {
      return jsonResponse({ error: 'Ogiltiga värden: datum och meter krävs' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([date, meters, note]);

    return jsonResponse({ success: true, date: date, meters: meters, note: note });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function findIndex(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headers.indexOf(names[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
