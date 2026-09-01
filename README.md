# Google Apps Script Invoice Email Automation

A Google Workspace automation project designed to streamline recurring invoice preparation and email delivery using Google Apps Script, Google Sheets, Gmail, and Google Drive.

> **Portfolio Project**
>
> This repository contains an anonymized portfolio version of a workflow originally developed for a real business process. All company names, client information, email addresses, file identifiers, invoice data, and other operational details shown in this repository are fictional or anonymized. No production data is included.

---

## Overview

Invoice delivery was previously handled through a largely manual workflow: matching invoice files to clients, preparing recipient information, attaching the correct documents, composing emails, sending them individually, and tracking completion.

Before building a custom solution, existing automation options were evaluated. However, the workflow required a combination of operational control, file handling, client-data lookup, flexible sending modes, and integration with the existing Google Workspace environment.

I therefore built a lightweight invoice operations workflow using **Google Apps Script**.

The solution supports:

* invoice file renaming and automatic Google Drive linking
* client information lookup from a CRM reference sheet
* reusable email templates with dynamic placeholders
* invoice and supporting-document attachments
* manual sending of all eligible invoices
* manual sending of selected invoice rows
* scheduled invoice delivery
* validation before sending
* duplicate-send prevention
* send-status and timestamp logging
* post-send file archiving

---

## Business Challenge

The original invoice-delivery process involved several repetitive manual steps.

A typical cycle required the operator to:

1. identify the correct invoice files
2. match files to the correct client
3. confirm recipient and CC email addresses
4. rename and organize invoice documents
5. compose the invoice email
6. attach the correct files
7. send each email
8. track whether an invoice had already been sent
9. archive completed invoice files

This created several operational risks:

* repetitive administrative work
* incorrect recipient information
* missing or incorrect attachments
* inconsistent file naming
* duplicate sends
* missed scheduled invoices
* limited visibility into send status

The objective was not simply to automate Gmail sending. The goal was to build a controlled workflow around the complete invoice-delivery process.

---

## Solution

The workflow uses a Google Sheet as the operational control layer and Google Apps Script as the automation engine.

```text
CRM Reference Data
        │
        ▼
Invoice Control Sheet
        │
        ├── Client information lookup
        ├── Invoice metadata
        ├── File URLs
        ├── Scheduled send time
        └── Send status
        │
        ▼
Google Apps Script
        │
        ├── Validate records
        ├── Rename / link files
        ├── Generate email content
        ├── Retrieve Drive attachments
        ├── Determine sending mode
        └── Send via Gmail
        │
        ▼
Status Logging + Drive Archiving
```

The system intentionally retains manual control where useful while automating repetitive execution.

---

## Core Workflow

### 1. Client Data Lookup

The invoice sheet is connected to a separate CRM reference sheet.

When a client code is entered, an `onEdit()` trigger searches the CRM dataset and automatically fills available client information such as:

* company name
* billing-related information
* recipient email
* CC email

If the client code cannot be found, the row is visibly flagged rather than silently continuing with incomplete data.

This reduces repeated data entry and helps keep invoice preparation aligned with the existing client reference dataset.

---

### 2. Invoice File Preparation

The workflow can scan a designated Google Drive source folder and match uploaded files against invoice records using either:

* client code
* company name

Matched files are renamed using a standardized structure.

Example:

```text
Northstar_Retail_Invoice_08-2026.pdf
Northstar_Retail_Breakdown_08-2026.pdf
```

The corresponding Google Drive URLs are then automatically written back to the invoice control sheet.

This creates a direct link between each operational record and its supporting files.

---

## Sending Modes

### Manual — All Pending

The operator can manually initiate processing of all eligible records that have not already been successfully sent.

Before processing each row, the script checks whether required information is available.

Records that fail validation are skipped and given a status explaining the issue.

---

### Manual — Selected Rows

Checkboxes allow the operator to process only selected records.

This mode is useful for:

* sending a single invoice
* sending a controlled subset
* retrying specific records
* handling exceptions separately from a full batch

After a selected row is successfully processed, its checkbox is automatically cleared.

---

### Scheduled Send

Invoices can also be assigned a scheduled send time.

A time-driven Google Apps Script trigger runs periodically and evaluates invoice records.

Only records whose scheduled time has been reached are eligible for automated delivery.

The scheduler is configured through the spreadsheet menu and currently checks eligible records once per hour.

```text
Scheduled Trigger
      │
      ▼
Check pending records
      │
      ▼
Scheduled time reached?
   │             │
   No           Yes
   │             │
 Skip        Validate row
                 │
                 ▼
              Send email
```

---

## Validation and Send Controls

Before an invoice is sent, the workflow performs several checks.

A record is skipped or flagged when:

* the invoice number is missing
* the recipient email is missing
* no invoice/supporting file is linked
* the invoice has already been marked as successfully sent
* the scheduled send time has not yet been reached

Example status values include:

```text
Sent Success
Skip: No Inv#
Error: No Email
Skip: No File
Error: <runtime error>
```

This validation layer is important because the automation is responsible for external client communication. Records should fail visibly rather than being sent with incomplete information.

---

## Dynamic Email Generation

Email content is maintained separately in an email-template sheet rather than being hard-coded into the sending logic.

The workflow supports reusable placeholders such as:

```text
{{Company Name}}
{{Invoice Number}}
{{Month Tag}}
```

At send time, Apps Script replaces these placeholders with the corresponding invoice-record values.

Example:

```text
Template:

Invoice {{Invoice Number}} — {{Month Tag}}

Dear {{Company Name}},

Please find the attached invoice for {{Month Tag}}.
```

This separates content maintenance from execution logic and allows the email copy to be updated without modifying the core script.

---

## Google Drive Attachment Handling

Invoice and supporting-document URLs are stored in the control sheet.

The script:

1. reads the Google Drive URL
2. extracts the Drive file ID
3. retrieves the file using `DriveApp`
4. converts the file to a Blob
5. adds it to the Gmail attachment array

The workflow supports up to two linked files per invoice record in the current implementation.

If URLs exist but no usable attachment can be retrieved, the send is stopped rather than sending an invoice email without its intended documents.

---

## Duplicate-Send Prevention

Successfully processed records are marked:

```text
Sent Success
```

The processing function checks this value before attempting another send.

Rows already marked as successfully sent are skipped during future batch or scheduled processing.

A timestamp is also recorded after successful delivery to create a lightweight operational audit trail.

---

## Post-Send Archiving

After successful delivery, attached files can be moved from the working folder into a month-specific archive folder.

Example:

```text
Archive_2026-08
Archive_2026-09
```

If the required archive subfolder does not already exist, the script creates it automatically.

This keeps the active invoice workspace separate from completed invoice records.

---

## Spreadsheet Menu

The Apps Script adds a custom menu to the Google Sheet so that operational users do not need to open the script editor.

Example portfolio menu:

```text
Invoice Automation

1. Rename Files & Auto-Link
2. Send All Pending
3. Send Checked Only
4. Start / Update Auto-Scheduler
```

This makes the workflow accessible from the spreadsheet interface while keeping the underlying automation centralized.

---

## Technical Architecture

The project uses:

* **Google Apps Script** — workflow logic and automation
* **Google Sheets** — operational control interface and record tracking
* **Google Drive** — invoice storage and archiving
* **GmailApp** — email delivery
* **Installable Triggers** — scheduled processing
* **Simple Triggers (`onOpen`, `onEdit`)** — UI and CRM lookup behavior

Key Apps Script services include:

```javascript
SpreadsheetApp
DriveApp
GmailApp
ScriptApp
Utilities
```

---

## Key Implementation Concepts

The project demonstrates several automation patterns beyond basic email sending.

### Event-driven automation

`onEdit()` reacts to client-code changes and automatically retrieves reference information.

### Time-driven automation

An installable trigger checks scheduled invoice records every hour.

### Rule-based processing

A shared processing function determines whether each row should be processed based on:

* sending mode
* checkbox state
* existing send status
* required fields
* scheduled time

### Separation of content and logic

Email templates are stored in the spreadsheet instead of directly inside the script.

### File-system integration

Google Drive files are matched, renamed, linked, attached, and archived within the same workflow.

### Lightweight operational logging

Each invoice row stores its current processing result and successful-send timestamp.

---

## Design Decision: Custom Automation vs. Existing Tools

Before implementation, existing automation options were considered.

The final workflow required more than simple scheduled email delivery. It needed to coordinate:

* CRM-based recipient lookup
* invoice-file matching
* standardized file naming
* multiple attachments
* selective sending
* batch sending
* scheduled sending
* duplicate-send controls
* status tracking
* post-send Drive archiving

Because the business process already operated primarily within Google Workspace, Google Apps Script provided a lightweight way to automate the workflow without introducing another standalone operational platform.

The design principle was:

> Automate repetitive execution while preserving human control over exception handling and send decisions.

---

## Outcome

The project converted a repetitive invoice-emailing process into a structured workflow with centralized control, automated validation, and multiple execution modes.

The resulting process reduced the amount of manual work required for routine invoice delivery while improving consistency around:

* file naming
* client-data reuse
* attachment handling
* sending status
* scheduled delivery
* invoice archiving

No numerical time-saving or error-reduction claims are included in this portfolio version because production performance data is not published.

---

## Privacy and Anonymization

This repository is intended strictly as a portfolio demonstration.

The public version does **not** contain production information.

The following information has been removed, replaced, or fictionalized:

* company names
* client names
* client codes
* email addresses
* CC recipients
* invoice numbers
* invoice documents
* billing information
* Google Drive folder IDs
* Google Sheet IDs
* internal folder structures
* production email templates
* operational identifiers

Example portfolio records use fictional entities such as:

```text
CL-001 | Northstar Retail
CL-002 | Blue Harbor Labs
CL-003 | Cedar & Co.
```

Example addresses use reserved/non-production domains such as:

```text
billing@example.com
finance@example.com
```

The public source code preserves the workflow architecture and implementation concepts while removing production-specific configuration and data.

---

## Repository Structure

```text
google-apps-script-invoice-email-automation/
│
├── README.md
│
├── src/
│   ├── Main.gs
│   ├── Sending.gs
│   ├── FileManagement.gs
│   ├── ClientLookup.gs
│   └── Config.gs
│
├── demo/
│   ├── sample-invoice-data.csv
│   └── sample-invoice.pdf
│
├── screenshots/
│   ├── 01-workflow-overview.png
│   ├── 02-invoice-control-sheet.png
│   ├── 03-client-lookup.png
│   ├── 04-selected-send.png
│   ├── 05-scheduled-send.png
│   └── 06-email-output.png
│
└── docs/
    └── privacy-and-anonymization.md
```

---

## Demo Data

All demo records are fictional.

Example:

| Send | Client Code | Company          | Invoice No.  | Recipient                                           | Send Time        | Status       |
| ---- | ----------- | ---------------- | ------------ | --------------------------------------------------- | ---------------- | ------------ |
| ✓    | CL-001      | Northstar Retail | INV-2026-001 | [billing@example.com](mailto:billing@example.com)   | —                | Sent Success |
| ✓    | CL-002      | Blue Harbor Labs | INV-2026-002 | [finance@example.com](mailto:finance@example.com)   | —                | Pending      |
|      | CL-003      | Cedar & Co.      | INV-2026-003 | [accounts@example.com](mailto:accounts@example.com) | 2026-09-05 09:00 | Scheduled    |

---

## Future Improvements

Potential production-oriented enhancements could include:

* centralized configuration objects instead of fixed spreadsheet coordinates
* structured execution logs
* stronger email-address validation
* configurable timezone handling
* improved retry/error-state management
* concurrency protection using `LockService`
* batch-range writes to reduce Spreadsheet API calls
* more explicit archive failure reporting
* automated tests for non-Google-dependent helper functions

These improvements are intentionally separated from the functionality demonstrated by the original workflow.

---

## Disclaimer

This project is presented for portfolio and demonstration purposes.

The repository contains anonymized or reconstructed examples of the workflow and is not intended to expose or reproduce confidential production data.
