# Attachment UNASSIGNED Folder Fix

New-ticket attachments no longer create an `UNASSIGNED` directory inside the configured IT Storage Repository.

Before a real CR-ID exists, files are staged under the authoritative repository in:
`<repository>\Temp_do_not_delete\<attachment-id>\`.

This keeps staging and final storage on the same filesystem/share, so the final `rename` does not hit Windows `EXDEV` (cross-device link) errors.

After PostgreSQL generates the real CR-ID, the server moves staged files into the final repository partition selected in IT Storage Repository Settings and stores the final physical path in the ticket attachment metadata.

For `DepartmentCode\\CR-ID`, for example:
`<repository>\\QA\\ITO-CR-2026-00001\\file.txt`

No PostgreSQL schema change is required for this fix.

Existing `UNASSIGNED` folders/files created by older versions are not automatically deleted; verify their contents before removing them.
