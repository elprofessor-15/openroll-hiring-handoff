# Verification

Verified locally on October 28, 2026, using Node 24 and Google Chrome.

## Engine and build

- `npm test`: 16 tests passed.
- `npm run build`: passed.
- Local HTTP preview returned 200.
- Tested one row per approved position, duplicate-source retention in the raw view, explicit draft assumptions, and frozen-position exclusion.
- Independently calculated November reviewed forecast: 4,032,000 cents, plan 4,280,000 cents, variance -248,000 cents.
- Budget variance drivers: +40,000 cents for POS-101 and -288,000 cents for POS-104.
- Source bridge reconciled exactly in November, December, and January, with zero unexplained residual.
- Tested inclusive start days, partial FTE, leap-month denominator, last-day starts, future starts, and separate rounding of base and load.
- Tested permitted source choices, owner/note validation, source-snapshot invalidation, and packet export rejection while exceptions remain unresolved.
- Tested identity mismatches, multiple ATS records, duplicate vacancy assignment rejection, invalid data, and quoted CSV output with explicit cents units.

## Browser workflows

- Opened the draft packet and verified export was disabled.
- Recorded the duplicate-source HRIS choice and verified 1/4 exceptions reviewed.
- Selected the ATS start date for POS-102; preview changed the working November forecast from $36,000 to $43,200 before recording the choice.
- Recorded frozen-position exclusion and explicitly linked ATS-404 to vacant POS-104.
- Verified 4/4 reviewed, November forecast $40,320, and packet export enabled.
- Reloaded and verified all source decisions persisted.
- Reopened an exception and verified the state returned to 3/4 reviewed; recorded it again.
- Phone at 390 x 844: review and bridge document widths both equaled 390 px; source dialog width 360 px. Escape dismissed the source dialog.
- Tablet at 768 x 1024: bridge document width equaled 768 px.
- Three actual local screenshots are included, showing reconciliation, start-date preview, and the reviewed forecast bridge.

Export content is generated and checked in under examples/. Completed browser downloads on disk are not independently verified. No live Openroll connection, actual HR or payroll write, production-grade access control, real-world cost saving, or performance-at-scale claim is made.
