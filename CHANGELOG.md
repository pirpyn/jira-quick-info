# Change Log
All notable changes to the "jira-quick-info" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0] 2026-08-24
* Move to CLOUD version of jira : email/PAT needed. Expecting output in adf format
* Added settings for email

## [0.1.7] 2026-07-21
- Automate dependabot to create minor version on dependency change. Last 5 minors where skipped.

## [0.1.2] 2026-02-12
- take correct parent and convert \ to / in paths

## [0.1.1] 2026-02-11
- hotfix to set paths as machine scope and made path exact

## [0.1.0] 2026-02-11
- Added paths where we shouldn't by default activate the extension, unless label is set manually

## [0.0.6] 2025-10-05
- Update axios dependency for security reason

## [0.0.5] 2025-03-04
- Update axios dependency for security reason
- Update esbuild dependency for security reason

## [0.0.4] 2024-08-12
- Change extension kind to "ui" to download images next to the tooltip renderer
- Reload PAT on change of the corresponding option
- Added a new "Output" log tag, to print list of downloaded images and their location on disk
- Fix default issue name from the Workspace folder basename

## [0.0.3] 2024-08-07
- Download thumbnailed images to render them in the tooltip
- Added a command to erase the thumbnails from the disk

## [0.0.2] 2024-07-21
- Added total number of attachments and comments on tooltip
- Renderer a mockup with issue ISSUE-1234

## [0.0.1] 2024-07-15
- Initial release