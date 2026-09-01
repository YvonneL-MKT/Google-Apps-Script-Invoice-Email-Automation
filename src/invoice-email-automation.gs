/**
 * Invoice Email Automation
 * Portfolio / anonymized version
 */

const CONFIG = Object.freeze({
  SHEETS: {
    MAIN: 'Main_List',
    EMAIL_TEMPLATE: 'Email_Template',
    CRM: 'CRM_Data'
  },

  CELLS: {
    SOURCE_FOLDER_ID: 'N2',
    ARCHIVE_FOLDER_ID: 'O2',
    EMAIL_SUBJECT: 'B1',
    EMAIL_BODY: 'B2'
  },

  TIMEZONE: 'GMT+8',
  SENDER_NAME: 'Finance Operations',

  STATUS: {
    SENT: 'Sent Success',
    NO_INVOICE_NUMBER: 'Skip: No Inv#',
    NO_EMAIL: 'Error: No Email',
    NO_FILE: 'Skip: No File'
  },

  MAIN_COL: {
    SELECTED: 0,
    COMPANY_NAME: 1,
    CLIENT_CODE: 2,
    CRM_REFERENCE: 3,
    INVOICE_NUMBER: 4,
    CLIENT_EMAIL: 5,
    CC_EMAIL: 6,
    MONTH_TAG: 7,
    INVOICE_FILE_URL: 8,
    BREAKDOWN_FILE_URL: 9,
    SCHEDULED_TIME: 10,
    STATUS: 11,
    SENT_AT: 12
  },

  CRM_COL: {
    CLIENT_CODE: 0,
    COMPANY_NAME: 4,
    CLIENT_EMAIL: 5,
    CC_EMAIL: 6,
    CRM_REFERENCE: 7
  }
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Invoice Sending Tools')
    .addItem('1. Rename Files & Auto-Link', 'renameFilesOnly')
    .addSeparator()
    .addItem('2. Send All Pending (Manual)', 'sendAllManual')
    .addItem('3. Send Checked Only (Manual)', 'sendCheckedManual')
    .addSeparator()
    .addItem('Start/Update Auto-Scheduler', 'setupTrigger')
    .addToUi();
}

function checkAndSendScheduled() {
  processRows(false);
}

function sendAllManual() {
  const response = Browser.msgBox(
    'Confirm',
    'Send all eligible pending invoice emails?',
    Browser.Buttons.YES_NO
  );

  if (response === 'yes') {
    processRows(true);
    SpreadsheetApp.getUi().alert('Processing complete.');
  }
}

function sendCheckedManual() {
  processRows(true, true);
  SpreadsheetApp.getUi().alert('Processing complete.');
}

function processRows(isManual, checkedOnly = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.SHEETS.MAIN);

  if (!mainSheet) {
    throw new Error(`Missing sheet: ${CONFIG.SHEETS.MAIN}`);
  }

  const data = mainSheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    if (checkedOnly && row[CONFIG.MAIN_COL.SELECTED] !== true) continue;
    if (row[CONFIG.MAIN_COL.STATUS] === CONFIG.STATUS.SENT) continue;

    if (!row[CONFIG.MAIN_COL.INVOICE_NUMBER]) {
      setStatus(mainSheet, rowNumber, CONFIG.STATUS.NO_INVOICE_NUMBER);
      continue;
    }

    if (!row[CONFIG.MAIN_COL.CLIENT_EMAIL]) {
      setStatus(mainSheet, rowNumber, CONFIG.STATUS.NO_EMAIL);
      continue;
    }

    const invoiceUrl = row[CONFIG.MAIN_COL.INVOICE_FILE_URL];
    const breakdownUrl = row[CONFIG.MAIN_COL.BREAKDOWN_FILE_URL];

    if (!invoiceUrl && !breakdownUrl) {
      setStatus(mainSheet, rowNumber, CONFIG.STATUS.NO_FILE);
      continue;
    }

    if (!isManual) {
      const scheduledTime = row[CONFIG.MAIN_COL.SCHEDULED_TIME];
      if (!(scheduledTime instanceof Date) || scheduledTime > now) continue;
    }

    try {
      executeCoreLogic(rowNumber);

      if (checkedOnly) {
        mainSheet
          .getRange(rowNumber, CONFIG.MAIN_COL.SELECTED + 1)
          .setValue(false);
      }
    } catch (error) {
      setStatus(mainSheet, rowNumber, `Error: ${error.message}`);
      console.error(`Row ${rowNumber}: ${error.stack || error.message}`);
    }
  }
}

function executeCoreLogic(rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.SHEETS.MAIN);
  const templateSheet = ss.getSheetByName(CONFIG.SHEETS.EMAIL_TEMPLATE);

  if (!mainSheet) throw new Error(`Missing sheet: ${CONFIG.SHEETS.MAIN}`);
  if (!templateSheet) throw new Error(`Missing sheet: ${CONFIG.SHEETS.EMAIL_TEMPLATE}`);

  const rowData = mainSheet
    .getRange(rowNumber, 1, 1, CONFIG.MAIN_COL.SENT_AT + 1)
    .getValues()[0];

  const companyName = rowData[CONFIG.MAIN_COL.COMPANY_NAME];
  const invoiceNumber = rowData[CONFIG.MAIN_COL.INVOICE_NUMBER];
  const clientEmail = rowData[CONFIG.MAIN_COL.CLIENT_EMAIL];
  const ccEmail = rowData[CONFIG.MAIN_COL.CC_EMAIL];
  const rawMonthTag = rowData[CONFIG.MAIN_COL.MONTH_TAG];

  const monthTag = formatMonthTag(rawMonthTag);
  const folderTag = rawMonthTag instanceof Date
    ? Utilities.formatDate(rawMonthTag, CONFIG.TIMEZONE, 'yyyy-MM')
    : String(rawMonthTag || '');

  const attachments = [];
  const filesToArchive = [];
  const attachmentErrors = [];

  [
    rowData[CONFIG.MAIN_COL.INVOICE_FILE_URL],
    rowData[CONFIG.MAIN_COL.BREAKDOWN_FILE_URL]
  ].forEach(urlValue => {
    if (!urlValue) return;

    const fileId = extractDriveFileId(String(urlValue));

    if (!fileId) {
      attachmentErrors.push('Unable to extract a Google Drive file ID.');
      return;
    }

    try {
      const file = DriveApp.getFileById(fileId);
      attachments.push(file.getBlob());
      filesToArchive.push(file);
    } catch (error) {
      attachmentErrors.push(
        `Unable to access Drive file ${maskIdentifier(fileId)}: ${error.message}`
      );
    }
  });

  if (attachments.length === 0) {
    const detail = attachmentErrors.length ? ` ${attachmentErrors.join(' ')}` : '';
    throw new Error(`No usable attachment could be retrieved.${detail}`);
  }

  const replaceTags = text => String(text)
    .replace(/{{Company Name}}/g, companyName)
    .replace(/{{Invoice Number}}/g, invoiceNumber)
    .replace(/{{Month Tag}}/g, monthTag);

  const subject = replaceTags(
    templateSheet.getRange(CONFIG.CELLS.EMAIL_SUBJECT).getValue()
  );
  const body = replaceTags(
    templateSheet.getRange(CONFIG.CELLS.EMAIL_BODY).getValue()
  );

  const mailOptions = {
    name: CONFIG.SENDER_NAME,
    attachments: attachments
  };

  if (ccEmail) mailOptions.cc = String(ccEmail);

  GmailApp.sendEmail(clientEmail, subject, body, mailOptions);

  setStatus(mainSheet, rowNumber, CONFIG.STATUS.SENT);
  mainSheet
    .getRange(rowNumber, CONFIG.MAIN_COL.SENT_AT + 1)
    .setValue(
      Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss')
    );

  archiveFiles(mainSheet, filesToArchive, folderTag);
}

function renameFilesOnly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.SHEETS.MAIN);

  if (!mainSheet) {
    SpreadsheetApp.getUi().alert(`Missing sheet: ${CONFIG.SHEETS.MAIN}`);
    return;
  }

  try {
    const sourceFolderId = String(
      mainSheet.getRange(CONFIG.CELLS.SOURCE_FOLDER_ID).getValue()
    ).trim();

    if (!sourceFolderId) throw new Error('Source folder ID is missing.');

    const folder = DriveApp.getFolderById(sourceFolderId);
    const files = folder.getFiles();
    const data = mainSheet.getDataRange().getValues();
    let processedCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      const originalName = file.getName();
      const originalNameLower = originalName.toLowerCase();

      for (let i = 1; i < data.length; i++) {
        const companyName = String(data[i][CONFIG.MAIN_COL.COMPANY_NAME] || '').trim();
        const clientCode = String(data[i][CONFIG.MAIN_COL.CLIENT_CODE] || '').trim();

        if (!companyName && !clientCode) continue;

        const matchesClient =
          (clientCode && originalNameLower.includes(clientCode.toLowerCase())) ||
          (companyName && originalNameLower.includes(companyName.toLowerCase()));

        if (!matchesClient) continue;

        const monthTag = formatMonthTag(data[i][CONFIG.MAIN_COL.MONTH_TAG]);
        const isBreakdown =
          originalNameLower.includes('breakdown') ||
          originalNameLower.includes('break down');

        const typeLabel = isBreakdown ? 'Breakdown' : 'Invoice';
        const extension = originalName.split('.').pop();
        const displayName = companyName || clientCode;
        const newName = `${displayName}_${typeLabel}_${monthTag}.${extension}`;

        file.setName(newName);

        mainSheet
          .getRange(
            i + 1,
            (isBreakdown
              ? CONFIG.MAIN_COL.BREAKDOWN_FILE_URL
              : CONFIG.MAIN_COL.INVOICE_FILE_URL) + 1
          )
          .setValue(file.getUrl());

        processedCount++;
        break;
      }
    }

    SpreadsheetApp.getUi().alert(
      `Rename complete. Processed ${processedCount} file(s).`
    );
  } catch (error) {
    console.error(error.stack || error.message);
    SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
  }
}

function formatMonthTag(raw) {
  if (raw instanceof Date) {
    return Utilities.formatDate(raw, CONFIG.TIMEZONE, 'MM-yyyy');
  }
  return raw || '';
}

function setupTrigger() {
  const handlerFunction = 'checkAndSendScheduled';
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === handlerFunction) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp
    .newTrigger(handlerFunction)
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    'Auto-scheduler configured to check once per hour.'
  );
}

function onEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();

  if (
    sheet.getName() !== CONFIG.SHEETS.MAIN ||
    range.getColumn() !== CONFIG.MAIN_COL.CLIENT_CODE + 1 ||
    range.getRow() <= 1
  ) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const crmSheet = ss.getSheetByName(CONFIG.SHEETS.CRM);
  if (!crmSheet) return;

  const crmData = crmSheet.getDataRange().getValues();
  const crmLookup = buildCrmLookup(crmData);
  const startRow = range.getRow();
  const editValues = range.getValues();

  for (let i = 0; i < editValues.length; i++) {
    const currentRow = startRow + i;
    const rawClientCode = editValues[i][0];
    const clientCode = normalizeKey(rawClientCode);

    if (!clientCode) {
      clearClientFields(sheet, currentRow);
      continue;
    }

    const crmRecord = crmLookup[clientCode];

    if (!crmRecord) {
      sheet
        .getRange(currentRow, CONFIG.MAIN_COL.COMPANY_NAME + 1)
        .setValue(`CRM code not found: ${rawClientCode}`);
      sheet
        .getRange(currentRow, CONFIG.MAIN_COL.CRM_REFERENCE + 1)
        .clearContent();
      sheet
        .getRange(currentRow, CONFIG.MAIN_COL.CLIENT_EMAIL + 1, 1, 2)
        .clearContent();
      continue;
    }

    sheet
      .getRange(currentRow, CONFIG.MAIN_COL.COMPANY_NAME + 1)
      .setValue(crmRecord.companyName);
    sheet
      .getRange(currentRow, CONFIG.MAIN_COL.CRM_REFERENCE + 1)
      .setValue(crmRecord.crmReference);
    sheet
      .getRange(currentRow, CONFIG.MAIN_COL.CLIENT_EMAIL + 1)
      .setValue(crmRecord.clientEmail);
    sheet
      .getRange(currentRow, CONFIG.MAIN_COL.CC_EMAIL + 1)
      .setValue(crmRecord.ccEmail);
  }
}

function buildCrmLookup(crmData) {
  const lookup = {};

  for (let i = 1; i < crmData.length; i++) {
    const clientCode = normalizeKey(crmData[i][CONFIG.CRM_COL.CLIENT_CODE]);
    if (!clientCode) continue;

    lookup[clientCode] = {
      companyName: crmData[i][CONFIG.CRM_COL.COMPANY_NAME] || '',
      clientEmail: crmData[i][CONFIG.CRM_COL.CLIENT_EMAIL] || '',
      ccEmail: crmData[i][CONFIG.CRM_COL.CC_EMAIL] || '',
      crmReference: crmData[i][CONFIG.CRM_COL.CRM_REFERENCE] || ''
    };
  }

  return lookup;
}

function clearClientFields(sheet, rowNumber) {
  sheet
    .getRange(rowNumber, CONFIG.MAIN_COL.COMPANY_NAME + 1)
    .clearContent();
  sheet
    .getRange(rowNumber, CONFIG.MAIN_COL.CRM_REFERENCE + 1)
    .clearContent();
  sheet
    .getRange(rowNumber, CONFIG.MAIN_COL.CLIENT_EMAIL + 1, 1, 2)
    .clearContent();
  sheet
    .getRange(rowNumber, CONFIG.MAIN_COL.STATUS + 1)
    .clearContent();
}

function archiveFiles(mainSheet, files, folderTag) {
  if (!files.length) return;

  const archiveFolderId = String(
    mainSheet.getRange(CONFIG.CELLS.ARCHIVE_FOLDER_ID).getValue()
  ).trim();

  if (!archiveFolderId) return;

  try {
    const parentFolder = DriveApp.getFolderById(archiveFolderId);
    const subFolderName = `Archive_${folderTag}`;
    const matchingFolders = parentFolder.getFoldersByName(subFolderName);
    const targetFolder = matchingFolders.hasNext()
      ? matchingFolders.next()
      : parentFolder.createFolder(subFolderName);

    files.forEach(file => {
      try {
        file.moveTo(targetFolder);
      } catch (error) {
        console.error(`Archive failed for ${file.getName()}: ${error.message}`);
      }
    });
  } catch (error) {
    console.error(`Archive setup failed: ${error.message}`);
  }
}

function extractDriveFileId(url) {
  const match = String(url).match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function setStatus(sheet, rowNumber, status) {
  sheet
    .getRange(rowNumber, CONFIG.MAIN_COL.STATUS + 1)
    .setValue(status);
}

function normalizeKey(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

function maskIdentifier(value) {
  const text = String(value || '');
  if (text.length <= 8) return '***';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}
