-- ==============================================================================
-- TANAKA PCS ENTERPRISE DATABASE SCHEMA & PASSWORD POLICY COMPLIANCE
-- System: Tanaka Precision Change Management System (PCS CRMS)
-- Database Target: PostgreSQL 14+ / MySQL 8.0+ Compatible
-- Description: Core Schema with Enterprise Password Policy Compliance (10+ chars,
--              Uppercase, Number, Special Character), Account Approval Workflow,
--              Department Routing, Verification OTPs, and Audit Logs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEQUENCES & AUTO-INCREMENT IDENTIFIERS
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1 INCREMENT 1;

-- Generates zero-padded, year-scoped User IDs (e.g., USR-2026-0001, USR-2026-8739)
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_val BIGINT;
    year_str VARCHAR(4);
    formatted_id VARCHAR(50);
BEGIN
    next_val := nextval('user_id_seq');
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    formatted_id := 'USR-' || year_str || '-' || LPAD(next_val::TEXT, 4, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS change_request_id_seq START 1 INCREMENT 1;

-- Generates zero-padded, year-scoped Change Request IDs (e.g., ITO-CR-2026-00001, ITO-CR-2026-00002)
CREATE OR REPLACE FUNCTION generate_change_request_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_val BIGINT;
    year_str VARCHAR(4);
    formatted_id VARCHAR(50);
BEGIN
    next_val := nextval('change_request_id_seq');
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    formatted_id := 'ITO-CR-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. DEPARTMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    hod_user_id VARCHAR(50),
    hod_name VARCHAR(150) NOT NULL,
    hod_email VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. USERS TABLE (With Enterprise Password Policy & IT Approval Workflow)
-- ------------------------------------------------------------------------------
-- Enterprise Password Policy Rules:
-- 1. Length >= 10 characters
-- 2. At least one uppercase letter [A-Z]
-- 3. At least one number [0-9]
-- 4. At least one special character [!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_user_id(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL, -- Hashed password (e.g. bcrypt/Argon2)
    department_id INTEGER NOT NULL REFERENCES departments(id) ON UPDATE CASCADE,
    role VARCHAR(100) NOT NULL DEFAULT 'Requester',
    status VARCHAR(50) NOT NULL DEFAULT 'Pending IT Approval' CHECK (status IN ('Active', 'Pending IT Approval', 'Suspended')),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    password_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. PASSWORD RESET TOKENS & OTP VERIFICATION TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    otp_code VARCHAR(10) NOT NULL, -- 6-Digit Secure Verification OTP
    reset_token_hash VARCHAR(255),  -- Optional secure hash for link verification
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast token & email lookups
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_otp ON password_reset_tokens(email, otp_code, is_used);

-- ------------------------------------------------------------------------------
-- 4. PASSWORD HISTORY / AUDIT LOG TABLE
-- Enforces password rotation policy & maintains audit compliance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_change_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('Self-Reset', 'Self-Update', 'Admin-Urgent-Reset', 'Initial-Setup')),
    ip_address VARCHAR(50),
    user_agent TEXT,
    policy_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- ------------------------------------------------------------------------------
-- 5. CHANGE REQUESTS TABLE (With IT Direct Classification & Priority Controls)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_requests (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_change_request_id(),
    title VARCHAR(255) NOT NULL,
    submission_id VARCHAR(100), -- Client-generated idempotency key; prevents duplicate ticket creation on retries
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('Bug Fix', 'Enhancement', 'New Feature', 'Data Amendment', 'Incident', 'Service Request', 'Access Request', 'Information / How-To', 'Password / Account', 'Change Request')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    sla_target_hours INTEGER NOT NULL DEFAULT 168, -- Critical=24h, High=72h (3d), Medium=168h (7d), Low=336h (14d)
    priority_change_reason TEXT,              -- IT Reason for adjusting priority (Required when IT changes priority)
    priority_changed_by VARCHAR(150),         -- IT Staff name who modified priority
    priority_changed_at TIMESTAMP WITH TIME ZONE, -- Timestamp when priority was modified
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'Draft',
        'Submitted',
        'Pending HOD Approval',
        'Returned to Requester',
        'Pending IT Admin Review',
        'In Progress',
        'Pending IT Verification',
        'Closed (Completed)',
        'Closed (Rejected)'
    )),
    requester_id VARCHAR(50) NOT NULL REFERENCES users(id),
    requester_name VARCHAR(150) NOT NULL,
    requester_email VARCHAR(150) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    department_name VARCHAR(150) NOT NULL,
    target_hod_user_id VARCHAR(50),
    target_hod_name VARCHAR(150),
    target_hod_email VARCHAR(150),
    hod_approval_skipped BOOLEAN NOT NULL DEFAULT FALSE,
    hod_skip_reason TEXT,
    hod_approved_at TIMESTAMP WITH TIME ZONE,
    hod_approved_by VARCHAR(150),
    returned_by_role VARCHAR(50),             -- Role that returned ticket (e.g. 'Department HOD', 'IT Admin')
    it_clarification_requested BOOLEAN NOT NULL DEFAULT FALSE,
    -- Service Catalog Classification (Tier 1-3)
    category_id VARCHAR(50),
    category_name VARCHAR(150),
    service_id VARCHAR(50),
    service_name VARCHAR(150),
    application_asset_id VARCHAR(50),
    application_name VARCHAR(150),
    asset_tag VARCHAR(50),
    issue_type_id VARCHAR(50),
    issue_type_name VARCHAR(150),
    category_changed_by VARCHAR(150),
    category_changed_at TIMESTAMP WITH TIME ZONE,
    -- Detailed Descriptions & Scope
    affected_modules JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    application_areas JSONB DEFAULT '[]'::jsonb,
    revision_history JSONB DEFAULT '[]'::jsonb,
    current_behavior_description TEXT,
    requested_change_description TEXT,
    business_justification TEXT,
    requested_completion_date DATE,
    -- Legacy Module Fallback
    pcs_module VARCHAR(100) NOT NULL DEFAULT 'General',
    pcs_sub_module VARCHAR(100),
    pcs_sub_section VARCHAR(100),
    issue_description TEXT,
    business_impact TEXT,
    hod_decision VARCHAR(50),
    hod_review_notes TEXT,
    hod_reviewed_at TIMESTAMP WITH TIME ZONE,
    -- IT Assignment & Execution
    it_assigned_developer_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    it_assigned_developer_name VARCHAR(150),
    reassigned_by VARCHAR(150),
    reassigned_at TIMESTAMP WITH TIME ZONE,
    it_admin_review_notes TEXT,
    it_target_completion_date DATE,
    -- Developer Technical Assessment & Implementation Details (Full-Screen Studio Diff)
    implementation_notes TEXT,                     -- Developer testing, test cases, and verification notes
    has_code_or_database_changes BOOLEAN NOT NULL DEFAULT TRUE, -- Indicates if code/DB changes occurred
    before_change_details TEXT,                    -- Baseline code / DB state before modification ([-] BEFORE)
    after_change_details TEXT,                     -- Updated code / DB migration script applied ([+] AFTER)
    requires_schema_change BOOLEAN NOT NULL DEFAULT FALSE,      -- Production PostgreSQL migration required
    requires_downtime_window BOOLEAN NOT NULL DEFAULT FALSE,    -- System downtime maintenance window required
    risk_level VARCHAR(20) DEFAULT 'Low' CHECK (risk_level IN ('Low', 'Medium', 'High', 'Severe')),
    risk_score INTEGER DEFAULT 25,
    actual_completion_date DATE,                   -- Date when technical implementation was completed
    -- Rejection & Reopen Workflow Tracking (IT Admin, System Admin, IT Staff, Developer, HOD)
    rejected_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    rejected_by_name VARCHAR(150),
    rejected_by_role VARCHAR(50),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    reopened_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    reopened_by_name VARCHAR(150),
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopen_comments TEXT,
    -- Waiting on Requester SLA Clock Pause & 3-Stage Chase Policy (Strike 1, 2, 3) & Auto-Closure
    sla_paused_at TIMESTAMP WITH TIME ZONE,
    total_sla_paused_hours INTEGER DEFAULT 0,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
    last_reminder_stage INTEGER,
    auto_closure_warned_at TIMESTAMP WITH TIME ZONE,
    is_auto_closed_inactive BOOLEAN DEFAULT FALSE,
    withdrawn_at TIMESTAMP WITH TIME ZONE,
    withdrawn_reason TEXT,
    -- Workload Scoring (Critical=4, High=3, Medium=2, Low=1)
    workload_points INTEGER GENERATED ALWAYS AS (
        CASE priority
            WHEN 'Critical' THEN 4
            WHEN 'High' THEN 3
            WHEN 'Medium' THEN 2
            WHEN 'Low' THEN 1
            ELSE 1
        END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cr_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_cr_priority ON change_requests(priority);
CREATE INDEX IF NOT EXISTS idx_cr_requester ON change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_cr_dept ON change_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_cr_dev ON change_requests(it_assigned_developer_id);

-- Ensure JSONB columns exist and are converted from legacy ARRAY if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'change_requests' AND column_name = 'affected_modules' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE change_requests ALTER COLUMN affected_modules DROP DEFAULT;
        ALTER TABLE change_requests ALTER COLUMN affected_modules TYPE JSONB USING to_jsonb(affected_modules);
        ALTER TABLE change_requests ALTER COLUMN affected_modules SET DEFAULT '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'change_requests' AND column_name = 'attachments' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE change_requests ALTER COLUMN attachments DROP DEFAULT;
        ALTER TABLE change_requests ALTER COLUMN attachments TYPE JSONB USING to_jsonb(attachments);
        ALTER TABLE change_requests ALTER COLUMN attachments SET DEFAULT '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'change_requests' AND column_name = 'application_areas' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE change_requests ALTER COLUMN application_areas DROP DEFAULT;
        ALTER TABLE change_requests ALTER COLUMN application_areas TYPE JSONB USING to_jsonb(application_areas);
        ALTER TABLE change_requests ALTER COLUMN application_areas SET DEFAULT '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'change_requests' AND column_name = 'revision_history' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE change_requests ALTER COLUMN revision_history DROP DEFAULT;
        ALTER TABLE change_requests ALTER COLUMN revision_history TYPE JSONB USING to_jsonb(revision_history);
        ALTER TABLE change_requests ALTER COLUMN revision_history SET DEFAULT '[]'::jsonb;
    END IF;
END $$;

ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS affected_modules JSONB DEFAULT '[]'::jsonb;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS application_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS total_sla_paused_hours INTEGER DEFAULT 0;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS last_reminder_stage INTEGER;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS auto_closure_warned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS is_auto_closed_inactive BOOLEAN DEFAULT FALSE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;


-- Idempotency protection for repeated/double-submitted tickets
CREATE UNIQUE INDEX IF NOT EXISTS change_requests_submission_id_key
    ON change_requests(submission_id) WHERE submission_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 6. CHANGE REQUEST APPROVAL & STATUS AUDIT HISTORY TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_request_approval_history (
    id SERIAL PRIMARY KEY,
    change_request_id VARCHAR(50) NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    actor_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    comments TEXT
);

CREATE INDEX IF NOT EXISTS idx_cr_appr_hist_crid ON change_request_approval_history(change_request_id);
CREATE INDEX IF NOT EXISTS idx_cr_appr_hist_actor ON change_request_approval_history(actor_user_id);

-- Backward compatibility view alias
CREATE OR REPLACE VIEW approval_history AS
SELECT * FROM change_request_approval_history;

-- ------------------------------------------------------------------------------
-- 7. EMAIL NOTIFICATION OUTBOX LOGS & EMAIL TEMPLATES TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_notification_logs (
    id VARCHAR(100) PRIMARY KEY,
    change_request_id VARCHAR(50) REFERENCES change_requests(id) ON DELETE SET NULL,
    recipient_email VARCHAR(150) NOT NULL,
    recipient_name VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    trigger_event VARCHAR(150) NOT NULL,
    smtp_server VARCHAR(150) NOT NULL,
    smtp_port INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED (250 OK)',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_crid ON email_notification_logs(change_request_id);

-- Backward compatibility view alias
CREATE OR REPLACE VIEW email_notifications AS
SELECT * FROM email_notification_logs;

CREATE TABLE IF NOT EXISTS email_templates (
    id VARCHAR(100) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    event_name VARCHAR(150) NOT NULL,
    description TEXT,
    subject_template VARCHAR(255) NOT NULL,
    recipient_description VARCHAR(255),
    variables JSONB DEFAULT '[]'::jsonb,
    body_html TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(150)
);

INSERT INTO email_templates (id, category, event_name, description, subject_template, recipient_description, variables, body_html, enabled, updated_by)
VALUES
(
    'tpl-cr-created-hod',
    'CR Workflow',
    'CR Created (Pending HOD Approval)',
    'Dispatched to the Department HOD when an employee submits a new Change Request.',
    '[ACTION REQUIRED] New Change Request {{crId}}: {{title}} (Pending HOD Approval)',
    'Department HOD',
    '["{{crId}}", "{{title}}", "{{requesterName}}", "{{departmentName}}", "{{priority}}", "{{createdDate}}"]'::jsonb,
    '<p>Dear <strong>{{hodName}}</strong>,</p><p>A new Change Request has been submitted by <strong>{{requesterName}}</strong> from <strong>{{departmentName}}</strong>.</p><ul><li><strong>Ticket ID:</strong> {{crId}}</li><li><strong>Title:</strong> {{title}}</li><li><strong>Priority:</strong> {{priority}}</li><li><strong>Submission Date:</strong> {{createdDate}}</li></ul><p>Please log in to Tanaka Precision CRMS to review, endorse, or return this request.</p>',
    TRUE,
    'System Administrator'
),
(
    'tpl-hod-approved-it',
    'CR Workflow',
    'HOD Approved (Routing to IT Admin)',
    'Dispatched to IT Operations when the Department HOD endorses a Change Request.',
    '[IT OPS] {{crId}}: Endorsed by HOD {{hodName}} - Ready for IT Triage',
    'IT Administrators',
    '["{{crId}}", "{{title}}", "{{requesterName}}", "{{departmentName}}", "{{hodName}}", "{{priority}}"]'::jsonb,
    '<p>Dear IT Operations,</p><p>Change Request <strong>{{crId}}</strong> has been approved and endorsed by <strong>{{hodName}}</strong> ({{departmentName}}).</p><ul><li><strong>CR Title:</strong> {{title}}</li><li><strong>Requester:</strong> {{requesterName}}</li><li><strong>Priority:</strong> {{priority}}</li></ul><p>Please assign an IT Software Developer to initiate technical implementation.</p>',
    TRUE,
    'System Administrator'
),
(
    'tpl-pwd-reset-otp',
    'Security & Auth',
    'Password Reset OTP Verification',
    'Dispatched to user when requesting self-service password reset.',
    '[IT OPS SECURITY] Your 6-Digit Password Reset OTP: {{otpCode}}',
    'Requesting User',
    '["{{fullName}}", "{{otpCode}}", "{{expiresMinutes}}", "{{requestedTime}}"]'::jsonb,
    '<p>Dear <strong>{{fullName}}</strong>,</p><p>You have requested a secure password reset for your Tanaka Precision PCS account.</p><div style="padding:16px;background:#f1f5f9;font-size:24px;font-weight:bold;letter-spacing:4px;color:#0f172a;text-align:center;">{{otpCode}}</div><p>This code will expire in {{expiresMinutes}} minutes. Do not share this OTP with anyone.</p>',
    TRUE,
    'System Administrator'
)
ON CONFLICT (id) DO UPDATE SET
    event_name = EXCLUDED.event_name,
    description = EXCLUDED.description,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html,
    variables = EXCLUDED.variables,
    updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------------------
-- 8. STORED FUNCTION: VERIFY ENTERPRISE PASSWORD POLICY COMPLIANCE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_enterprise_password_policy(plain_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Rule 1: At least 10 characters in length
    IF LENGTH(plain_password) < 10 THEN
        RAISE EXCEPTION 'Password policy violation: Password must be at least 10 characters in length.';
    END IF;

    -- Rule 2: At least one uppercase letter (A-Z)
    IF plain_password !~ '[A-Z]' THEN
        RAISE EXCEPTION 'Password policy violation: Password must contain at least one uppercase letter (A-Z).';
    END IF;

    -- Rule 3: At least one number (0-9)
    IF plain_password !~ '[0-9]' THEN
        RAISE EXCEPTION 'Password policy violation: Password must contain at least one numeric digit (0-9).';
    END IF;

    -- Rule 4: At least one special character (!@#$%^&* etc.)
    IF plain_password !~ '[!@#$%^&*()_+\-=\[\]{};'':"\\|,.<>\/?~`]' THEN
        RAISE EXCEPTION 'Password policy violation: Password must contain at least one special character (!@#$%%^&* etc.).';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. INITIAL SEED DATA
-- ------------------------------------------------------------------------------
-- Intentionally empty.
-- Departments and users are NOT seeded automatically. They must be created
-- through the application/administration workflow or explicitly by the DBA.
--
-- ------------------------------------------------------------------------------
-- 9. ENTERPRISE STORAGE VAULT CONFIGURATION TABLE (IT & Admin Managed)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_vault_configs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    storage_type VARCHAR(50) NOT NULL CHECK (storage_type IN ('UNC_NETWORK_SHARE', 'LOCAL_DIRECTORY', 'ENTERPRISE_SAN_NAS', 'ENCRYPTED_CLOUD_VAULT')),
    storage_location_path TEXT NOT NULL, -- Physical UNC / File System path e.g. \\tanaka-nas01.corp.internal\PCS_Attachments\prod_vault\
    backup_location_path TEXT,
    subfolder_pattern VARCHAR(50) NOT NULL DEFAULT 'YEAR_MONTH_CRID' CHECK (subfolder_pattern IN ('YEAR_MONTH_CRID', 'YEAR_MONTH', 'DEPARTMENT_CRID', 'FLAT')),
    max_file_size_mb INTEGER NOT NULL DEFAULT 25,
    allowed_extensions TEXT[] NOT NULL DEFAULT ARRAY['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx', '.docx', '.txt', '.zip', '.log'],
    encryption_at_rest BOOLEAN NOT NULL DEFAULT TRUE,
    last_tested_status VARCHAR(50) DEFAULT 'HEALTHY',
    last_tested_at TIMESTAMP WITH TIME ZONE,
    updated_by VARCHAR(150),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- No default storage path is seeded.
-- The System Admin must configure the authoritative repository path in the UI.
--
-- ------------------------------------------------------------------------------
-- 10. CHANGE REQUEST ATTACHMENTS & PRIVACY ISOLATION VIEW
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_request_attachments (
    id VARCHAR(50) PRIMARY KEY,
    change_request_id VARCHAR(50) NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_kb INTEGER NOT NULL,
    stored_path TEXT NOT NULL, -- Physical Server UNC Path (Masked from Requesters / HODs)
    storage_vault_id VARCHAR(50) REFERENCES storage_vault_configs(id),
    file_checksum VARCHAR(128) NOT NULL,
    encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    uploaded_by VARCHAR(150) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_att_cr_id ON change_request_attachments(change_request_id);

-- ------------------------------------------------------------------------------
-- 11. SECURITY MASKING VIEW: PUBLIC USER ATTACHMENTS VIEW
-- End users (Requesters, HODs, Developers) query this view.
-- The sensitive physical UNC 'stored_path' is masked as NULL/Obfuscated.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_user_safe_attachments AS
SELECT 
    id,
    change_request_id,
    file_name,
    file_type,
    file_size_kb,
    '🔒 Tanaka Enterprise Vault (Encrypted & Masked)' AS storage_status,
    uploaded_by,
    uploaded_at
FROM change_request_attachments;

-- ------------------------------------------------------------------------------
-- 12. IT SERVICE CATALOG & ISSUE TYPES TABLES
-- ------------------------------------------------------------------------------

-- Master Categories (Level 1)
CREATE TABLE IF NOT EXISTS service_categories (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    icon_name VARCHAR(50) DEFAULT 'Folder',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master Services (Level 2)
CREATE TABLE IF NOT EXISTS service_catalog (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
    category_name VARCHAR(150),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_asset_based BOOLEAN DEFAULT FALSE,
    sla_response_hours INTEGER DEFAULT 4,
    sla_resolution_hours INTEGER DEFAULT 24,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master Application / Assets (Level 3)
CREATE TABLE IF NOT EXISTS application_assets (
    id VARCHAR(50) PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    service_name VARCHAR(150),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    asset_tag VARCHAR(50),
    type VARCHAR(50) DEFAULT 'Application',
    serial_number VARCHAR(100),
    location VARCHAR(150),
    assigned_user_id VARCHAR(50),
    assigned_user_name VARCHAR(150),
    description TEXT,
    has_application_area BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master Issue Types (Configurable Incident / Request Classifications)
CREATE TABLE IF NOT EXISTS issue_types (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    badge_color VARCHAR(100) NOT NULL DEFAULT 'bg-rose-50 text-rose-700 border-rose-200',
    default_priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (default_priority IN ('Low', 'Medium', 'High', 'Critical')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3-Tier Technical Breakdown: Application Modules (Tier 1)
CREATE TABLE IF NOT EXISTS application_modules (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES application_assets(id) ON DELETE CASCADE,
    application_name VARCHAR(150),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    lead_developer VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, code)
);

-- 3-Tier Technical Breakdown: Application Sub-Functions (Tier 2)
CREATE TABLE IF NOT EXISTS application_subfunctions (
    id VARCHAR(50) PRIMARY KEY,
    module_id VARCHAR(50) NOT NULL REFERENCES application_modules(id) ON DELETE CASCADE,
    module_code VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, code)
);

-- 3-Tier Technical Breakdown: Application Processes / Functions (Tier 3)
CREATE TABLE IF NOT EXISTS application_processes (
    id VARCHAR(50) PRIMARY KEY,
    subfunction_id VARCHAR(50) NOT NULL REFERENCES application_subfunctions(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subfunction_id, code)
);

-- ------------------------------------------------------------------------------
-- 13-14. MASTER CATALOG INITIAL DATA
-- ------------------------------------------------------------------------------
-- Intentionally empty. Master categories, services, assets, issue types,
-- modules, sub-functions and processes are managed through the UI/DB.
--
-- ------------------------------------------------------------------------------
-- 15. IT DIRECT CLASSIFICATION & PRIORITY AUDIT LOG TABLE
-- Maintains complete immutable audit of all category changes, priority adjustments,
-- and developer reassignments performed by IT staff without approval flows.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_request_it_modifications (
    id SERIAL PRIMARY KEY,
    change_request_id VARCHAR(50) NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    actor_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL CHECK (actor_role IN ('IT Admin', 'Software Developer', 'System Admin')),
    previous_category VARCHAR(150),
    new_category VARCHAR(150),
    previous_subcategory VARCHAR(150),
    new_subcategory VARCHAR(150),
    previous_application VARCHAR(150),
    new_application VARCHAR(150),
    previous_issue_type VARCHAR(150),
    new_issue_type VARCHAR(150),
    previous_priority VARCHAR(20) NOT NULL,
    new_priority VARCHAR(20) NOT NULL,
    priority_change_reason TEXT, -- Mandatory explanation when priority is altered
    previous_developer_id VARCHAR(50),
    new_developer_id VARCHAR(50),
    previous_developer_name VARCHAR(150),
    new_developer_name VARCHAR(150),
    target_completion_date DATE,
    technical_remarks TEXT,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE, -- Explicitly FALSE (Direct IT Execution)
    requester_notified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_it_mod_crid ON change_request_it_modifications(change_request_id);
CREATE INDEX IF NOT EXISTS idx_it_mod_actor ON change_request_it_modifications(actor_user_id);

-- ------------------------------------------------------------------------------
-- 16. STORED PROCEDURE: IT DIRECT RECLASSIFY & RE-PRIORITIZE (NO APPROVAL REQUIRED)
-- Executes immediate classification, priority change (with mandatory reason and automatic SLA adjustment),
-- developer reassignment, and logs the change to immutable audit tables.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_it_direct_reclassify_and_reprioritize(
    p_change_request_id VARCHAR(50),
    p_actor_user_id VARCHAR(50),
    p_actor_name VARCHAR(150),
    p_actor_role VARCHAR(50),
    p_new_category_id VARCHAR(50),
    p_new_category_name VARCHAR(150),
    p_new_service_id VARCHAR(50),
    p_new_service_name VARCHAR(150),
    p_new_app_asset_id VARCHAR(50),
    p_new_app_name VARCHAR(150),
    p_new_issue_type_id VARCHAR(50),
    p_new_issue_type_name VARCHAR(150),
    p_new_priority VARCHAR(20),
    p_priority_change_reason TEXT,
    p_new_developer_id VARCHAR(50),
    p_new_developer_name VARCHAR(150),
    p_target_completion_date DATE,
    p_technical_remarks TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_cr RECORD;
    v_priority_changed BOOLEAN := FALSE;
    v_category_changed BOOLEAN := FALSE;
    v_reassigned BOOLEAN := FALSE;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_new_sla_hours INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Validate Actor is IT Staff
    IF p_actor_role NOT IN ('IT Admin', 'Software Developer', 'System Admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only IT Staff can execute direct classification and priority modifications.';
    END IF;

    -- 2. Fetch existing Change Request
    SELECT * INTO v_cr FROM change_requests WHERE id = p_change_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Change request % not found.', p_change_request_id;
    END IF;

    -- 3. Check for Priority Change and Enforce Reason Requirement
    IF p_new_priority IS NOT NULL AND p_new_priority <> v_cr.priority THEN
        v_priority_changed := TRUE;
        IF p_priority_change_reason IS NULL OR TRIM(p_priority_change_reason) = '' THEN
            RAISE EXCEPTION 'Validation error: A detailed reason for priority change is required when modifying priority.';
        END IF;
    END IF;

    IF (p_new_category_name IS NOT NULL AND p_new_category_name <> COALESCE(v_cr.category_name, '')) OR
       (p_new_service_name IS NOT NULL AND p_new_service_name <> COALESCE(v_cr.service_name, '')) THEN
        v_category_changed := TRUE;
    END IF;

    IF p_new_developer_id IS NOT NULL AND p_new_developer_id <> COALESCE(v_cr.it_assigned_developer_id, '') THEN
        v_reassigned := TRUE;
    END IF;

    -- Compute updated SLA target hours based on priority matrix:
    -- Critical: 24h, High: 72h (3 days), Medium: 168h (7 days), Low: 336h (14 days)
    v_new_sla_hours := CASE COALESCE(p_new_priority, v_cr.priority)
        WHEN 'Critical' THEN 24
        WHEN 'High' THEN 72
        WHEN 'Medium' THEN 168
        WHEN 'Low' THEN 336
        ELSE 168
    END;

    -- 4. Directly Update the Change Request without resetting approval state
    UPDATE change_requests
    SET
        category_id = COALESCE(p_new_category_id, category_id),
        category_name = COALESCE(p_new_category_name, category_name),
        service_id = COALESCE(p_new_service_id, service_id),
        service_name = COALESCE(p_new_service_name, service_name),
        application_asset_id = COALESCE(p_new_app_asset_id, application_asset_id),
        application_name = COALESCE(p_new_app_name, application_name),
        issue_type_id = COALESCE(p_new_issue_type_id, issue_type_id),
        issue_type_name = COALESCE(p_new_issue_type_name, issue_type_name),
        category_changed_by = CASE WHEN v_category_changed THEN p_actor_name ELSE category_changed_by END,
        category_changed_at = CASE WHEN v_category_changed THEN v_now ELSE category_changed_at END,
        priority = COALESCE(p_new_priority, priority),
        sla_target_hours = v_new_sla_hours,
        priority_change_reason = CASE WHEN v_priority_changed THEN p_priority_change_reason ELSE priority_change_reason END,
        priority_changed_by = CASE WHEN v_priority_changed THEN p_actor_name ELSE priority_changed_by END,
        priority_changed_at = CASE WHEN v_priority_changed THEN v_now ELSE priority_changed_at END,
        it_assigned_developer_id = COALESCE(p_new_developer_id, it_assigned_developer_id),
        it_assigned_developer_name = COALESCE(p_new_developer_name, it_assigned_developer_name),
        reassigned_by = CASE WHEN v_reassigned THEN p_actor_name ELSE reassigned_by END,
        reassigned_at = CASE WHEN v_reassigned THEN v_now ELSE reassigned_at END,
        it_target_completion_date = COALESCE(p_target_completion_date, it_target_completion_date),
        -- If unassigned ticket is assigned by IT, transition automatically to In Progress
        status = CASE 
            WHEN status = 'Pending IT Admin Review' AND p_new_developer_id IS NOT NULL THEN 'In Progress'
            ELSE status 
        END,
        updated_at = v_now
    WHERE id = p_change_request_id;

    -- 5. Record Immutable IT Modification Log
    INSERT INTO change_request_it_modifications (
        change_request_id,
        actor_user_id,
        actor_name,
        actor_role,
        previous_category,
        new_category,
        previous_subcategory,
        new_subcategory,
        previous_application,
        new_application,
        previous_issue_type,
        new_issue_type,
        previous_priority,
        new_priority,
        priority_change_reason,
        previous_developer_id,
        new_developer_id,
        previous_developer_name,
        new_developer_name,
        target_completion_date,
        technical_remarks,
        approval_required,
        requester_notified,
        created_at
    ) VALUES (
        p_change_request_id,
        p_actor_user_id,
        p_actor_name,
        p_actor_role,
        v_cr.category_name,
        COALESCE(p_new_category_name, v_cr.category_name),
        v_cr.service_name,
        COALESCE(p_new_service_name, v_cr.service_name),
        v_cr.application_name,
        COALESCE(p_new_app_name, v_cr.application_name),
        v_cr.issue_type_name,
        COALESCE(p_new_issue_type_name, v_cr.issue_type_name),
        v_cr.priority,
        COALESCE(p_new_priority, v_cr.priority),
        CASE WHEN v_priority_changed THEN p_priority_change_reason ELSE NULL END,
        v_cr.it_assigned_developer_id,
        p_new_developer_id,
        v_cr.it_assigned_developer_name,
        p_new_developer_name,
        p_target_completion_date,
        p_technical_remarks,
        FALSE,
        TRUE,
        v_now
    );

    -- 6. Record in Change Request Status & Approval History
    INSERT INTO change_request_approval_history (
        change_request_id,
        actor_user_id,
        actor_name,
        actor_role,
        action_date,
        from_status,
        to_status,
        decision,
        comments
    ) VALUES (
        p_change_request_id,
        p_actor_user_id,
        p_actor_name,
        p_actor_role,
        v_now,
        v_cr.status,
        CASE WHEN v_cr.status = 'Pending IT Admin Review' AND p_new_developer_id IS NOT NULL THEN 'In Progress' ELSE v_cr.status END,
        'IT Direct Modification',
        COALESCE(p_technical_remarks, 'IT Direct classification/priority update executed.')
    );

    -- 7. Insert Automated SMTP Notification Log for Requester, HOD & Developer
    INSERT INTO email_notification_logs (
        id,
        change_request_id,
        recipient_email,
        recipient_name,
        subject,
        body_html,
        trigger_event,
        smtp_server,
        smtp_port,
        status,
        sent_at
    ) VALUES (
        'em-it-mod-' || EXTRACT(EPOCH FROM v_now)::BIGINT,
        p_change_request_id,
        v_cr.requester_email,
        v_cr.requester_name,
        '[IT DIRECT ACTION] ' || p_change_request_id || ': Priority & Classification Updated by IT Operations',
        '<p>Dear ' || v_cr.requester_name || ',</p><p>IT Operations (' || p_actor_name || ') has directly updated your change request <strong>' || p_change_request_id || '</strong>:</p><ul>' ||
        '<li><strong>Priority:</strong> ' || v_cr.priority || ' &rarr; ' || COALESCE(p_new_priority, v_cr.priority) || '</li>' ||
        CASE WHEN v_priority_changed THEN '<li><strong>Reason for Priority Change:</strong> ' || p_priority_change_reason || '</li>' ELSE '' END ||
        '<li><strong>Classification:</strong> ' || COALESCE(p_new_category_name, v_cr.category_name, 'General') || ' &rarr; ' || COALESCE(p_new_service_name, v_cr.service_name, 'N/A') || '</li>' ||
        '<li><strong>Assigned Developer:</strong> ' || COALESCE(p_new_developer_name, v_cr.it_assigned_developer_name, 'Unassigned') || '</li></ul>' ||
        '<p><em>Note: This update was executed directly by IT Operations based on operational triage. No approval flow or requester action is required.</em></p>',
        'IT_DIRECT_RECLASSIFY_AND_REPRIORITIZE',
        '157.9.183.242',
        25,
        'DELIVERED (250 OK)',
        v_now
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'change_request_id', p_change_request_id,
        'priority_changed', v_priority_changed,
        'category_changed', v_category_changed,
        'reassigned', v_reassigned,
        'approval_required', FALSE,
        'updated_at', v_now
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 17. WORKLOAD PRIORITY SCORING CONFIGURATION TABLE
-- Defines the point weight assigned to change requests by priority level:
--   * Critical = 4 Points (Severe disruption / system outage)
--   * High     = 3 Points (Major feature defect / critical business blocker)
--   * Medium   = 2 Points (Standard enhancement / moderate issue)
--   * Low      = 1 Point  (Minor tweak / informational / cosmetics)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS workload_priority_scoring_rules (
    id SERIAL PRIMARY KEY,
    priority VARCHAR(20) UNIQUE NOT NULL CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    workload_points INTEGER NOT NULL CHECK (workload_points > 0),
    badge_color VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Scoring Rules
INSERT INTO workload_priority_scoring_rules (priority, workload_points, badge_color, description)
VALUES
    ('Critical', 4, 'bg-red-50 text-red-700 border-red-200', 'Severe system outage or urgent production blocker (4 workload points)'),
    ('High',     3, 'bg-orange-50 text-orange-700 border-orange-200', 'Major system defect or core workflow impairment (3 workload points)'),
    ('Medium',   2, 'bg-amber-50 text-amber-700 border-amber-200', 'Standard functional change, feature enhancement or moderate bug (2 workload points)'),
    ('Low',      1, 'bg-slate-100 text-slate-700 border-slate-200', 'Minor cosmetic tweak, documentation, or low urgency request (1 workload point)')
ON CONFLICT (priority) DO UPDATE SET
    workload_points = EXCLUDED.workload_points,
    badge_color = EXCLUDED.badge_color,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------------------
-- 18. STORED FUNCTION: GET PRIORITY WORKLOAD POINTS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_priority_workload_points(p_priority VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE UPPER(TRIM(p_priority))
        WHEN 'CRITICAL' THEN 4
        WHEN 'HIGH' THEN 3
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW' THEN 1
        ELSE 1
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 19. VIEW: LIVE DEVELOPER WORKLOAD & CAPACITY (Active Cases Only)
-- Max capacity per developer = 10 workload points
-- Utilization thresholds:
--   * 0 - 4 pts  -> 'Available'
--   * 5 - 7 pts  -> 'Moderate'
--   * 8 - 9 pts  -> 'Busy'
--   * 10+ pts    -> 'Full'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_developer_live_workload AS
WITH developer_active_cases AS (
    SELECT 
        u.id AS user_id,
        u.full_name,
        u.email,
        u.role,
        u.department_id,
        COUNT(cr.id) AS active_cases_count,
        COALESCE(SUM(
            CASE cr.priority
                WHEN 'Critical' THEN 4
                WHEN 'High' THEN 3
                WHEN 'Medium' THEN 2
                WHEN 'Low' THEN 1
                ELSE 1
            END
        ), 0) AS used_points
    FROM users u
    LEFT JOIN change_requests cr 
        ON (cr.it_assigned_developer_id = u.id OR cr.it_assigned_developer_name = u.full_name)
        AND cr.status NOT IN ('Closed (Completed)', 'Closed (Rejected)', 'Draft')
    WHERE u.role IN ('Software Developer', 'IT Admin')
      AND u.status = 'Active'
    GROUP BY u.id, u.full_name, u.email, u.role, u.department_id
)
SELECT 
    user_id,
    full_name,
    email,
    role,
    department_id,
    active_cases_count,
    used_points,
    10 AS max_capacity,
    GREATEST(0, 10 - used_points) AS remaining_capacity,
    CASE 
        WHEN used_points <= 4 THEN 'Available'
        WHEN used_points <= 7 THEN 'Moderate'
        WHEN used_points <= 9 THEN 'Busy'
        ELSE 'Full'
    END AS workload_status,
    ROUND((used_points::NUMERIC / 10.0) * 100, 1) AS capacity_utilized_percent,
    -- Rank developer by highest remaining capacity (lowest used points) for assignment recommendations
    DENSE_RANK() OVER (ORDER BY used_points ASC, active_cases_count ASC) AS recommendation_rank
FROM developer_active_cases;

-- ------------------------------------------------------------------------------
-- 20. VIEW: HISTORICAL STAFF WORKLOAD POINTS & ASSIGNMENT AUDIT
-- Aggregates all assigned cases (active + historical) to audit workload distribution.
-- Ranked from highest accumulated workload points down to lowest.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_staff_historical_workload_points AS
WITH staff_aggregates AS (
    SELECT 
        u.id AS user_id,
        u.full_name,
        u.email,
        u.role,
        u.department_id,
        COUNT(cr.id) AS total_cases_assigned,
        COUNT(CASE WHEN cr.priority = 'Critical' THEN 1 END) AS critical_cases_count,
        COUNT(CASE WHEN cr.priority = 'High' THEN 1 END) AS high_cases_count,
        COUNT(CASE WHEN cr.priority = 'Medium' THEN 1 END) AS medium_cases_count,
        COUNT(CASE WHEN cr.priority = 'Low' THEN 1 END) AS low_cases_count,
        COUNT(CASE WHEN cr.priority = 'Critical' THEN 1 END) * 4 AS critical_points,
        COUNT(CASE WHEN cr.priority = 'High' THEN 1 END) * 3 AS high_points,
        COUNT(CASE WHEN cr.priority = 'Medium' THEN 1 END) * 2 AS medium_points,
        COUNT(CASE WHEN cr.priority = 'Low' THEN 1 END) * 1 AS low_points,
        COALESCE(SUM(
            CASE cr.priority
                WHEN 'Critical' THEN 4
                WHEN 'High' THEN 3
                WHEN 'Medium' THEN 2
                WHEN 'Low' THEN 1
                ELSE 1
            END
        ), 0) AS total_workload_points
    FROM users u
    LEFT JOIN change_requests cr 
        ON (cr.it_assigned_developer_id = u.id OR cr.it_assigned_developer_name = u.full_name)
    WHERE u.role IN ('Software Developer', 'IT Admin')
       OR cr.id IS NOT NULL
    GROUP BY u.id, u.full_name, u.email, u.role, u.department_id
)
SELECT 
    DENSE_RANK() OVER (ORDER BY total_workload_points DESC, total_cases_assigned DESC) AS rank,
    user_id,
    full_name,
    email,
    role,
    department_id,
    total_cases_assigned,
    critical_cases_count,
    high_cases_count,
    medium_cases_count,
    low_cases_count,
    critical_points,
    high_points,
    medium_points,
    low_points,
    total_workload_points,
    CASE 
        WHEN DENSE_RANK() OVER (ORDER BY total_workload_points DESC) = 1 AND total_workload_points > 0 
        THEN TRUE 
        ELSE FALSE 
    END AS is_highest_workload
FROM staff_aggregates
ORDER BY total_workload_points DESC, total_cases_assigned DESC;

-- ------------------------------------------------------------------------------
-- 21. STORED FUNCTION: INTELLIGENT DEVELOPER RECOMMENDATION FOR ASSIGNMENT
-- Returns the best developer to assign based on current points and incoming case priority.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recommend_developer_for_assignment(p_priority VARCHAR DEFAULT 'Medium')
RETURNS TABLE (
    developer_id VARCHAR,
    developer_name VARCHAR,
    current_used_points BIGINT,
    projected_points BIGINT,
    remaining_capacity BIGINT,
    workload_status TEXT,
    fits_within_capacity BOOLEAN
) AS $$
DECLARE
    v_incoming_pts INTEGER;
BEGIN
    v_incoming_pts := fn_get_priority_workload_points(p_priority);

    RETURN QUERY
    SELECT 
        w.user_id::VARCHAR AS developer_id,
        w.full_name::VARCHAR AS developer_name,
        w.used_points AS current_used_points,
        (w.used_points + v_incoming_pts) AS projected_points,
        w.remaining_capacity,
        w.workload_status,
        ((w.used_points + v_incoming_pts) <= 10) AS fits_within_capacity
    FROM vw_developer_live_workload w
    ORDER BY 
        -- Prioritize developers where case fits in capacity, then least loaded
        ((w.used_points + v_incoming_pts) <= 10) DESC,
        w.used_points ASC,
        w.active_cases_count ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- 22. TEMPORARY APPROVER DELEGATION MANAGEMENT & REVOCATION
-- Enables HODs to grant temporary approval authority to a department team member
-- during leave/travel, and REVOKE this authority immediately at ANY time.
-- DEPARTMENT-LEVEL ISOLATION: Each department is strictly restricted to viewing
-- and auditing their own department's delegation and revocation records only.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS temporary_approver_delegations (
    id VARCHAR(50) PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON UPDATE CASCADE,
    department_name VARCHAR(150) NOT NULL,
    hod_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    hod_name VARCHAR(150) NOT NULL,
    hod_email VARCHAR(150) NOT NULL,
    delegate_user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    delegate_name VARCHAR(150) NOT NULL,
    delegate_email VARCHAR(150) NOT NULL,
    delegate_role VARCHAR(50) NOT NULL DEFAULT 'Requester',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Revoked', 'Expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(150) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by VARCHAR(150),
    revocation_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delegation_dept ON temporary_approver_delegations(department_id, status);
CREATE INDEX IF NOT EXISTS idx_delegation_delegate ON temporary_approver_delegations(delegate_user_id, status);
CREATE INDEX IF NOT EXISTS idx_delegation_hod ON temporary_approver_delegations(hod_user_id, status);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS): DEPARTMENT DATA ISOLATION
-- Ensures each department can ONLY see their own department's delegation and revocation records.
-- System Admins and IT Admins have enterprise-wide audit clearance.
-- ------------------------------------------------------------------------------
ALTER TABLE temporary_approver_delegations ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if exist
DROP POLICY IF EXISTS rls_admin_all_delegations ON temporary_approver_delegations;
DROP POLICY IF EXISTS rls_department_isolation_delegations ON temporary_approver_delegations;

-- Policy 1: System Admin & IT Admin full audit access
CREATE POLICY rls_admin_all_delegations ON temporary_approver_delegations
    FOR ALL
    TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('request.jwt.claim.sub', true)
              AND u.role IN ('System Admin', 'IT Admin')
        )
    );

-- Policy 2: Department Isolation (HODs, Delegates, and Staff only see own department)
CREATE POLICY rls_department_isolation_delegations ON temporary_approver_delegations
    FOR SELECT
    TO PUBLIC
    USING (
        department_id = (
            SELECT u.department_id FROM users u
            WHERE u.id = current_setting('request.jwt.claim.sub', true)
        )
    );

-- Drop prior views before recreation to prevent PostgreSQL 42P16 column rename errors
DROP VIEW IF EXISTS vw_active_temporary_approver_delegations CASCADE;
DROP VIEW IF EXISTS vw_delegation_revocation_audit CASCADE;

-- View: Active Valid Delegations (Excludes Revoked and Expired)
CREATE OR REPLACE VIEW vw_active_temporary_approver_delegations AS
SELECT 
    d.id,
    d.id AS delegation_id,
    d.department_id,
    d.department_name,
    d.hod_user_id,
    d.hod_name,
    d.hod_email,
    d.delegate_user_id,
    d.delegate_name,
    d.delegate_email,
    d.delegate_role,
    d.start_date,
    d.end_date,
    d.reason,
    d.notes,
    d.status,
    d.created_at,
    d.created_by,
    CASE 
        WHEN CURRENT_TIMESTAMP BETWEEN d.start_date AND d.end_date AND d.status = 'Active' THEN TRUE
        ELSE FALSE
    END AS is_currently_effective,
    -- Calculation of remaining active days
    GREATEST(0, EXTRACT(DAY FROM (d.end_date - CURRENT_TIMESTAMP))::INTEGER) AS days_remaining
FROM temporary_approver_delegations d
WHERE d.status = 'Active'
  AND CURRENT_TIMESTAMP >= d.start_date
  AND CURRENT_TIMESTAMP <= d.end_date;

-- View: Delegation Revocation Audit Log (Enterprise / Department Scoped)
CREATE OR REPLACE VIEW vw_delegation_revocation_audit AS
SELECT 
    d.id,
    d.id AS delegation_id,
    d.department_id,
    d.department_name,
    d.hod_name,
    d.delegate_name,
    d.delegate_email,
    d.start_date,
    d.end_date,
    d.reason AS initial_delegation_reason,
    d.status,
    d.created_at AS delegated_at,
    d.revoked_at,
    d.revoked_by,
    d.revocation_reason,
    ROUND(EXTRACT(EPOCH FROM (d.end_date - d.revoked_at)) / 86400.0, 1) AS days_revoked_before_scheduled_expiry
FROM temporary_approver_delegations d
WHERE d.status = 'Revoked'
ORDER BY d.revoked_at DESC;

-- ------------------------------------------------------------------------------
-- STORED FUNCTION: GET DEPARTMENT-SCOPED DELEGATION & REVOCATION REGISTER
-- Securely returns delegation records strictly for the requester's department,
-- unless the caller possesses System Admin / IT Admin role.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_department_delegation_audit(
    p_user_id VARCHAR,
    p_filter_status VARCHAR DEFAULT 'ALL'
)
RETURNS TABLE (
    delegation_id VARCHAR,
    department_id INTEGER,
    department_name VARCHAR,
    hod_name VARCHAR,
    hod_email VARCHAR,
    delegate_name VARCHAR,
    delegate_email VARCHAR,
    delegate_role VARCHAR,
    start_date DATE,
    end_date DATE,
    reason VARCHAR,
    notes TEXT,
    status VARCHAR,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by VARCHAR,
    revocation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR,
    is_department_scoped BOOLEAN
) AS $$
DECLARE
    v_user RECORD;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found in system directory.', p_user_id;
    END IF;

    IF v_user.role IN ('System Admin', 'IT Admin') THEN
        v_is_admin := TRUE;
    END IF;

    RETURN QUERY
    SELECT 
        d.id AS delegation_id,
        d.department_id,
        d.department_name,
        d.hod_name,
        d.hod_email,
        d.delegate_name,
        d.delegate_email,
        d.delegate_role,
        d.start_date,
        d.end_date,
        d.reason,
        d.notes,
        d.status,
        d.revoked_at,
        d.revoked_by,
        d.revocation_reason,
        d.created_at,
        d.created_by,
        (NOT v_is_admin) AS is_department_scoped
    FROM temporary_approver_delegations d
    WHERE (v_is_admin = TRUE OR d.department_id = v_user.department_id)
      AND (
          p_filter_status = 'ALL' 
          OR (p_filter_status = 'REVOKED' AND d.status = 'Revoked')
          OR (p_filter_status = 'ACTIVE' AND d.status = 'Active')
          OR (p_filter_status = 'EXPIRED' AND d.status = 'Expired')
      )
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- STORED FUNCTION: REVOKE TEMPORARY APPROVER DELEGATION ANYTIME BY HOD
-- Allows the department HOD (or System Admin) to instantly revoke an active delegation.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revoke_temporary_approver_delegation(
    p_delegation_id VARCHAR,
    p_revoked_by_user_id VARCHAR,
    p_revoked_by_name VARCHAR,
    p_revocation_reason TEXT DEFAULT 'HOD resumed office / Authority revoked manually'
)
RETURNS JSONB AS $$
DECLARE
    v_delegation RECORD;
    v_actor RECORD;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_result JSONB;
BEGIN
    -- 1. Fetch delegation record
    SELECT * INTO v_delegation
    FROM temporary_approver_delegations
    WHERE id = p_delegation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delegation record % not found.', p_delegation_id;
    END IF;

    IF v_delegation.status = 'Revoked' THEN
        RAISE EXCEPTION 'Delegation % has already been revoked on % by %.', 
            p_delegation_id, v_delegation.revoked_at, v_delegation.revoked_by;
    END IF;

    -- 2. Validate actor authorization (HOD of that department, or System/IT Admin)
    SELECT * INTO v_actor
    FROM users
    WHERE id = p_revoked_by_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Actor user % not found.', p_revoked_by_user_id;
    END IF;

    IF v_actor.id <> v_delegation.hod_user_id 
       AND v_actor.role NOT IN ('System Admin', 'IT Admin') 
       AND v_actor.department_id <> v_delegation.department_id THEN
        RAISE EXCEPTION 'Permission denied: Only the delegating HOD (%) or System Admin can revoke this delegation.', v_delegation.hod_name;
    END IF;

    -- 3. Execute Immediate Revocation
    UPDATE temporary_approver_delegations
    SET 
        status = 'Revoked',
        revoked_at = v_now,
        revoked_by = p_revoked_by_name,
        revocation_reason = COALESCE(TRIM(p_revocation_reason), 'HOD resumed office / Authority revoked manually')
    WHERE id = p_delegation_id;

    -- 4. Queue Automated SMTP Email Notification to Delegate & HOD
    INSERT INTO email_notification_logs (
        id,
        recipient_email,
        recipient_name,
        subject,
        body_html,
        trigger_event,
        smtp_server,
        smtp_port,
        status,
        sent_at
    ) VALUES (
        'em-del-rev-' || EXTRACT(EPOCH FROM v_now)::BIGINT,
        v_delegation.delegate_email,
        v_delegation.delegate_name,
        '[IT OPS] Temporary Approver Authority Revoked - ' || v_delegation.department_name,
        '<p>Dear ' || v_delegation.delegate_name || ',</p>' ||
        '<p>This is an automated notification that your Acting Approver authority for <strong>' || v_delegation.department_name || '</strong> has been <strong>revoked</strong> by Head of Department <strong>' || p_revoked_by_name || '</strong> with immediate effect.</p>' ||
        '<ul>' ||
        '<li><strong>Delegation ID:</strong> ' || p_delegation_id || '</li>' ||
        '<li><strong>Revocation Date & Time:</strong> ' || TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS OF') || '</li>' ||
        '<li><strong>Reason for Revocation:</strong> ' || COALESCE(p_revocation_reason, 'HOD resumed duty / manual revocation') || '</li>' ||
        '<li><strong>Status:</strong> Authority returned to HOD (' || v_delegation.hod_name || ')</li>' ||
        '</ul>' ||
        '<p>All pending approval requests for ' || v_delegation.department_name || ' will now route directly to HOD ' || v_delegation.hod_name || '.</p>',
        'HOD_DELEGATION_REVOKED',
        '157.9.183.242',
        25,
        'DELIVERED (250 OK)',
        v_now
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'delegation_id', p_delegation_id,
        'status', 'Revoked',
        'revoked_at', v_now,
        'revoked_by', p_revoked_by_name,
        'revocation_reason', p_revocation_reason,
        'authority_restored_to_hod', v_delegation.hod_name
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- STORED FUNCTION: VERIFY IF USER IS CURRENTLY AUTHORIZED TO APPROVE AS HOD OR DELEGATE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_user_authorized_approver(
    p_user_id VARCHAR,
    p_department_id INTEGER,
    p_check_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_hod BOOLEAN := FALSE;
    v_is_active_delegate BOOLEAN := FALSE;
BEGIN
    -- Check 1: User is primary HOD of department
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_user_id 
          AND department_id = p_department_id 
          AND role = 'HOD' 
          AND status = 'Active'
    ) INTO v_is_hod;

    IF v_is_hod THEN
        RETURN TRUE;
    END IF;

    -- Check 2: User holds an Active, unexpired, non-revoked delegation
    SELECT EXISTS (
        SELECT 1 FROM temporary_approver_delegations
        WHERE department_id = p_department_id
          AND delegate_user_id = p_user_id
          AND status = 'Active'
          AND p_check_date >= start_date
          AND p_check_date <= end_date
    ) INTO v_is_active_delegate;

    RETURN v_is_active_delegate;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 15. STORED PROCEDURE: REJECT CHANGE REQUEST (IT Admin, System Admin, IT Staff, Developer, HOD)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_reject_change_request(
    p_change_request_id VARCHAR,
    p_actor_user_id VARCHAR,
    p_actor_name VARCHAR,
    p_actor_role VARCHAR,
    p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_cr RECORD;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_result JSONB;
BEGIN
    -- Authorization check: IT Admin, System Admin, Software Developer, Department HOD, Acting HOD
    IF p_actor_role NOT IN ('IT Admin', 'System Admin', 'Software Developer', 'Department HOD', 'Acting Department HOD') THEN
        RAISE EXCEPTION 'Unauthorized: User role % is not permitted to reject tickets.', p_actor_role;
    END IF;

    -- Validation: Rejection reason cannot be empty
    IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
        RAISE EXCEPTION 'Validation Error: Rejection justification reason is mandatory for audit trail.';
    END IF;

    -- Check ticket existence and state
    SELECT * INTO v_cr FROM change_requests WHERE id = p_change_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Change request % not found.', p_change_request_id;
    END IF;

    IF v_cr.status IN ('Closed (Completed)', 'Closed (Rejected)') THEN
        RAISE EXCEPTION 'Cannot reject change request % because it is already closed.', p_change_request_id;
    END IF;

    -- Update change request status to Closed (Rejected)
    UPDATE change_requests
    SET status = 'Closed (Rejected)',
        rejected_by_user_id = p_actor_user_id,
        rejected_by_name = p_actor_name,
        rejected_by_role = p_actor_role,
        rejected_at = v_now,
        rejection_reason = p_rejection_reason,
        updated_at = v_now
    WHERE id = p_change_request_id;

    -- Insert into approval history
    INSERT INTO change_request_approval_history (
        change_request_id,
        actor_user_id,
        actor_name,
        actor_role,
        action_date,
        from_status,
        to_status,
        decision,
        comments
    ) VALUES (
        p_change_request_id,
        p_actor_user_id,
        p_actor_name,
        p_actor_role,
        v_now,
        v_cr.status,
        'Closed (Rejected)',
        'Rejected',
        p_rejection_reason
    );

    -- Log email notification to requester & HOD
    INSERT INTO email_notification_logs (
        id,
        change_request_id,
        recipient_email,
        recipient_name,
        subject,
        body_html,
        trigger_event,
        smtp_server,
        smtp_port,
        status,
        sent_at
    ) VALUES (
        'em-cr-rej-' || EXTRACT(EPOCH FROM v_now)::BIGINT,
        p_change_request_id,
        v_cr.requester_email,
        v_cr.requester_name,
        '[IT OPS] Change Request ' || p_change_request_id || ' Rejected by ' || p_actor_name || ' (' || p_actor_role || ')',
        '<p>Dear ' || v_cr.requester_name || ',</p>' ||
        '<p>Your change request <strong>' || p_change_request_id || ' (' || v_cr.title || ')</strong> has been <strong>Rejected</strong>.</p>' ||
        '<ul>' ||
        '<li><strong>Rejected By:</strong> ' || p_actor_name || ' (' || p_actor_role || ')</li>' ||
        '<li><strong>Date & Time:</strong> ' || TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS OF') || '</li>' ||
        '<li><strong>Rejection Reason / Justification:</strong> ' || p_rejection_reason || '</li>' ||
        '<li><strong>Status:</strong> Closed (Rejected)</li>' ||
        '</ul>' ||
        '<p>Note: Rejected cases may be reviewed and reopened exclusively by a System Administrator.</p>',
        'CR_REJECTED',
        '157.9.183.242',
        25,
        'DELIVERED (250 OK)',
        v_now
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'change_request_id', p_change_request_id,
        'status', 'Closed (Rejected)',
        'rejected_by_name', p_actor_name,
        'rejected_by_role', p_actor_role,
        'rejected_at', v_now,
        'rejection_reason', p_rejection_reason
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 16. STORED PROCEDURE: REOPEN REJECTED CASE (SYSTEM ADMIN ONLY & AUTO-ROUTING)
-- Direct Rule: Can ONLY be reopened by System Admin; automatically routes to the person who rejected it!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_reopen_rejected_change_request(
    p_change_request_id VARCHAR,
    p_system_admin_user_id VARCHAR,
    p_system_admin_name VARCHAR,
    p_system_admin_role VARCHAR,
    p_reopen_comments TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_cr RECORD;
    v_target_status VARCHAR(50);
    v_target_user_id VARCHAR(50);
    v_target_user_name VARCHAR(150);
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_result JSONB;
BEGIN
    -- Strict Security Authorization Check: ONLY System Admin is permitted
    IF p_system_admin_role != 'System Admin' THEN
        RAISE EXCEPTION 'Security Permission Denied: Only System Administrator has authorization to reopen a rejected case/ticket.';
    END IF;

    -- Retrieve change request
    SELECT * INTO v_cr FROM change_requests WHERE id = p_change_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Change request % not found.', p_change_request_id;
    END IF;

    -- Ensure current state is Closed (Rejected)
    IF v_cr.status != 'Closed (Rejected)' THEN
        RAISE EXCEPTION 'Invalid State: Only Closed (Rejected) cases can be reopened (Current status: %).', v_cr.status;
    END IF;

    -- Determine Automatic Target Route based on who rejected it
    v_target_user_id := v_cr.rejected_by_user_id;
    v_target_user_name := v_cr.rejected_by_name;

    IF v_cr.rejected_by_role = 'Software Developer' THEN
        -- Reopened ticket automatically routes to In Progress assigned to the rejecting developer
        v_target_status := 'In Progress';
        UPDATE change_requests
        SET status = 'In Progress',
            it_assigned_developer_id = COALESCE(v_cr.rejected_by_user_id, v_cr.it_assigned_developer_id),
            it_assigned_developer_name = COALESCE(v_cr.rejected_by_name, v_cr.it_assigned_developer_name),
            reopened_by_user_id = p_system_admin_user_id,
            reopened_by_name = p_system_admin_name,
            reopened_at = v_now,
            reopen_comments = p_reopen_comments,
            updated_at = v_now
        WHERE id = p_change_request_id;

    ELSIF v_cr.rejected_by_role IN ('IT Admin', 'System Admin') THEN
        -- Reopened ticket automatically routes back to IT Admin Review
        v_target_status := 'Pending IT Admin Review';
        UPDATE change_requests
        SET status = 'Pending IT Admin Review',
            reopened_by_user_id = p_system_admin_user_id,
            reopened_by_name = p_system_admin_name,
            reopened_at = v_now,
            reopen_comments = p_reopen_comments,
            updated_at = v_now
        WHERE id = p_change_request_id;

    ELSIF v_cr.rejected_by_role IN ('Department HOD', 'Acting Department HOD') THEN
        -- Reopened ticket automatically routes back to Department HOD Approval
        v_target_status := 'Pending HOD Approval';
        UPDATE change_requests
        SET status = 'Pending HOD Approval',
            reopened_by_user_id = p_system_admin_user_id,
            reopened_by_name = p_system_admin_name,
            reopened_at = v_now,
            reopen_comments = p_reopen_comments,
            updated_at = v_now
        WHERE id = p_change_request_id;

    ELSE
        -- Fallback: route to Pending IT Admin Review
        v_target_status := 'Pending IT Admin Review';
        UPDATE change_requests
        SET status = 'Pending IT Admin Review',
            reopened_by_user_id = p_system_admin_user_id,
            reopened_by_name = p_system_admin_name,
            reopened_at = v_now,
            reopen_comments = p_reopen_comments,
            updated_at = v_now
        WHERE id = p_change_request_id;
    END IF;

    -- Append Reopen event to Approval History
    INSERT INTO change_request_approval_history (
        change_request_id,
        actor_user_id,
        actor_name,
        actor_role,
        action_date,
        from_status,
        to_status,
        decision,
        comments
    ) VALUES (
        p_change_request_id,
        p_system_admin_user_id,
        p_system_admin_name,
        'System Admin',
        v_now,
        'Closed (Rejected)',
        v_target_status,
        'Reopened',
        COALESCE(
            '[Reopened by System Admin] Reopened by ' || p_system_admin_name || ' and automatically routed back to ' || COALESCE(v_target_user_name, 'original rejector') || ' (' || COALESCE(v_cr.rejected_by_role, 'Staff') || '). ' || COALESCE(p_reopen_comments, ''),
            'Reopened by System Admin'
        )
    );

    -- Dispatch Email Notification to Rejector and Requester
    INSERT INTO email_notification_logs (
        id,
        change_request_id,
        recipient_email,
        recipient_name,
        subject,
        body_html,
        trigger_event,
        smtp_server,
        smtp_port,
        status,
        sent_at
    ) VALUES (
        'em-cr-reopen-' || EXTRACT(EPOCH FROM v_now)::BIGINT,
        p_change_request_id,
        v_cr.requester_email,
        v_cr.requester_name,
        '[IT OPS] Rejected Change Request ' || p_change_request_id || ' Reopened by System Admin',
        '<p>Dear Team,</p>' ||
        '<p>Previously rejected change request <strong>' || p_change_request_id || ' (' || v_cr.title || ')</strong> has been <strong>Reopened by System Administrator ' || p_system_admin_name || '</strong>.</p>' ||
        '<ul>' ||
        '<li><strong>Reopened By:</strong> ' || p_system_admin_name || ' (System Admin)</li>' ||
        '<li><strong>Automatically Assigned / Routed to:</strong> ' || COALESCE(v_target_user_name, 'Original Rejector') || ' (' || COALESCE(v_cr.rejected_by_role, 'IT') || ')</li>' ||
        '<li><strong>New Status:</strong> ' || v_target_status || '</li>' ||
        '<li><strong>System Admin Remarks:</strong> ' || COALESCE(p_reopen_comments, 'No remarks entered.') || '</li>' ||
        '<li><strong>Prior Rejection Reason:</strong> ' || COALESCE(v_cr.rejection_reason, 'N/A') || '</li>' ||
        '</ul>' ||
        '<p>The case is now active in the assigned user work queue for resolution.</p>',
        'CR_REOPENED_BY_SYSADMIN',
        '157.9.183.242',
        25,
        'DELIVERED (250 OK)',
        v_now
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'change_request_id', p_change_request_id,
        'new_status', v_target_status,
        'reopened_by_name', p_system_admin_name,
        'reopened_at', v_now,
        'routed_to_user_name', v_target_user_name,
        'routed_to_role', v_cr.rejected_by_role,
        'reopen_comments', p_reopen_comments
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 17. VIEW: REJECTED & REOPENED CASES AUDIT REGISTER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_rejected_and_reopened_case_audit AS
SELECT 
    cr.id AS change_request_id,
    cr.title,
    cr.priority,
    cr.category_name,
    cr.requester_name,
    cr.department_name,
    cr.status AS current_status,
    cr.rejected_by_user_id,
    cr.rejected_by_name,
    cr.rejected_by_role,
    cr.rejected_at,
    cr.rejection_reason,
    cr.reopened_by_user_id,
    cr.reopened_by_name,
    cr.reopened_at,
    cr.reopen_comments,
    cr.it_assigned_developer_name AS currently_assigned_developer,
    cr.updated_at
FROM change_requests cr
WHERE cr.rejected_at IS NOT NULL OR cr.status = 'Closed (Rejected)';

-- ------------------------------------------------------------------------------
-- 18. STORED PROCEDURE: DEVELOPER TECHNICAL ASSESSMENT & CODE DIFF SUBMISSION
-- Updates change request with developer testing notes, code/database before & after diffs,
-- risk parameters, and advances status (e.g. to 'Pending IT Verification' or 'In Progress').
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_developer_submit_technical_assessment(
    p_change_request_id VARCHAR(50),
    p_developer_user_id VARCHAR(50),
    p_developer_name VARCHAR(150),
    p_target_status VARCHAR(50),
    p_implementation_notes TEXT,
    p_has_code_or_database_changes BOOLEAN DEFAULT TRUE,
    p_before_change_details TEXT DEFAULT NULL,
    p_after_change_details TEXT DEFAULT NULL,
    p_requires_schema_change BOOLEAN DEFAULT FALSE,
    p_requires_downtime_window BOOLEAN DEFAULT FALSE,
    p_risk_level VARCHAR(20) DEFAULT 'Low',
    p_risk_score INTEGER DEFAULT 25
)
RETURNS JSONB AS $$
DECLARE
    v_cr RECORD;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_completion_date DATE := NULL;
    v_result JSONB;
BEGIN
    -- 1. Fetch existing change request
    SELECT * INTO v_cr FROM change_requests WHERE id = p_change_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Change request % not found.', p_change_request_id;
    END IF;

    -- 2. If status is advancing to Pending IT Verification or Closed, record completion date
    IF p_target_status IN ('Pending IT Verification', 'Closed (Completed)') THEN
        v_completion_date := CURRENT_DATE;
    ELSE
        v_completion_date := v_cr.actual_completion_date;
    END IF;

    -- 3. Update change request record
    UPDATE change_requests
    SET
        status = p_target_status,
        implementation_notes = p_implementation_notes,
        has_code_or_database_changes = p_has_code_or_database_changes,
        before_change_details = p_before_change_details,
        after_change_details = p_after_change_details,
        requires_schema_change = p_requires_schema_change,
        requires_downtime_window = p_requires_downtime_window,
        risk_level = p_risk_level,
        risk_score = p_risk_score,
        actual_completion_date = v_completion_date,
        updated_at = v_now
    WHERE id = p_change_request_id;

    -- 4. Record entry in approval/status history
    INSERT INTO approval_history (
        change_request_id,
        actor_user_id,
        actor_name,
        actor_role,
        action_date,
        from_status,
        to_status,
        decision,
        comments
    ) VALUES (
        p_change_request_id,
        p_developer_user_id,
        p_developer_name,
        'Software Developer',
        v_now,
        v_cr.status,
        p_target_status,
        'Status Update',
        COALESCE(p_implementation_notes, 'Developer technical assessment and diff submitted.')
    );

    -- 5. Dispatch notification if ready for IT Verification
    IF p_target_status = 'Pending IT Verification' THEN
        INSERT INTO email_notification_logs (
            id,
            change_request_id,
            recipient_email,
            recipient_name,
            subject,
            body_html,
            trigger_event,
            smtp_server,
            smtp_port,
            status,
            sent_at
        ) VALUES (
            'em-dev-complete-' || EXTRACT(EPOCH FROM v_now)::BIGINT,
            p_change_request_id,
            'it.admin@company.com',
            'IT Operations & QA Team',
            '[UAT READY] ' || p_change_request_id || ': Developer Technical Implementation & Code Diff Completed',
            '<p>Developer <strong>' || p_developer_name || '</strong> has completed implementation for <strong>' || p_change_request_id || ' (' || v_cr.title || ')</strong>.</p>' ||
            '<ul>' ||
            '<li><strong>New Status:</strong> Pending IT Verification (Ready for UAT)</li>' ||
            '<li><strong>Code/DB Changes:</strong> ' || CASE WHEN p_has_code_or_database_changes THEN 'Yes (Before & After Diffs Provided)' ELSE 'No (Configuration Only)' END || '</li>' ||
            '<li><strong>Schema Migration Required:</strong> ' || CASE WHEN p_requires_schema_change THEN 'YES' ELSE 'No' END || '</li>' ||
            '<li><strong>System Downtime Required:</strong> ' || CASE WHEN p_requires_downtime_window THEN 'YES' ELSE 'No' END || '</li>' ||
            '<li><strong>Developer Notes:</strong> ' || COALESCE(p_implementation_notes, 'N/A') || '</li>' ||
            '</ul>' ||
            '<p>Please review the technical diff and perform release verification.</p>',
            'DEVELOPER_IMPLEMENTATION_COMPLETED',
            '157.9.183.242',
            25,
            'DELIVERED (250 OK)',
            v_now
        );
    END IF;

    v_result := jsonb_build_object(
        'success', TRUE,
        'change_request_id', p_change_request_id,
        'status', p_target_status,
        'has_code_or_database_changes', p_has_code_or_database_changes,
        'requires_schema_change', p_requires_schema_change,
        'requires_downtime_window', p_requires_downtime_window,
        'updated_at', v_now
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 19. VIEW: DEVELOPER TECHNICAL AUDIT TRAIL & CODE DIFF REGISTER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_developer_code_diff_audit AS
SELECT 
    cr.id AS change_request_id,
    cr.title,
    cr.priority,
    cr.category_name,
    cr.service_name,
    cr.application_name,
    cr.status,
    cr.it_assigned_developer_id,
    cr.it_assigned_developer_name,
    cr.has_code_or_database_changes,
    cr.before_change_details,
    cr.after_change_details,
    cr.requires_schema_change,
    cr.requires_downtime_window,
    cr.risk_level,
    cr.risk_score,
    cr.implementation_notes,
    cr.actual_completion_date,
    cr.updated_at
FROM change_requests cr
WHERE cr.implementation_notes IS NOT NULL 
   OR cr.before_change_details IS NOT NULL 
   OR cr.after_change_details IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 21. CUSTOM ROLES & PERMISSION GOVERNANCE MATRIX TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_roles (
    id VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE,
    archetype VARCHAR(50) NOT NULL DEFAULT 'Custom',
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    workflow_routing JSONB NOT NULL DEFAULT '{}'::jsonb,
    email_subscriptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(role_name);

-- Seed Default Baseline System Roles
INSERT INTO custom_roles (id, role_name, archetype, description, is_system_role, permissions, workflow_routing, email_subscriptions)
VALUES
(
    'role-requester',
    'Requester',
    'Requester',
    'Standard organizational end-user with access to submit IT change requests, track tickets in My Requests, and reply to clarification requests.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": false, "canViewItAdminWorkspace": false, "canViewDeveloperBoard": false, "canViewClosedCases": false, "canViewReports": false, "canViewAdminHub": false, "canViewEmailHub": false, "canApproveHodStage": false, "canTriageAndAssignDevs": false, "canReturnToRequester": false, "canDirectModifyCatalog": false, "canVerifyRelease": false, "canReopenCases": false, "canManageUsers": false}'::jsonb,
    '{"receivesHodReview": false, "receivesItAdminReview": false, "canBeAssignedAsDeveloper": false, "receivesCriticalEscalations": false}'::jsonb,
    '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": false, "notifyDelegations": false}'::jsonb
),
(
    'role-hod',
    'Department HOD',
    'Department HOD',
    'Departmental Head with authority to review, approve, send back, or reject department change requests, and delegate temporary approvers.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": true, "canViewItAdminWorkspace": false, "canViewDeveloperBoard": false, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": false, "canViewEmailHub": false, "canApproveHodStage": true, "canTriageAndAssignDevs": false, "canReturnToRequester": true, "canDirectModifyCatalog": false, "canVerifyRelease": false, "canReopenCases": false, "canManageUsers": false}'::jsonb,
    '{"receivesHodReview": true, "receivesItAdminReview": false, "canBeAssignedAsDeveloper": false, "receivesCriticalEscalations": false}'::jsonb,
    '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": false, "notifyDelegations": true}'::jsonb
),
(
    'role-it-helpdesk',
    'IT Helpdesk',
    'IT Helpdesk',
    'Frontline IT support and triage operator with capabilities to review tickets, request clarification, monitor email logs, and track task queues.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": false, "canViewItAdminWorkspace": true, "canViewDeveloperBoard": true, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": false, "canViewEmailHub": true, "canApproveHodStage": false, "canTriageAndAssignDevs": true, "canReturnToRequester": true, "canDirectModifyCatalog": true, "canVerifyRelease": true, "canReopenCases": false, "canManageUsers": false}'::jsonb,
    '{"receivesHodReview": false, "receivesItAdminReview": true, "canBeAssignedAsDeveloper": false, "receivesCriticalEscalations": true}'::jsonb,
    '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": true, "notifyDelegations": true}'::jsonb
),
(
    'role-it-admin',
    'IT Admin',
    'IT Admin',
    'Lead IT Administrator with full operational triage authority, developer workload assignment, direct modifications, and release verification.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": false, "canViewItAdminWorkspace": true, "canViewDeveloperBoard": true, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": false, "canViewEmailHub": true, "canApproveHodStage": false, "canTriageAndAssignDevs": true, "canReturnToRequester": true, "canDirectModifyCatalog": true, "canVerifyRelease": true, "canReopenCases": false, "canManageUsers": false}'::jsonb,
    '{"receivesHodReview": false, "receivesItAdminReview": true, "canBeAssignedAsDeveloper": true, "receivesCriticalEscalations": true}'::jsonb,
    '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": true, "notifyDelegations": true}'::jsonb
),
(
    'role-developer',
    'Software Developer',
    'Software Developer',
    'Software engineer with task assignment board access to implement changes, manage status cards, and record technical notes.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": false, "canViewItAdminWorkspace": false, "canViewDeveloperBoard": true, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": false, "canViewEmailHub": false, "canApproveHodStage": false, "canTriageAndAssignDevs": false, "canReturnToRequester": true, "canDirectModifyCatalog": false, "canVerifyRelease": false, "canReopenCases": false, "canManageUsers": false}'::jsonb,
    '{"receivesHodReview": false, "receivesItAdminReview": false, "canBeAssignedAsDeveloper": true, "receivesCriticalEscalations": false}'::jsonb,
    '{"notifyNewSubmissions": false, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": false, "notifyDelegations": false}'::jsonb
),
(
    'role-system-admin',
    'System Admin',
    'System Admin',
    'Full super administrator with complete control over user directory, application catalogs, process options, security policies, and system configuration.',
    TRUE,
    '{"canViewMyRequests": true, "canViewHodQueue": true, "canViewItAdminWorkspace": true, "canViewDeveloperBoard": true, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": true, "canViewEmailHub": true, "canApproveHodStage": true, "canTriageAndAssignDevs": true, "canReturnToRequester": true, "canDirectModifyCatalog": true, "canVerifyRelease": true, "canReopenCases": true, "canManageUsers": true}'::jsonb,
    '{"receivesHodReview": true, "receivesItAdminReview": true, "canBeAssignedAsDeveloper": true, "receivesCriticalEscalations": true}'::jsonb,
    '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": true, "notifyDelegations": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    archetype = EXCLUDED.archetype,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role,
    permissions = EXCLUDED.permissions,
    workflow_routing = EXCLUDED.workflow_routing,
    email_subscriptions = EXCLUDED.email_subscriptions,
    updated_at = CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------------------
-- 22. STORED FUNCTION & VIEW: SYSTEM TURNAROUND & SLA METRICS CALCULATION
-- Dynamically aggregates live turnaround times, HOD clearance, IT dev cycles,
-- and SLA compliance rates directly from PostgreSQL tables and audit logs.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_system_turnaround_metrics()
RETURNS JSONB AS $$
DECLARE
    v_total_cases INTEGER := 0;
    v_completed_count INTEGER := 0;
    v_rejected_count INTEGER := 0;
    v_closed_count INTEGER := 0;
    v_verified_count INTEGER := 0;
    
    v_hod_eval_count INTEGER := 0;
    v_hod_compliant_count INTEGER := 0;
    v_avg_hod_hours NUMERIC := 0;
    v_avg_hod_days NUMERIC := 0;
    v_hod_sla_percent NUMERIC := 100;
    
    v_it_eval_count INTEGER := 0;
    v_it_compliant_count INTEGER := 0;
    v_avg_it_hours NUMERIC := 0;
    v_avg_it_days NUMERIC := 0;
    v_it_sla_percent NUMERIC := 100;
    
    v_avg_overall_hours NUMERIC := 0;
    v_avg_overall_days NUMERIC := 0;
    v_verification_percent NUMERIC := 100;
    
    v_priority_dist JSONB;
    v_status_dist JSONB;
    v_result JSONB;
BEGIN
    -- 1. Total Case counts
    SELECT COUNT(*) INTO v_total_cases FROM change_requests;
    SELECT COUNT(*) INTO v_completed_count FROM change_requests WHERE status = 'Closed (Completed)';
    SELECT COUNT(*) INTO v_rejected_count FROM change_requests WHERE status = 'Closed (Rejected)';
    v_closed_count := v_completed_count + v_rejected_count;

    -- 2. HOD Clearance Calculation
    WITH hod_durations AS (
        SELECT 
            cr.id,
            cr.created_at,
            COALESCE(
                cr.hod_approved_at,
                (SELECT MIN(action_date) FROM change_request_approval_history h WHERE h.change_request_id = cr.id AND h.decision IN ('Approved', 'Endorsed', 'Returned', 'Rejected', 'Approved by HOD', 'Approved by Delegate')),
                cr.updated_at
            ) AS approved_at
        FROM change_requests cr
        WHERE cr.hod_approval_skipped IS NOT TRUE 
          AND (cr.hod_approved_at IS NOT NULL OR EXISTS (
              SELECT 1 FROM change_request_approval_history h 
              WHERE h.change_request_id = cr.id 
                AND h.decision IN ('Approved', 'Endorsed', 'Returned', 'Rejected', 'Approved by HOD', 'Approved by Delegate')
          ))
    )
    SELECT 
        COUNT(*),
        COALESCE(AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600.0), 0),
        COALESCE(COUNT(CASE WHEN EXTRACT(EPOCH FROM (approved_at - created_at)) <= 172800 THEN 1 END), 0) -- 48 hours / 2 days
    INTO v_hod_eval_count, v_avg_hod_hours, v_hod_compliant_count
    FROM hod_durations
    WHERE approved_at >= created_at;

    IF v_hod_eval_count > 0 THEN
        v_avg_hod_days := ROUND(v_avg_hod_hours / 24.0, 1);
        v_hod_sla_percent := ROUND((v_hod_compliant_count::numeric / v_hod_eval_count::numeric) * 100.0, 1);
    ELSE
        v_avg_hod_days := 0.0;
        v_hod_sla_percent := 100.0;
    END IF;

    -- 3. IT Development Cycle Calculation
    WITH it_durations AS (
        SELECT 
            cr.id,
            COALESCE(
                (SELECT MIN(action_date) FROM change_request_approval_history h WHERE h.change_request_id = cr.id AND (h.to_status = 'In Progress' OR h.from_status = 'Pending IT Admin Review')),
                cr.hod_approved_at,
                cr.created_at
            ) AS dev_start,
            COALESCE(
                cr.actual_completion_date::timestamp with time zone,
                (SELECT MIN(action_date) FROM change_request_approval_history h WHERE h.change_request_id = cr.id AND h.to_status IN ('Pending IT Verification', 'Closed (Completed)')),
                cr.updated_at
            ) AS dev_end,
            COALESCE(cr.sla_target_hours, 168) AS target_hours
        FROM change_requests cr
        WHERE cr.status IN ('In Progress', 'Pending IT Verification', 'Closed (Completed)')
           OR cr.actual_completion_date IS NOT NULL
           OR EXISTS (
               SELECT 1 FROM change_request_approval_history h 
               WHERE h.change_request_id = cr.id AND h.to_status IN ('Pending IT Verification', 'Closed (Completed)')
           )
    )
    SELECT 
        COUNT(*),
        COALESCE(AVG(EXTRACT(EPOCH FROM (dev_end - dev_start)) / 3600.0), 0),
        COALESCE(COUNT(CASE WHEN EXTRACT(EPOCH FROM (dev_end - dev_start)) <= (target_hours * 3600.0) THEN 1 END), 0)
    INTO v_it_eval_count, v_avg_it_hours, v_it_compliant_count
    FROM it_durations
    WHERE dev_end >= dev_start;

    IF v_it_eval_count > 0 THEN
        v_avg_it_days := ROUND(v_avg_it_hours / 24.0, 1);
        v_it_sla_percent := ROUND((v_it_compliant_count::numeric / v_it_eval_count::numeric) * 100.0, 1);
    ELSE
        v_avg_it_days := 0.0;
        v_it_sla_percent := 100.0;
    END IF;

    -- 4. IT Admin Verification on Closed Cases
    IF v_completed_count > 0 THEN
        SELECT COUNT(DISTINCT cr.id) INTO v_verified_count
        FROM change_requests cr
        WHERE cr.status = 'Closed (Completed)'
          AND (
              EXISTS (
                  SELECT 1 FROM change_request_approval_history h 
                  WHERE h.change_request_id = cr.id 
                    AND h.actor_role IN ('IT Admin', 'System Admin', 'IT Helpdesk')
                    AND h.to_status = 'Closed (Completed)'
              ) OR cr.updated_at IS NOT NULL
          );
        v_verification_percent := ROUND((v_verified_count::numeric / v_completed_count::numeric) * 100.0, 0);
    ELSE
        v_verification_percent := 100.0;
    END IF;

    -- 5. Overall Resolution Time on Closed Cases
    WITH closed_durations AS (
        SELECT 
            cr.id,
            EXTRACT(EPOCH FROM (COALESCE(cr.actual_completion_date::timestamp with time zone, cr.updated_at) - cr.created_at)) / 3600.0 AS duration_hours
        FROM change_requests cr
        WHERE cr.status IN ('Closed (Completed)', 'Closed (Rejected)')
    )
    SELECT COALESCE(AVG(duration_hours), 0) INTO v_avg_overall_hours
    FROM closed_durations
    WHERE duration_hours >= 0;

    v_avg_overall_days := ROUND(v_avg_overall_hours / 24.0, 1);

    -- 6. Priority and Status Distributions
    SELECT jsonb_object_agg(COALESCE(priority, 'Medium'), cnt) INTO v_priority_dist
    FROM (
        SELECT priority, COUNT(*)::int AS cnt
        FROM change_requests
        GROUP BY priority
    ) p;

    SELECT jsonb_object_agg(COALESCE(status, 'Draft'), cnt) INTO v_status_dist
    FROM (
        SELECT status, COUNT(*)::int AS cnt
        FROM change_requests
        GROUP BY status
    ) s;

    -- 7. Build Output JSON
    v_result := jsonb_build_object(
        'avgHodClearanceDays', v_avg_hod_days,
        'hodClearanceDisplay', CASE WHEN v_hod_eval_count > 0 THEN v_avg_hod_days || ' Days' ELSE '0.0 Days' END,
        'hodSlaCompliancePercent', v_hod_sla_percent,
        'hodSlaComplianceDisplay', v_hod_sla_percent || '% SLA Compliance (< 2 Days)',
        'hodEvaluatedCount', v_hod_eval_count,
        'avgItDevCycleDays', v_avg_it_days,
        'itDevCycleDisplay', CASE WHEN v_it_eval_count > 0 THEN v_avg_it_days || ' Days' ELSE '0.0 Days' END,
        'itDevSlaCompliancePercent', v_it_sla_percent,
        'itDevSlaComplianceDisplay', v_it_sla_percent || '% within target SLA release window',
        'itEvaluatedCount', v_it_eval_count,
        'totalClosedCases', v_completed_count,
        'completedCount', v_completed_count,
        'rejectedCount', v_rejected_count,
        'totalCases', v_total_cases,
        'verificationRatePercent', v_verification_percent,
        'verificationDisplay', v_verification_percent || '% verified by IT Admin',
        'priorityDistribution', COALESCE(v_priority_dist, '{}'::jsonb),
        'statusDistribution', COALESCE(v_status_dist, '{}'::jsonb),
        'avgOverallResolutionDays', v_avg_overall_days,
        'calculatedAt', CURRENT_TIMESTAMP,
        'source', 'postgresql_engine'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE VIEW vw_system_turnaround_sla_metrics AS
SELECT * FROM fn_get_system_turnaround_metrics();

-- ------------------------------------------------------------------------------
-- BRING DEVICE OUT & SATO CL4NX STICKER LABEL SYSTEM
-- ------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS device_out_request_id_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_device_out_request_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_val BIGINT;
    year_str VARCHAR(4);
    formatted_id VARCHAR(50);
BEGIN
    next_val := nextval('device_out_request_id_seq');
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    formatted_id := 'DEV-OUT-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS device_out_requests (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_device_out_request_id(),
    request_id VARCHAR(50) UNIQUE,
    requester_id VARCHAR(50) NOT NULL,
    requester_name VARCHAR(150) NOT NULL,
    requester_email VARCHAR(150),
    department_id INTEGER,
    department_name VARCHAR(150),
    asset_type VARCHAR(100) NOT NULL,
    asset_id VARCHAR(100),
    asset_name VARCHAR(255) NOT NULL,
    asset_serial_no VARCHAR(100),
    from_date VARCHAR(50) NOT NULL,
    to_date VARCHAR(50) NOT NULL,
    vpn_required VARCHAR(50) NOT NULL DEFAULT 'Not Required',
    business_purpose TEXT NOT NULL,
    approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    approval_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    approved_by VARCHAR(50),
    approved_by_name VARCHAR(150),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    returned_at TIMESTAMP WITH TIME ZONE,
    returned_by VARCHAR(50),
    returned_by_name VARCHAR(150),
    return_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE device_out_requests DROP CONSTRAINT IF EXISTS chk_device_out_dates;
ALTER TABLE device_out_requests ADD CONSTRAINT chk_device_out_dates CHECK (to_date >= from_date);

CREATE TABLE IF NOT EXISTS device_out_approvals (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    approver_id VARCHAR(50) NOT NULL,
    approver_name VARCHAR(150),
    approver_role VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS label_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    width_mm NUMERIC(10,2) NOT NULL DEFAULT 100,
    height_mm NUMERIC(10,2) NOT NULL DEFAULT 50,
    orientation VARCHAR(20) NOT NULL DEFAULT 'Landscape',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS label_template_elements (
    id VARCHAR(50) PRIMARY KEY,
    template_id VARCHAR(50) NOT NULL REFERENCES label_templates(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL DEFAULT 'text',
    field_key VARCHAR(100) NOT NULL,
    x_mm NUMERIC(10,2) NOT NULL DEFAULT 0,
    y_mm NUMERIC(10,2) NOT NULL DEFAULT 0,
    width_mm NUMERIC(10,2) NOT NULL DEFAULT 40,
    height_mm NUMERIC(10,2) NOT NULL DEFAULT 10,
    font_size INTEGER NOT NULL DEFAULT 12,
    font_weight VARCHAR(20) NOT NULL DEFAULT 'normal',
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    alignment VARCHAR(20) NOT NULL DEFAULT 'left',
    rotation INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS label_print_history (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    template_id VARCHAR(50),
    printed_by VARCHAR(50) NOT NULL,
    printed_by_name VARCHAR(150),
    printer_name VARCHAR(150) NOT NULL DEFAULT 'SATO CL4NX',
    print_count INTEGER NOT NULL DEFAULT 1,
    printed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 23. MAINTENANCE ANNOUNCEMENTS & EMAIL REMINDERS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_announcements (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    maintenance_type VARCHAR(100) NOT NULL,
    affected_system VARCHAR(255) NOT NULL,
    description TEXT,
    reason TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    duration VARCHAR(100),
    impact TEXT,
    user_action TEXT,
    workaround TEXT,
    it_contact VARCHAR(255),
    change_number VARCHAR(100),
    recipient_group VARCHAR(100) DEFAULT 'TD_TEM',
    status VARCHAR(50) DEFAULT 'Scheduled',
    reminder_settings JSONB DEFAULT '{}'::jsonb,
    created_by VARCHAR(50),
    created_by_name VARCHAR(150),
    updated_by VARCHAR(50),
    updated_by_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maint_ann_status ON maintenance_announcements(status);
CREATE INDEX IF NOT EXISTS idx_maint_ann_start ON maintenance_announcements(start_datetime);

CREATE TABLE IF NOT EXISTS maintenance_reminders (
    id VARCHAR(100) PRIMARY KEY,
    maintenance_id VARCHAR(50) NOT NULL REFERENCES maintenance_announcements(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Scheduled',
    sent_time TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    recipient_group VARCHAR(100),
    recipient_count INTEGER DEFAULT 0,
    template_used VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maint_rem_id ON maintenance_reminders(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_maint_rem_status ON maintenance_reminders(status);

CREATE TABLE IF NOT EXISTS maintenance_email_history (
    id VARCHAR(100) PRIMARY KEY,
    maintenance_id VARCHAR(50) REFERENCES maintenance_announcements(id) ON DELETE SET NULL,
    reminder_type VARCHAR(50),
    recipient_group VARCHAR(100),
    recipient_count INTEGER DEFAULT 0,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    sent_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    error_message TEXT,
    template_used VARCHAR(150),
    subject VARCHAR(255),
    body_html TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maint_hist_id ON maintenance_email_history(maintenance_id);

-- ------------------------------------------------------------------------------
-- 24. RELEASE NOTES & SYSTEM UPDATE LOGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS release_notes (
    id VARCHAR(50) PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    release_date DATE NOT NULL,
    summary TEXT,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_notes_date ON release_notes(release_date);
CREATE INDEX IF NOT EXISTS idx_rel_notes_status ON release_notes(status);

CREATE TABLE IF NOT EXISTS release_note_items (
    id VARCHAR(50) PRIMARY KEY,
    release_id VARCHAR(50) NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- e.g. 'Strategic Feature', 'Service Correction', 'System Enhancement'
    description TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rel_note_items_rid ON release_note_items(release_id);

CREATE TABLE IF NOT EXISTS release_note_reads (
    release_id VARCHAR(50) NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (release_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 25. SEED DATA: LABEL TEMPLATES & ELEMENTS (SATO CL4NX Standard)
-- ------------------------------------------------------------------------------
INSERT INTO label_templates (id, name, width_mm, height_mm, orientation, is_active, created_by)
VALUES 
('tpl-sato-cl4nx-std', 'SATO CL4NX - Standard 100x50mm Asset Label', 100.00, 50.00, 'Landscape', TRUE, 'USR-IT-ADMIN'),
('tpl-sato-cl4nx-small', 'SATO CL4NX - Small 50x25mm Component Label', 50.00, 25.00, 'Landscape', TRUE, 'USR-IT-ADMIN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO label_template_elements (id, template_id, element_type, field_key, x_mm, y_mm, width_mm, height_mm, font_size, font_weight)
VALUES
('el-std-title', 'tpl-sato-cl4nx-std', 'text', 'Tanaka Precision (M) Sdn Bhd', 5, 5, 90, 8, 14, 'bold'),
('el-std-asset-id', 'tpl-sato-cl4nx-std', 'text', 'Asset ID: {{assetId}}', 5, 15, 60, 6, 12, 'bold'),
('el-std-asset-name', 'tpl-sato-cl4nx-std', 'text', 'Name: {{assetName}}', 5, 23, 60, 6, 11, 'normal'),
('el-std-barcode', 'tpl-sato-cl4nx-std', 'barcode', '{{assetId}}', 70, 15, 25, 25, 0, 'normal'),
('el-std-footer', 'tpl-sato-cl4nx-std', 'text', 'IT OPS / FIXED ASSET CONTROL', 5, 42, 90, 5, 9, 'normal')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 26. SEED DATA: INITIAL SYSTEM ROLES
-- ------------------------------------------------------------------------------
INSERT INTO custom_roles (id, role_name, archetype, description, is_system_role, permissions, workflow_routing, email_subscriptions)
VALUES
(
  'role-requester',
  'Requester',
  'Requester',
  'Standard organizational end-user with access to submit IT change requests and track tickets.',
  TRUE,
  '{"canViewMyRequests": true, "canViewHodQueue": false, "canViewItAdminWorkspace": false, "canViewDeveloperBoard": false, "canViewClosedCases": false, "canViewReports": false, "canViewAdminHub": false, "canViewEmailHub": false, "canApproveHodStage": false, "canTriageAndAssignDevs": false, "canReturnToRequester": false, "canDirectModifyCatalog": false, "canVerifyRelease": false, "canReopenCases": false, "canManageUsers": false}'::jsonb,
  '{"receivesHodReview": false, "receivesItAdminReview": false, "canBeAssignedAsDeveloper": false, "receivesCriticalEscalations": false}'::jsonb,
  '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": false, "notifyDelegations": false}'::jsonb
),
(
  'role-system-admin',
  'System Admin',
  'System Admin',
  'Full super administrator with complete control over the application.',
  TRUE,
  '{"canViewMyRequests": true, "canViewHodQueue": true, "canViewItAdminWorkspace": true, "canViewDeveloperBoard": true, "canViewClosedCases": true, "canViewReports": true, "canViewAdminHub": true, "canViewEmailHub": true, "canApproveHodStage": true, "canTriageAndAssignDevs": true, "canReturnToRequester": true, "canDirectModifyCatalog": true, "canVerifyRelease": true, "canReopenCases": true, "canManageUsers": true}'::jsonb,
  '{"receivesHodReview": true, "receivesItAdminReview": true, "canBeAssignedAsDeveloper": true, "receivesCriticalEscalations": true}'::jsonb,
  '{"notifyNewSubmissions": true, "notifyClarificationReplies": true, "notifyStatusTransitions": true, "notifyReleaseVerifications": true, "notifyUserRegistrations": true, "notifyDelegations": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;









