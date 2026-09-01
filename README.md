# Google Apps Script Invoice Email Automation

A Google Workspace workflow automation project that streamlines recurring invoice preparation and email processing using Google Apps Script, Google Sheets, Google Drive, and Gmail.

> **Portfolio Project**
>
> This repository contains an anonymized portfolio version of a workflow originally developed for a real business process. All client names, email addresses, invoice information, identifiers, file references, and operational data shown in this repository are fictional or anonymized. No production client data is included.

## Overview

The original invoice-delivery workflow involved multiple repetitive manual steps: matching invoice files to clients, retrieving billing contacts, preparing attachments, composing emails, sending invoices, tracking completion, and archiving processed files.

Existing automation options were evaluated, but the workflow required tighter integration with an existing Google Sheets and CRM-based operating process.

I therefore developed a custom Google Apps Script solution that uses the existing spreadsheet as the operational control layer.

The workflow supports:

* CRM-linked client information lookup
* invoice file renaming and automatic Drive linking
* reusable email templates with dynamic placeholders
* invoice and supporting-document attachments
* manual processing of all pending invoices
* manual processing of selected invoice rows
* scheduled invoice processing
* pre-send validation
* duplicate-send prevention
* status and timestamp logging
* post-send file archiving

## Business Challenge

The manual workflow required the operator to repeatedly:

1. identify the correct client
2. retrieve billing contact information
3. locate invoice and breakdown files
4. standardize file names
5. attach the correct documents
6. prepare the invoice email
7. determine when or which invoices should be processed
8. track completed sends
9. organize completed files

This introduced avoidable operational friction and increased the risk of:

* incorrect recipient information
* missing attachments
* inconsistent file naming
* duplicate processing
* missed scheduled invoices
* incomplete status tracking

The objective was therefore not simply to automate email sending, but to create a controlled invoice-processing workflow around the existing Google Workspace environment.

## Solution Architecture

```text
CRM Reference Data
        |
        v
Invoice Control Sheet
        |
        +-- Client information lookup
        +-- Invoice metadata
        +-- File references
        +-- Scheduled processing time
        +-- Processing status
        |
        v
Google Apps Script
        |
        +-- Validate records
        +-- Match and rename files
        +-- Generate email content
        +-- Retrieve Drive attachments
        +-- Determine processing mode
        +-- Send through GmailApp
        |
        v
Status Logging + File Archiving
```

The design intentionally combines automation with operator control instead of forcing every invoice through the same execution path.

## Workflow

### 1. CRM-Linked Invoice Preparation

Entering a client code in the invoice control sheet triggers a lookup against the CRM reference sheet.

Available client information is automatically populated into the invoice record, including:

* company name
* billing email
* CC email
* other required CRM-linked information

If the client code cannot be found, the record is flagged instead of silently continuing with incomplete data.

![CRM-linked invoice setup](screenshots/01-crm-linked-invoice-setup.png)

*CRM-linked invoice preparation using fictional portfolio records.*

### 2. File Rename and Auto-Link

The script scans a designated Google Drive source folder and matches files against invoice records using either the client code or company name.

Matched files are renamed using a standardized naming structure and their Drive URLs are written back to the corresponding invoice row.

Example:

```text
Northstar Retail_Invoice_09-2026.pdf
Northstar Retail_Breakdown_09-2026.pdf
```

![File rename and auto-link](screenshots/02-file-rename-auto-link.png)

*Invoice and breakdown files are matched, renamed, and linked back to the corresponding records.*

## Processing Modes

The workflow provides three operational processing modes.

### Send All Pending

Processes all eligible records that have not already been successfully completed.

### Send Checked Only

Processes only rows selected through spreadsheet checkboxes.

This can be used for:

* a single invoice
* a controlled subset of invoices
* exception handling
* selective retries

### Scheduled Processing

Invoices can include a scheduled processing time.

A time-driven Apps Script trigger periodically checks pending records and processes only those whose scheduled time has been reached.

![Sending controls](screenshots/03-sending-controls.png)

*Spreadsheet-native controls allow operators to process all pending records, selected records, or enable scheduled processing.*

## Validation and Status Handling

Before processing an invoice, the script checks whether the record contains the required information.

Examples include:

* invoice number
* recipient email
* invoice or supporting file
* previous successful-send status
* scheduled processing time

Records that fail validation are skipped and assigned an actionable status.

Example statuses:

```text
Sent Success
Skip: No Inv#
Error: No Email
Skip: No File
Error: <runtime error>
```

Successfully processed records also receive a timestamp.

![Validation and send results](screenshots/04-validation-send-results.png)

*Successful records are logged while incomplete records are skipped with explicit status messages.*

This validation layer is especially important because the workflow ultimately supports external client communication. The automation should fail visibly rather than continue with incomplete invoice data.

## Dynamic Email Template

Email content is stored separately from the main sending logic in an `Email_Template` sheet.

The subject and body support dynamic placeholders such as:

```text
{{Company Name}}
{{Invoice Number}}
{{Month Tag}}
```

At runtime, the script replaces these placeholders with the corresponding invoice-record values before preparing the email.

![Dynamic email template](screenshots/05-email-template.png)

*The email template is maintained separately from the execution logic and populated dynamically at runtime.*

This separation allows email copy to be maintained without modifying the core Apps Script logic.

## Google Drive Attachment Handling

Invoice and supporting-document URLs are stored in the invoice control sheet.

The script:

1. reads each Drive URL
2. extracts the Google Drive file ID
3. retrieves the corresponding file through `DriveApp`
4. converts the file into an attachment Blob
5. adds the document to the Gmail attachment list

The current implementation supports up to two linked files per invoice record.

If the record contains file references but no usable attachment can be retrieved, processing is stopped rather than continuing without the intended documents.

## Duplicate-Processing Prevention

Successfully completed records are marked:

```text
Sent Success
```

Future manual or scheduled processing checks this status and skips records that have already been completed.

A processing timestamp is also written back to the spreadsheet to provide lightweight operational traceability.

## Post-Processing File Archiving

After successful processing, related invoice files can be moved into month-specific archive folders.

Example:

```text
Archive_2026-08
Archive_2026-09
```

If the required archive folder does not yet exist, the script creates it automatically.

This separates active invoice documents from completed records.

## Spreadsheet Interface

The Apps Script adds a custom menu directly to Google Sheets.

```text
Invoice Sending Tools

1. Rename Files & Auto-Link
2. Send All Pending (Manual)
3. Send Checked Only (Manual)
4. Start/Update Auto-Scheduler
```

This allows operational users to execute the workflow without opening the Apps Script editor.

## Technology Stack

* Google Apps Script
* Google Sheets
* Google Drive
* GmailApp
* SpreadsheetApp
* DriveApp
* ScriptApp
* Utilities
* Google Apps Script triggers

## Key Implementation Patterns

### Event-Driven Lookup

`onEdit()` reacts to client-code changes and retrieves matching information from the CRM reference data.

### Shared Row Processor

Manual and scheduled workflows use a common row-processing function rather than maintaining separate implementations for each processing mode.

### Time-Driven Automation

An installable trigger runs the scheduled-processing entry point periodically.

### Template-Driven Content

Email content is maintained separately from execution logic and populated through placeholders.

### File-System Integration

Google Drive is used for file matching, renaming, linking, attachment retrieval, and archiving.

### Row-Level Operational Logging

Each invoice record stores its processing status and completion timestamp.

## Build vs. Buy Decision

Before building the custom workflow, existing automation options were considered.

The required process involved more than scheduled email delivery. It needed to coordinate:

* CRM-based client lookup
* existing Google Sheets workflows
* file matching
* standardized naming
* multiple attachments
* selective processing
* batch processing
* scheduled processing
* validation
* status tracking
* Drive archiving

Because the operating process already lived primarily inside Google Workspace, Apps Script provided a lightweight way to automate the workflow without introducing an additional standalone platform.

The design principle was:

> Automate repetitive execution while preserving human control over exceptions and processing decisions.

## Outcome

The project transformed a repetitive invoice-email workflow into a structured Google Workspace process with centralized control, automated validation, and multiple execution modes.

The resulting workflow improved consistency around:

* client-data reuse
* invoice preparation
* file naming
* attachment handling
* processing status
* scheduled execution
* post-processing organization

No numerical time-saving or error-reduction claims are included because production performance data is not published in this portfolio repository.

## Privacy and Anonymization

This repository is intended strictly for portfolio demonstration.

The public version does not contain production client information.

The following information has been removed, replaced, or fictionalized:

* company and client names
* client codes
* recipient addresses
* CC addresses
* invoice numbers
* financial information
* invoice documents
* Google Drive identifiers
* internal folder identifiers
* production email content
* other operational identifiers

Example portfolio entities include:

```text
CLIENT_A | Northstar Retail
CLIENT_B | Blue Harbor Labs
CLIENT_C | Cedar & Co.
CLIENT_D | Summit Property Group
```

Example addresses use non-production values such as:

```text
billing@example.com
finance@example.com
```

The public source code preserves the workflow architecture and implementation concepts while removing production-specific data and configuration.

## Repository Structure

```text
google-apps-script-invoice-email-automation/
├── README.md
├── src/
│   └── invoice-email-automation.gs
├── screenshots/
│   ├── 01-crm-linked-invoice-setup.png
│   ├── 02-file-rename-auto-link.png
│   ├── 03-sending-controls.png
│   ├── 04-validation-send-results.png
│   └── 05-email-template.png
├── docs/
│   └── privacy-and-anonymization.md
├── .gitignore
└── LICENSE
```

## Future Improvements

Potential enhancements include:

* replacing column index values with named configuration constants
* centralized configuration management
* structured execution logs
* stronger email-address validation
* configurable timezone handling
* improved retry and error-state management
* `LockService` protection against overlapping executions
* batch spreadsheet writes for improved performance
* more explicit archive-failure reporting
* automated testing for pure helper functions

These are presented as potential improvements rather than functionality claimed by the current implementation.

## Disclaimer

This project is presented for portfolio and demonstration purposes.

All screenshots, records, names, email addresses, invoice references, and sample content are fictional or anonymized. No production client data is included.
