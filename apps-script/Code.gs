// ============================================================
// Kizzier Classic 2026 — Registration Backend
// Google Apps Script (paste into script.google.com)
// ============================================================

// CONFIGURATION
var SPREADSHEET_ID = '1Ik1TupZf4-sPr7e_ktsp2O8qvvr0EOBWhjlZCg0l6Kc';
var SHEET_NAME = 'Registrations';
var ADMIN_EMAIL = 'kizzierclassic@gmail.com';
var VENMO_HANDLE = '@Kizzier-Classic';

// Registration amounts
var AMOUNTS = {
  'individual': 85,
  'foursome': 320,
  'sponsor-hole': 175,
  'sponsor-lunch': 200,
  'sponsor-beverage': 500
};

var TYPE_LABELS = {
  'individual': 'Individual Player',
  'foursome': 'Foursome',
  'sponsor-hole': 'Hole Sponsor',
  'sponsor-lunch': 'Lunch Sponsor',
  'sponsor-beverage': 'Beverage Cart Sponsor'
};

// ============================================================
// WEB APP ENDPOINT — receives form submissions
// ============================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var firstName = data.firstName || '';
    var lastName = data.lastName || '';
    var email = data.email || '';
    var phone = data.phone || '';
    var regType = data.regType || '';
    var notes = data.notes || '';
    var amount = AMOUNTS[regType] || 0;
    var typeLabel = TYPE_LABELS[regType] || regType;

    // Log to spreadsheet
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    sheet.appendRow([
      new Date(),
      firstName,
      lastName,
      email,
      phone,
      typeLabel,
      '$' + amount,
      notes
    ]);

    // Send confirmation email to registrant
    sendConfirmationEmail(firstName, email, typeLabel, amount);

    // Return success with CORS headers
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Registration received!',
        amount: amount,
        typeLabel: typeLabel
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// CONFIRMATION EMAIL TO REGISTRANT
// ============================================================
function sendConfirmationEmail(firstName, email, typeLabel, amount) {
  var subject = 'Kizzier Classic 2026 — Registration Confirmed!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you for registering for the 6th Annual Kizzier Classic! We are so excited to have you.\n\n'
    + '--- REGISTRATION DETAILS ---\n'
    + 'Type: ' + typeLabel + '\n'
    + 'Amount Due: $' + amount + '\n\n'
    + '--- EVENT DETAILS ---\n'
    + 'Date: Saturday, June 27, 2026\n'
    + 'Time: 1:00 PM Shotgun Start (Registration at 11:30 AM)\n'
    + 'Location: Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526\n'
    + 'Format: 18-Hole Scramble\n\n'
    + '--- PAYMENT ---\n'
    + 'Please send $' + amount + ' via Venmo to: ' + VENMO_HANDLE + '\n'
    + 'Venmo link: https://venmo.com/Kizzier-Classic\n\n'
    + 'If you have questions or need an alternative payment method, email us at kizzierclassic@gmail.com.\n\n'
    + 'See you on the course!\n'
    + 'The Kizzier Classic Team';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<div style="background: #7A9E8E; padding: 30px; text-align: center;">'
    + '<h1 style="color: white; margin: 0; font-size: 28px;">The Kizzier <span style="color: #C4AA6A;">Classic</span></h1>'
    + '<p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">6th Annual Charity Golf Tournament</p>'
    + '</div>'
    + '<div style="padding: 30px; background: #FAF8F4;">'
    + '<h2 style="color: #3D3D3D; margin-top: 0;">You\'re In, ' + firstName + '!</h2>'
    + '<p style="color: #6B6B6B;">Thank you for registering for the 6th Annual Kizzier Classic. We are so excited to have you!</p>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C4AA6A;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Registration Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Type:</strong> ' + typeLabel + '</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Amount Due:</strong> $' + amount + '</p>'
    + '</div>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7A9E8E;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Event Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Date:</strong> Saturday, June 27, 2026</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Time:</strong> 1:00 PM Shotgun Start (Registration at 11:30 AM)</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Location:</strong> Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Format:</strong> 18-Hole Scramble</p>'
    + '</div>'
    + '<div style="background: #5B7D6E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">'
    + '<h3 style="color: white; margin-top: 0;">Payment</h3>'
    + '<p style="color: rgba(255,255,255,0.8); margin: 4px 0;">Send <strong style="color: #C4AA6A;">$' + amount + '</strong> via Venmo to:</p>'
    + '<a href="https://venmo.com/Kizzier-Classic" style="display: inline-block; background: #C4AA6A; color: #3D3D3D; padding: 12px 32px; border-radius: 4px; font-weight: bold; text-decoration: none; margin-top: 12px; font-size: 16px;">' + VENMO_HANDLE + '</a>'
    + '</div>'
    + '<p style="color: #A0A0A0; font-size: 13px; text-align: center; margin-top: 30px;">Questions? Email us at <a href="mailto:kizzierclassic@gmail.com" style="color: #7A9E8E;">kizzierclassic@gmail.com</a></p>'
    + '</div>'
    + '<div style="background: #4A6E5D; padding: 20px; text-align: center;">'
    + '<p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">In loving memory of Ryan Kizzier</p>'
    + '</div>'
    + '</div>';

  GmailApp.sendEmail(email, subject, body, {
    htmlBody: htmlBody,
    name: 'The Kizzier Classic'
  });
}

// ============================================================
// WEEKLY RECAP EMAIL (set up a Monday 8am trigger)
// ============================================================
function sendWeeklyRecap() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    // No registrations yet (only header row)
    return;
  }

  var now = new Date();
  var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  var newRegs = [];
  var totalRegs = 0;
  var totalRevenue = 0;
  var typeCounts = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var timestamp = new Date(row[0]);
    var amount = parseFloat(String(row[6]).replace('$', '')) || 0;
    var type = row[5];

    totalRegs++;
    totalRevenue += amount;
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    if (timestamp >= oneWeekAgo) {
      newRegs.push({
        name: row[1] + ' ' + row[2],
        email: row[3],
        type: type,
        amount: amount,
        date: timestamp
      });
    }
  }

  var subject = 'Kizzier Classic Weekly Recap — ' + Utilities.formatDate(now, 'America/Chicago', 'MMM d, yyyy');

  var body = '--- KIZZIER CLASSIC WEEKLY RECAP ---\n'
    + 'Week ending: ' + Utilities.formatDate(now, 'America/Chicago', 'EEEE, MMM d, yyyy') + '\n\n'
    + 'NEW THIS WEEK: ' + newRegs.length + ' registrations\n'
    + 'TOTAL REGISTRATIONS: ' + totalRegs + '\n'
    + 'TOTAL REVENUE: $' + totalRevenue + '\n\n';

  if (Object.keys(typeCounts).length > 0) {
    body += '--- BREAKDOWN BY TYPE ---\n';
    for (var type in typeCounts) {
      body += type + ': ' + typeCounts[type] + '\n';
    }
    body += '\n';
  }

  if (newRegs.length > 0) {
    body += '--- NEW REGISTRANTS THIS WEEK ---\n';
    for (var j = 0; j < newRegs.length; j++) {
      var reg = newRegs[j];
      body += '• ' + reg.name + ' (' + reg.email + ') — ' + reg.type + ' — $' + reg.amount + '\n';
    }
  } else {
    body += 'No new registrations this week.\n';
  }

  body += '\nView full spreadsheet: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit\n';

  GmailApp.sendEmail(ADMIN_EMAIL, subject, body, {
    name: 'Kizzier Classic Bot'
  });
}

// ============================================================
// SET UP WEEKLY TRIGGER (run this once manually)
// ============================================================
function setupWeeklyTrigger() {
  // Remove existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendWeeklyRecap') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new weekly trigger — Monday at 8 AM Central
  ScriptApp.newTrigger('sendWeeklyRecap')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  Logger.log('Weekly recap trigger created for Mondays at 8 AM');
}

// ============================================================
// RUN THIS ONCE to authorize Sheets + Gmail access
// ============================================================
function authorizeServices() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  Logger.log('Sheet access OK: ' + sheet.getName());
  Logger.log('Gmail access OK');
  Logger.log('All services authorized!');
}
