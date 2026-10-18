# StudyFlow Calendar Parity — Reference Apps & Findings

## Mission status
Phase 2-3 complete (recon + live-app reverse engineering). Reference-app inspection was constrained by macOS permissions; this document records what WAS observable vs what remains blocked.

## Installed calendar applications (discovered)

| App | Location | Version | Launchable | Scriptable | Calendar UI inspectable | Event data readable |
|-----|----------|---------|------------|------------|-------------------------|---------------------|
| Apple Calendar | /System/Applications/Calendar.app | 15.0 | Yes | Partially (calendars listable) | No — window content not capturable | No — TCC error -1728 |
| Fantastical | /Applications/Fantastical.app | 4.2.2 | Yes | Partially (`version`/`activate` OK) | No — no visible window at capture | No — automation timed out |
| Microsoft Outlook | /Applications/Microsoft Outlook.app | 16.113.2 | Yes | Partially (calendar metadata only) | No — calendar window unreachable | No — TCC error -1728 |
| Notion Calendar | /Applications/Notion Calendar.app | 1.140.0 | Yes | No — no AppleScript dictionary | No — Electron, AX/content hidden | No — no scriptable interface |

### Evidence gathered (read-only, no data modified)
- Apple Calendar: `osascript` lists calendars (Home, Work, Scheduled Reminders, Birthdays, UK Holidays, Siri Suggestions); `current date` = 2026-10-17; window 1 visible at bounds {209,25,1144,623}; event queries return `-1728` (data access denied).
- `screencapture` of Calendar window region and full screen both returned desktop wallpaper — Calendar window content not capturable in this environment.
- Fantastical/Outlook/Notion Calendar: could not reach calendar UI or read events. Notion Calendar window title observed (`Oct 11 – 17, 2026 · Notion Calendar`, 1276×862) but content not accessible.

### Limitation (honestly recorded)
Reference-app **visual UI** and **event semantics** could NOT be observed read-only in this session. Bypassing TCC/Accessibility permissions is prohibited by safety rules. The parity spec below is therefore grounded in StudyFlow's own architecture plus established calendar conventions (day/week/month/agenda views, Monday-first weeks, all-day events, multi-day spans, recurring events, time zones, today indicator, drag/resize, conflict detection), with acceptance criteria that are testable against StudyFlow's own code. Where a requirement cannot be verified against a live reference, it is marked `NOT_VERIFIED` and disclosed.

## Reference specification: `docs/calendar-parity.md`
(see that file for the full spec with weighted acceptance criteria)
