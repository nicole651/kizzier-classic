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
  'individual': 80,
  'foursome': 320,
  'join-foursome': 80,
  'sponsor-hole': 175,
  'sponsor-lunch': 200,
  'sponsor-beverage': 500,
  'donation': 0,
  'after-celebration': 0,
  'raffle-donation': 0
};

var TYPE_LABELS = {
  'individual': 'Individual Player',
  'foursome': 'Foursome',
  'join-foursome': 'Join a Foursome',
  'sponsor-hole': 'Hole Sponsor',
  'sponsor-lunch': 'Lunch Sponsor',
  'sponsor-beverage': 'Beverage Cart Sponsor',
  'after-celebration': 'After Celebration Contribution',
  'donation': 'Donation',
  'raffle-donation': 'Raffle Item Donation'
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
    var street = data.street || '';
    var city = data.city || '';
    var state = data.state || '';
    var zip = data.zip || '';
    var regType = data.regType || '';
    var player2 = data.player2 || '';
    var player2email = data.player2email || '';
    var player3 = data.player3 || '';
    var player3email = data.player3email || '';
    var player4 = data.player4 || '';
    var player4email = data.player4email || '';
    var teamName = data.teamName || '';
    var notes = data.notes || '';
    var raffleItems = data.raffleItems || '';
    var ryanStory = data.ryanStory || '';
    var ryanPhotoData = data.ryanPhotoData || '';
    var ryanPhotoName = data.ryanPhotoName || '';
    var ryanPhotoType = data.ryanPhotoType || '';
    var amount = AMOUNTS[regType] || 0;
    var typeLabel = TYPE_LABELS[regType] || regType;

    // Save Ryan photo to Google Drive if provided
    var ryanPhotoLink = '';
    if (ryanPhotoData) {
      try {
        var folderName = 'Kizzier Classic - Ryan Memories';
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }
        var blob = Utilities.newBlob(Utilities.base64Decode(ryanPhotoData), ryanPhotoType, firstName + '_' + lastName + '_' + ryanPhotoName);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        ryanPhotoLink = file.getUrl();
      } catch (photoErr) {
        ryanPhotoLink = 'Upload error: ' + photoErr.toString();
      }
    }

    // Build player list for foursomes (names and emails)
    var playerNames = '';
    var playerEmails = '';
    if (regType === 'foursome') {
      var players = [player2, player3, player4].filter(function(p) { return p.trim() !== ''; });
      var emails = [player2email, player3email, player4email].filter(function(e) { return e.trim() !== ''; });
      if (players.length > 0) {
        playerNames = players.join(', ');
      }
      if (emails.length > 0) {
        playerEmails = emails.join(', ');
      }
    }

    // Determine team column value
    // Foursome captains: store their own name as team identifier
    // Join-foursome players: store the captain name they selected
    var team = '';
    if (regType === 'foursome') {
      team = firstName + ' ' + lastName;
    } else if (regType === 'join-foursome') {
      team = teamName;
    }

    // Full mailing address for easy reference
    var mailingAddress = '';
    if (street) {
      mailingAddress = street + ', ' + city + ', ' + state + ' ' + zip;
    }

    // Log to spreadsheet
    // Columns: A=Timestamp, B=First, C=Last, D=Email, E=Phone,
    //          F=Street, G=City, H=State, I=Zip, J=FullAddress,
    //          K=Type, L=Amount, M=PlayerNames, N=PlayerEmails,
    //          O=Notes, P=Team, Q=RaffleItems, R=RyanStory,
    //          S=RyanPhotoLink, T=Paid
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    sheet.appendRow([
      new Date(),
      firstName,
      lastName,
      email,
      phone,
      street,
      city,
      state,
      zip,
      mailingAddress,
      typeLabel,
      '$' + amount,
      playerNames,
      playerEmails,
      notes,
      team,
      raffleItems,
      ryanStory,
      ryanPhotoLink,
      'No'
    ]);

    // Send confirmation email to registrant
    if (regType === 'raffle-donation') {
      sendRaffleDonationEmail(firstName, email, raffleItems);
    } else if (regType === 'after-celebration') {
      sendAfterCelebrationEmail(firstName, email);
    } else if (regType === 'donation') {
      sendDonationEmail(firstName, email);
    } else if (regType === 'join-foursome') {
      sendJoinFoursomeEmail(firstName, email, amount, teamName);
    } else {
      sendConfirmationEmail(firstName, email, typeLabel, amount, playerNames);
    }

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

// Handle GET requests — team list API + health check
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

  if (action === 'getTeams') {
    return getAvailableTeams();
  }

  // Default health check
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Returns foursomes with open spots for join-foursome registrations
function getAvailableTeams() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    var data = sheet.getDataRange().getValues();

    // Find all foursome registrations and count named players
    // Updated columns: 0=Timestamp, 1=First, 2=Last, 3=Email, 4=Phone,
    //   5=Street, 6=City, 7=State, 8=Zip, 9=FullAddress,
    //   10=Type, 11=Amount, 12=PlayerNames, 13=PlayerEmails,
    //   14=Notes, 15=Team, 16=RaffleItems
    var COL_TYPE = 10;
    var COL_PLAYER_NAMES = 12;
    var COL_TEAM = 15;
    var foursomes = {}; // captainName -> { namedPlayers: count }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var type = String(row[COL_TYPE]);
      var team = String(row[COL_TEAM] || '');

      if (type === 'Foursome') {
        var captainName = row[1] + ' ' + row[2];
        var playerNames = String(row[COL_PLAYER_NAMES] || '');
        var namedCount = 0;
        if (playerNames.trim()) {
          namedCount = playerNames.split(',').filter(function(p) { return p.trim() !== ''; }).length;
        }
        // Captain + named players = filled spots from the original registration
        foursomes[captainName] = { filledFromReg: 1 + namedCount, joins: 0 };
      }
    }

    // Count join-foursome registrations per team
    for (var j = 1; j < data.length; j++) {
      var row2 = data[j];
      var type2 = String(row2[COL_TYPE]);
      var team2 = String(row2[COL_TEAM] || '');

      if (type2 === 'Join a Foursome' && team2 && foursomes[team2]) {
        foursomes[team2].joins++;
      }
    }

    // Build list of teams with open spots
    var teams = [];
    for (var captain in foursomes) {
      var info = foursomes[captain];
      var spots = 4 - info.filledFromReg - info.joins;
      if (spots > 0) {
        teams.push({ name: captain, spots: spots });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', teams: teams }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString(), teams: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// CONFIRMATION EMAIL TO REGISTRANT
// ============================================================
function sendConfirmationEmail(firstName, email, typeLabel, amount, playerNames) {
  var subject = 'Kizzier Classic 2026 — Registration Confirmed!';

  var playerLine = '';
  if (playerNames) {
    playerLine = 'Teammates: ' + playerNames + '\n';
  }

  var body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you for registering for the 6th Annual Kizzier Classic! We are so excited to have you.\n\n'
    + '--- REGISTRATION DETAILS ---\n'
    + 'Type: ' + typeLabel + '\n'
    + 'Amount Due: $' + amount + '\n'
    + playerLine + '\n'
    + '--- EVENT DETAILS ---\n'
    + 'Date: Saturday, June 27, 2026\n'
    + 'Time: 9:00 AM Tee Off (Registration 8:00–9:00 AM)\n'
    + 'Location: Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526\n'
    + 'Format: 18-Hole Scramble\n\n'
    + '--- PAYMENT ---\n'
    + 'Please send $' + amount + ' via Venmo to: ' + VENMO_HANDLE + '\n'
    + 'Venmo link: https://venmo.com/u/Kizzier-Classic\n\n'
    + 'If you have questions or need an alternative payment method, email us at kizzierclassic@gmail.com.\n\n'
    + 'See you on the course!\n'
    + 'The Kizzier Classic Team';

  var playerHtml = '';
  if (playerNames) {
    playerHtml = '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Teammates:</strong> ' + playerNames + '</p>';
  }

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
    + playerHtml
    + '</div>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7A9E8E;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Event Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Date:</strong> Saturday, June 27, 2026</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Time:</strong> 9:00 AM Tee Off (Registration 8:00–9:00 AM)</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Location:</strong> Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Format:</strong> 18-Hole Scramble</p>'
    + '</div>'
    + '<div style="background: #5B7D6E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">'
    + '<h3 style="color: white; margin-top: 0;">Payment</h3>'
    + '<p style="color: rgba(255,255,255,0.8); margin: 4px 0;">Send <strong style="color: #C4AA6A;">$' + amount + '</strong> via Venmo to:</p>'
    + '<a href="https://venmo.com/u/Kizzier-Classic" style="display: inline-block; background: #C4AA6A; color: #3D3D3D; padding: 12px 32px; border-radius: 4px; font-weight: bold; text-decoration: none; margin-top: 12px; font-size: 16px;">' + VENMO_HANDLE + '</a>'
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
// JOIN A FOURSOME CONFIRMATION EMAIL
// ============================================================
function sendJoinFoursomeEmail(firstName, email, amount, teamName) {
  var subject = 'Kizzier Classic 2026 — You\'re Joining ' + teamName + '\'s Team!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'You\'re in! You\'ve joined ' + teamName + '\'s team for the 6th Annual Kizzier Classic.\n\n'
    + '--- REGISTRATION DETAILS ---\n'
    + 'Type: Join a Foursome\n'
    + 'Team: ' + teamName + '\'s Team\n'
    + 'Amount Due: $' + amount + '\n\n'
    + '--- EVENT DETAILS ---\n'
    + 'Date: Saturday, June 27, 2026\n'
    + 'Time: 9:00 AM Tee Off (Registration 8:00–9:00 AM)\n'
    + 'Location: Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526\n'
    + 'Format: 18-Hole Scramble\n\n'
    + '--- PAYMENT ---\n'
    + 'Please send $' + amount + ' via Venmo to: ' + VENMO_HANDLE + '\n'
    + 'Venmo link: https://venmo.com/u/Kizzier-Classic\n\n'
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
    + '<p style="color: #6B6B6B;">You\'ve joined <strong>' + teamName + '\'s Team</strong> for the 6th Annual Kizzier Classic. See you on the course!</p>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C4AA6A;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Registration Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Type:</strong> Join a Foursome</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Team:</strong> ' + teamName + '\'s Team</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Amount Due:</strong> $' + amount + '</p>'
    + '</div>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7A9E8E;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Event Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Date:</strong> Saturday, June 27, 2026</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Time:</strong> 9:00 AM Tee Off (Registration 8:00–9:00 AM)</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Location:</strong> Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Format:</strong> 18-Hole Scramble</p>'
    + '</div>'
    + '<div style="background: #5B7D6E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">'
    + '<h3 style="color: white; margin-top: 0;">Payment</h3>'
    + '<p style="color: rgba(255,255,255,0.8); margin: 4px 0;">Send <strong style="color: #C4AA6A;">$' + amount + '</strong> via Venmo to:</p>'
    + '<a href="https://venmo.com/u/Kizzier-Classic" style="display: inline-block; background: #C4AA6A; color: #3D3D3D; padding: 12px 32px; border-radius: 4px; font-weight: bold; text-decoration: none; margin-top: 12px; font-size: 16px;">' + VENMO_HANDLE + '</a>'
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
// DONATION THANK-YOU EMAIL
// ============================================================
function sendDonationEmail(firstName, email) {
  var subject = 'Kizzier Classic 2026 — Thank You for Your Donation!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you so much for your generous donation to the Kizzier Classic! '
    + 'Your support helps keep Ryan\'s legacy alive and makes a real difference.\n\n'
    + '--- HOW TO DONATE ---\n'
    + 'Please send your donation via Venmo to: ' + VENMO_HANDLE + '\n'
    + 'Venmo link: https://venmo.com/u/Kizzier-Classic\n\n'
    + 'If you have questions or need an alternative payment method, email us at kizzierclassic@gmail.com.\n\n'
    + 'With gratitude,\n'
    + 'The Kizzier Classic Team';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<div style="background: #7A9E8E; padding: 30px; text-align: center;">'
    + '<h1 style="color: white; margin: 0; font-size: 28px;">The Kizzier <span style="color: #C4AA6A;">Classic</span></h1>'
    + '<p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">6th Annual Charity Golf Tournament</p>'
    + '</div>'
    + '<div style="padding: 30px; background: #FAF8F4;">'
    + '<h2 style="color: #3D3D3D; margin-top: 0;">Thank You, ' + firstName + '!</h2>'
    + '<p style="color: #6B6B6B;">Your generous donation to the Kizzier Classic means the world to us. Every dollar helps keep Ryan\'s legacy alive and supports our cause.</p>'
    + '<div style="background: #5B7D6E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">'
    + '<h3 style="color: white; margin-top: 0;">Send Your Donation</h3>'
    + '<p style="color: rgba(255,255,255,0.8); margin: 4px 0;">Send any amount via Venmo to:</p>'
    + '<a href="https://venmo.com/u/Kizzier-Classic" style="display: inline-block; background: #C4AA6A; color: #3D3D3D; padding: 12px 32px; border-radius: 4px; font-weight: bold; text-decoration: none; margin-top: 12px; font-size: 16px;">' + VENMO_HANDLE + '</a>'
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
// AFTER CELEBRATION CONTRIBUTION EMAIL
// ============================================================
function sendAfterCelebrationEmail(firstName, email) {
  var subject = 'Kizzier Classic 2026 — Thank You for Your Contribution!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you so much for your After Celebration Contribution to the Kizzier Classic! '
    + 'Your support helps keep Ryan\'s legacy alive and makes a real difference.\n\n'
    + '--- HOW TO CONTRIBUTE ---\n'
    + 'Please send your contribution via Venmo to: ' + VENMO_HANDLE + '\n'
    + 'Venmo link: https://venmo.com/u/Kizzier-Classic\n\n'
    + 'If you have questions or need an alternative payment method, email us at kizzierclassic@gmail.com.\n\n'
    + 'With gratitude,\n'
    + 'The Kizzier Classic Team';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<div style="background: #7A9E8E; padding: 30px; text-align: center;">'
    + '<h1 style="color: white; margin: 0; font-size: 28px;">The Kizzier <span style="color: #C4AA6A;">Classic</span></h1>'
    + '<p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">6th Annual Charity Golf Tournament</p>'
    + '</div>'
    + '<div style="padding: 30px; background: #FAF8F4;">'
    + '<h2 style="color: #3D3D3D; margin-top: 0;">Thank You, ' + firstName + '!</h2>'
    + '<p style="color: #6B6B6B;">Your After Celebration Contribution to the Kizzier Classic means the world to us. Every dollar helps keep Ryan\'s legacy alive and supports our cause.</p>'
    + '<div style="background: #5B7D6E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">'
    + '<h3 style="color: white; margin-top: 0;">Send Your Contribution</h3>'
    + '<p style="color: rgba(255,255,255,0.8); margin: 4px 0;">Send any amount via Venmo to:</p>'
    + '<a href="https://venmo.com/u/Kizzier-Classic" style="display: inline-block; background: #C4AA6A; color: #3D3D3D; padding: 12px 32px; border-radius: 4px; font-weight: bold; text-decoration: none; margin-top: 12px; font-size: 16px;">' + VENMO_HANDLE + '</a>'
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
// RAFFLE ITEM DONATION THANK-YOU EMAIL
// ============================================================
function sendRaffleDonationEmail(firstName, email, raffleItems) {
  var subject = 'Kizzier Classic 2026 — Thank You for Donating Raffle Items!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'Thank you for pledging raffle items for the 6th Annual Kizzier Classic! '
    + 'Your generosity helps make our raffle a highlight of the day.\n\n'
    + '--- ITEMS YOU\'RE DONATING ---\n'
    + raffleItems + '\n\n'
    + '--- WHAT TO DO ---\n'
    + 'Please bring your items to registration check-in at 11:30 AM on Saturday, June 27, 2026 '
    + 'at Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526.\n\n'
    + 'No payment is needed — your item donation is your contribution!\n\n'
    + 'If you have questions, email us at kizzierclassic@gmail.com.\n\n'
    + 'With gratitude,\n'
    + 'The Kizzier Classic Team';

  // Build HTML list of items
  var itemsArray = raffleItems.split(', ');
  var itemsHtml = '';
  for (var i = 0; i < itemsArray.length; i++) {
    itemsHtml += '<li style="padding: 6px 0; color: #6B6B6B; border-bottom: 1px solid #E8E5DE;">' + itemsArray[i] + '</li>';
  }

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<div style="background: #7A9E8E; padding: 30px; text-align: center;">'
    + '<h1 style="color: white; margin: 0; font-size: 28px;">The Kizzier <span style="color: #C4AA6A;">Classic</span></h1>'
    + '<p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">6th Annual Charity Golf Tournament</p>'
    + '</div>'
    + '<div style="padding: 30px; background: #FAF8F4;">'
    + '<h2 style="color: #3D3D3D; margin-top: 0;">Thank You, ' + firstName + '!</h2>'
    + '<p style="color: #6B6B6B;">Your raffle item donation for the 6th Annual Kizzier Classic is greatly appreciated. Every item makes the raffle more fun for everyone!</p>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C4AA6A;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Items You\'re Donating</h3>'
    + '<ul style="list-style: none; padding: 0; margin: 0;">' + itemsHtml + '</ul>'
    + '</div>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7A9E8E;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Drop-Off Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;">Please bring your items to <strong>registration check-in</strong>:</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Date:</strong> Saturday, June 27, 2026</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Time:</strong> 11:30 AM</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Location:</strong> Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526</p>'
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

  // Column indexes
  var COL_TIMESTAMP = 0;
  var COL_FIRST = 1;
  var COL_LAST = 2;
  var COL_EMAIL = 3;
  var COL_TYPE = 10;
  var COL_AMOUNT = 11;
  var COL_PLAYER_NAMES = 12;
  var COL_PAID = 19; // Column T

  var newRegs = [];
  var totalRegs = 0;
  var totalRevenue = 0;
  var totalReceived = 0;
  var totalTeams = 0;
  var totalGolfers = 0;
  var typeCounts = {};
  var sponsorCounts = {};
  var sponsorRevenue = 0;
  var sponsorReceived = 0;
  var unpaidList = [];

  var sponsorTypes = ['Hole Sponsor', 'Lunch Sponsor', 'Beverage Cart Sponsor'];
  var golferTypes = ['Individual Player', 'Foursome', 'Join a Foursome'];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var timestamp = new Date(row[COL_TIMESTAMP]);
    var amount = parseFloat(String(row[COL_AMOUNT]).replace('$', '')) || 0;
    var type = String(row[COL_TYPE]);
    var paid = String(row[COL_PAID] || 'No').trim().toLowerCase();
    var isPaid = (paid === 'yes' || paid === 'y');
    var name = row[COL_FIRST] + ' ' + row[COL_LAST];

    totalRegs++;
    totalRevenue += amount;
    if (isPaid) {
      totalReceived += amount;
    }

    // Count golfers
    if (type === 'Foursome') {
      totalTeams++;
      totalGolfers += 4; // Always 4 spots per foursome
    } else if (type === 'Individual Player') {
      totalGolfers += 1;
    } else if (type === 'Join a Foursome') {
      totalGolfers += 1;
    }

    // Track sponsors separately
    if (sponsorTypes.indexOf(type) >= 0) {
      sponsorCounts[type] = (sponsorCounts[type] || 0) + 1;
      sponsorRevenue += amount;
      if (isPaid) sponsorReceived += amount;
    }

    // Type breakdown
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    // Track unpaid registrations with an amount due
    if (!isPaid && amount > 0) {
      unpaidList.push({ name: name, type: type, amount: amount });
    }

    // New this week
    if (timestamp >= oneWeekAgo) {
      newRegs.push({
        name: name,
        email: row[COL_EMAIL],
        type: type,
        amount: amount,
        paid: isPaid
      });
    }
  }

  var subject = 'Kizzier Classic Weekly Recap — ' + Utilities.formatDate(now, 'America/Chicago', 'MMM d, yyyy');

  var body = '--- KIZZIER CLASSIC WEEKLY RECAP ---\n'
    + 'Week ending: ' + Utilities.formatDate(now, 'America/Chicago', 'EEEE, MMM d, yyyy') + '\n\n'
    + 'NEW THIS WEEK: ' + newRegs.length + ' registrations\n\n'
    + '--- TOTALS ---\n'
    + 'Total Registrations: ' + totalRegs + '\n'
    + 'Total Teams: ' + totalTeams + '\n'
    + 'Total Golfers: ' + totalGolfers + '\n'
    + 'Total Revenue (Expected): $' + totalRevenue + '\n'
    + 'Total Revenue (Received): $' + totalReceived + '\n'
    + 'Outstanding Balance: $' + (totalRevenue - totalReceived) + '\n\n';

  // Sponsorship section
  if (Object.keys(sponsorCounts).length > 0) {
    body += '--- SPONSORSHIPS ---\n';
    for (var sType in sponsorCounts) {
      body += sType + ': ' + sponsorCounts[sType] + '\n';
    }
    body += 'Sponsor Revenue (Expected): $' + sponsorRevenue + '\n';
    body += 'Sponsor Revenue (Received): $' + sponsorReceived + '\n\n';
  } else {
    body += '--- SPONSORSHIPS ---\nNo sponsorships yet.\n\n';
  }

  // Type breakdown
  if (Object.keys(typeCounts).length > 0) {
    body += '--- BREAKDOWN BY TYPE ---\n';
    for (var t in typeCounts) {
      body += t + ': ' + typeCounts[t] + '\n';
    }
    body += '\n';
  }

  // New registrants this week
  if (newRegs.length > 0) {
    body += '--- NEW THIS WEEK ---\n';
    for (var j = 0; j < newRegs.length; j++) {
      var reg = newRegs[j];
      var paidTag = reg.paid ? ' ✓ PAID' : ' ⏳ UNPAID';
      body += '• ' + reg.name + ' (' + reg.email + ') — ' + reg.type + ' — $' + reg.amount + paidTag + '\n';
    }
    body += '\n';
  } else {
    body += 'No new registrations this week.\n\n';
  }

  // Outstanding payments
  if (unpaidList.length > 0) {
    body += '--- AWAITING PAYMENT ---\n';
    for (var k = 0; k < unpaidList.length; k++) {
      body += '• ' + unpaidList[k].name + ' — ' + unpaidList[k].type + ' — $' + unpaidList[k].amount + '\n';
    }
    body += '\n';
  }

  body += '💡 To mark a payment as received, open the spreadsheet and change column T ("Paid") to "Yes".\n'
    + 'A confirmation email will be sent to the registrant automatically.\n\n'
    + 'View full spreadsheet: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit\n';

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
  // Touch DriveApp to authorize it
  DriveApp.getRootFolder();
  Logger.log('Drive access OK');
  Logger.log('All services authorized!');
}

// ============================================================
// SET UP HEADER ROW (run once after updating to new column layout)
// ============================================================
function setupHeaderRow() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  var headers = [
    'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone',
    'Street', 'City', 'State', 'Zip', 'Full Address',
    'Type', 'Amount', 'Teammate Names', 'Teammate Emails',
    'Notes', 'Team', 'Raffle Items', 'Ryan Memory/Story', 'Ryan Photo Link',
    'Paid'
  ];

  // Write headers to row 1
  for (var i = 0; i < headers.length; i++) {
    sheet.getRange(1, i + 1).setValue(headers[i]);
  }

  // Bold the header row
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  // Freeze header row
  sheet.setFrozenRows(1);

  Logger.log('Header row set up with ' + headers.length + ' columns');
}

// ============================================================
// PAYMENT CONFIRMATION — auto-sends when "Paid" column = "Yes"
// ============================================================
function onPaidEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  var range = e.range;
  var col = range.getColumn();
  var row = range.getRow();

  // Column T = 20 (Paid column)
  if (col !== 20 || row <= 1) return;

  var newValue = String(range.getValue()).trim().toLowerCase();
  var oldValue = String(e.oldValue || '').trim().toLowerCase();

  // Only fire when changed TO "yes"
  if ((newValue === 'yes' || newValue === 'y') && oldValue !== 'yes' && oldValue !== 'y') {
    var data = sheet.getRange(row, 1, 1, 20).getValues()[0];
    var firstName = data[1];  // Column B
    var email = data[3];      // Column D
    var typeLabel = data[10];  // Column K
    var amount = parseFloat(String(data[11]).replace('$', '')) || 0;

    if (email) {
      sendPaymentConfirmationEmail(firstName, email, typeLabel, amount);
      // Add timestamp note
      var noteCell = sheet.getRange(row, 20);
      noteCell.setNote('Payment confirmed: ' + new Date().toLocaleString());
    }
  }
}

// ============================================================
// PAYMENT CONFIRMATION EMAIL
// ============================================================
function sendPaymentConfirmationEmail(firstName, email, typeLabel, amount) {
  var subject = 'Kizzier Classic 2026 — Payment Received!';

  var body = 'Hi ' + firstName + ',\n\n'
    + 'We\'ve received your payment of $' + amount + ' for the Kizzier Classic. You\'re all set!\n\n'
    + '--- CONFIRMATION ---\n'
    + 'Type: ' + typeLabel + '\n'
    + 'Amount Paid: $' + amount + '\n'
    + 'Status: PAID ✓\n\n'
    + '--- EVENT DETAILS ---\n'
    + 'Date: Saturday, June 27, 2026\n'
    + 'Time: 1:00 PM Shotgun Start (Registration at 11:30 AM)\n'
    + 'Location: Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526\n'
    + 'Format: 18-Hole Scramble\n\n'
    + 'See you on the course!\n'
    + 'The Kizzier Classic Team';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<div style="background: #7A9E8E; padding: 30px; text-align: center;">'
    + '<h1 style="color: white; margin: 0; font-size: 28px;">The Kizzier <span style="color: #C4AA6A;">Classic</span></h1>'
    + '<p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">6th Annual Charity Golf Tournament</p>'
    + '</div>'
    + '<div style="padding: 30px; background: #FAF8F4;">'
    + '<h2 style="color: #3D3D3D; margin-top: 0;">Payment Received!</h2>'
    + '<p style="color: #6B6B6B;">Hey ' + firstName + '! We\'ve got your payment — you\'re officially locked in for the 6th Annual Kizzier Classic!</p>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Payment Confirmation</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Type:</strong> ' + typeLabel + '</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Amount Paid:</strong> $' + amount + '</p>'
    + '<p style="margin: 4px 0; color: #4CAF50; font-weight: bold;">✓ PAID IN FULL</p>'
    + '</div>'
    + '<div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7A9E8E;">'
    + '<h3 style="color: #3D3D3D; margin-top: 0;">Event Details</h3>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Date:</strong> Saturday, June 27, 2026</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Time:</strong> 1:00 PM Shotgun Start (Registration at 11:30 AM)</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Location:</strong> Hidden Valley Golf Club, 10501 Pine Lake Rd, Lincoln, NE 68526</p>'
    + '<p style="margin: 4px 0; color: #6B6B6B;"><strong>Format:</strong> 18-Hole Scramble</p>'
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
// SET UP EDIT TRIGGER for payment confirmations (run once)
// ============================================================
function setupEditTrigger() {
  // Remove existing onPaidEdit triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onPaidEdit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new installable onEdit trigger
  ScriptApp.newTrigger('onPaidEdit')
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();

  Logger.log('Edit trigger created — payment confirmations will auto-send when Paid = Yes');
}
