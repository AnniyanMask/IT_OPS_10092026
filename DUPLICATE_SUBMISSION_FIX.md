# Duplicate Ticket Submission Fix

## What changed
- The Change Request form disables Save/Submit immediately after the first click.
- A client-generated `submissionId` is sent with every new ticket submission.
- PostgreSQL stores the idempotency key and enforces a unique partial index.
- If the same submission is retried because of a slow/lost response, the existing ticket is returned instead of creating a second ticket.
- A concurrent race between two identical POST requests is also handled by the PostgreSQL unique index and server recovery logic.

## PostgreSQL migration for an existing database
Run once:

```sql
ALTER TABLE change_requests
ADD COLUMN IF NOT EXISTS submission_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS change_requests_submission_id_key
ON change_requests(submission_id)
WHERE submission_id IS NOT NULL;
```

Do not add a unique constraint directly to `id` or `title`; legitimate tickets can have the same title.
