/**
 * Google Apps Script Webhook for Voice to Google Sheet
 * 
 * HOW TO USE THIS (Takes only 2 minutes):
 * 1. Open your Google Sheet (https://sheets.google.com)
 * 2. Click "Extensions" > "Apps Script" in the top menu
 * 3. Delete any code in the editor and PASTE this entire file
 * 4. Click the blue "Deploy" button (top right) -> "New deployment"
 * 5. Select type: "Web app" (click gear icon next to Select type)
 * 6. Set Description: "Voice to Sheet Webhook"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"  <-- CRITICAL!
 * 9. Click "Deploy", review and grant permissions
 * 10. Copy the "Web app URL" provided (looks like https://script.google.com/macros/s/.../exec)
 * 11. Add it to your .env or Render Environment Variables:
 *     GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure header row exists if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Story Title",
        "Story Sub Heading",
        "Story Description",
        "Challenge Description",
        "Plan Description",
        "Makeover Description",
        "Owner Testimonials",
        "Language"
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#b45309").setFontColor("#ffffff");
    }

    var requestData = JSON.parse(e.postData.contents);
    var timestamp = requestData.timestamp || new Date().toLocaleString();
    var storyTitle = requestData.storyTitle || requestData.topic || "";
    var storySubHeading = requestData.storySubHeading || "";
    var storyDesc = requestData.storyDescription || requestData.description || requestData.text || "";
    var challengeDesc = requestData.challengeDescription || "";
    var planDesc = requestData.planDescription || "";
    var makeoverDesc = requestData.makeoverDescription || "";
    var ownerQuotes = requestData.ownerQuotes || "";
    var language = requestData.language || "en-IN";

    if (!storyTitle && !storySubHeading && !storyDesc && !challengeDesc && !planDesc && !makeoverDesc && !ownerQuotes) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No content provided"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Append the row to Google Sheet
    sheet.appendRow([
      "'" + timestamp,
      storyTitle,
      storySubHeading,
      storyDesc,
      challengeDesc,
      planDesc,
      makeoverDesc,
      ownerQuotes,
      language
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row appended successfully",
      row: [timestamp, storyTitle, storySubHeading, storyDesc, challengeDesc, planDesc, makeoverDesc, ownerQuotes, language]
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Voice to Google Sheet Webhook"
  })).setMimeType(ContentService.MimeType.JSON);
}
