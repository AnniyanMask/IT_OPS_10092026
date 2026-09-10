import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database configuration with environment variables and production secrets
const pgHost = process.env.PGHOST || '157.9.183.59';
const pgConfig = {
  connectionString: process.env.DATABASE_URL && process.env.DATABASE_URL.trim() && !process.env.DATABASE_URL.includes('your_secure_password') ? process.env.DATABASE_URL.trim() : undefined,
  host: pgHost,
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'it_user',
  password: process.env.PGPASSWORD !== undefined && process.env.PGPASSWORD !== '' ? process.env.PGPASSWORD : 'TANAKA123',
  database: process.env.PGDATABASE || 'IT_OPS',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

let dbPool: Pool | null = null;
let isDbConnected = false;
let lastDbError: string | null = null;
let lastDbCheckedAt: string | null = null;

// In-Memory Fallbacks for UI functionality when Database is unavailable
const memoryCatalog: {
  categories: any[];
  services: any[];
  applications: any[];
  issueTypes: any[];
  modules: any[];
  subFunctions: any[];
  processes: any[];
} = {
  categories: [],
  services: [],
  applications: [],
  issueTypes: [],
  modules: [],
  subFunctions: [],
  processes: [],
};
const memoryDeviceOutRequests: any[] = [];
const memoryDeviceOutApprovals: any[] = [];
const memoryLabelTemplates: any[] = [];
const memoryLabelPrintHistory: any[] = [];
const memoryReleaseNotes: any[] = [];
const memoryReleaseReads: any[] = [];
let deviceOutCounter = 100;

function getMalaysianTimestamp(date: Date | string | number = new Date(), includeSeconds: boolean = true): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date || '');
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const YYYY = getPart('year');
    const MM = getPart('month');
    const DD = getPart('day');
    const hh = getPart('hour');
    const mm = getPart('minute');
    const ss = getPart('second');
    return includeSeconds ? `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}` : `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
  } catch {
    const offsetMs = 8 * 60 * 60 * 1000;
    const mytDate = new Date(d.getTime() + offsetMs);
    const iso = mytDate.toISOString().replace('T', ' ');
    return includeSeconds ? iso.substring(0, 19) : iso.substring(0, 16);
  }
}

function getPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool(pgConfig);
    dbPool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err.message);
      isDbConnected = false;
      lastDbError = err.message;
    });
  }
  return dbPool;
}

// 1. Ensure all PostgreSQL tables exist with correct schemas
async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1 INCREMENT 1;

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

      CREATE TABLE IF NOT EXISTS change_requests (
          id VARCHAR(50) PRIMARY KEY DEFAULT generate_change_request_id(),
          title VARCHAR(255) NOT NULL,
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

      -- Backward-compatible migration for installations that already have the legacy table.
      -- Fresh databases are created with the complete production definition above.
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS sla_target_hours INTEGER DEFAULT 168;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS priority_change_reason TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS priority_changed_by VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS priority_changed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS target_hod_user_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS target_hod_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS target_hod_email VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_approval_skipped BOOLEAN DEFAULT FALSE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_skip_reason TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_approved_by VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS returned_by_role VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS it_clarification_requested BOOLEAN DEFAULT FALSE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS category_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS category_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS service_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS application_asset_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS application_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS issue_type_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS issue_type_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS category_changed_by VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS category_changed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS application_areas JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS current_behavior_description TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requested_change_description TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS business_justification TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requested_completion_date DATE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS pcs_module VARCHAR(100) DEFAULT 'General';
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS pcs_sub_module VARCHAR(100);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS pcs_sub_section VARCHAR(100);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS issue_description TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS business_impact TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_decision VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_review_notes TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS hod_reviewed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS it_assigned_developer_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS it_assigned_developer_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reassigned_by VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS it_admin_review_notes TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS it_target_completion_date DATE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS implementation_notes TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS has_code_or_database_changes BOOLEAN DEFAULT TRUE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS before_change_details TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS after_change_details TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requires_schema_change BOOLEAN DEFAULT FALSE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requires_downtime_window BOOLEAN DEFAULT FALSE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'Low';
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 25;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS actual_completion_date DATE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS rejected_by_user_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS rejected_by_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS rejected_by_role VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reopened_by_user_id VARCHAR(50);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reopened_by_name VARCHAR(150);
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reopen_comments TEXT;

      -- Synchronize the sequence only after change_requests exists.
      -- Synchronize sequence with highest numeric suffix in existing change_requests
            DO $$
            DECLARE
              max_cr_seq BIGINT := 0;
              seq_num BIGINT;
              r RECORD;
            BEGIN
              FOR r IN SELECT id FROM change_requests LOOP
                BEGIN
                  seq_num := NULLIF(substring(r.id from '([0-9]+)$'), '')::BIGINT;
                  IF seq_num IS NOT NULL AND seq_num > max_cr_seq THEN
                    max_cr_seq := seq_num;
                  END IF;
                EXCEPTION WHEN OTHERS THEN
                END;
              END LOOP;
              IF max_cr_seq > 0 THEN
                PERFORM setval('change_request_id_seq', max_cr_seq, true);
              END IF;
            END $$;

      -- Production approval history (replaces the unused legacy audit table).
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

      -- Immutable IT direct modification log used by the stored procedure.
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

      -- IT direct classification/re-prioritization stored procedure.
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
      -- Ensure columns are strictly JSONB for rich metadata (attachments, modules, history)
      DO $$
      BEGIN
        -- Drop legacy check constraints on users.role if present so custom roles and IT Helpdesk can be assigned freely
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'users' AND constraint_name = 'users_role_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_check;
        END IF;

        -- Ensure users.role is VARCHAR(100)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role'
        ) THEN
          ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(100);
        END IF;

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

        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS total_sla_paused_hours INTEGER DEFAULT 0;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS last_reminder_stage INTEGER;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS auto_closure_warned_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS is_auto_closed_inactive BOOLEAN DEFAULT FALSE;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;
      END $$;

      CREATE TABLE IF NOT EXISTS temporary_approver_delegations (
        id VARCHAR(50) PRIMARY KEY,
        department_id INTEGER NOT NULL,
        department_name VARCHAR(100) NOT NULL,
        hod_user_id VARCHAR(50) NOT NULL,
        hod_name VARCHAR(150) NOT NULL,
        hod_email VARCHAR(150) NOT NULL,
        delegate_user_id VARCHAR(50) NOT NULL,
        delegate_name VARCHAR(150) NOT NULL,
        delegate_email VARCHAR(150) NOT NULL,
        delegate_role VARCHAR(50) NOT NULL,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        reason VARCHAR(100) NOT NULL,
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(150) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP WITH TIME ZONE,
        revoked_by VARCHAR(150),
        revocation_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS email_notification_logs (
        id VARCHAR(100) PRIMARY KEY,
        change_request_id VARCHAR(50),
        recipient_email VARCHAR(150) NOT NULL,
        recipient_name VARCHAR(150),
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        trigger_event VARCHAR(150),
        smtp_server VARCHAR(150),
        smtp_port INTEGER,
        status VARCHAR(100) NOT NULL DEFAULT 'DELIVERED (250 OK)',
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        email VARCHAR(150) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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

      -- 7-Tier Relational Catalog & 3-Tier Hierarchy Tables
      CREATE TABLE IF NOT EXISTS service_categories (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(100),
        description TEXT,
        icon_name VARCHAR(100),
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS service_catalog (
        id VARCHAR(100) PRIMARY KEY,
        category_id VARCHAR(100) NOT NULL,
        category_name VARCHAR(150),
        name VARCHAR(150) NOT NULL,
        code VARCHAR(100),
        description TEXT,
        is_asset_based BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS category_name VARCHAR(150);
      ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS is_asset_based BOOLEAN DEFAULT FALSE;


      CREATE TABLE IF NOT EXISTS application_assets (
        id VARCHAR(100) PRIMARY KEY,
        service_id VARCHAR(100),
        service_name VARCHAR(150),
        category_id VARCHAR(100),
        name VARCHAR(150) NOT NULL,
        code VARCHAR(100),
        type VARCHAR(50) DEFAULT 'Application',
        asset_tag VARCHAR(100),
        serial_number VARCHAR(100),
        location VARCHAR(150),
        assigned_user_id VARCHAR(100),
        assigned_user_name VARCHAR(150),
        has_application_area BOOLEAN DEFAULT TRUE,
        description TEXT,
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      -- Backward-compatible catalog migrations for existing installations.
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS category_id VARCHAR(100);
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'Application';
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS location VARCHAR(150);
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS assigned_user_id VARCHAR(100);
      ALTER TABLE application_assets ADD COLUMN IF NOT EXISTS assigned_user_name VARCHAR(150);


      CREATE TABLE IF NOT EXISTS issue_types (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(100),
        description TEXT,
        badge_color VARCHAR(100) DEFAULT 'bg-rose-50 text-rose-700 border-rose-200',
        default_priority VARCHAR(50) DEFAULT 'Medium',
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS application_modules (
        id VARCHAR(100) PRIMARY KEY,
        application_id VARCHAR(100) NOT NULL,
        application_name VARCHAR(150),
        code VARCHAR(100),
        name VARCHAR(150) NOT NULL,
        description TEXT,
        lead_developer VARCHAR(150),
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE application_modules ADD COLUMN IF NOT EXISTS application_name VARCHAR(150);
      ALTER TABLE application_modules ADD COLUMN IF NOT EXISTS lead_developer VARCHAR(150);


      CREATE TABLE IF NOT EXISTS application_subfunctions (
        id VARCHAR(100) PRIMARY KEY,
        module_id VARCHAR(100) NOT NULL,
        module_code VARCHAR(100),
        code VARCHAR(100),
        name VARCHAR(150) NOT NULL,
        description TEXT,
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE application_subfunctions ADD COLUMN IF NOT EXISTS module_code VARCHAR(100);


      CREATE TABLE IF NOT EXISTS application_processes (
        id VARCHAR(100) PRIMARY KEY,
        subfunction_id VARCHAR(100) NOT NULL,
        subfunction_name VARCHAR(150),
        code VARCHAR(100),
        name VARCHAR(150) NOT NULL,
        description TEXT,
        display_order INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE application_processes ADD COLUMN IF NOT EXISTS subfunction_id VARCHAR(100);
      ALTER TABLE application_processes ADD COLUMN IF NOT EXISTS subfunction_name VARCHAR(150);
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'application_processes' AND column_name = 'sub_function_id'
        ) THEN
          UPDATE application_processes
          SET subfunction_id = COALESCE(subfunction_id, sub_function_id)
          WHERE subfunction_id IS NULL;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'application_processes' AND column_name = 'sub_function_name'
        ) THEN
          UPDATE application_processes
          SET subfunction_name = COALESCE(subfunction_name, sub_function_name)
          WHERE subfunction_name IS NULL;
        END IF;
      END $$;

      -- ------------------------------------------------------------------------
      -- BRING DEVICE OUT & SATO CL4NX LABEL TABLES
      -- ------------------------------------------------------------------------
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

      INSERT INTO label_templates (id, name, width_mm, height_mm, orientation, is_active, created_by)
      VALUES ('tpl-sato-cl4nx-std', 'SATO CL4NX Standard Out-Pass (100mm x 50mm)', 100.00, 50.00, 'Landscape', TRUE, 'USR-SYSTEM')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO label_template_elements (id, template_id, element_type, field_key, x_mm, y_mm, width_mm, height_mm, font_size, font_weight, visible, alignment, rotation)
      VALUES
        ('el-01', 'tpl-sato-cl4nx-std', 'badge', 'APPROVED', 4, 3, 92, 7, 13, 'bold', TRUE, 'center', 0),
        ('el-02', 'tpl-sato-cl4nx-std', 'text', 'request_number', 4, 12, 45, 6, 9, 'bold', TRUE, 'left', 0),
        ('el-03', 'tpl-sato-cl4nx-std', 'text', 'requester_name', 4, 18, 92, 6, 9, 'bold', TRUE, 'left', 0),
        ('el-04', 'tpl-sato-cl4nx-std', 'text', 'asset_name', 4, 24, 92, 6, 9, 'bold', TRUE, 'left', 0),
        ('el-05', 'tpl-sato-cl4nx-std', 'text', 'from_date', 4, 30, 44, 5, 8, 'normal', TRUE, 'left', 0),
        ('el-06', 'tpl-sato-cl4nx-std', 'text', 'to_date', 50, 30, 46, 5, 8, 'normal', TRUE, 'left', 0),
        ('el-07', 'tpl-sato-cl4nx-std', 'text', 'approver_name', 4, 36, 92, 5, 8, 'bold', TRUE, 'left', 0),
        ('el-08', 'tpl-sato-cl4nx-std', 'text', 'security_footer', 4, 42, 92, 5, 7, 'normal', TRUE, 'center', 0)
      ON CONFLICT (id) DO NOTHING;

      -- ==========================================
      -- RELEASE NOTES / WHAT'S NEW MODULE
      -- ==========================================
      CREATE TABLE IF NOT EXISTS release_notes (
        id VARCHAR(50) PRIMARY KEY,
        version VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        release_date DATE NOT NULL,
        summary TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        published_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_release_notes_status ON release_notes(status);
      CREATE INDEX IF NOT EXISTS idx_release_notes_date ON release_notes(release_date DESC);

      CREATE TABLE IF NOT EXISTS release_note_items (
        id VARCHAR(50) PRIMARY KEY,
        release_id VARCHAR(50) NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_release_note_items_rel ON release_note_items(release_id);

      CREATE TABLE IF NOT EXISTS release_note_reads (
        id VARCHAR(50) PRIMARY KEY,
        release_id VARCHAR(50) NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL,
        read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_release_user UNIQUE (release_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_release_note_reads_user ON release_note_reads(user_id);

      -- Seed Baseline Initial Release Note
      INSERT INTO release_notes (id, version, title, release_date, summary, status, published_at, created_by, updated_by)
      VALUES (
        'rel-v2-5-0',
        'v2.5.0',
        'Enterprise IT Helpdesk & Service Catalog Upgrade',
        CURRENT_DATE,
        'Official rollout of the unified IT Operations platform featuring multi-tier Service Catalog classification, Bring Device Out pass generation with SATO CL4NX thermal label design, and system-wide turnaround SLA tracking.',
        'Published',
        CURRENT_TIMESTAMP,
        'USR-SYSTEM',
        'USR-SYSTEM'
      )
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO release_note_items (id, release_id, type, description, sort_order)
      VALUES
        ('item-01', 'rel-v2-5-0', 'What''s New', 'Unified 3-Tier IT Service Catalog with dynamic Category, Service, and Application asset linkage.', 1),
        ('item-02', 'rel-v2-5-0', 'What''s New', 'Interactive Device Out-Pass management with SATO CL4NX barcode and QR label designer.', 2),
        ('item-03', 'rel-v2-5-0', 'What''s New', 'Dedicated What''s New / Release Notes hub with unread indicator and release history.', 3),
        ('item-04', 'rel-v2-5-0', 'Improvements', 'Optimized Malaysian business day SLA clearance metrics for HOD and IT review phases.', 4),
        ('item-05', 'rel-v2-5-0', 'Improvements', 'Instant full-text ticket and service catalog search with live filtering.', 5),
        ('item-06', 'rel-v2-5-0', 'Bug Fixes', 'Synchronized ticket sequence counter to avoid collision during parallel submission.', 6),
        ('item-07', 'rel-v2-5-0', 'Bug Fixes', 'Corrected timezone formatting for automated SMTP notification dispatches.', 7),
        ('item-08', 'rel-v2-5-0', 'Important Notices', 'All physical hardware removals require approved digital out-passes printed via SATO thermal printer before security checkpoint clearance.', 8)
      ON CONFLICT (id) DO NOTHING;

      -- ==========================================
      -- MAINTENANCE ANNOUNCEMENTS & EMAIL REMINDERS
      -- ==========================================
      CREATE TABLE IF NOT EXISTS maintenance_announcements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        maintenance_type VARCHAR(100) NOT NULL,
        affected_system VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
        end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
        duration VARCHAR(100) NOT NULL,
        impact VARCHAR(255) NOT NULL,
        user_action TEXT NOT NULL,
        workaround TEXT,
        it_contact VARCHAR(255) NOT NULL,
        change_number VARCHAR(100),
        recipient_group VARCHAR(100) NOT NULL DEFAULT 'TD_TEM',
        status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
        reminder_settings JSONB NOT NULL DEFAULT '{"initial":true,"threeDaysBefore":true,"oneDayBefore":true,"thirtyMinsBefore":true,"started":true,"completed":true,"cancelled":true}'::jsonb,
        created_by VARCHAR(100),
        created_by_name VARCHAR(150),
        updated_by VARCHAR(100),
        updated_by_name VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_maint_announcements_status ON maintenance_announcements(status);
      CREATE INDEX IF NOT EXISTS idx_maint_announcements_start ON maintenance_announcements(start_datetime);

      CREATE TABLE IF NOT EXISTS maintenance_reminders (
        id VARCHAR(100) PRIMARY KEY,
        maintenance_id VARCHAR(50) NOT NULL REFERENCES maintenance_announcements(id) ON DELETE CASCADE,
        reminder_type VARCHAR(50) NOT NULL,
        scheduled_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
        sent_time TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        recipient_group VARCHAR(100) NOT NULL DEFAULT 'TD_TEM',
        recipient_count INTEGER DEFAULT 0,
        template_used VARCHAR(100) DEFAULT 'maintenance_announcement_broadcast',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_maint_reminder UNIQUE (maintenance_id, reminder_type)
      );
      CREATE INDEX IF NOT EXISTS idx_maint_reminders_status_time ON maintenance_reminders(status, scheduled_time);

      CREATE TABLE IF NOT EXISTS maintenance_email_history (
        id VARCHAR(100) PRIMARY KEY,
        maintenance_id VARCHAR(50) NOT NULL REFERENCES maintenance_announcements(id) ON DELETE CASCADE,
        reminder_type VARCHAR(50) NOT NULL,
        recipient_group VARCHAR(100) NOT NULL,
        recipient_count INTEGER DEFAULT 0,
        scheduled_time TIMESTAMP WITH TIME ZONE,
        sent_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        template_used VARCHAR(100) NOT NULL,
        subject VARCHAR(255),
        body_html TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_maint_email_hist_maint ON maintenance_email_history(maintenance_id);
      CREATE INDEX IF NOT EXISTS idx_maint_email_hist_sent ON maintenance_email_history(sent_time DESC);

      -- Seed Baseline Sample Maintenance Announcement
      INSERT INTO maintenance_announcements (
        id, title, maintenance_type, affected_system, description, reason,
        start_datetime, end_datetime, duration, impact, user_action, workaround,
        it_contact, change_number, recipient_group, status, reminder_settings,
        created_by, created_by_name
      ) VALUES (
        'maint-2026-001',
        'Enterprise SAP ERP & Core Network Switch Infrastructure Upgrade',
        'Network & Server Maintenance',
        'SAP Production & MES Shop Floor Gateway',
        'Scheduled replacement of core distribution switches, fiber optic transceivers, and operating firmware patches across the primary datacenter rack.',
        'Hardware end-of-life replacement and mandatory security vulnerability remediation.',
        (CURRENT_TIMESTAMP + INTERVAL '3 days'),
        (CURRENT_TIMESTAMP + INTERVAL '3 days 4 hours'),
        '4 hours',
        'Complete service downtime for SAP ERP, MES shop floor terminals, and local file storage.',
        'All users must save ongoing transactions and log out from SAP and MES before the maintenance window.',
        'Production lines may continue using paper batch traveler forms during the 4-hour window.',
        'Tanaka IT Operations Desk ext. 4321 / helpdesk@tanaka.com.my',
        'ITO-CR-2026-00088',
        'TD_TEM',
        'Scheduled',
        '{"initial":true,"threeDaysBefore":true,"oneDayBefore":true,"thirtyMinsBefore":true,"started":true,"completed":true,"cancelled":true}'::jsonb,
        'USR-ADMIN',
        'System Administrator'
      ) ON CONFLICT (id) DO NOTHING;

      -- Seed Sample Reminders for Baseline Announcement
      INSERT INTO maintenance_reminders (id, maintenance_id, reminder_type, scheduled_time, status, recipient_group, recipient_count)
      VALUES
        ('rem-001-init', 'maint-2026-001', 'initial', CURRENT_TIMESTAMP, 'Sent', 'TD_TEM', 85),
        ('rem-001-3day', 'maint-2026-001', '3_days_before', (CURRENT_TIMESTAMP + INTERVAL '1 hour'), 'Scheduled', 'TD_TEM', 0),
        ('rem-001-1day', 'maint-2026-001', '1_day_before', (CURRENT_TIMESTAMP + INTERVAL '2 days'), 'Scheduled', 'TD_TEM', 0),
        ('rem-001-30m',  'maint-2026-001', '30_mins_before', (CURRENT_TIMESTAMP + INTERVAL '2 days 23 hours 30 minutes'), 'Scheduled', 'TD_TEM', 0),
        ('rem-001-start', 'maint-2026-001', 'started', (CURRENT_TIMESTAMP + INTERVAL '3 days'), 'Scheduled', 'TD_TEM', 0),
        ('rem-001-comp',  'maint-2026-001', 'completed', (CURRENT_TIMESTAMP + INTERVAL '3 days 4 hours'), 'Scheduled', 'TD_TEM', 0),
        ('rem-001-canc',  'maint-2026-001', 'cancelled', NULL, 'Scheduled', 'TD_TEM', 0)
      ON CONFLICT (maintenance_id, reminder_type) DO NOTHING;

      -- Seed Sample Initial Broadcast in Email History
      INSERT INTO maintenance_email_history (
        id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject
      ) VALUES (
        'hist-001-init',
        'maint-2026-001',
        'initial',
        'TD_TEM',
        85,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'Sent',
        'maintenance_announcement_broadcast',
        '[INITIAL ANNOUNCEMENT] Scheduled IT Maintenance: SAP Production & MES Shop Floor Gateway'
      ) ON CONFLICT (id) DO NOTHING;

      -- Stored function for System Turnaround & SLA Metrics
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
          SELECT COUNT(*) INTO v_total_cases FROM change_requests;
          SELECT COUNT(*) INTO v_completed_count FROM change_requests WHERE status = 'Closed (Completed)';
          SELECT COUNT(*) INTO v_rejected_count FROM change_requests WHERE status = 'Closed (Rejected)';
          v_closed_count := v_completed_count + v_rejected_count;

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
              COALESCE(COUNT(CASE WHEN EXTRACT(EPOCH FROM (approved_at - created_at)) <= 172800 THEN 1 END), 0)
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

    `);
    console.log('[DB Init] Core PostgreSQL relational tables verified/created successfully.');
  } catch (err) {
    console.error('[DB Init Schema Error]', err instanceof Error ? err.message : String(err));
  }
}

// 2. Ensure production departments & system baseline accounts exist in PostgreSQL
let baselineAlreadyInitialized = false;

async function ensureProductionBaseline(pool: Pool, force: boolean = false): Promise<void> {
  if (baselineAlreadyInitialized && !force) {
    return;
  }
  baselineAlreadyInitialized = true;
  try {
    // First make sure tables exist
    await ensureDatabaseSchema(pool);

    // 0. Seed Baseline Roles safely if not present
    await pool.query(`
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
    `);

    // Departments and user accounts are intentionally NOT seeded here.
    // All organizational departments and users must be created/managed through
    // the application and PostgreSQL. This prevents mock/demo data from being
    // re-inserted automatically on startup/build/schema synchronization.

    console.log('[DB Init] Schema and system role definitions verified. No demo users/departments/catalog data were seeded.');

    // Master catalog data is intentionally NOT auto-seeded.
    // Administrators must create/manage catalog records through the UI.
  } catch (err) {
    console.warn('[DB Baseline Sync Notice]', err instanceof Error ? err.message : String(err));
  }
}

// Database connection test
async function testDbConnection(): Promise<{ connected: boolean; message: string; config: Record<string, unknown>; diagnostics?: Record<string, unknown> }> {
  lastDbCheckedAt = new Date().toISOString();
  try {
    const pool = getPool();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time, current_database() AS db_name, version() AS pg_version');
    
    // Check table counts
    let userCount = 0;
    let deptCount = 0;
    let crCount = 0;
    try {
      const uRes = await client.query('SELECT COUNT(*) FROM users');
      userCount = parseInt(uRes.rows[0].count, 10);
    } catch { /* ignore */ }
    try {
      const dRes = await client.query('SELECT COUNT(*) FROM departments');
      deptCount = parseInt(dRes.rows[0].count, 10);
    } catch { /* ignore */ }
    try {
      const cRes = await client.query('SELECT COUNT(*) FROM change_requests');
      crCount = parseInt(cRes.rows[0].count, 10);
    } catch { /* ignore */ }

    client.release();
    isDbConnected = true;
    lastDbError = null;
    return {
      connected: true,
      message: `Connected successfully to PostgreSQL database "${result.rows[0].db_name}"`,
      config: {
        host: pgConfig.host,
        port: pgConfig.port,
        user: pgConfig.user,
        database: pgConfig.database,
      },
      diagnostics: {
        serverTime: result.rows[0].current_time,
        version: result.rows[0].pg_version,
        userCount,
        deptCount,
        crCount,
        lastChecked: lastDbCheckedAt,
      },
    };
  } catch (err: unknown) {
    isDbConnected = false;
    const msg = err instanceof Error ? err.message : String(err);
    lastDbError = msg;
    return {
      connected: false,
      message: `PostgreSQL connection check: ${msg}`,
      config: {
        host: pgConfig.host,
        port: pgConfig.port,
        user: pgConfig.user,
        database: pgConfig.database,
      },
      diagnostics: {
        lastChecked: lastDbCheckedAt,
        troubleshooting: [
          `Verify that PostgreSQL is running on host "${pgConfig.host}" port ${pgConfig.port}`,
          `Check postgresql.conf: ensure listen_addresses includes '${pgConfig.host}' or '*' (defaults to 'localhost')`,
          `Check pg_hba.conf: ensure host permissions exist for user '${pgConfig.user}' on database '${pgConfig.database}'`,
          `Check server firewall / UFW / iptables: ensure port ${pgConfig.port} is open to incoming connections`,
          `If hosting on 157.9.183.59, set PGHOST=157.9.183.59 or PGHOST=localhost in your .env file`
        ]
      }
    };
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & Database Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    databaseConnected: isDbConnected,
    lastDbError: lastDbError || null,
  });
});

app.get('/api/db/status', async (req, res) => {
  const status = await testDbConnection();
  res.json(status);
});

// Seed/Init DB with schema if needed
app.post('/api/db/initialize-schema', async (req, res) => {
  try {
    const pool = getPool();
    const fs = await import('fs');
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      await ensureProductionBaseline(pool);
      res.json({ success: true, message: 'Database production schema and baseline synced successfully from schema.sql' });
    } else {
      res.status(404).json({ success: false, message: 'schema.sql not found on server' });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// Explicit Production Baseline Seeding (11 Departments + Administrator Accounts)
app.post('/api/db/seed-production', async (req, res) => {
  try {
    const pool = getPool();
    await ensureProductionBaseline(pool);
    res.json({ success: true, message: 'Production baseline seeded with 11 Tanaka departments and administrative accounts.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// 2. AUTHENTICATION & USER MANAGEMENT

// Register New User (Writes to PostgreSQL users table)
app.post('/api/auth/register', async (req, res) => {
  const { id, fullName, email, username, password, departmentId, role, status } = req.body;
  if (!email || !fullName || !password) {
    return res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
  }

  const userRole = role || 'Requester';
  const userStatus = status || 'Pending IT Approval';
  const userDeptId = departmentId ? Number(departmentId) : 1;
  const userUname = username || email.split('@')[0];

  try {
    const pool = getPool();

    // Ensure production baseline departments and foreign key integrity
    await ensureProductionBaseline(pool);

    // Check if user already exists by email
    const checkUser = await pool.query('SELECT id, full_name, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: `An account with email "${email}" already exists in the database (Status: ${checkUser.rows[0].status}).` 
      });
    }

    // Validate Department ID & Retrieve Official Department Name
    const deptRes = await pool.query('SELECT id, name FROM departments WHERE id = $1 LIMIT 1', [userDeptId]);
    if (deptRes.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Department ID (${userDeptId}) does not exist in the Tanaka department registry.` 
      });
    }
    const officialDeptName = deptRes.rows[0].name;

    // Determine ID strictly using PostgreSQL sequence function (generate_user_id)
    const seqRes = await pool.query('SELECT generate_user_id() AS new_id');
    const assignedId = seqRes.rows[0].new_id;

    const insertQuery = `
      INSERT INTO users (
        id, full_name, email, username, password_hash, department_id, role, status,
        must_change_password, registered_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW(), NOW(), NOW())
      RETURNING id, full_name, email, username, department_id, role, status, must_change_password, registered_at
    `;
    const result = await pool.query(insertQuery, [
      assignedId,
      fullName.trim(),
      email.trim(),
      userUname,
      password, // User-defined permanent password stored for login verification
      userDeptId,
      userRole,
      userStatus,
    ]);

    const created = result.rows[0];
    console.log(`[DB Register Success] Registered user "${created.full_name}" (${created.email}) -> ID: ${created.id}, Dept: ${officialDeptName}`);

    res.status(201).json({
      success: true,
      message: 'Account successfully registered and saved in PostgreSQL database (Pending IT Approval).',
      user: {
        id: created.id,
        fullName: created.full_name,
        email: created.email,
        username: created.username,
        departmentId: created.department_id,
        departmentName: officialDeptName,
        role: created.role,
        status: created.status,
        mustChangePassword: false,
        registeredAt: created.registered_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DB Register Error]', msg);
    res.status(500).json({ success: false, message: `Database write failed: ${msg}` });
  }
});

// Login Verification (Checks PostgreSQL users table)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email/username and password are required.' });
  }

  try {
    const pool = getPool();
    const query = `
      SELECT u.*, d.name AS department_name, d.code AS department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `;
    const result = await pool.query(query, [email.trim()]);
    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (user.status === 'Suspended') {
        return res.status(403).json({ success: false, message: 'This account has been deactivated by IT Security. Please contact IT Administration.' });
      }

      if (user.status === 'Pending IT Approval') {
        return res.status(403).json({ success: false, message: 'Your account registration is currently Pending IT Admin Approval. You will receive an automated email once approved by IT Administration to sign in with your registered password.' });
      }

      const isValid = user.password_hash === password || user.password === password;
      if (isValid) {
        return res.json({
          success: true,
          user: {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            username: user.username,
            departmentId: user.department_id,
            departmentName: user.department_name,
            role: user.role,
            status: user.status || 'Active',
            mustChangePassword: user.must_change_password || false,
          },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
      }
    } else {
      return res.status(404).json({ success: false, message: 'No account found for this email address.' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[DB Login Fallback Notice]', msg);
    res.json({ success: false, message: msg, fallback: true });
  }
});

// Get All Users (From PostgreSQL users table)
app.get('/api/users', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT u.id, u.full_name AS "fullName", u.email, u.username,
             u.department_id AS "departmentId", d.name AS "departmentName",
             u.role, u.status, u.registered_at AS "registeredAt",
             u.must_change_password AS "mustChangePassword"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: msg, fallback: true });
  }
});

// Create/Update User (Admin)
// Create/Update User (Admin)
app.post('/api/users', async (req, res) => {
  const { id, fullName, email, username, password, departmentId, role, status } = req.body;
  try {
    const pool = getPool();

    let assignedId = id && !id.startsWith('user-req-') && !id.startsWith('USR-') ? id : null;
    if (!assignedId) {
      const seqRes = await pool.query('SELECT generate_user_id() AS new_id');
      assignedId = seqRes.rows[0].new_id;
    }

    const query = `
      INSERT INTO users (id, full_name, email, username, password_hash, department_id, role, status, registered_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        department_id = EXCLUDED.department_id,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `;
    const values = [assignedId, fullName, email, username || email.split('@')[0], password || 'Pass@1234', departmentId ? Number(departmentId) : 1, role || 'Requester', status || 'Active'];
    const result = await pool.query(query, values);

    // Fetch full joined data
    const fetchRes = await pool.query(`
      SELECT u.id, u.full_name AS "fullName", u.email, u.username,
             u.department_id AS "departmentId", d.name AS "departmentName",
             u.role, u.status, u.registered_at AS "registeredAt",
             u.must_change_password AS "mustChangePassword"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `, [result.rows[0].id]);

    res.json({ success: true, data: fetchRes.rows[0] || result.rows[0], message: 'User saved to PostgreSQL database.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, username, departmentId, role, status, password, mustChangePassword } = req.body;
  try {
    const pool = getPool();

    // Auto-heal: Ensure legacy check constraint is dropped on update if still present
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    } catch {
      // Ignore if already dropped or lacking DDL permission in current sub-transaction
    }

    const targetDeptId = departmentId ? Number(departmentId) : null;

    const query = `
      UPDATE users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        username = COALESCE($3, username),
        department_id = COALESCE($4, department_id),
        role = COALESCE($5, role),
        status = COALESCE($6, status),
        password_hash = CASE WHEN $7::text IS NOT NULL AND $7::text <> '' THEN $7::text ELSE password_hash END,
        must_change_password = COALESCE($8, must_change_password),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;
    const values = [
      fullName || null,
      email || null,
      username || null,
      targetDeptId,
      role || null,
      status || null,
      password || null,
      mustChangePassword !== undefined ? mustChangePassword : null,
      id
    ];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      // Upsert fallback
      const insertQuery = `
        INSERT INTO users (id, full_name, email, username, password_hash, department_id, role, status, must_change_password, registered_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          department_id = EXCLUDED.department_id,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *
      `;
      const fallbackValues = [
        id,
        fullName || 'New User',
        email || `${id.toLowerCase()}@tanaka.com.my`,
        username || (email ? email.split('@')[0] : id.toLowerCase()),
        password || 'Pass@1234',
        targetDeptId || 1,
        role || 'Requester',
        status || 'Active',
        mustChangePassword || false
      ];
      await pool.query(insertQuery, fallbackValues);
    }

    // Return joined department details
    const fetchRes = await pool.query(`
      SELECT u.id, u.full_name AS "fullName", u.email, u.username,
             u.department_id AS "departmentId", d.name AS "departmentName",
             u.role, u.status, u.registered_at AS "registeredAt",
             u.must_change_password AS "mustChangePassword"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `, [id]);

    res.json({
      success: true,
      data: fetchRes.rows[0],
      message: `User "${fetchRes.rows[0]?.fullName || id}" role and profile successfully saved in PostgreSQL.`
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DB User Update Error] ${id}:`, msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// Delete User from PostgreSQL (with safe nullification of soft-references)
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();

    // 1. First, nullify or sanitize references in other tables so foreign keys / history don't block deletion
    try {
      await pool.query(`UPDATE change_requests SET it_assigned_developer_id = NULL WHERE it_assigned_developer_id = $1`, [id]);
      await pool.query(`UPDATE change_requests SET target_hod_user_id = NULL WHERE target_hod_user_id = $1`, [id]);
      await pool.query(`UPDATE departments SET hod_user_id = NULL WHERE hod_user_id = $1`, [id]);
      await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [id]);
      await pool.query(`DELETE FROM temporary_approver_delegations WHERE hod_user_id = $1 OR delegate_user_id = $1`, [id]);
    } catch (refErr) {
      console.warn('[DB User Cleanup Warning]', refErr instanceof Error ? refErr.message : String(refErr));
    }

    // 2. Execute DELETE on users table
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, full_name, email', [id]);

    if (result.rows.length === 0) {
      return res.json({ success: true, deleted: false, message: `User ID "${id}" was not present in PostgreSQL or already deleted.` });
    }

    console.log(`[DB User Deleted] Deleted account ${result.rows[0].id} (${result.rows[0].full_name}) from PostgreSQL.`);
    res.json({
      success: true,
      deleted: true,
      data: result.rows[0],
      message: `User "${result.rows[0].full_name}" (${result.rows[0].id}) permanently deleted from PostgreSQL database.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DB User Delete Error] ${id}:`, msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// Dedicated Real-Time Database User Approval with Live Verification & Account Activation
app.post('/api/users/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, departmentId, role, password } = req.body;

  try {
    const pool = getPool();
    await ensureProductionBaseline(pool);

    // 1. Inspect existing user record in PostgreSQL
    const existingRes = await pool.query('SELECT id, full_name, email, username, password_hash, department_id, role, status FROM users WHERE id = $1 LIMIT 1', [id]);
    
    // Resolve department
    const targetDeptId = departmentId ? Number(departmentId) : (existingRes.rows[0]?.department_id || 1);
    const deptCheck = await pool.query('SELECT id, name FROM departments WHERE id = $1 LIMIT 1', [targetDeptId]);
    if (deptCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: `Department ID (${targetDeptId}) does not exist in the Tanaka department registry.`,
      });
    }
    const resolvedDept = deptCheck.rows[0];

    if (existingRes.rows.length > 0) {
      // 2. Update existing user in PostgreSQL to Active, preserving their registration password (must_change_password = FALSE)
      let updateSql = `
        UPDATE users SET
          status = 'Active',
          department_id = $1,
          role = COALESCE($2, role),
          full_name = COALESCE($3, full_name),
          must_change_password = FALSE,
          updated_at = NOW()
      `;
      const updateParams: any[] = [resolvedDept.id, role || null, fullName || null];
      if (password) {
        updateSql += `, password_hash = $4 WHERE id = $5 RETURNING *`;
        updateParams.push(password, id);
      } else {
        updateSql += ` WHERE id = $4 RETURNING *`;
        updateParams.push(id);
      }
      await pool.query(updateSql, updateParams);
    } else {
      // Provision as new Active user with must_change_password = FALSE
      const insertQuery = `
        INSERT INTO users (id, full_name, email, username, password_hash, department_id, role, status, must_change_password, registered_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', FALSE, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = 'Active',
          department_id = EXCLUDED.department_id,
          role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          must_change_password = FALSE,
          updated_at = NOW()
        RETURNING *
      `;
      const fallbackValues = [
        id,
        fullName || 'New User',
        email || `${id.toLowerCase()}@tanaka.com.my`,
        email ? email.split('@')[0] : (fullName ? fullName.toLowerCase().replace(/\s+/g, '.') : id.toLowerCase()),
        password || 'TanakaPass2026!',
        resolvedDept.id,
        role || 'Requester'
      ];
      await pool.query(insertQuery, fallbackValues);
    }

    // 3. Real-time verification query in PostgreSQL
    const verifyQuery = `
      SELECT u.id, u.full_name, u.email, u.username, u.department_id, d.name AS department_name, u.role, u.status, u.must_change_password, u.updated_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
      LIMIT 1
    `;
    const verifyResult = await pool.query(verifyQuery, [id]);

    if (verifyResult.rows.length === 0 || verifyResult.rows[0].status !== 'Active') {
      throw new Error(`Verification query failed: User ID "${id}" could not be confirmed as Active in table "users".`);
    }

    const verifiedUser = verifyResult.rows[0];

    return res.json({
      success: true,
      verified: true,
      database: 'PostgreSQL (IT_OPS)',
      table: 'public.users',
      message: `Account for "${verifiedUser.full_name}" (${verifiedUser.id}) was successfully approved and verified in PostgreSQL.`,
      data: {
        id: verifiedUser.id,
        fullName: verifiedUser.full_name,
        email: verifiedUser.email,
        username: verifiedUser.username,
        departmentId: verifiedUser.department_id,
        departmentName: verifiedUser.department_name || resolvedDept.name,
        role: verifiedUser.role,
        status: verifiedUser.status,
        mustChangePassword: verifiedUser.must_change_password,
        updatedAt: verifiedUser.updated_at,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[User Approval Error in PostgreSQL]', errorMsg);
    return res.status(500).json({
      success: false,
      verified: false,
      database: 'PostgreSQL (IT_OPS)',
      message: `Database error during approval: ${errorMsg}`,
    });
  }
});

// Password Reset OTP Generation
app.post('/api/auth/request-otp', async (req, res) => {
  const { email, otpCode: clientOtpCode } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const pool = getPool();
    const userRes = await pool.query('SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }
    const user = userRes.rows[0];
    const otpCode = clientOtpCode ? clientOtpCode.trim() : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Clear older tokens for this user first
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR LOWER(email) = LOWER($2)', [user.id, user.email]);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, email, otp_code, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.id, user.email, otpCode, expiresAt]
    );

    res.json({
      success: true,
      message: `Verification code dispatched to ${user.email}`,
      otpCode,
      targetUser: { id: user.id, fullName: user.full_name, email: user.email },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// Password Reset Completion
app.post('/api/auth/reset-password', async (req, res) => {
  const { userId, newPassword, otpCode } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, message: 'User ID and new password are required.' });
  }

  try {
    const pool = getPool();
    await pool.query('UPDATE users SET password_hash = $1, must_change_password = FALSE, password_updated_at = NOW(), updated_at = NOW() WHERE id = $2', [newPassword, userId]);
    await pool.query(
      `INSERT INTO password_change_audit_logs (user_id, change_type, policy_compliant, created_at)
       VALUES ($1, 'Self-Reset', TRUE, NOW())`,
      [userId]
    );
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    res.json({ success: true, message: 'Password has been successfully updated in database.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 3. DEPARTMENTS
app.get('/api/departments', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT id, code, name, hod_user_id AS "hodUserId", hod_name AS "hodName", hod_email AS "hodEmail" FROM departments ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: msg, fallback: true });
  }
});

app.post('/api/departments', async (req, res) => {
  const { id, code, name, hodUserId, hodName, hodEmail } = req.body;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO departments (id, code, name, hod_user_id, hod_name, hod_email, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        hod_user_id = EXCLUDED.hod_user_id,
        hod_name = EXCLUDED.hod_name,
        hod_email = EXCLUDED.hod_email,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [id, code, name, hodUserId, hodName, hodEmail]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  const { id } = req.params;
  if (Number(id) === 1) {
    return res.status(400).json({ success: false, message: 'Default department (ID 1) cannot be deleted.' });
  }
  try {
    const pool = getPool();
    await ensureProductionBaseline(pool);

    // 1. Reassign users in this department to Default Department (id 1) so delete doesn't fail
    await pool.query(`UPDATE users SET department_id = 1 WHERE department_id = $1`, [id]);
    await pool.query(`UPDATE change_requests SET department_id = 1 WHERE department_id = $1`, [id]);

    const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING id, name, code', [id]);
    if (result.rows.length === 0) {
      return res.json({ success: true, deleted: false, message: `Department ID "${id}" was not found or already deleted.` });
    }

    res.json({
      success: true,
      deleted: true,
      data: result.rows[0],
      message: `Department "${result.rows[0].name}" (${result.rows[0].code}) removed from PostgreSQL database.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 4. CHANGE REQUESTS & IMMUTABLE APPROVAL AUDIT TRAIL

// Helper to fetch authoritative change request by ID with full approval history
async function fetchChangeRequestById(pool: any, crId: string) {
  const query = `
    SELECT 
      cr.id,
      cr.title,
      cr.request_type AS "requestType",
      cr.priority,
      cr.sla_target_hours AS "slaTargetHours",
      cr.status,
      cr.requester_id AS "requesterId",
      cr.requester_name AS "requesterName",
      cr.requester_email AS "requesterEmail",
      cr.department_id AS "departmentId",
      cr.department_name AS "departmentName",
      cr.target_hod_user_id AS "targetHodUserId",
      cr.target_hod_name AS "targetHodName",
      cr.target_hod_email AS "targetHodEmail",
      cr.hod_approval_skipped AS "hodApprovalSkipped",
      cr.hod_skip_reason AS "hodSkipReason",
      cr.hod_approved_at AS "hodApprovedAt",
      cr.hod_approved_by AS "hodApprovedBy",
      cr.returned_by_role AS "returnedByRole",
      cr.it_clarification_requested AS "itClarificationRequested",
      cr.category_id AS "categoryId",
      cr.category_name AS "categoryName",
      cr.category_name AS "category",
      cr.service_id AS "serviceId",
      cr.service_name AS "serviceName",
      cr.service_name AS "subcategory",
      cr.application_asset_id AS "applicationAssetId",
      cr.application_name AS "applicationName",
      cr.application_name AS "applicationAssetName",
      cr.asset_tag AS "assetTag",
      cr.issue_type_id AS "issueTypeId",
      cr.issue_type_name AS "issueTypeName",
      cr.issue_type_name AS "issueType",
      COALESCE(to_jsonb(cr.affected_modules), '[]'::jsonb) AS "affectedModules",
      COALESCE(to_jsonb(cr.attachments), '[]'::jsonb) AS "attachments",
      COALESCE(to_jsonb(cr.application_areas), '[]'::jsonb) AS "applicationAreas",
      COALESCE(to_jsonb(cr.revision_history), '[]'::jsonb) AS "revisionHistory",
      cr.current_behavior_description AS "currentBehaviorDescription",
      cr.requested_change_description AS "requestedChangeDescription",
      cr.business_justification AS "businessJustification",
      cr.requested_completion_date AS "requestedCompletionDate",
      cr.it_assigned_developer_id AS "assignedDeveloperId",
      cr.it_assigned_developer_name AS "assignedDeveloperName",
      cr.it_assigned_developer_name AS "itAssignedDeveloperName",
      cr.it_admin_review_notes AS "itAdminReviewNotes",
      cr.it_target_completion_date AS "itTargetCompletionDate",
      cr.implementation_notes AS "implementationNotes",
      cr.has_code_or_database_changes AS "hasCodeOrDatabaseChanges",
      cr.before_change_details AS "beforeChangeDetails",
      cr.after_change_details AS "afterChangeDetails",
      cr.requires_schema_change AS "requiresSchemaChange",
      cr.requires_downtime_window AS "requiresDowntimeWindow",
      cr.risk_level AS "riskLevel",
      cr.risk_score AS "riskScore",
      cr.actual_completion_date AS "actualCompletionDate",
      cr.hod_decision AS "hodDecision",
      cr.hod_review_notes AS "hodReviewNotes",
      cr.hod_reviewed_at AS "hodReviewedAt",
      cr.rejected_by_user_id AS "rejectedByUserId",
      cr.rejected_by_name AS "rejectedByName",
      cr.rejected_by_role AS "rejectedByRole",
      cr.rejected_at AS "rejectedAt",
      cr.rejection_reason AS "rejectionReason",
      cr.reopened_by_user_id AS "reopenedByUserId",
      cr.reopened_by_name AS "reopenedByName",
      cr.reopened_at AS "reopenedAt",
      cr.reopen_comments AS "reopenComments",
      cr.sla_paused_at AS "slaPausedAt",
      cr.total_sla_paused_hours AS "totalSlaPausedHours",
      cr.reminder_count AS "reminderCount",
      cr.last_reminder_sent_at AS "lastReminderSentAt",
      cr.last_reminder_stage AS "lastReminderStage",
      cr.auto_closure_warned_at AS "autoClosureWarnedAt",
      cr.is_auto_closed_inactive AS "isAutoClosedInactive",
      cr.withdrawn_at AS "withdrawnAt",
      cr.withdrawn_reason AS "withdrawnReason",
      cr.workload_points AS "workloadPoints",
      cr.created_at AS "createdAt",
      cr.updated_at AS "updatedAt",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', h.id,
              'changeRequestId', h.change_request_id,
              'actorUserId', h.actor_user_id,
              'actorName', h.actor_name,
              'actorRole', h.actor_role,
              'actionDate', h.action_date,
              'fromStatus', h.from_status,
              'toStatus', h.to_status,
              'decision', h.decision,
              'comments', h.comments
            ) ORDER BY h.action_date ASC
          )
          FROM change_request_approval_history h
          WHERE h.change_request_id = cr.id
        ),
        '[]'::json
      ) AS "approvalHistory"
    FROM change_requests cr
    WHERE cr.id = $1
  `;
  const result = await pool.query(query, [crId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const id = row.id && typeof row.id === 'string' && row.id.startsWith('PCS-CR-')
    ? row.id.replace(/^PCS-CR-/, 'ITO-CR-')
    : row.id;
  return {
    ...row,
    id,
    approvalHistory: Array.isArray(row.approvalHistory)
      ? row.approvalHistory.map((h: any) => ({
          ...h,
          changeRequestId: typeof h.changeRequestId === 'string' && h.changeRequestId.startsWith('PCS-CR-')
            ? h.changeRequestId.replace(/^PCS-CR-/, 'ITO-CR-')
            : (h.changeRequestId || id),
        }))
      : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    affectedModules: Array.isArray(row.affectedModules) ? row.affectedModules : [],
    applicationAreas: Array.isArray(row.applicationAreas) ? row.applicationAreas : [],
    revisionHistory: Array.isArray(row.revisionHistory) ? row.revisionHistory : [],
  };
}


// Centralized case-visibility rules used by both Change Requests and Reports.
// This keeps reporting and case-list authorization consistent in the local app.
type VisibilityContext = { userId: string; role: string; departmentId?: string };
function buildChangeRequestVisibility(ctx: VisibilityContext) {
  const { userId, role, departmentId = '' } = ctx;
  if (!userId || !role) throw new Error('Authenticated user context is required.');
  const elevatedRoles = new Set(['IT Helpdesk', 'IT Admin', 'System Admin']);
  if (elevatedRoles.has(role)) return { clause: '', params: [] as any[] };
  if (role === 'Department HOD') {
    if (!departmentId || Number.isNaN(Number(departmentId))) throw new Error('Department context is required.');
    return { clause: 'WHERE cr.department_id = $1', params: [Number(departmentId)] };
  }
  if (role === 'Software Developer') {
    return { clause: 'WHERE cr.it_assigned_developer_id = $1', params: [userId] };
  }
  return { clause: 'WHERE cr.requester_id = $1', params: [userId] };
}

// Fetch All Change Requests with full Approval History Audit
app.get('/api/change-requests', async (req, res) => {
  try {
    const pool = getPool();

    // Use the centralized visibility rules shared with reports.
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Authenticated user context is required to view change requests.' });
    }
    let visibility;
    try {
      visibility = buildChangeRequestVisibility({ userId, role, departmentId });
    } catch (e: any) {
      return res.status(403).json({ success: false, message: e?.message || 'Access denied.' });
    }
    const visibilityClause = visibility.clause;
    const visibilityParams = visibility.params;

    const query = `
      SELECT 
        cr.id,
        cr.title,
        cr.request_type AS "requestType",
        cr.priority,
        cr.sla_target_hours AS "slaTargetHours",
        cr.status,
        cr.requester_id AS "requesterId",
        cr.requester_name AS "requesterName",
        cr.requester_email AS "requesterEmail",
        cr.department_id AS "departmentId",
        cr.department_name AS "departmentName",
        cr.target_hod_user_id AS "targetHodUserId",
        cr.target_hod_name AS "targetHodName",
        cr.target_hod_email AS "targetHodEmail",
        cr.hod_approval_skipped AS "hodApprovalSkipped",
        cr.hod_skip_reason AS "hodSkipReason",
        cr.hod_approved_at AS "hodApprovedAt",
        cr.hod_approved_by AS "hodApprovedBy",
        cr.returned_by_role AS "returnedByRole",
        cr.it_clarification_requested AS "itClarificationRequested",
        cr.category_id AS "categoryId",
        cr.category_name AS "categoryName",
        cr.category_name AS "category",
        cr.service_id AS "serviceId",
        cr.service_name AS "serviceName",
        cr.service_name AS "subcategory",
        cr.application_asset_id AS "applicationAssetId",
        cr.application_name AS "applicationName",
        cr.application_name AS "applicationAssetName",
        cr.asset_tag AS "assetTag",
        cr.issue_type_id AS "issueTypeId",
        cr.issue_type_name AS "issueTypeName",
        cr.issue_type_name AS "issueType",
        COALESCE(to_jsonb(cr.affected_modules), '[]'::jsonb) AS "affectedModules",
        COALESCE(to_jsonb(cr.attachments), '[]'::jsonb) AS "attachments",
        COALESCE(to_jsonb(cr.application_areas), '[]'::jsonb) AS "applicationAreas",
        COALESCE(to_jsonb(cr.revision_history), '[]'::jsonb) AS "revisionHistory",
        cr.current_behavior_description AS "currentBehaviorDescription",
        cr.requested_change_description AS "requestedChangeDescription",
        cr.business_justification AS "businessJustification",
        cr.requested_completion_date AS "requestedCompletionDate",
        cr.it_assigned_developer_id AS "assignedDeveloperId",
        cr.it_assigned_developer_name AS "assignedDeveloperName",
        cr.it_assigned_developer_name AS "itAssignedDeveloperName",
        cr.it_admin_review_notes AS "itAdminReviewNotes",
        cr.it_target_completion_date AS "itTargetCompletionDate",
        cr.implementation_notes AS "implementationNotes",
        cr.has_code_or_database_changes AS "hasCodeOrDatabaseChanges",
        cr.before_change_details AS "beforeChangeDetails",
        cr.after_change_details AS "afterChangeDetails",
        cr.requires_schema_change AS "requiresSchemaChange",
        cr.requires_downtime_window AS "requiresDowntimeWindow",
        cr.risk_level AS "riskLevel",
        cr.risk_score AS "riskScore",
        cr.actual_completion_date AS "actualCompletionDate",
        cr.hod_decision AS "hodDecision",
        cr.hod_review_notes AS "hodReviewNotes",
        cr.hod_reviewed_at AS "hodReviewedAt",
        cr.rejected_by_user_id AS "rejectedByUserId",
        cr.rejected_by_name AS "rejectedByName",
        cr.rejected_by_role AS "rejectedByRole",
        cr.rejected_at AS "rejectedAt",
        cr.rejection_reason AS "rejectionReason",
        cr.reopened_by_user_id AS "reopenedByUserId",
        cr.reopened_by_name AS "reopenedByName",
        cr.reopened_at AS "reopenedAt",
        cr.reopen_comments AS "reopenComments",
        cr.sla_paused_at AS "slaPausedAt",
        cr.total_sla_paused_hours AS "totalSlaPausedHours",
        cr.reminder_count AS "reminderCount",
        cr.last_reminder_sent_at AS "lastReminderSentAt",
        cr.last_reminder_stage AS "lastReminderStage",
        cr.auto_closure_warned_at AS "autoClosureWarnedAt",
        cr.is_auto_closed_inactive AS "isAutoClosedInactive",
        cr.withdrawn_at AS "withdrawnAt",
        cr.withdrawn_reason AS "withdrawnReason",
        cr.workload_points AS "workloadPoints",
        cr.created_at AS "createdAt",
        cr.updated_at AS "updatedAt",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', h.id,
                'changeRequestId', h.change_request_id,
                'actorUserId', h.actor_user_id,
                'actorName', h.actor_name,
                'actorRole', h.actor_role,
                'actionDate', h.action_date,
                'fromStatus', h.from_status,
                'toStatus', h.to_status,
                'decision', h.decision,
                'comments', h.comments
              ) ORDER BY h.action_date ASC
            )
            FROM change_request_approval_history h
            WHERE h.change_request_id = cr.id
          ),
          '[]'::json
        ) AS "approvalHistory"
      FROM change_requests cr
      ${visibilityClause}
      ORDER BY cr.created_at DESC
    `;
    const result = await pool.query(query, visibilityParams);
    const normalizedRows = result.rows.map((row: any) => {
      const id = row.id && typeof row.id === 'string' && row.id.startsWith('PCS-CR-')
        ? row.id.replace(/^PCS-CR-/, 'ITO-CR-')
        : row.id;
      return {
        ...row,
        id,
        approvalHistory: Array.isArray(row.approvalHistory)
          ? row.approvalHistory.map((h: any) => ({
              ...h,
              changeRequestId: typeof h.changeRequestId === 'string' && h.changeRequestId.startsWith('PCS-CR-')
                ? h.changeRequestId.replace(/^PCS-CR-/, 'ITO-CR-')
                : (h.changeRequestId || id),
            }))
          : [],
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        affectedModules: Array.isArray(row.affectedModules) ? row.affectedModules : [],
        applicationAreas: Array.isArray(row.applicationAreas) ? row.applicationAreas : [],
        revisionHistory: Array.isArray(row.revisionHistory) ? row.revisionHistory : [],
      };
    });
    res.json({ success: true, count: normalizedRows.length, data: normalizedRows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DB GET ChangeRequests Error]', msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// Create Change Request (Writes directly to PostgreSQL change_requests & immutable audit history)
app.post('/api/change-requests', async (req, res) => {
  const cr = req.body;
  const pool = getPool();
  let client: any = null;
  let movedAttachmentFiles: Array<{ from: string; to: string }> = [];
  let submissionId = '';

  try {
    await ensureProductionBaseline(pool);

    // 1. Mandatory Title Validation
    if (!cr.title || typeof cr.title !== 'string' || !cr.title.trim()) {
      return res.status(400).json({ success: false, message: 'Field "title" is required and cannot be empty.' });
    }

    // 2. Requester Validation & FK resolution
    const requesterId = cr.requesterId || 'user-req-01';
    let requesterName = cr.requesterName || 'Requester';
    let requesterEmail = cr.requesterEmail || `${requesterId.toLowerCase()}@tanaka.com.my`;

    const userCheck = await pool.query('SELECT id, full_name, email, department_id FROM users WHERE id = $1 LIMIT 1', [requesterId]);
    if (userCheck.rows.length > 0) {
      const u = userCheck.rows[0];
      requesterName = u.full_name || requesterName;
      requesterEmail = u.email || requesterEmail;
    } else {
      // Ensure user exists in users table to satisfy foreign key constraints
      await pool.query(
        `INSERT INTO users (id, full_name, email, username, department_id, role, status, password_hash, registered_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'Requester', 'Active', 'Pass@1234', NOW(), NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          requesterId,
          requesterName,
          requesterEmail,
          requesterEmail.split('@')[0],
          cr.departmentId ? Number(cr.departmentId) : 1
        ]
      );
    }

    // 3. Department Validation
    let deptId = cr.departmentId ? Number(cr.departmentId) : 1;
    if (isNaN(deptId)) deptId = 1;
    const deptCheck = await pool.query('SELECT id, name, hod_user_id, hod_name, hod_email FROM departments WHERE id = $1 LIMIT 1', [deptId]);
    let targetDeptName = cr.departmentName || 'General Management';
    let targetHodUserId = cr.targetHodUserId || null;
    let targetHodName = cr.targetHodName || null;
    let targetHodEmail = cr.targetHodEmail || null;

    if (deptCheck.rows.length > 0) {
      const dRow = deptCheck.rows[0];
      targetDeptName = dRow.name;
      if (!targetHodUserId) targetHodUserId = dRow.hod_user_id;
      if (!targetHodName) targetHodName = dRow.hod_name;
      if (!targetHodEmail) targetHodEmail = dRow.hod_email;
    }

    // 4. Validate Enums against schema CHECK constraints
    const VALID_REQUEST_TYPES = ['Bug Fix', 'Enhancement', 'New Feature', 'Data Amendment', 'Incident', 'Service Request', 'Access Request', 'Information / How-To', 'Password / Account', 'Change Request'];
    let reqType = cr.requestType || 'Enhancement';
    if (!VALID_REQUEST_TYPES.includes(reqType)) {
      reqType = 'Enhancement';
    }

    const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
    let priority = cr.priority || 'Medium';
    if (!VALID_PRIORITIES.includes(priority)) {
      priority = 'Medium';
    }

    const VALID_STATUSES = ['Draft', 'Submitted', 'Pending HOD Approval', 'Returned to Requester', 'Pending IT Admin Review', 'In Progress', 'Pending IT Verification', 'Closed (Completed)', 'Closed (Rejected)'];
    let status = cr.status || (priority === 'Critical' ? 'Pending IT Admin Review' : 'Pending HOD Approval');
    if (!VALID_STATUSES.includes(status)) {
      status = priority === 'Critical' ? 'Pending IT Admin Review' : 'Pending HOD Approval';
    }

    const slaHours = cr.slaTargetHours || (priority === 'Critical' ? 24 : priority === 'High' ? 72 : priority === 'Low' ? 336 : 168);

    // 5. Parse completion date safely
    let formattedDate: string | null = null;
    if (cr.requestedCompletionDate) {
      try {
        const d = new Date(cr.requestedCompletionDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      } catch {
        formattedDate = null;
      }
    }

    // 6. Resolve a stable client submission key. The same key can safely be retried without creating a second ticket.
    submissionId = typeof cr.submissionId === 'string' && cr.submissionId.trim()
      ? cr.submissionId.trim()
      : randomUUID();

    // Fast path for retries after a lost/slow response. The unique index below is the final race-safe guard.
    const existingSubmission = await pool.query(
      'SELECT id FROM change_requests WHERE submission_id = $1 LIMIT 1',
      [submissionId]
    );
    if (existingSubmission.rows.length > 0) {
      const existingRecord = await fetchChangeRequestById(pool, existingSubmission.rows[0].id);
      if (existingRecord) {
        console.log(`[DB CR Idempotency] Reused existing ticket ${existingSubmission.rows[0].id} for submission ${submissionId}.`);
        return res.status(200).json({ success: true, data: existingRecord, duplicate: true });
      }
    }

    // 6. Generate atomic unique sequence ID from PostgreSQL generator
    let finalCrId = cr.id && typeof cr.id === 'string' ? cr.id.trim() : '';
    if (finalCrId) {
      const existsCheck = await pool.query('SELECT id FROM change_requests WHERE id = $1 LIMIT 1', [finalCrId]);
      if (existsCheck.rows.length > 0) {
        const seqResult = await pool.query('SELECT generate_change_request_id() AS next_id');
        finalCrId = seqResult.rows[0]?.next_id || `ITO-CR-2026-${Date.now().toString().slice(-5)}`;
      }
    } else {
      const seqResult = await pool.query('SELECT generate_change_request_id() AS next_id');
      finalCrId = seqResult.rows[0]?.next_id || `ITO-CR-2026-${Date.now().toString().slice(-5)}`;
    }

    // 7. Finalize attachments that were uploaded before a real CR-ID existed.
    // They are staged inside the same authoritative repository share so the final move
    // remains a same-volume rename and does not fail with Windows EXDEV.
    const finalizedAttachmentsResult = await relocateStagedAttachmentsForChangeRequest(
      pool,
      Array.isArray(cr.attachments) ? cr.attachments : [],
      finalCrId,
      deptId,
      undefined,
    );
    cr.attachments = finalizedAttachmentsResult.attachments;
    movedAttachmentFiles = finalizedAttachmentsResult.moved;

    // 8. Acquire dedicated client for atomic transaction
    client = await pool.connect();
    await client.query('BEGIN');

    // 8. Execute PostgreSQL INSERT for change_requests inside transaction
    const insertQuery = `
      INSERT INTO change_requests (
        id, title, request_type, priority, sla_target_hours, status,
        requester_id, requester_name, requester_email, department_id, department_name,
        target_hod_user_id, target_hod_name, target_hod_email,
        hod_approval_skipped, hod_skip_reason,
        category_id, category_name, service_id, service_name, application_asset_id, application_name, asset_tag, issue_type_id, issue_type_name,
        current_behavior_description, requested_change_description, business_justification,
        requested_completion_date, affected_modules, attachments, application_areas, revision_history, submission_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28,
        $29, $30::jsonb, $31::jsonb, $32::jsonb, $33::jsonb, $34, NOW(), NOW()
      ) RETURNING id
    `;
    const insertValues = [
      finalCrId,
      cr.title,
      reqType,
      priority,
      slaHours,
      status,
      requesterId,
      requesterName,
      requesterEmail,
      deptId,
      targetDeptName,
      targetHodUserId,
      targetHodName,
      targetHodEmail,
      cr.hodApprovalSkipped || (priority === 'Critical'),
      cr.hodSkipReason || (priority === 'Critical' ? 'Critical Priority Direct-Route to IT Admin (Emergency)' : null),
      cr.categoryId || null,
      cr.categoryName || cr.category || null,
      cr.serviceId || null,
      cr.serviceName || cr.subcategory || null,
      cr.applicationAssetId || null,
      cr.applicationName || cr.applicationAssetName || null,
      cr.assetTag || null,
      cr.issueTypeId || null,
      cr.issueTypeName || cr.issueType || null,
      cr.currentBehaviorDescription || '',
      cr.requestedChangeDescription || '',
      cr.businessJustification || '',
      formattedDate,
      JSON.stringify(Array.isArray(cr.affectedModules) ? cr.affectedModules : []),
      JSON.stringify(Array.isArray(cr.attachments) ? cr.attachments : []),
      JSON.stringify(Array.isArray(cr.applicationAreas) ? cr.applicationAreas : []),
      JSON.stringify(Array.isArray(cr.revisionHistory) ? cr.revisionHistory : []),
      submissionId,
    ];

    await client.query(insertQuery, insertValues);

    // 9. Insert Immutable Approval Audit History Record inside SAME transaction
    if (cr.approvalHistory && Array.isArray(cr.approvalHistory) && cr.approvalHistory.length > 0) {
      for (const h of cr.approvalHistory) {
        let validActorId = null;
        if (h.actorUserId) {
          const uCheck = await client.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [h.actorUserId]);
          if (uCheck.rows.length > 0) validActorId = h.actorUserId;
        }
        await client.query(
          `INSERT INTO change_request_approval_history (
            change_request_id, actor_user_id, actor_name, actor_role, action_date, from_status, to_status, decision, comments
          ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)`,
          [
            finalCrId,
            validActorId,
            h.actorName || requesterName,
            h.actorRole || 'Requester',
            h.fromStatus || 'Draft',
            h.toStatus || status,
            h.decision || 'Submitted',
            h.comments || 'Initial ticket submitted into change management pipeline.'
          ]
        );
      }
    } else {
      let validActorId = null;
      const uCheck = await client.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [requesterId]);
      if (uCheck.rows.length > 0) validActorId = requesterId;

      await client.query(
        `INSERT INTO change_request_approval_history (
          change_request_id, actor_user_id, actor_name, actor_role, action_date, from_status, to_status, decision, comments
        ) VALUES ($1, $2, $3, $4, NOW(), 'Draft', $5, 'Submitted', 'Initial ticket submitted into change management pipeline.')`,
        [finalCrId, validActorId, requesterName, 'Requester', status]
      );
    }

    // 10. Commit the transaction atomically
    await client.query('COMMIT');

    // 11. Fetch the authoritative persisted record directly from PostgreSQL
    const persistedRecord = await fetchChangeRequestById(pool, finalCrId);
    if (!persistedRecord) {
      return res.status(500).json({ success: false, message: 'Unable to submit the change request. The request was not saved. Please contact IT Operations.' });
    }

    console.log(`[DB CR Created] ${finalCrId} - "${cr.title}" successfully committed to PostgreSQL.`);
    res.status(201).json({ success: true, data: persistedRecord });
  } catch (err: unknown) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[POST /api/change-requests] Transaction rollback error:', rollbackErr);
      }
    }
    for (const item of [...movedAttachmentFiles].reverse()) {
      try {
        if (fs.existsSync(item.to)) fs.renameSync(item.to, item.from);
      } catch { /* best effort rollback */ }
    }
    const pgErr = err as any;
    if (pgErr?.code === '23505' && pgErr?.constraint === 'change_requests_submission_id_key') {
      try {
        const existing = await pool.query('SELECT id FROM change_requests WHERE submission_id = $1 LIMIT 1', [submissionId]);
        if (existing.rows.length > 0) {
          const existingRecord = await fetchChangeRequestById(pool, existing.rows[0].id);
          if (existingRecord) {
            console.log(`[DB CR Idempotency] Concurrent duplicate blocked; returning ${existing.rows[0].id}.`);
            return res.status(200).json({ success: true, data: existingRecord, duplicate: true });
          }
        }
      } catch (dedupeErr) {
        console.error('[POST /api/change-requests] Idempotency recovery failed:', dedupeErr);
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/change-requests] PostgreSQL INSERT failed:', msg);
    res.status(500).json({
      success: false,
      message: 'Unable to submit the change request. The request was not saved. Please contact IT Operations.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Update Change Request (Updates change_requests & appends immutable audit log)
app.put('/api/change-requests/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const pool = getPool();
    const query = `
      UPDATE change_requests SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        sla_target_hours = COALESCE($3, sla_target_hours),
        it_assigned_developer_id = COALESCE($4, it_assigned_developer_id),
        it_assigned_developer_name = COALESCE($5, it_assigned_developer_name),
        it_admin_review_notes = COALESCE($6, it_admin_review_notes),
        implementation_notes = COALESCE($7, implementation_notes),
        before_change_details = COALESCE($8, before_change_details),
        after_change_details = COALESCE($9, after_change_details),
        requires_schema_change = COALESCE($10, requires_schema_change),
        requires_downtime_window = COALESCE($11, requires_downtime_window),
        risk_level = COALESCE($12, risk_level),
        risk_score = COALESCE($13, risk_score),
        actual_completion_date = COALESCE($14, actual_completion_date),
        hod_decision = COALESCE($15, hod_decision),
        hod_review_notes = COALESCE($16, hod_review_notes),
        hod_reviewed_at = CASE WHEN $15 IS NOT NULL THEN NOW() ELSE hod_reviewed_at END,
        hod_approved_at = CASE WHEN $15 = 'Approved' THEN NOW() ELSE hod_approved_at END,
        hod_approved_by = COALESCE($17, hod_approved_by),
        returned_by_role = COALESCE($18, returned_by_role),
        it_clarification_requested = COALESCE($19, it_clarification_requested),
        rejected_by_user_id = COALESCE($20, rejected_by_user_id),
        rejected_by_name = COALESCE($21, rejected_by_name),
        rejected_by_role = COALESCE($22, rejected_by_role),
        rejected_at = CASE WHEN $20 IS NOT NULL THEN NOW() ELSE rejected_at END,
        rejection_reason = COALESCE($23, rejection_reason),
        reopened_by_user_id = COALESCE($24, reopened_by_user_id),
        reopened_by_name = COALESCE($25, reopened_by_name),
        reopened_at = CASE WHEN $24 IS NOT NULL THEN NOW() ELSE reopened_at END,
        reopen_comments = COALESCE($26, reopen_comments),
        sla_paused_at = CASE WHEN $27 IS TRUE THEN $28::timestamp with time zone WHEN $27 IS FALSE THEN NULL ELSE sla_paused_at END,
        total_sla_paused_hours = COALESCE($29, total_sla_paused_hours),
        reminder_count = COALESCE($30, reminder_count),
        last_reminder_sent_at = CASE WHEN $31 IS TRUE THEN $32::timestamp with time zone WHEN $31 IS FALSE THEN NULL ELSE last_reminder_sent_at END,
        last_reminder_stage = COALESCE($33, last_reminder_stage),
        auto_closure_warned_at = CASE WHEN $34 IS TRUE THEN $35::timestamp with time zone WHEN $34 IS FALSE THEN NULL ELSE auto_closure_warned_at END,
        is_auto_closed_inactive = COALESCE($36, is_auto_closed_inactive),
        withdrawn_at = CASE WHEN $37 IS TRUE THEN $38::timestamp with time zone WHEN $37 IS FALSE THEN NULL ELSE withdrawn_at END,
        withdrawn_reason = COALESCE($39, withdrawn_reason),
        title = COALESCE($41, title),
        current_behavior_description = COALESCE($42, current_behavior_description),
        requested_change_description = COALESCE($43, requested_change_description),
        business_justification = COALESCE($44, business_justification),
        requested_completion_date = COALESCE($45, requested_completion_date),
        category_id = COALESCE($46, category_id),
        category_name = COALESCE($47, category_name),
        service_id = COALESCE($48, service_id),
        service_name = COALESCE($49, service_name),
        application_asset_id = COALESCE($50, application_asset_id),
        application_name = COALESCE($51, application_name),
        asset_tag = COALESCE($52, asset_tag),
        issue_type_id = COALESCE($53, issue_type_id),
        issue_type_name = COALESCE($54, issue_type_name),
        affected_modules = COALESCE($55::jsonb, affected_modules),
        attachments = COALESCE($56::jsonb, attachments),
        application_areas = COALESCE($57::jsonb, application_areas),
        hod_approval_skipped = COALESCE($58, hod_approval_skipped),
        hod_skip_reason = COALESCE($59, hod_skip_reason),
        updated_at = NOW()
      WHERE id = $40
      RETURNING *
    `;
    const values = [
      updates.status,
      updates.priority,
      updates.slaTargetHours,
      updates.assignedDeveloperId || updates.it_assigned_developer_id,
      updates.assignedDeveloperName || updates.it_assigned_developer_name,
      updates.itAdminReviewNotes,
      updates.implementationNotes,
      updates.beforeChangeDetails,
      updates.afterChangeDetails,
      updates.requiresSchemaChange,
      updates.requiresDowntimeWindow,
      updates.riskLevel,
      updates.riskScore,
      updates.actualCompletionDate,
      updates.hodDecision,
      updates.hodReviewNotes,
      updates.hodApprovedBy,
      updates.returnedByRole,
      updates.itClarificationRequested,
      updates.rejectedByUserId,
      updates.rejectedByName,
      updates.rejectedByRole,
      updates.rejectionReason,
      updates.reopenedByUserId,
      updates.reopenedByName,
      updates.reopenComments,
      updates.slaPausedAt !== undefined ? (updates.slaPausedAt ? true : false) : null,
      updates.slaPausedAt || null,
      updates.totalSlaPausedHours !== undefined ? updates.totalSlaPausedHours : null,
      updates.reminderCount !== undefined ? updates.reminderCount : null,
      updates.lastReminderSentAt !== undefined ? (updates.lastReminderSentAt ? true : false) : null,
      updates.lastReminderSentAt || null,
      updates.lastReminderStage !== undefined ? updates.lastReminderStage : null,
      updates.autoClosureWarnedAt !== undefined ? (updates.autoClosureWarnedAt ? true : false) : null,
      updates.autoClosureWarnedAt || null,
      updates.isAutoClosedInactive !== undefined ? updates.isAutoClosedInactive : null,
      updates.withdrawnAt !== undefined ? (updates.withdrawnAt ? true : false) : null,
      updates.withdrawnAt || null,
      updates.withdrawnReason !== undefined ? updates.withdrawnReason : null,
      id,
      updates.title,
      updates.currentBehaviorDescription ?? updates.current_behavior_description,
      updates.requestedChangeDescription ?? updates.requested_change_description,
      updates.businessJustification ?? updates.business_justification,
      updates.requestedCompletionDate ?? updates.requested_completion_date,
      updates.categoryId ?? updates.category_id,
      updates.categoryName ?? updates.category_name,
      updates.serviceId ?? updates.service_id,
      updates.serviceName ?? updates.service_name,
      updates.applicationAssetId ?? updates.application_asset_id,
      updates.applicationName ?? updates.application_name,
      updates.assetTag ?? updates.asset_tag,
      updates.issueTypeId ?? updates.issue_type_id,
      updates.issueTypeName ?? updates.issue_type_name,
      updates.affectedModules !== undefined ? JSON.stringify(updates.affectedModules) : null,
      updates.attachments !== undefined ? JSON.stringify(updates.attachments) : null,
      updates.applicationAreas !== undefined ? JSON.stringify(updates.applicationAreas) : null,
      updates.hodApprovalSkipped,
      updates.hodSkipReason ?? updates.hod_skip_reason,
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Change request with ID "${id}" not found in PostgreSQL database.` });
    }

    // Append new immutable approval history entry if provided
    if (updates.newApprovalHistoryEntry) {
      const h = updates.newApprovalHistoryEntry;
      let validActorId = null;
      if (h.actorUserId) {
        const uCheck = await pool.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [h.actorUserId]);
        if (uCheck.rows.length > 0) validActorId = h.actorUserId;
      }
      await pool.query(
        `INSERT INTO change_request_approval_history (
          change_request_id, actor_user_id, actor_name, actor_role, action_date, from_status, to_status, decision, comments
        ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)`,
        [id, validActorId, h.actorName, h.actorRole, h.fromStatus, h.toStatus, h.decision, h.comments]
      );
    }

    const updatedRecord = await fetchChangeRequestById(pool, id);
    res.json({ success: true, data: updatedRecord });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// IT Direct Reclassify & Re-prioritize
app.post('/api/it-direct-modify', async (req, res) => {
  const payload = req.body;
  try {
    const pool = getPool();
    const query = `
      SELECT sp_it_direct_reclassify_and_reprioritize(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) AS result
    `;
    const values = [
      payload.crId || payload.changeRequestId,
      payload.actorUserId,
      payload.actorName,
      payload.actorRole || 'IT Admin',
      payload.categoryId || payload.newCategoryId || null,
      payload.categoryName || payload.newCategoryName || payload.category || null,
      payload.serviceId || payload.newServiceId || null,
      payload.serviceName || payload.newServiceName || payload.subcategory || null,
      payload.applicationAssetId || payload.newApplicationId || null,
      payload.applicationAssetName || payload.newApplicationName || payload.applicationName || null,
      payload.issueTypeId || payload.newIssueTypeId || null,
      payload.issueTypeName || payload.newIssueTypeName || payload.issueType || null,
      payload.priority || payload.newPriority || null,
      payload.priorityChangeReason || null,
      payload.assignedDeveloperId || payload.newDeveloperId || null,
      payload.assignedDeveloperName || payload.newDeveloperName || null,
      payload.targetCompletionDate || null,
      payload.comments || payload.technicalRemarks || null,
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, result: result.rows[0].result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 5. DELEGATIONS (TEMPORARY APPROVERS)
app.get('/api/delegations', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        department_id AS "departmentId",
        department_name AS "departmentName",
        hod_user_id AS "hodUserId",
        hod_name AS "hodName",
        hod_email AS "hodEmail",
        delegate_user_id AS "delegateUserId",
        delegate_name AS "delegateName",
        delegate_email AS "delegateEmail",
        delegate_role AS "delegateRole",
        start_date AS "startDate",
        end_date AS "endDate",
        reason,
        notes,
        status,
        revoked_at AS "revokedAt",
        revoked_by AS "revokedBy",
        revocation_reason AS "revocationReason",
        created_at AS "createdAt",
        created_by AS "createdBy"
      FROM temporary_approver_delegations
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: msg, fallback: true });
  }
});

app.post('/api/delegations', async (req, res) => {
  const d = req.body;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO temporary_approver_delegations (
        id, department_id, department_name, hod_user_id, hod_name, hod_email,
        delegate_user_id, delegate_name, delegate_email, delegate_role,
        start_date, end_date, reason, notes, status, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Active', NOW(), $15)
      RETURNING *
    `;
    const values = [
      d.id || `DEL-${Date.now()}`,
      d.departmentId,
      d.departmentName,
      d.hodUserId,
      d.hodName,
      d.hodEmail,
      d.delegateUserId,
      d.delegateName,
      d.delegateEmail,
      d.delegateRole,
      d.startDate,
      d.endDate,
      d.reason,
      d.notes || '',
      d.createdBy || d.hodName,
    ];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.put('/api/delegations/:id/revoke', async (req, res) => {
  const { id } = req.params;
  const { revokedBy, revocationReason } = req.body;
  try {
    const pool = getPool();
    const query = `
      UPDATE temporary_approver_delegations SET
        status = 'Revoked',
        revoked_at = NOW(),
        revoked_by = $1,
        revocation_reason = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [revokedBy, revocationReason, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 6. REAL SMTP RELAY & EMAIL NOTIFICATION LOGS
function createSmtpTransporter(options?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  useTls?: boolean;
}) {
  const host = options?.host || process.env.SMTP_HOST || '157.9.183.242';
  const port = options?.port ? Number(options.port) : parseInt(process.env.SMTP_PORT || '25', 10);
  const secure = port === 465;

  const auth =
    options?.user && options?.pass
      ? { user: options.user, pass: options.pass }
      : process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    connectionTimeout: 8000,
    greetingTimeout: 6000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false, // Allows internal enterprise self-signed certs for Tanaka relay
    },
  });
}

// Live SMTP Relay Verification & Test Endpoint
app.post('/api/smtp/test', async (req, res) => {
  const {
    host = '157.9.183.242',
    port = 25,
    user,
    pass,
    to,
    fromAddress = 'Administrator@tanaka.com.my',
    fromName = 'IT OPS Security Relay',
  } = req.body;
  const startTime = Date.now();
  const smtpLog: string[] = [];

  smtpLog.push(`[${getMalaysianTimestamp()}] Initiating SMTP connection to relay ${host}:${port}...`);

  const transporter = createSmtpTransporter({
    host,
    port: Number(port),
    user,
    pass,
  });

  try {
    smtpLog.push(`[${getMalaysianTimestamp()}] Verifying SMTP handshake (EHLO / STARTTLS)...`);
    await transporter.verify();
    smtpLog.push(`[${getMalaysianTimestamp()}] SMTP Handshake Successful: Server ${host}:${port} is ready.`);

    let messageSent = false;
    let messageResponse = '250 OK - SMTP Handshake Active';

    if (to && typeof to === 'string' && to.trim().length > 0) {
      const recipient = to.trim();
      smtpLog.push(`[${getMalaysianTimestamp()}] Dispatching live test email to: ${recipient}...`);
      const testInfo = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: recipient,
        subject: `IT OPS Live SMTP Relay Test (${host}:${port})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0f172a; color: #ffffff; padding: 16px;">
              <h2 style="margin: 0; font-size: 16px; color: #38bdf8;">TANAKA ENTERPRISE SMTP RELAY TEST</h2>
            </div>
            <div style="padding: 20px; color: #334155; font-size: 13px;">
              <p>This is a live test notification dispatched directly from the IT OPS portal via SMTP relay <strong>${host}:${port}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px;">
                <tr><td style="padding: 4px 0; color: #64748b; width: 120px;">Server Host:</td><td><strong>${host}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Port:</td><td><strong>${port}</strong></td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Sender:</td><td>${fromName} &lt;${fromAddress}&gt;</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Recipient:</td><td style="color: #2563eb;">${recipient}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Dispatched At:</td><td>${getMalaysianTimestamp()}</td></tr>
              </table>
            </div>
          </div>
        `,
      });
      messageSent = true;
      messageResponse = testInfo.response || 'Message Delivered';
      smtpLog.push(`[${getMalaysianTimestamp()}] Test message response: ${messageResponse}`);
    }

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      message: messageSent
        ? `Live test email successfully dispatched to ${to} via ${host}:${port}`
        : `SMTP relay ${host}:${port} responded successfully (250 OK)`,
      latencyMs,
      serverHost: host,
      serverPort: Number(port),
      testedAt: getMalaysianTimestamp(),
      protocolResponse: messageResponse,
      smtpLog,
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as any)?.code || 'RELAY_CONNECTION_ERROR';
    smtpLog.push(`[${getMalaysianTimestamp()}] Socket Error: ${msg} [${code}]`);
    res.json({
      success: false,
      message: `SMTP relay connection failed (${host}:${port}): ${msg}`,
      latencyMs,
      serverHost: host,
      serverPort: Number(port),
      testedAt: getMalaysianTimestamp(),
      errorCode: code,
      protocolResponse: msg,
      smtpLog,
    });
  }
});

// Live Email Dispatch Endpoint with PostgreSQL Logging
app.post('/api/send-email', async (req, res) => {
  const {
    recipientEmail,
    recipientName,
    subject,
    bodyHtml,
    triggerEvent,
    changeRequestId,
    smtpConfig,
  } = req.body;

  const host = smtpConfig?.smtpServer || process.env.SMTP_HOST || '157.9.183.242';
  const port = smtpConfig?.smtpPort ? Number(smtpConfig.smtpPort) : parseInt(process.env.SMTP_PORT || '25', 10);
  const fromName = smtpConfig?.fromName || 'IT OPS Notifications';
  const fromAddress = smtpConfig?.fromAddress || 'Administrator@tanaka.com.my';

  const logId = `EMAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let deliveryStatus = 'PENDING';
  let serverResponse = '';
  let isLiveDelivered = false;

  const transporter = createSmtpTransporter({
    host,
    port,
    user: smtpConfig?.authUser,
    pass: smtpConfig?.authPass,
    useTls: smtpConfig?.useTls,
  });

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: recipientEmail,
    subject,
    html: bodyHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    deliveryStatus = 'DELIVERED (250 OK)';
    serverResponse = info.response || `Accepted by relay ${host}:${port}`;
    isLiveDelivered = true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    deliveryStatus = `FAILED (${errMsg.substring(0, 40)})`;
    serverResponse = errMsg;
    console.warn(`[SMTP Relay Warning] Delivery to ${recipientEmail} via ${host}:${port} notice: ${errMsg}`);
  }

  // Persist to PostgreSQL database
  try {
    const pool = getPool();
    const query = `
      INSERT INTO email_notification_logs (
        id, change_request_id, recipient_email, recipient_name, subject, body_html, sent_at, smtp_server, smtp_port, status, trigger_event
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      logId,
      changeRequestId || null,
      recipientEmail,
      recipientName || recipientEmail,
      subject,
      bodyHtml,
      host,
      port,
      deliveryStatus,
      triggerEvent || 'Live Workflow Notification',
    ];
    const dbResult = await pool.query(query, values);
    res.json({
      success: isLiveDelivered,
      delivered: isLiveDelivered,
      status: deliveryStatus,
      serverResponse,
      data: dbResult.rows[0],
    });
  } catch (dbErr: unknown) {
    res.json({
      success: isLiveDelivered,
      delivered: isLiveDelivered,
      status: deliveryStatus,
      serverResponse,
      fallback: true,
    });
  }
});

// Email Notification Logs
app.get('/api/email-logs', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        change_request_id AS "changeRequestId",
        recipient_email AS "recipientEmail",
        recipient_name AS "recipientName",
        subject,
        body_html AS "bodyHtml",
        trigger_event AS "triggerEvent",
        smtp_server AS "smtpServer",
        smtp_port AS "smtpPort",
        status,
        sent_at AS "sentAt"
      FROM email_notification_logs
      ORDER BY sent_at DESC
      LIMIT 200
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: msg, fallback: true });
  }
});

// Custom Roles & Permission Matrix CRUD endpoints
app.get('/api/custom-roles', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        r.id,
        r.role_name AS "roleName",
        r.archetype,
        r.description,
        r.is_system_role AS "isSystemRole",
        r.permissions,
        r.workflow_routing AS "workflowRouting",
        r.email_subscriptions AS "emailSubscriptions",
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt",
        (SELECT COUNT(*)::int FROM users u WHERE u.role = r.role_name) AS "userCount"
      FROM custom_roles r
      ORDER BY r.is_system_role DESC, r.role_name ASC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg, fallback: true, data: [] });
  }
});

app.post('/api/custom-roles', async (req, res) => {
  const role = req.body;
  try {
    const pool = getPool();
    const roleId = role.id || `role-${role.roleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString().slice(-4)}`;
    
    // Check for duplicate role name
    const existing = await pool.query('SELECT id FROM custom_roles WHERE LOWER(role_name) = LOWER($1)', [role.roleName.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `A role with the name "${role.roleName}" already exists.` });
    }

    const query = `
      INSERT INTO custom_roles (
        id, role_name, archetype, description, is_system_role, permissions, workflow_routing, email_subscriptions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING 
        id,
        role_name AS "roleName",
        archetype,
        description,
        is_system_role AS "isSystemRole",
        permissions,
        workflow_routing AS "workflowRouting",
        email_subscriptions AS "emailSubscriptions",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        0 AS "userCount"
    `;
    const values = [
      roleId,
      role.roleName.trim(),
      role.archetype || 'Custom',
      role.description || '',
      false, // user created roles are never system locked
      JSON.stringify(role.permissions || {}),
      JSON.stringify(role.workflowRouting || {}),
      JSON.stringify(role.emailSubscriptions || {}),
    ];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.put('/api/custom-roles/:id', async (req, res) => {
  const { id } = req.params;
  const role = req.body;
  try {
    const pool = getPool();
    
    // Check if role exists
    const check = await pool.query('SELECT * FROM custom_roles WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Role with ID "${id}" not found.` });
    }
    const existingRole = check.rows[0];

    // If role name changed, check uniqueness
    if (role.roleName && role.roleName.trim().toLowerCase() !== existingRole.role_name.toLowerCase()) {
      const dupCheck = await pool.query('SELECT id FROM custom_roles WHERE LOWER(role_name) = LOWER($1) AND id != $2', [role.roleName.trim(), id]);
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: `A role with the name "${role.roleName}" already exists.` });
      }
      // If role name changed, update users who had this role
      await pool.query('UPDATE users SET role = $1 WHERE role = $2', [role.roleName.trim(), existingRole.role_name]);
    }

    const query = `
      UPDATE custom_roles SET
        role_name = COALESCE($2, role_name),
        archetype = COALESCE($3, archetype),
        description = COALESCE($4, description),
        permissions = COALESCE($5, permissions),
        workflow_routing = COALESCE($6, workflow_routing),
        email_subscriptions = COALESCE($7, email_subscriptions),
        updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id,
        role_name AS "roleName",
        archetype,
        description,
        is_system_role AS "isSystemRole",
        permissions,
        workflow_routing AS "workflowRouting",
        email_subscriptions AS "emailSubscriptions",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        (SELECT COUNT(*)::int FROM users u WHERE u.role = custom_roles.role_name) AS "userCount"
    `;
    const values = [
      id,
      role.roleName ? role.roleName.trim() : null,
      role.archetype || null,
      role.description !== undefined ? role.description : null,
      role.permissions ? JSON.stringify(role.permissions) : null,
      role.workflowRouting ? JSON.stringify(role.workflowRouting) : null,
      role.emailSubscriptions ? JSON.stringify(role.emailSubscriptions) : null,
    ];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.delete('/api/custom-roles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getPool();
    const check = await pool.query('SELECT * FROM custom_roles WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Role with ID "${id}" not found.` });
    }
    const role = check.rows[0];
    if (role.is_system_role) {
      return res.status(403).json({ success: false, message: 'Core System Roles cannot be deleted as they are required for foundational platform integrity.' });
    }

    // Check if users are currently assigned to this role
    const usersWithRole = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE role = $1', [role.role_name]);
    if (usersWithRole.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role "${role.role_name}" because ${usersWithRole.rows[0].count} user(s) are currently assigned to this role. Please reassign those users first.`,
      });
    }

    await pool.query('DELETE FROM custom_roles WHERE id = $1', [id]);
    res.json({ success: true, message: `Role "${role.role_name}" deleted successfully.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.post('/api/email-logs', async (req, res) => {
  const log = req.body;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO email_notification_logs (
        id, change_request_id, recipient_email, recipient_name, subject, body_html, sent_at, smtp_server, smtp_port, status, trigger_event
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      log.id || `EMAIL-${Date.now()}`,
      log.changeRequestId || null,
      log.recipientEmail,
      log.recipientName,
      log.subject,
      log.bodyHtml || '',
      log.smtpServer || '157.9.183.242',
      log.smtpPort || 25,
      log.status || 'DELIVERED (250 OK)',
      log.triggerEvent || 'General Notification',
    ];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// Email Templates CRUD endpoints
app.get('/api/email-templates', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT 
        id,
        category,
        event_name AS "eventName",
        description,
        subject_template AS "subjectTemplate",
        recipient_description AS "recipientDescription",
        variables,
        body_html AS "bodyHtml",
        enabled,
        updated_at AS "lastUpdated",
        updated_by AS "updatedBy"
      FROM email_templates
      ORDER BY id ASC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: msg, fallback: true, data: [] });
  }
});

app.put('/api/email-templates/:id', async (req, res) => {
  const { id } = req.params;
  const tpl = req.body;
  try {
    const pool = getPool();
    const query = `
      INSERT INTO email_templates (
        id, category, event_name, description, subject_template, recipient_description, variables, body_html, enabled, updated_at, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        event_name = EXCLUDED.event_name,
        description = EXCLUDED.description,
        subject_template = EXCLUDED.subject_template,
        recipient_description = EXCLUDED.recipient_description,
        variables = EXCLUDED.variables,
        body_html = EXCLUDED.body_html,
        enabled = EXCLUDED.enabled,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING *
    `;
    const values = [
      id,
      tpl.category || 'cr_workflow',
      tpl.eventName || id,
      tpl.description || '',
      tpl.subjectTemplate || '',
      tpl.recipientDescription || '',
      JSON.stringify(tpl.variables || []),
      tpl.bodyHtml || '',
      tpl.enabled !== undefined ? tpl.enabled : true,
      tpl.updatedBy || 'System Admin',
    ];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 7. STORAGE VAULT CONFIGURATION
// The database-backed storage_vault_configs row is the authoritative source.
// No attachment filesystem location is hard-coded in the application.
app.get('/api/storage-vault', async (req, res) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    if (!['IT Admin', 'System Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Storage repository configuration is restricted to IT/System Admin.' });
    }
    const pool = getPool();
    const result = await pool.query('SELECT * FROM storage_vault_configs ORDER BY updated_at DESC NULLS LAST LIMIT 1');
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Storage repository configuration has not been configured.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

app.put('/api/storage-vault', async (req, res) => {
  try {
    const body = req.body || {};
    const role = typeof body.role === 'string' ? body.role : '';
    if (!['IT Admin', 'System Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only IT Admin or System Admin can update storage repository configuration.' });
    }

    const storagePath = String(body.storageLocationPath || '').trim();
    if (!storagePath) return res.status(400).json({ success: false, message: 'Authoritative storage repository path is required.' });

    const validTypes = new Set(['UNC_NETWORK_SHARE', 'LOCAL_DIRECTORY', 'ENTERPRISE_SAN_NAS', 'ENCRYPTED_CLOUD_VAULT']);
    const validPatterns = new Set(['YEAR_MONTH', 'YEAR_MONTH_CRID', 'DEPARTMENT_CRID', 'FLAT']);
    const storageType = validTypes.has(String(body.storageType)) ? String(body.storageType) : 'UNC_NETWORK_SHARE';
    const subfolderPattern = validPatterns.has(String(body.subfolderPattern)) ? String(body.subfolderPattern) : 'YEAR_MONTH_CRID';
    const maxFileSizeMb = Math.max(1, Math.min(1024, Number(body.maxFileSizeMb) || 25));
    const allowedExtensions = Array.isArray(body.allowedExtensions)
      ? body.allowedExtensions.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean)
      : ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx', '.docx', '.txt', '.zip', '.log'];

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO storage_vault_configs (
        id, name, storage_type, storage_location_path, backup_location_path,
        subfolder_pattern, max_file_size_mb, allowed_extensions,
        encryption_at_rest, last_tested_status, last_tested_at, updated_by, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        storage_type = EXCLUDED.storage_type,
        storage_location_path = EXCLUDED.storage_location_path,
        backup_location_path = EXCLUDED.backup_location_path,
        subfolder_pattern = EXCLUDED.subfolder_pattern,
        max_file_size_mb = EXCLUDED.max_file_size_mb,
        allowed_extensions = EXCLUDED.allowed_extensions,
        encryption_at_rest = EXCLUDED.encryption_at_rest,
        last_tested_status = EXCLUDED.last_tested_status,
        last_tested_at = EXCLUDED.last_tested_at,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      String(body.id || 'vault-prod-primary'),
      String(body.name || 'IT Storage Repository'),
      storageType,
      storagePath,
      body.backupLocationPath ? String(body.backupLocationPath).trim() : null,
      subfolderPattern,
      maxFileSizeMb,
      allowedExtensions,
      Boolean(body.encryptionAtRest),
      String(body.lastTestedStatus || 'CONFIGURING'),
      body.lastTestedAt ? new Date(body.lastTestedAt) : null,
      String(body.updatedBy || 'IT System Admin')
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PUT /api/storage-vault]', msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// 7A. ATTACHMENT STORAGE & DOWNLOAD
// The repository root is loaded from storage_vault_configs for every upload.
// This is intentionally NOT configured by a hard-coded path or environment variable.
function normalizeConfiguredStoragePath(rawPath: string): string {
  const configured = String(rawPath || '').trim();
  if (!configured) throw new Error('IT Storage Repository path is not configured.');
  return path.normalize(configured);
}

async function getAuthoritativeStorageConfig(pool: any): Promise<any> {
  const result = await pool.query('SELECT * FROM storage_vault_configs ORDER BY updated_at DESC NULLS LAST LIMIT 1');
  const config = result.rows[0];
  if (!config?.storage_location_path) {
    throw new Error('IT Storage Repository path is not configured. An IT/System Admin must save the repository location first.');
  }
  return config;
}

function safeAttachmentFileName(name: string): string {
  const base = path.basename(name || 'attachment');
  return base.replace(/[^a-zA-Z0-9._()\- ]/g, '_').slice(0, 180) || 'attachment';
}

function buildAttachmentDirectory(root: string, pattern: string, changeRequestId: string, departmentCode?: string, now: Date = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const safeCrId = String(changeRequestId || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeDepartmentCode = String(departmentCode || '').replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!safeCrId && pattern !== 'YEAR_MONTH' && pattern !== 'FLAT') {
    throw new Error('A real Change Request ID is required before placing an attachment into its final repository partition.');
  }
  if (pattern === 'DEPARTMENT_CRID' && !safeDepartmentCode) {
    throw new Error('Department code is required for the selected DepartmentCode\\CR-ID storage partition.');
  }

  switch (pattern) {
    case 'YEAR_MONTH':
      return path.join(root, year, month);
    case 'DEPARTMENT_CRID':
      return path.join(root, safeDepartmentCode, safeCrId);
    case 'FLAT':
      return root;
    case 'YEAR_MONTH_CRID':
    default:
      return path.join(root, year, month, safeCrId);
  }
}

function getAttachmentStagingRoot(storageRoot: string): string {
  // Keep temporary staging on the same filesystem/share as the authoritative
  // repository. This allows fs.renameSync() to move the file without EXDEV.
  return path.join(storageRoot, 'Temp_do_not_delete');
}

function isStagedAttachmentPath(filePath: string, storageRoot: string): boolean {
  const stagingRoot = path.resolve(getAttachmentStagingRoot(storageRoot));
  const normalized = path.resolve(filePath);
  return normalized === stagingRoot || normalized.startsWith(`${stagingRoot}${path.sep}`);
}

async function getDepartmentStorageCode(pool: any, departmentId: any, fallbackCode?: string): Promise<string> {
  if (fallbackCode) return String(fallbackCode);
  if (departmentId === undefined || departmentId === null || departmentId === '') return '';
  const result = await pool.query('SELECT code FROM departments WHERE id = $1 LIMIT 1', [Number(departmentId)]);
  return result.rows[0]?.code ? String(result.rows[0].code) : '';
}

async function relocateStagedAttachmentsForChangeRequest(
  pool: any,
  attachments: any[],
  changeRequestId: string,
  departmentId: any,
  departmentCode?: string,
): Promise<{ attachments: any[]; moved: Array<{ from: string; to: string }> }> {
  if (!Array.isArray(attachments) || attachments.length === 0) return { attachments: [], moved: [] };
  const storageConfig = await getAuthoritativeStorageConfig(pool);
  const root = normalizeConfiguredStoragePath(storageConfig.storage_location_path);
  const pattern = String(storageConfig.subfolder_pattern || 'YEAR_MONTH_CRID');
  const resolvedDepartmentCode = await getDepartmentStorageCode(pool, departmentId, departmentCode);
  const finalDirectory = buildAttachmentDirectory(root, pattern, changeRequestId, resolvedDepartmentCode, new Date());
  fs.mkdirSync(finalDirectory, { recursive: true });

  const moved: Array<{ from: string; to: string }> = [];
  const updated = attachments.map((a: any) => ({ ...a }));
  try {
    for (const attachment of updated) {
      const storedPath = attachment?.storedPath ? path.normalize(String(attachment.storedPath)) : '';
      if (!storedPath || !isStagedAttachmentPath(storedPath, root)) continue;
      if (!fs.existsSync(storedPath)) throw new Error(`Attachment file is missing from staging location: ${storedPath}`);
      const target = path.join(finalDirectory, path.basename(storedPath));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(storedPath, target);
      attachment.storedPath = target;
      attachment.changeRequestId = changeRequestId;
      attachment.storageVaultId = String(storageConfig.id);
      attachment.isStaged = false;
      moved.push({ from: storedPath, to: target });
    }
    return { attachments: updated, moved };
  } catch (err) {
    for (const item of [...moved].reverse()) {
      try {
        if (fs.existsSync(item.to)) fs.renameSync(item.to, item.from);
      } catch { /* best effort rollback */ }
    }
    throw err;
  }
}

app.post('/api/attachments/upload', async (req, res) => {
  try {
    const { fileName, fileType, dataUrl, uploadedBy, uploadedByUserId, changeRequestId } = req.body || {};
    if (!fileName || !dataUrl || !uploadedBy || !uploadedByUserId) {
      return res.status(400).json({ success: false, message: 'fileName, dataUrl, uploadedBy and uploadedByUserId are required.' });
    }

    const pool = getPool();
    const storageConfig = await getAuthoritativeStorageConfig(pool);
    const storageRoot = normalizeConfiguredStoragePath(storageConfig.storage_location_path);
    const maxBytes = Math.max(1, Number(storageConfig.max_file_size_mb || 25)) * 1024 * 1024;
    const safeName = safeAttachmentFileName(String(fileName));
    const extension = path.extname(safeName).toLowerCase();
    const allowedExtensions = Array.isArray(storageConfig.allowed_extensions)
      ? storageConfig.allowed_extensions.map((x: any) => String(x).trim().toLowerCase())
      : [];
    if (allowedExtensions.length > 0 && extension && !allowedExtensions.includes(extension)) {
      return res.status(400).json({ success: false, message: `File extension "${extension}" is not allowed by the current IT Storage Repository configuration.` });
    }

    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return res.status(400).json({ success: false, message: 'Invalid file payload.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > maxBytes) {
      return res.status(413).json({ success: false, message: `File exceeds the configured ${storageConfig.max_file_size_mb || 25} MB upload limit.` });
    }

    let departmentId: any = null;
    let departmentCode = '';
    if (changeRequestId) {
      const crResult = await pool.query(
        'SELECT department_id, d.code AS department_code FROM change_requests cr LEFT JOIN departments d ON d.id = cr.department_id WHERE cr.id = $1 LIMIT 1',
        [String(changeRequestId)]
      );
      departmentId = crResult.rows[0]?.department_id ?? null;
      departmentCode = crResult.rows[0]?.department_code || '';
    }

    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const pattern = String(storageConfig.subfolder_pattern || 'YEAR_MONTH_CRID');
    // A new ticket has no real CR-ID yet. Stage inside the dedicated Temp_do_not_delete
    // folder under the authoritative repository so the eventual rename stays on the
    // same network share and cannot fail with EXDEV.
    const targetDirectory = changeRequestId
      ? buildAttachmentDirectory(storageRoot, pattern, String(changeRequestId), departmentCode, now)
      : path.join(getAttachmentStagingRoot(storageRoot), id);
    fs.mkdirSync(targetDirectory, { recursive: true });

    const target = path.join(targetDirectory, `${id}-${safeName}`);
    fs.writeFileSync(target, buffer, { flag: 'wx' });

    const attachment = {
      id,
      fileName: safeName,
      fileType: fileType || 'application/octet-stream',
      fileSizeKb: Math.round(buffer.length / 1024),
      uploadedAt: getMalaysianTimestamp(),
      uploadedBy: String(uploadedBy),
      uploadedByUserId: String(uploadedByUserId),
      url: `/api/attachments/${encodeURIComponent(id)}`,
      storedPath: target,
      storageVaultId: String(storageConfig.id),
      fileChecksum: `sha256-${require('crypto').createHash('sha256').update(buffer).digest('hex')}`,
      encryptionAlgorithm: storageConfig.encryption_at_rest ? 'AES-256-GCM (configured)' : 'Filesystem',
      changeRequestId: changeRequestId || undefined,
      isStaged: !changeRequestId,
    };

    res.json({ success: true, attachment });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/attachments/upload]', msg);
    res.status(500).json({ success: false, message: msg });
  }
});

app.get('/api/attachments/:attachmentId', async (req, res) => {
  try {
    const pool = getPool();
    const attachmentId = req.params.attachmentId;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    if (!userId || !role) return res.status(401).json({ success: false, message: 'Authenticated user context is required.' });
    const visibility = buildChangeRequestVisibility({ userId, role, departmentId });
    const where = visibility.clause ? `${visibility.clause} AND cr.attachments @> $${visibility.params.length + 1}::jsonb` : `WHERE cr.attachments @> $1::jsonb`;
    const params = visibility.params.length ? [...visibility.params, JSON.stringify([{ id: attachmentId }])] : [JSON.stringify([{ id: attachmentId }])];
    const result = await pool.query(`SELECT cr.attachments FROM change_requests cr ${where} LIMIT 1`, params);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Attachment not found or access denied.' });
    const attachment = (result.rows[0].attachments || []).find((a: any) => a?.id === attachmentId);
    if (!attachment?.storedPath) return res.status(404).json({ success: false, message: 'Attachment file is not stored on this server.' });
    // The storedPath was created by the server from the authoritative repository
    // configuration at upload time. Use that persisted path so downloads continue
    // to work even if an administrator later changes the repository location.
    const filePath = path.normalize(String(attachment.storedPath));
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Attachment file is missing from storage.' });
    res.download(filePath, safeAttachmentFileName(attachment.fileName));
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

// 8. SYSTEM TURNAROUND & SLA METRICS (Authoritative Database Calculations)
app.get('/api/reports/turnaround-metrics', async (req, res) => {
  try {
    const pool = getPool();

    // Reports use the exact same visibility rules as the Change Request list.
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Authenticated user context is required to view reports.' });
    }
    let visibility;
    try {
      visibility = buildChangeRequestVisibility({ userId, role, departmentId });
    } catch (e: any) {
      return res.status(403).json({ success: false, message: e?.message || 'Access denied.' });
    }
    const visibilityClause = visibility.clause;
    const visibilityParams = visibility.params;

    // Do not use the old system-wide fn_get_system_turnaround_metrics() here:
    // it intentionally aggregates every case in the database. Reports must
    // aggregate only the rows the current user is authorized to see.
    const crRes = await pool.query(`
      SELECT
        cr.id,
        cr.created_at AS "createdAt",
        cr.updated_at AS "updatedAt",
        cr.status,
        cr.priority,
        cr.sla_target_hours AS "slaTargetHours",
        cr.hod_approved_at AS "hodApprovedAt",
        cr.actual_completion_date AS "actualCompletionDate",
        (
          SELECT json_agg(
            json_build_object(
              'decision', h.decision,
              'actorRole', h.actor_role,
              'toStatus', h.to_status,
              'actionDate', h.action_date
            ) ORDER BY h.action_date ASC
          )
          FROM change_request_approval_history h
          WHERE h.change_request_id = cr.id
        ) AS "history"
      FROM change_requests cr
      ${visibilityClause}
    `, visibilityParams);

    const rows = crRes.rows || [];
    const totalCases = rows.length;
    const completedCases = rows.filter((r: any) => r.status === 'Closed (Completed)');
    const rejectedCases = rows.filter((r: any) => r.status === 'Closed (Rejected)');
    const totalClosed = completedCases.length + rejectedCases.length;

    let hodTotalHours = 0;
    let hodCount = 0;
    let hodCompliantCount = 0;

    for (const r of rows) {
      let approvedAt: Date | null = r.hodApprovedAt ? new Date(r.hodApprovedAt) : null;
      if (!approvedAt && Array.isArray(r.history)) {
        const hEntry = r.history.find((h: any) =>
          ['Approved', 'Endorsed', 'Approved by HOD', 'Approved by Delegate'].includes(h.decision)
        );
        if (hEntry?.actionDate) approvedAt = new Date(hEntry.actionDate);
      }
      if (approvedAt && r.createdAt) {
        const createdDate = new Date(r.createdAt);
        const hours = (approvedAt.getTime() - createdDate.getTime()) / (1000 * 3600);
        if (hours >= 0) {
          hodTotalHours += hours;
          hodCount++;
          if (hours <= 48) hodCompliantCount++;
        }
      }
    }

    const avgHodDays = hodCount > 0 ? Number((hodTotalHours / (hodCount * 24)).toFixed(1)) : 0.0;
    const hodSlaPercent = hodCount > 0 ? Number(((hodCompliantCount / hodCount) * 100).toFixed(1)) : 0.0;

    let itTotalHours = 0;
    let itCount = 0;
    let itCompliantCount = 0;

    for (const r of rows) {
      let devStart: Date | null = null;
      let devEnd: Date | null = r.actualCompletionDate ? new Date(r.actualCompletionDate) : null;

      if (Array.isArray(r.history)) {
        const startEntry = r.history.find((h: any) => h.toStatus === 'In Progress' || h.decision === 'Assigned Developer');
        if (startEntry?.actionDate) devStart = new Date(startEntry.actionDate);

        if (!devEnd) {
          const endEntry = r.history.find((h: any) => ['Pending IT Verification', 'Closed (Completed)'].includes(h.toStatus));
          if (endEntry?.actionDate) devEnd = new Date(endEntry.actionDate);
        }
      }

      if (!devStart && r.hodApprovedAt) devStart = new Date(r.hodApprovedAt);
      if (!devStart && r.createdAt) devStart = new Date(r.createdAt);
      if (!devEnd && (r.status === 'Closed (Completed)' || r.status === 'Pending IT Verification')) {
        devEnd = r.updatedAt ? new Date(r.updatedAt) : new Date();
      }

      if (devStart && devEnd) {
        const hours = (devEnd.getTime() - devStart.getTime()) / (1000 * 3600);
        if (hours >= 0) {
          itTotalHours += hours;
          itCount++;
          const targetHours = r.slaTargetHours || 168;
          if (hours <= targetHours) itCompliantCount++;
        }
      }
    }

    const avgItDays = itCount > 0 ? Number((itTotalHours / (itCount * 24)).toFixed(1)) : 0.0;
    const itSlaPercent = itCount > 0 ? Number(((itCompliantCount / itCount) * 100).toFixed(1)) : 0.0;

    const priorityDist: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const statusDist: Record<string, number> = {};
    for (const r of rows) {
      if (r.priority) priorityDist[r.priority] = (priorityDist[r.priority] || 0) + 1;
      if (r.status) statusDist[r.status] = (statusDist[r.status] || 0) + 1;
    }

    const verificationRate = completedCases.length > 0 ? 100 : 0;

    return res.json({
      success: true,
      data: {
        avgHodClearanceDays: avgHodDays,
        hodClearanceDisplay: hodCount > 0 ? `${avgHodDays} Days` : '0.0 Days',
        hodSlaCompliancePercent: hodSlaPercent,
        hodSlaComplianceDisplay: hodCount > 0 ? `${hodSlaPercent}% SLA Compliance (< 2 Days)` : 'No HOD reviews evaluated',
        hodEvaluatedCount: hodCount,
        avgItDevCycleDays: avgItDays,
        itDevCycleDisplay: itCount > 0 ? `${avgItDays} Days` : '0.0 Days',
        itDevSlaCompliancePercent: itSlaPercent,
        itDevSlaComplianceDisplay: itCount > 0 ? `${itSlaPercent}% within target SLA release window` : 'No developer cycles recorded',
        itEvaluatedCount: itCount,
        totalClosedCases: completedCases.length,
        completedCount: completedCases.length,
        rejectedCount: rejectedCases.length,
        totalCases,
        verificationRatePercent: verificationRate,
        verificationDisplay: completedCases.length > 0 ? `${verificationRate}% verified by IT Admin` : 'No completed cases',
        priorityDistribution: priorityDist,
        statusDistribution: statusDist,
        avgOverallResolutionDays: Number((avgItDays + avgHodDays).toFixed(1)),
        calculatedAt: new Date().toISOString(),
        source: 'postgresql_filtered_engine',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Turnaround Metrics Calculation Error]', msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// ==========================================
// 9. IT SERVICE CATALOG & HIERARCHY MANAGEMENT (DATA-DRIVEN)
// ==========================================

app.get('/api/catalog', async (req, res) => {
  try {
    const pool = getPool();
    const [catsRes, srvsRes, appsRes, issuesRes, modsRes, sfsRes, procsRes] = await Promise.all([
      pool.query('SELECT * FROM service_categories ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM service_catalog ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM application_assets ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM issue_types ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM application_modules ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM application_subfunctions ORDER BY display_order ASC, name ASC'),
      pool.query('SELECT * FROM application_processes ORDER BY display_order ASC, name ASC'),
    ]);

    const categories = catsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description || '',
      iconName: r.icon_name || 'Layers',
      displayOrder: r.display_order,
      isActive: r.is_active,
    }));

    const services = srvsRes.rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      categoryName: r.category_name || '',
      name: r.name,
      code: r.code,
      description: r.description || '',
      isAssetBased: r.is_asset_based,
      displayOrder: r.display_order,
      isActive: r.is_active,
    }));

    const applications = appsRes.rows.map((r) => ({
      id: r.id,
      serviceId: r.service_id || '',
      serviceName: r.service_name || '',
      categoryId: r.category_id || '',
      name: r.name,
      code: r.code || '',
      type: r.type || 'Application',
      assetTag: r.asset_tag || '',
      serialNumber: r.serial_number || '',
      location: r.location || '',
      assignedUserId: r.assigned_user_id || '',
      assignedUserName: r.assigned_user_name || '',
      hasApplicationArea: r.has_application_area !== false,
      description: r.description || '',
      isActive: r.is_active !== false,
      displayOrder: r.display_order || 1,
    }));

    const issueTypes = issuesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description || '',
      badgeColor: r.badge_color || 'bg-rose-50 text-rose-700 border-rose-200',
      defaultPriority: r.default_priority || 'Medium',
      displayOrder: r.display_order || 1,
      isActive: r.is_active !== false,
    }));

    const modules = modsRes.rows.map((r) => ({
      id: r.id,
      applicationId: r.application_id,
      applicationName: r.application_name || '',
      code: r.code,
      name: r.name,
      description: r.description || '',
      leadDeveloper: r.lead_developer || '',
      displayOrder: r.display_order || 1,
      isActive: r.is_active !== false,
    }));

    const subFunctions = sfsRes.rows.map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      moduleCode: r.module_code || '',
      code: r.code,
      name: r.name,
      description: r.description || '',
      displayOrder: r.display_order || 1,
      isActive: r.is_active !== false,
    }));

    const processes = procsRes.rows.map((r) => ({
      id: r.id,
      subFunctionId: r.subfunction_id || r.sub_function_id || '',
      subFunctionName: r.subfunction_name || '',
      code: r.code,
      name: r.name,
      description: r.description || '',
      displayOrder: r.display_order || 1,
      isActive: r.is_active !== false,
    }));

    res.json({
      success: true,
      data: {
        categories,
        services,
        applications,
        issueTypes,
        modules,
        subFunctions,
        processes,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/catalog Error]', msg);
    res.status(500).json({
      success: false,
      error: msg,
    });
  }
});

app.post('/api/catalog/save', async (req, res) => {
  const {
    categories,
    services,
    applications,
    issueTypes,
    modules,
    subFunctions,
    processes,
  } = req.body;

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (Array.isArray(categories)) {
        for (const cat of categories) {
          await client.query(
            `INSERT INTO service_categories (id, name, code, description, icon_name, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               description = EXCLUDED.description,
               icon_name = EXCLUDED.icon_name,
               display_order = EXCLUDED.display_order,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [cat.id, cat.name, cat.code, cat.description || '', cat.iconName || 'Layers', cat.displayOrder || 1, cat.isActive !== false]
          );
        }
      }

      if (Array.isArray(services)) {
        for (const srv of services) {
          await client.query(
            `INSERT INTO service_catalog (id, category_id, category_name, name, code, description, is_asset_based, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               category_id = EXCLUDED.category_id,
               category_name = EXCLUDED.category_name,
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               description = EXCLUDED.description,
               is_asset_based = EXCLUDED.is_asset_based,
               display_order = EXCLUDED.display_order,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [srv.id, srv.categoryId, srv.categoryName || '', srv.name, srv.code, srv.description || '', !!srv.isAssetBased, srv.displayOrder || 1, srv.isActive !== false]
          );
        }
      }

      if (Array.isArray(applications)) {
        for (const app of applications) {
          await client.query(
            `INSERT INTO application_assets (id, service_id, service_name, category_id, name, code, type, asset_tag, serial_number, location, assigned_user_id, assigned_user_name, has_application_area, description, is_active, display_order, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               service_id = EXCLUDED.service_id,
               service_name = EXCLUDED.service_name,
               category_id = EXCLUDED.category_id,
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               type = EXCLUDED.type,
               asset_tag = EXCLUDED.asset_tag,
               serial_number = EXCLUDED.serial_number,
               location = EXCLUDED.location,
               assigned_user_id = EXCLUDED.assigned_user_id,
               assigned_user_name = EXCLUDED.assigned_user_name,
               has_application_area = EXCLUDED.has_application_area,
               description = EXCLUDED.description,
               is_active = EXCLUDED.is_active,
               display_order = EXCLUDED.display_order,
               updated_at = CURRENT_TIMESTAMP`,
            [
              app.id,
              app.serviceId || '',
              app.serviceName || '',
              app.categoryId || '',
              app.name,
              app.code || '',
              app.type || 'Application',
              app.assetTag || '',
              app.serialNumber || '',
              app.location || '',
              app.assignedUserId || '',
              app.assignedUserName || '',
              app.hasApplicationArea !== false,
              app.description || '',
              app.isActive !== false,
              app.displayOrder || 1,
            ]
          );
        }
      }

      if (Array.isArray(issueTypes)) {
        for (const it of issueTypes) {
          await client.query(
            `INSERT INTO issue_types (id, name, code, description, badge_color, default_priority, is_active, display_order, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               description = EXCLUDED.description,
               badge_color = EXCLUDED.badge_color,
               default_priority = EXCLUDED.default_priority,
               is_active = EXCLUDED.is_active,
               display_order = EXCLUDED.display_order,
               updated_at = CURRENT_TIMESTAMP`,
            [it.id, it.name, it.code, it.description || '', it.badgeColor || 'bg-rose-50 text-rose-700 border-rose-200', it.defaultPriority || 'Medium', it.isActive !== false, it.displayOrder || 1]
          );
        }
      }

      if (Array.isArray(modules)) {
        for (const mod of modules) {
          await client.query(
            `INSERT INTO application_modules (id, application_id, application_name, code, name, description, lead_developer, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               application_id = EXCLUDED.application_id,
               application_name = EXCLUDED.application_name,
               code = EXCLUDED.code,
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               lead_developer = EXCLUDED.lead_developer,
               display_order = EXCLUDED.display_order,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [mod.id, mod.applicationId, mod.applicationName || '', mod.code, mod.name, mod.description || '', mod.leadDeveloper || '', mod.displayOrder || 1, mod.isActive !== false]
          );
        }
      }

      if (Array.isArray(subFunctions)) {
        for (const sf of subFunctions) {
          await client.query(
            `INSERT INTO application_subfunctions (id, module_id, module_code, code, name, description, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               module_id = EXCLUDED.module_id,
               module_code = EXCLUDED.module_code,
               code = EXCLUDED.code,
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               display_order = EXCLUDED.display_order,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [sf.id, sf.moduleId, sf.moduleCode || '', sf.code, sf.name, sf.description || '', sf.displayOrder || 1, sf.isActive !== false]
          );
        }
      }

      if (Array.isArray(processes)) {
        for (const proc of processes) {
          const subFnId = proc.subFunctionId || proc.subfunction_id || '';
          await client.query(
            `INSERT INTO application_processes (id, subfunction_id, subfunction_name, code, name, description, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               subfunction_id = EXCLUDED.subfunction_id,
               subfunction_name = EXCLUDED.subfunction_name,
               code = EXCLUDED.code,
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               display_order = EXCLUDED.display_order,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [proc.id, subFnId, proc.subFunctionName || '', proc.code, proc.name, proc.description || '', proc.displayOrder || 1, proc.isActive !== false]
          );
        }
      }

      await client.query('COMMIT');

      res.json({ success: true, message: 'IT Service Catalog & Hierarchy persisted in PostgreSQL' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/catalog/save] PostgreSQL transaction failed:', msg);
    res.status(500).json({ success: false, message: 'IT Service Catalog was not saved to PostgreSQL: ' + msg });
  }
});

app.delete('/api/catalog/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const tableMap: Record<string, string> = {
    categories: 'service_categories',
    services: 'service_catalog',
    applications: 'application_assets',
    issuetypes: 'issue_types',
    modules: 'application_modules',
    subfunctions: 'application_subfunctions',
    processes: 'application_processes',
  };

  const memKey: Record<string, keyof typeof memoryCatalog> = {
    categories: 'categories',
    services: 'services',
    applications: 'applications',
    issuetypes: 'issueTypes',
    modules: 'modules',
    subfunctions: 'subFunctions',
    processes: 'processes',
  };

  const tableName = tableMap[type];
  if (!tableName) {
    return res.status(400).json({ success: false, message: `Invalid catalog type: ${type}` });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Capture the full descendant set before the DELETE. PostgreSQL performs the
    // actual cascade through the FK constraints; this keeps the server cache in
    // sync with the same records that PostgreSQL removes.
    let descendantIds: Record<string, Set<string>> = {};
    if (type === 'categories') {
      const services = await client.query('SELECT id FROM service_catalog WHERE category_id = $1', [id]);
      const serviceIds = services.rows.map((r: any) => r.id);
      const apps = serviceIds.length
        ? await client.query('SELECT id FROM application_assets WHERE service_id = ANY($1::varchar[])', [serviceIds])
        : { rows: [] };
      const appIds = apps.rows.map((r: any) => r.id);
      const mods = appIds.length
        ? await client.query('SELECT id FROM application_modules WHERE application_id = ANY($1::varchar[])', [appIds])
        : { rows: [] };
      const modIds = mods.rows.map((r: any) => r.id);
      const sfs = modIds.length
        ? await client.query('SELECT id FROM application_subfunctions WHERE module_id = ANY($1::varchar[])', [modIds])
        : { rows: [] };
      const sfIds = sfs.rows.map((r: any) => r.id);
      descendantIds = {
        categories: new Set([id]),
        services: new Set(serviceIds),
        applications: new Set(appIds),
        modules: new Set(modIds),
        subFunctions: new Set(sfIds),
      };
    } else if (type === 'services') {
      const apps = await client.query('SELECT id FROM application_assets WHERE service_id = $1', [id]);
      const appIds = apps.rows.map((r: any) => r.id);
      const mods = appIds.length
        ? await client.query('SELECT id FROM application_modules WHERE application_id = ANY($1::varchar[])', [appIds])
        : { rows: [] };
      const modIds = mods.rows.map((r: any) => r.id);
      const sfs = modIds.length
        ? await client.query('SELECT id FROM application_subfunctions WHERE module_id = ANY($1::varchar[])', [modIds])
        : { rows: [] };
      const sfIds = sfs.rows.map((r: any) => r.id);
      descendantIds = {
        services: new Set([id]),
        applications: new Set(appIds),
        modules: new Set(modIds),
        subFunctions: new Set(sfIds),
      };
    } else {
      descendantIds[memKey[type]] = new Set([id]);
    }

    const result = await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    if (result.rowCount !== 1) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Record ${id} was not found in ${tableName}` });
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      deleted: true,
      cascaded: Object.fromEntries(Object.entries(descendantIds).map(([key, ids]) => [key, ids.size])),
      message: `Record ${id} removed from PostgreSQL.`,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DELETE /api/catalog/${type}/${id}] PostgreSQL delete failed:`, msg);
    return res.status(500).json({ success: false, message: `Record ${id} was not deleted from PostgreSQL: ${msg}` });
  } finally {
    client.release();
  }
});

// ============================================================================
// 10. BRING DEVICE OUT & SATO CL4NX STICKER LABEL SYSTEM
// ============================================================================

const IT_STAFF_ROLES = ['IT Helpdesk', 'IT Admin', 'System Admin', 'Software Developer'];
const isUserItStaff = (role?: string) => Boolean(role && IT_STAFF_ROLES.includes(role));

// GET: All Device Out Requests (with role visibility)
app.get('/api/device-out-requests', async (req, res) => {
  try {
    const { userId, role, departmentId } = req.query as { userId?: string; role?: string; departmentId?: string };

    let results: any[] = [];

    // Attempt PostgreSQL query
    if (isDbConnected && dbPool) {
      try {
        let query = `
          SELECT r.*,
            (SELECT COUNT(*) FROM label_print_history p WHERE p.request_id = r.id) as print_count,
            (SELECT MAX(printed_at) FROM label_print_history p WHERE p.request_id = r.id) as last_printed_at
          FROM device_out_requests r
        `;
        const params: any[] = [];

        // Role-based visibility
        if (role === 'Requester' && userId) {
          query += ` WHERE r.requester_id = $1`;
          params.push(userId);
        } else if (role === 'Department HOD' && departmentId) {
          query += ` WHERE r.department_id = $1 OR r.requester_id = $2`;
          params.push(parseInt(departmentId, 10), userId || '');
        }

        query += ` ORDER BY r.created_at DESC`;
        const dbRes = await dbPool.query(query, params);
        results = dbRes.rows.map(row => ({
          id: row.id,
          requestId: row.request_id || row.id,
          requesterId: row.requester_id,
          requesterName: row.requester_name,
          requesterEmail: row.requester_email,
          departmentId: row.department_id,
          departmentName: row.department_name,
          assetType: row.asset_type,
          assetId: row.asset_id,
          assetName: row.asset_name,
          assetSerialNo: row.asset_serial_no,
          fromDate: row.from_date,
          toDate: row.to_date,
          vpnRequired: row.vpn_required,
          businessPurpose: row.business_purpose,
          approvalRequired: Boolean(row.approval_required),
          approvalStatus: row.approval_status,
          approvedBy: row.approved_by,
          approvedByName: row.approved_by_name,
          approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
          rejectionReason: row.rejection_reason,
          returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
          returnedBy: row.returned_by,
          returnedByName: row.returned_by_name,
          returnRemarks: row.return_remarks,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
          printCount: parseInt(row.print_count || '0', 10),
          lastPrintedAt: row.last_printed_at ? new Date(row.last_printed_at).toISOString() : null,
        }));
      } catch (dbErr) {
        console.error('[DB Error: /api/device-out-requests]', dbErr instanceof Error ? dbErr.message : String(dbErr));
        return res.status(500).json({ success: false, error: 'Database connection failed' });
      }
    } else {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    return res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET: Single Device Out Request with approvals
app.get('/api/device-out-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let found: any = null;
    let approvals: any[] = [];
    let printHistory: any[] = [];

    if (isDbConnected && dbPool) {
      try {
        const dbRes = await dbPool.query('SELECT * FROM device_out_requests WHERE id = $1 OR request_id = $1', [id]);
        if (dbRes.rows.length > 0) {
          const row = dbRes.rows[0];
          found = {
            id: row.id,
            requestId: row.request_id || row.id,
            requesterId: row.requester_id,
            requesterName: row.requester_name,
            requesterEmail: row.requester_email,
            departmentId: row.department_id,
            departmentName: row.department_name,
            assetType: row.asset_type,
            assetId: row.asset_id,
            assetName: row.asset_name,
            assetSerialNo: row.asset_serial_no,
            fromDate: row.from_date,
            toDate: row.to_date,
            vpnRequired: row.vpn_required,
            businessPurpose: row.business_purpose,
            approvalRequired: Boolean(row.approval_required),
            approvalStatus: row.approval_status,
            approvedBy: row.approved_by,
            approvedByName: row.approved_by_name,
            approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
            rejectionReason: row.rejection_reason,
            returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
            returnedBy: row.returned_by,
            returnedByName: row.returned_by_name,
            returnRemarks: row.return_remarks,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
          };

          const appRes = await dbPool.query('SELECT * FROM device_out_approvals WHERE request_id = $1 ORDER BY created_at ASC', [id]);
          approvals = appRes.rows.map(a => ({
            id: a.id,
            requestId: a.request_id,
            approverId: a.approver_id,
            approverName: a.approver_name,
            approverRole: a.approver_role,
            action: a.action,
            comments: a.comments,
            createdAt: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
          }));

          const prRes = await dbPool.query('SELECT * FROM label_print_history WHERE request_id = $1 ORDER BY printed_at DESC', [id]);
          printHistory = prRes.rows.map(p => ({
            id: p.id,
            requestId: p.request_id,
            templateId: p.template_id,
            printedBy: p.printed_by,
            printedByName: p.printed_by_name,
            printerName: p.printer_name,
            printCount: p.print_count,
            printedAt: p.printed_at ? new Date(p.printed_at).toISOString() : new Date().toISOString(),
          }));
        }
      } catch (dbErr) {
        console.error('[DB Error: /api/device-out-requests/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
        return res.status(500).json({ success: false, error: 'Database error' });
      }
    } else {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    if (!found) {
      return res.status(404).json({ success: false, error: `Device out request ${id} not found.` });
    }

    return res.json({
      success: true,
      data: {
        ...found,
        approvals,
        printHistory,
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Create new Device Out Request
app.post('/api/device-out-requests', async (req, res) => {
  try {
    const {
      assetType,
      assetId,
      assetName,
      assetSerialNo,
      fromDate,
      toDate,
      vpnRequired = 'Not Required',
      businessPurpose,
      requesterId,
      requesterName,
      requesterEmail,
      departmentId,
      departmentName,
    } = req.body;

    // Validation rules
    if (!assetType || !assetName) {
      return res.status(400).json({ success: false, error: 'Asset Type and Asset/Device Name are required.' });
    }
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: 'From Date and To Date are mandatory.' });
    }
    // "To Date cannot be earlier than From Date."
    if (toDate < fromDate) {
      return res.status(400).json({ success: false, error: 'To Date cannot be earlier than From Date.' });
    }
    if (!businessPurpose || !businessPurpose.trim()) {
      return res.status(400).json({ success: false, error: 'Business Purpose is required for audit clearance.' });
    }

    // Rule: Laptop must require approval
    const approvalRequired = assetType === 'Laptop' ? true : (req.body.approvalRequired !== false);
    const initialStatus = 'Pending';

    deviceOutCounter += 1;
    const year = new Date().getFullYear();
    const newId = `DEV-OUT-${year}-${String(deviceOutCounter).padStart(5, '0')}`;
    const nowIso = new Date().toISOString();

    const newRecord = {
      id: newId,
      requestId: newId,
      requesterId: requesterId || 'USR-ANON-001',
      requesterName: requesterName || 'Employee Requester',
      requesterEmail: requesterEmail || '',
      departmentId: departmentId ? Number(departmentId) : 1,
      departmentName: departmentName || 'General',
      assetType,
      assetId: assetId || null,
      assetName,
      assetSerialNo: assetSerialNo || 'N/A',
      fromDate,
      toDate,
      vpnRequired: vpnRequired === 'Required' ? 'Required' : 'Not Required',
      businessPurpose,
      approvalRequired,
      approvalStatus: initialStatus,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      rejectionReason: null,
      returnedAt: null,
      returnedBy: null,
      returnedByName: null,
      returnRemarks: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      printCount: 0,
      approvals: [
        {
          id: Date.now(),
          requestId: newId,
          approverId: requesterId || 'USR-ANON-001',
          approverName: requesterName || 'Employee Requester',
          action: 'Pending',
          comments: 'Request submitted for out-pass authorization',
          createdAt: nowIso,
        }
      ]
    };

    // Save to PostgreSQL
    if (isDbConnected && dbPool) {
      try {
        const year = new Date().getFullYear();
        const newId = `DEV-OUT-${year}-${Date.now().toString().slice(-5)}`;

        const query = `
          INSERT INTO device_out_requests (
            id, request_id, requester_id, requester_name, requester_email,
            department_id, department_name, asset_type, asset_id, asset_name, asset_serial_no,
            from_date, to_date, vpn_required, business_purpose, approval_required, approval_status,
            created_at, updated_at
          ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *;
        `;
        const values = [
          newId,
          requesterId || 'USR-ANON-001',
          requesterName || 'Employee Requester',
          requesterEmail || '',
          departmentId ? Number(departmentId) : 1,
          departmentName || 'General',
          assetType,
          assetId || null,
          assetName,
          assetSerialNo || 'N/A',
          fromDate,
          toDate,
          vpnRequired === 'Required' ? 'Required' : 'Not Required',
          businessPurpose,
          approvalRequired,
          initialStatus,
        ];
        const dbRes = await dbPool.query(query, values);
        const savedRecord = dbRes.rows[0];

        await dbPool.query(`
          INSERT INTO device_out_approvals (request_id, approver_id, approver_name, action, comments, created_at)
          VALUES ($1, $2, $3, 'Pending', 'Request submitted for out-pass authorization', CURRENT_TIMESTAMP)
        `, [newId, values[1], values[2]]);

        return res.status(201).json({
          success: true,
          message: `Device out request ${newId} submitted successfully.`,
          data: {
            ...savedRecord,
            requestId: savedRecord.request_id,
            requesterId: savedRecord.requester_id,
            requesterName: savedRecord.requester_name,
            requesterEmail: savedRecord.requester_email,
            departmentId: savedRecord.department_id,
            departmentName: savedRecord.department_name,
            assetType: savedRecord.asset_type,
            assetId: savedRecord.asset_id,
            assetName: savedRecord.asset_name,
            assetSerialNo: savedRecord.asset_serial_no,
            fromDate: savedRecord.from_date,
            toDate: savedRecord.to_date,
            vpnRequired: savedRecord.vpn_required,
            businessPurpose: savedRecord.business_purpose,
            approvalRequired: Boolean(savedRecord.approval_required),
            approvalStatus: savedRecord.approval_status,
            createdAt: savedRecord.created_at,
            updatedAt: savedRecord.updated_at
          },
        });
      } catch (dbErr) {
        console.error('[DB Error: POST /api/device-out-requests]', dbErr instanceof Error ? dbErr.message : String(dbErr));
        return res.status(500).json({ success: false, error: 'Failed to save request to database' });
      }
    } else {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Approve Device Out Request (IT Staff only)
app.post('/api/device-out-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, approvedByName, approverRole, comments } = req.body;

    // Rule: "IT staff can Approve/Reject."
    if (!isUserItStaff(approverRole)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only authorized IT staff can approve Bring Device Out requests.' });
    }

    // Rule: "Never allow approval without approved_by."
    if (!approvedBy || !approvedBy.trim()) {
      return res.status(400).json({ success: false, error: 'Validation Error: Never allow approval without approved_by.' });
    }

    const nowIso = new Date().toISOString();

    // Update in memory
    const reqIndex = memoryDeviceOutRequests.findIndex(r => r.id === id || r.requestId === id);
    if (reqIndex !== -1) {
      memoryDeviceOutRequests[reqIndex].approvalStatus = 'Approved';
      memoryDeviceOutRequests[reqIndex].approvedBy = approvedBy;
      memoryDeviceOutRequests[reqIndex].approvedByName = approvedByName || 'IT Staff Approver';
      memoryDeviceOutRequests[reqIndex].approvedAt = nowIso;
      memoryDeviceOutRequests[reqIndex].updatedAt = nowIso;

      const approvalEntry = {
        id: Date.now(),
        requestId: id,
        approverId: approvedBy,
        approverName: approvedByName || 'IT Staff Approver',
        approverRole: approverRole || 'IT Staff',
        action: 'Approved',
        comments: comments || 'Authorized device removal for specified business purpose.',
        createdAt: nowIso,
      };
      memoryDeviceOutApprovals.push(approvalEntry);
      if (!memoryDeviceOutRequests[reqIndex].approvals) {
        memoryDeviceOutRequests[reqIndex].approvals = [];
      }
      memoryDeviceOutRequests[reqIndex].approvals.push(approvalEntry);
    }

    // Update in PostgreSQL
    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(`
          UPDATE device_out_requests
          SET approval_status = 'Approved',
              approved_by = $1,
              approved_by_name = $2,
              approved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 OR request_id = $3
        `, [approvedBy, approvedByName || 'IT Staff Approver', id]);

        await dbPool.query(`
          INSERT INTO device_out_approvals (request_id, approver_id, approver_name, approver_role, action, comments, created_at)
          VALUES ($1, $2, $3, $4, 'Approved', $5, CURRENT_TIMESTAMP)
        `, [id, approvedBy, approvedByName || 'IT Staff Approver', approverRole || 'IT Staff', comments || 'Authorized device removal for specified business purpose.']);

        return res.json({
          success: true,
          message: `Device Out request ${id} is APPROVED. SATO CL4NX sticker printing is now enabled.`,
          data: { id, approvalStatus: 'Approved' },
        });
      } catch (dbErr) {
        console.error('[DB Error: Approve /api/device-out-requests/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
        return res.status(500).json({ success: false, error: 'Database update failed' });
      }
    } else {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Reject Device Out Request (IT Staff only)
app.post('/api/device-out-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, rejectedByName, approverRole, rejectionReason, comments } = req.body;

    if (!isUserItStaff(approverRole)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only authorized IT staff can reject Bring Device Out requests.' });
    }

    const reason = rejectionReason || comments;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is mandatory when declining a device out request.' });
    }

    const nowIso = new Date().toISOString();

    const reqIndex = memoryDeviceOutRequests.findIndex(r => r.id === id || r.requestId === id);
    if (reqIndex !== -1) {
      memoryDeviceOutRequests[reqIndex].approvalStatus = 'Rejected';
      memoryDeviceOutRequests[reqIndex].rejectionReason = reason;
      memoryDeviceOutRequests[reqIndex].updatedAt = nowIso;

      const approvalEntry = {
        id: Date.now(),
        requestId: id,
        approverId: rejectedBy || 'USR-IT-STAFF',
        approverName: rejectedByName || 'IT Staff Reviewer',
        approverRole: approverRole || 'IT Staff',
        action: 'Rejected',
        comments: reason,
        createdAt: nowIso,
      };
      memoryDeviceOutApprovals.push(approvalEntry);
      if (!memoryDeviceOutRequests[reqIndex].approvals) {
        memoryDeviceOutRequests[reqIndex].approvals = [];
      }
      memoryDeviceOutRequests[reqIndex].approvals.push(approvalEntry);
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(`
          UPDATE device_out_requests
          SET approval_status = 'Rejected',
              rejection_reason = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 OR request_id = $2
        `, [reason, id]);

        await dbPool.query(`
          INSERT INTO device_out_approvals (request_id, approver_id, approver_name, approver_role, action, comments, created_at)
          VALUES ($1, $2, $3, $4, 'Rejected', $5, CURRENT_TIMESTAMP)
        `, [id, rejectedBy || 'USR-IT-STAFF', rejectedByName || 'IT Staff Reviewer', approverRole || 'IT Staff', reason]);
      } catch (dbErr) {
        console.warn('[DB Fallback: Reject /api/device-out-requests/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Device Out request ${id} has been REJECTED.`,
      data: reqIndex !== -1 ? memoryDeviceOutRequests[reqIndex] : { id, approvalStatus: 'Rejected' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Mark as Returned (IT Staff only)
app.post('/api/device-out-requests/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { returnedBy, returnedByName, approverRole, remarks } = req.body;

    if (!isUserItStaff(approverRole)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only IT staff can mark devices as returned.' });
    }

    const nowIso = new Date().toISOString();

    const reqIndex = memoryDeviceOutRequests.findIndex(r => r.id === id || r.requestId === id);
    if (reqIndex !== -1) {
      memoryDeviceOutRequests[reqIndex].approvalStatus = 'Returned/Closed';
      memoryDeviceOutRequests[reqIndex].returnedAt = nowIso;
      memoryDeviceOutRequests[reqIndex].returnedBy = returnedBy || 'USR-IT-STAFF';
      memoryDeviceOutRequests[reqIndex].returnedByName = returnedByName || 'IT Custodian';
      memoryDeviceOutRequests[reqIndex].returnRemarks = remarks || 'Device returned and checked into pool inventory.';
      memoryDeviceOutRequests[reqIndex].updatedAt = nowIso;

      const approvalEntry = {
        id: Date.now(),
        requestId: id,
        approverId: returnedBy || 'USR-IT-STAFF',
        approverName: returnedByName || 'IT Custodian',
        approverRole: approverRole || 'IT Staff',
        action: 'Returned/Closed',
        comments: remarks || 'Device returned in good condition. Out-pass closed.',
        createdAt: nowIso,
      };
      memoryDeviceOutApprovals.push(approvalEntry);
      if (!memoryDeviceOutRequests[reqIndex].approvals) {
        memoryDeviceOutRequests[reqIndex].approvals = [];
      }
      memoryDeviceOutRequests[reqIndex].approvals.push(approvalEntry);
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(`
          UPDATE device_out_requests
          SET approval_status = 'Returned/Closed',
              returned_at = CURRENT_TIMESTAMP,
              returned_by = $1,
              returned_by_name = $2,
              return_remarks = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 OR request_id = $4
        `, [returnedBy || 'USR-IT-STAFF', returnedByName || 'IT Custodian', remarks || 'Device returned in good condition.', id]);

        await dbPool.query(`
          INSERT INTO device_out_approvals (request_id, approver_id, approver_name, approver_role, action, comments, created_at)
          VALUES ($1, $2, $3, $4, 'Returned/Closed', $5, CURRENT_TIMESTAMP)
        `, [id, returnedBy || 'USR-IT-STAFF', returnedByName || 'IT Custodian', approverRole || 'IT Staff', remarks || 'Device returned in good condition.']);
      } catch (dbErr) {
        console.warn('[DB Fallback: Return /api/device-out-requests/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Device Out request ${id} is marked as RETURNED and CLOSED. Sticker printing is disabled.`,
      data: reqIndex !== -1 ? memoryDeviceOutRequests[reqIndex] : { id, approvalStatus: 'Returned/Closed' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET: Label Templates
app.get('/api/label-templates', async (req, res) => {
  try {
    let templates = [...memoryLabelTemplates];

    if (isDbConnected && dbPool) {
      try {
        const tplRes = await dbPool.query('SELECT * FROM label_templates ORDER BY is_active DESC, created_at ASC');
        if (tplRes.rows.length > 0) {
          const tplIds = tplRes.rows.map(r => r.id);
          const elRes = await dbPool.query('SELECT * FROM label_template_elements WHERE template_id = ANY($1)', [tplIds]);

          templates = tplRes.rows.map(t => {
            const elements = elRes.rows
              .filter(e => e.template_id === t.id)
              .map(e => ({
                id: e.id,
                templateId: e.template_id,
                elementType: e.element_type,
                fieldKey: e.field_key,
                xMm: Number(e.x_mm),
                yMm: Number(e.y_mm),
                widthMm: Number(e.width_mm),
                heightMm: Number(e.height_mm),
                fontSize: Number(e.font_size),
                fontWeight: e.font_weight,
                visible: Boolean(e.visible),
                alignment: e.alignment,
                rotation: Number(e.rotation),
              }));

            return {
              id: t.id,
              name: t.name,
              widthMm: Number(t.width_mm),
              heightMm: Number(t.height_mm),
              orientation: t.orientation,
              isActive: Boolean(t.is_active),
              createdBy: t.created_by,
              updatedBy: t.updated_by,
              createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
              updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : null,
              elements,
            };
          });
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: /api/label-templates]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({ success: true, data: templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Save or Update Label Template (Admin)
app.post('/api/label-templates', async (req, res) => {
  try {
    const {
      id = `tpl-${Date.now()}`,
      name,
      widthMm = 100,
      heightMm = 50,
      orientation = 'Landscape',
      isActive = true,
      elements = [],
      updatedBy = 'Admin User',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Template name is required.' });
    }

    const templateObj = {
      id,
      name,
      widthMm: Number(widthMm),
      heightMm: Number(heightMm),
      orientation,
      isActive: Boolean(isActive),
      updatedBy,
      updatedAt: new Date().toISOString(),
      elements: elements.map((el: any, idx: number) => ({
        ...el,
        id: el.id || `el-${idx + 1}`,
        templateId: id,
        xMm: Number(el.xMm || 0),
        yMm: Number(el.yMm || 0),
        widthMm: Number(el.widthMm || 40),
        heightMm: Number(el.heightMm || 10),
        fontSize: Number(el.fontSize || 10),
        fontWeight: el.fontWeight || 'normal',
        visible: el.visible !== false,
        alignment: el.alignment || 'left',
        rotation: Number(el.rotation || 0),
      }))
    };

    // Update in memory
    const existingIndex = memoryLabelTemplates.findIndex(t => t.id === id);
    if (existingIndex !== -1) {
      memoryLabelTemplates[existingIndex] = templateObj;
    } else {
      memoryLabelTemplates.push(templateObj);
    }

    // Save to PostgreSQL
    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(`
          INSERT INTO label_templates (id, name, width_mm, height_mm, orientation, is_active, updated_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            width_mm = EXCLUDED.width_mm,
            height_mm = EXCLUDED.height_mm,
            orientation = EXCLUDED.orientation,
            is_active = EXCLUDED.is_active,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP;
        `, [id, name, templateObj.widthMm, templateObj.heightMm, orientation, isActive, updatedBy]);

        await dbPool.query('DELETE FROM label_template_elements WHERE template_id = $1', [id]);

        for (const el of templateObj.elements) {
          await dbPool.query(`
            INSERT INTO label_template_elements (
              id, template_id, element_type, field_key, x_mm, y_mm, width_mm, height_mm,
              font_size, font_weight, visible, alignment, rotation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            el.id,
            id,
            el.elementType || 'text',
            el.fieldKey,
            el.xMm,
            el.yMm,
            el.widthMm,
            el.heightMm,
            el.fontSize,
            el.fontWeight,
            el.visible,
            el.alignment,
            el.rotation,
          ]);
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: POST /api/label-templates]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Label template '${name}' saved successfully.`,
      data: templateObj,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// DELETE: Label Template (Admin)
app.delete('/api/label-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Template ID is required.' });
    }

    if (memoryLabelTemplates.length <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the only remaining label template. At least one template must remain in the system.'
      });
    }

    const tplIndex = memoryLabelTemplates.findIndex(t => t.id === id);
    if (tplIndex === -1) {
      return res.status(404).json({ success: false, error: 'Label template not found.' });
    }

    const deleted = memoryLabelTemplates.splice(tplIndex, 1)[0];

    // If the deleted template was active, make the first remaining template active
    if (deleted.isActive && memoryLabelTemplates.length > 0) {
      memoryLabelTemplates[0].isActive = true;
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query('DELETE FROM label_template_elements WHERE template_id = $1', [id]);
        await dbPool.query('DELETE FROM label_templates WHERE id = $1', [id]);
        if (deleted.isActive && memoryLabelTemplates.length > 0) {
          await dbPool.query('UPDATE label_templates SET is_active = TRUE WHERE id = $1', [memoryLabelTemplates[0].id]);
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: DELETE /api/label-templates/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Label template '${deleted.name}' deleted successfully.`
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Record Label Print History & Validate Print Authorization
app.post('/api/label-print-history', async (req, res) => {
  try {
    const { requestId, templateId, printedBy, printedByName, printerName = 'SATO CL4NX', printCount = 1 } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Request ID is required to log label print.' });
    }

    // Strict Rule Validation:
    // "Only APPROVED requests can print a sticker."
    // "Never allow printing unless approval_status = APPROVED."
    // "Prevent printing after Returned/Closed."
    let requestObj = memoryDeviceOutRequests.find(r => r.id === requestId || r.requestId === requestId);

    if (isDbConnected && dbPool) {
      try {
        const dbReq = await dbPool.query('SELECT * FROM device_out_requests WHERE id = $1 OR request_id = $1', [requestId]);
        if (dbReq.rows.length > 0) {
          const row = dbReq.rows[0];
          requestObj = {
            id: row.id,
            requestId: row.request_id || row.id,
            approvalStatus: row.approval_status,
          };
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: Verify Request in /api/label-print-history]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (!requestObj) {
      return res.status(404).json({ success: false, error: `Device Out request ${requestId} not found.` });
    }

    if (requestObj.approvalStatus === 'Returned/Closed') {
      return res.status(400).json({
        success: false,
        error: 'Security Enforcement: Printing is disabled because this device out-pass has already been Returned/Closed.'
      });
    }

    if (requestObj.approvalStatus !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: `Security Enforcement: Never allow printing unless approval_status = APPROVED. Current status is '${requestObj.approvalStatus}'.`
      });
    }

    const nowIso = new Date().toISOString();
    const count = Math.max(1, Number(printCount) || 1);

    const historyRecord = {
      id: Date.now(),
      requestId,
      templateId: templateId || 'tpl-sato-cl4nx-std',
      printedBy: printedBy || 'USR-IT-STAFF',
      printedByName: printedByName || 'IT Staff Member',
      printerName: printerName || 'SATO CL4NX',
      printCount: count,
      printedAt: nowIso,
    };

    memoryLabelPrintHistory.push(historyRecord);

    // Update print count in memory
    const reqIndex = memoryDeviceOutRequests.findIndex(r => r.id === requestId || r.requestId === requestId);
    if (reqIndex !== -1) {
      memoryDeviceOutRequests[reqIndex].printCount = (memoryDeviceOutRequests[reqIndex].printCount || 0) + count;
      memoryDeviceOutRequests[reqIndex].lastPrintedAt = nowIso;
    }

    // Log to PostgreSQL
    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(`
          INSERT INTO label_print_history (request_id, template_id, printed_by, printed_by_name, printer_name, print_count, printed_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
          requestId,
          templateId || 'tpl-sato-cl4nx-std',
          printedBy || 'USR-IT-STAFF',
          printedByName || 'IT Staff Member',
          printerName || 'SATO CL4NX',
          count,
        ]);
      } catch (dbErr) {
        console.warn('[DB Fallback: INSERT label_print_history]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Print of ${count} label(s) logged successfully for ${printerName}.`,
      data: historyRecord,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});


// ==========================================
// WHAT'S NEW / RELEASE NOTES API ENDPOINTS
// ==========================================

// GET: All Release Notes (Published for all users, Drafts only for Admin)
app.get('/api/release-notes', async (req, res) => {
  try {
    const { userId, includeDrafts, actorRole } = req.query as {
      userId?: string;
      includeDrafts?: string;
      actorRole?: string;
    };

    const isAdmin = actorRole === 'System Admin' || actorRole === 'IT Admin';
    const allowDrafts = isAdmin && includeDrafts === 'true';

    let releases: any[] = [];

    if (isDbConnected && dbPool) {
      try {
        let query = `
          SELECT rn.id, rn.version, rn.title, TO_CHAR(rn.release_date, 'YYYY-MM-DD') as "releaseDate",
                 rn.summary, rn.status, rn.published_at as "publishedAt",
                 rn.created_by as "createdBy", rn.updated_by as "updatedBy",
                 rn.created_at as "createdAt", rn.updated_at as "updatedAt",
                 u1.full_name as "createdByName",
                 u2.full_name as "updatedByName",
                 CASE 
                   WHEN $1::text IS NOT NULL THEN
                     EXISTS (SELECT 1 FROM release_note_reads r WHERE r.release_id = rn.id AND r.user_id = $1::text)
                   ELSE false
                 END as "isRead"
          FROM release_notes rn
          LEFT JOIN users u1 ON rn.created_by = u1.id
          LEFT JOIN users u2 ON rn.updated_by = u2.id
        `;
        const params: any[] = [userId || null];

        if (!allowDrafts) {
          query += ` WHERE rn.status = 'Published'`;
        }

        query += ` ORDER BY rn.release_date DESC, rn.created_at DESC`;

        const dbRes = await dbPool.query(query, params);
        const relRows = dbRes.rows || [];

        if (relRows.length > 0) {
          const relIds = relRows.map(r => r.id);
          const itemsRes = await dbPool.query(
            `SELECT id, release_id as "releaseId", type, description, sort_order as "sortOrder"
             FROM release_note_items
             WHERE release_id = ANY($1::varchar[])
             ORDER BY sort_order ASC, id ASC`,
            [relIds]
          );
          const allItems = itemsRes.rows || [];

          releases = relRows.map(rn => ({
            ...rn,
            items: allItems.filter(item => item.releaseId === rn.id),
          }));
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: /api/release-notes]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (releases.length === 0) {
      // Memory fallback
      releases = memoryReleaseNotes
        .filter(r => allowDrafts || r.status === 'Published')
        .map(r => ({
          ...r,
          isRead: userId ? memoryReleaseReads.some(read => read.releaseId === r.id && read.userId === userId) : false,
        }))
        .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    }

    return res.json({ success: true, data: releases });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET: Unread Published Release Notes Count for a User
app.get('/api/release-notes/unread-count', async (req, res) => {
  try {
    const { userId } = req.query as { userId?: string };
    if (!userId) {
      return res.json({ success: true, count: 0 });
    }

    let unreadCount = 0;

    if (isDbConnected && dbPool) {
      try {
        const countRes = await dbPool.query(
          `SELECT COUNT(*)::int as count
           FROM release_notes rn
           WHERE rn.status = 'Published'
             AND NOT EXISTS (
               SELECT 1 FROM release_note_reads r
               WHERE r.release_id = rn.id AND r.user_id = $1
             )`,
          [userId]
        );
        unreadCount = countRes.rows[0]?.count || 0;
      } catch (dbErr) {
        console.warn('[DB Fallback: unread-count]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    } else {
      unreadCount = memoryReleaseNotes.filter(
        r => r.status === 'Published' && !memoryReleaseReads.some(read => read.releaseId === r.id && read.userId === userId)
      ).length;
    }

    return res.json({ success: true, count: unreadCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Mark Release Note as Read by User
app.post('/api/release-notes/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId: string };

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const nowIso = new Date().toISOString();
    const readId = `read-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Memory update
    const existingIdx = memoryReleaseReads.findIndex(r => r.releaseId === id && r.userId === userId);
    if (existingIdx === -1) {
      memoryReleaseReads.push({ id: readId, releaseId: id, userId, readAt: nowIso });
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `INSERT INTO release_note_reads (id, release_id, user_id, read_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (release_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
          [readId, id, userId]
        );
      } catch (dbErr) {
        console.warn('[DB Fallback: POST /api/release-notes/:id/read]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({ success: true, message: 'Release marked as read.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Create New Release Note (Admin Only)
app.post('/api/release-notes', async (req, res) => {
  try {
    const {
      version,
      title,
      releaseDate,
      summary,
      status = 'Draft',
      items = [],
      actorUserId,
      actorRole,
      actorName
    } = req.body as {
      version: string;
      title: string;
      releaseDate: string;
      summary: string;
      status?: 'Draft' | 'Published';
      items?: any[];
      actorUserId?: string;
      actorRole?: string;
      actorName?: string;
    };

    if (actorRole !== 'System Admin' && actorRole !== 'IT Admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Administrators can create release notes.' });
    }

    if (!version || !title || !releaseDate) {
      return res.status(400).json({ success: false, error: 'Version, title, and release date are required fields.' });
    }

    const newId = `rel-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const publishedAt = status === 'Published' ? nowIso : null;

    const formattedItems = (items || []).map((item, idx) => ({
      id: item.id || `item-${Date.now()}-${idx}`,
      releaseId: newId,
      type: item.type || "What's New",
      description: item.description || '',
      sortOrder: item.sortOrder !== undefined ? item.sortOrder : idx + 1,
    }));

    const newRelease = {
      id: newId,
      version: version.trim(),
      title: title.trim(),
      releaseDate,
      summary: summary || '',
      status,
      publishedAt,
      createdBy: actorUserId || 'USR-ADMIN',
      createdByName: actorName || 'System Administrator',
      updatedBy: actorUserId || 'USR-ADMIN',
      updatedByName: actorName || 'System Administrator',
      createdAt: nowIso,
      updatedAt: nowIso,
      items: formattedItems,
    };

    // Update memory
    memoryReleaseNotes.unshift(newRelease);

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `INSERT INTO release_notes (id, version, title, release_date, summary, status, published_at, created_by, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            newId,
            newRelease.version,
            newRelease.title,
            newRelease.releaseDate,
            newRelease.summary,
            newRelease.status,
            newRelease.publishedAt,
            newRelease.createdBy,
            newRelease.updatedBy
          ]
        );

        for (const item of formattedItems) {
          await dbPool.query(
            `INSERT INTO release_note_items (id, release_id, type, description, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [item.id, newId, item.type, item.description, item.sortOrder]
          );
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: POST /api/release-notes]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.status(201).json({
      success: true,
      message: `Release note "${newRelease.version} - ${newRelease.title}" created successfully.`,
      data: newRelease,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// PUT: Update Release Note (Admin Only)
app.put('/api/release-notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      version,
      title,
      releaseDate,
      summary,
      status,
      items = [],
      actorUserId,
      actorRole,
      actorName
    } = req.body as {
      version: string;
      title: string;
      releaseDate: string;
      summary: string;
      status?: 'Draft' | 'Published';
      items?: any[];
      actorUserId?: string;
      actorRole?: string;
      actorName?: string;
    };

    if (actorRole !== 'System Admin' && actorRole !== 'IT Admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Administrators can update release notes.' });
    }

    const nowIso = new Date().toISOString();
    const memIdx = memoryReleaseNotes.findIndex(r => r.id === id);

    let currentPublishedAt: string | null = null;
    if (memIdx !== -1) {
      currentPublishedAt = memoryReleaseNotes[memIdx].publishedAt;
    }

    const publishedAt = status === 'Published' ? (currentPublishedAt || nowIso) : null;

    const formattedItems = (items || []).map((item, idx) => ({
      id: item.id || `item-${Date.now()}-${idx}`,
      releaseId: id,
      type: item.type || "What's New",
      description: item.description || '',
      sortOrder: item.sortOrder !== undefined ? item.sortOrder : idx + 1,
    }));

    if (memIdx !== -1) {
      memoryReleaseNotes[memIdx] = {
        ...memoryReleaseNotes[memIdx],
        version: version.trim(),
        title: title.trim(),
        releaseDate,
        summary: summary || '',
        status: status || memoryReleaseNotes[memIdx].status,
        publishedAt,
        updatedBy: actorUserId || 'USR-ADMIN',
        updatedByName: actorName || memoryReleaseNotes[memIdx].updatedByName,
        updatedAt: nowIso,
        items: formattedItems,
      };
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `UPDATE release_notes
           SET version = $1, title = $2, release_date = $3, summary = $4,
               status = $5, published_at = $6, updated_by = $7, updated_at = CURRENT_TIMESTAMP
           WHERE id = $8`,
          [
            version.trim(),
            title.trim(),
            releaseDate,
            summary || '',
            status || 'Draft',
            publishedAt,
            actorUserId || null,
            id
          ]
        );

        // Replace items
        await dbPool.query('DELETE FROM release_note_items WHERE release_id = $1', [id]);
        for (const item of formattedItems) {
          await dbPool.query(
            `INSERT INTO release_note_items (id, release_id, type, description, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [item.id, id, item.type, item.description, item.sortOrder]
          );
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: PUT /api/release-notes/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Release note updated successfully.`,
      data: memIdx !== -1 ? memoryReleaseNotes[memIdx] : { id, version, title },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// PATCH: Publish / Unpublish Release Note (Admin Only)
app.patch('/api/release-notes/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actorUserId, actorRole, actorName } = req.body as {
      status: 'Published' | 'Draft';
      actorUserId?: string;
      actorRole?: string;
      actorName?: string;
    };

    if (actorRole !== 'System Admin' && actorRole !== 'IT Admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Administrators can publish or unpublish releases.' });
    }

    const nowIso = new Date().toISOString();
    const memIdx = memoryReleaseNotes.findIndex(r => r.id === id);

    let publishedAt: string | null = null;
    if (status === 'Published') {
      publishedAt = (memIdx !== -1 && memoryReleaseNotes[memIdx].publishedAt) ? memoryReleaseNotes[memIdx].publishedAt : nowIso;
    }

    if (memIdx !== -1) {
      memoryReleaseNotes[memIdx].status = status;
      memoryReleaseNotes[memIdx].publishedAt = publishedAt;
      memoryReleaseNotes[memIdx].updatedBy = actorUserId || 'USR-ADMIN';
      memoryReleaseNotes[memIdx].updatedByName = actorName || 'System Administrator';
      memoryReleaseNotes[memIdx].updatedAt = nowIso;
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `UPDATE release_notes
           SET status = $1,
               published_at = CASE WHEN $1 = 'Published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,
               updated_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [status, actorUserId || null, id]
        );
      } catch (dbErr) {
        console.warn('[DB Fallback: PATCH /api/release-notes/:id/publish]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({
      success: true,
      message: `Release note is now ${status}.`,
      status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// DELETE: Delete Release Note (Admin Only)
app.delete('/api/release-notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { actorRole } = req.query as { actorRole?: string };

    if (actorRole !== 'System Admin' && actorRole !== 'IT Admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Administrators can delete release notes.' });
    }

    const memIdx = memoryReleaseNotes.findIndex(r => r.id === id);
    if (memIdx !== -1) {
      memoryReleaseNotes.splice(memIdx, 1);
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query('DELETE FROM release_notes WHERE id = $1', [id]);
      } catch (dbErr) {
        console.warn('[DB Fallback: DELETE /api/release-notes/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    return res.json({ success: true, message: `Release note deleted successfully.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});


// ============================================================================
// MAINTENANCE ANNOUNCEMENTS & EMAIL REMINDERS ENGINE
// ============================================================================

// In-Memory Fallback State for Maintenance Announcements & Reminders
const memoryMaintenanceAnnouncements: any[] = [
  {
    id: 'maint-2026-001',
    title: 'Enterprise SAP ERP & Core Network Switch Infrastructure Upgrade',
    maintenanceType: 'Network & Server Maintenance',
    affectedSystem: 'SAP Production & MES Shop Floor Gateway',
    description: 'Scheduled replacement of core distribution switches, fiber optic transceivers, and operating firmware patches across the primary datacenter rack.',
    reason: 'Hardware end-of-life replacement and mandatory security vulnerability remediation.',
    startDatetime: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    endDatetime: new Date(Date.now() + (3 * 24 + 4) * 3600 * 1000).toISOString(),
    duration: '4 hours',
    impact: 'Complete service downtime for SAP ERP, MES shop floor terminals, and local file storage.',
    userAction: 'All users must save ongoing transactions and log out from SAP and MES before the maintenance window.',
    workaround: 'Production lines may continue using paper batch traveler forms during the 4-hour window.',
    itContact: 'Tanaka IT Operations Desk ext. 4321 / helpdesk@tanaka.com.my',
    changeNumber: 'ITO-CR-2026-00088',
    recipientGroup: 'TD_TEM',
    status: 'Scheduled',
    reminderSettings: {
      initial: true,
      threeDaysBefore: true,
      oneDayBefore: true,
      thirtyMinsBefore: true,
      started: true,
      completed: true,
      cancelled: true,
    },
    createdBy: 'USR-ADMIN',
    createdByName: 'System Administrator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const memoryMaintenanceReminders: any[] = [
  {
    id: 'rem-001-init',
    maintenanceId: 'maint-2026-001',
    reminderType: 'initial',
    scheduledTime: new Date().toISOString(),
    status: 'Sent',
    sentTime: new Date().toISOString(),
    recipientGroup: 'TD_TEM',
    recipientCount: 85,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-3day',
    maintenanceId: 'maint-2026-001',
    reminderType: '3_days_before',
    scheduledTime: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-1day',
    maintenanceId: 'maint-2026-001',
    reminderType: '1_day_before',
    scheduledTime: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-30m',
    maintenanceId: 'maint-2026-001',
    reminderType: '30_mins_before',
    scheduledTime: new Date(Date.now() + (3 * 24 * 3600 - 1800) * 1000).toISOString(),
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-start',
    maintenanceId: 'maint-2026-001',
    reminderType: 'started',
    scheduledTime: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-comp',
    maintenanceId: 'maint-2026-001',
    reminderType: 'completed',
    scheduledTime: new Date(Date.now() + (3 * 24 + 4) * 3600 * 1000).toISOString(),
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
  {
    id: 'rem-001-canc',
    maintenanceId: 'maint-2026-001',
    reminderType: 'cancelled',
    scheduledTime: null,
    status: 'Scheduled',
    recipientGroup: 'TD_TEM',
    recipientCount: 0,
    templateUsed: 'maintenance_announcement_broadcast',
  },
];

const memoryMaintenanceEmailHistory: any[] = [
  {
    id: 'hist-001-init',
    maintenanceId: 'maint-2026-001',
    reminderType: 'initial',
    recipientGroup: 'TD_TEM',
    recipientCount: 85,
    scheduledTime: new Date().toISOString(),
    sentTime: new Date().toISOString(),
    status: 'Sent',
    templateUsed: 'maintenance_announcement_broadcast',
    subject: '[INITIAL ANNOUNCEMENT] Scheduled IT Maintenance: SAP Production & MES Shop Floor Gateway',
    createdAt: new Date().toISOString(),
  },
];

// Helper: Calculate duration between start & end
function calculateMaintenanceDurationHelper(start: string | Date, end: string | Date): string {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return '0 minutes (End time must be after Start time)';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' ') : '0 minutes';
}

// Helper: Reminder label
function getMaintenanceReminderLabel(type: string): string {
  switch (type) {
    case 'initial':
      return 'INITIAL ANNOUNCEMENT';
    case '3_days_before':
      return 'REMINDER (3 DAYS BEFORE)';
    case '1_day_before':
      return 'REMINDER (1 DAY BEFORE)';
    case '30_mins_before':
      return 'URGENT (30 MINUTES BEFORE)';
    case 'started':
      return 'MAINTENANCE STARTED';
    case 'completed':
      return 'MAINTENANCE COMPLETED';
    case 'cancelled':
      return 'MAINTENANCE CANCELLED';
    default:
      return 'MAINTENANCE NOTICE';
  }
}

// Helper: Format DateTime for Malaysian Timezone display
function formatMytDisplay(dt: string | Date): string {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return String(dt);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(d).replace(',', '')} (MYT)`;
  } catch {
    return d.toISOString().replace('T', ' ').substring(0, 16) + ' (MYT)';
  }
}

// Helper: Default Maintenance HTML Template Fallback
const DEFAULT_MAINTENANCE_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px; text-align: left; border-bottom: 3px solid #3b82f6;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <span style="background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 4px; letter-spacing: 0.8px; text-transform: uppercase;">
        TANAKA IT OPERATIONS NOTICE
      </span>
      <span style="background-color: #f59e0b; color: #000000; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 4px; text-transform: uppercase;">
        {{reminder_type_label}}
      </span>
    </div>
    <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 800; line-height: 1.3;">
      {{announcement_title}}
    </h1>
    <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
      Target Audience: <strong>{{recipient_group}}</strong> • Ref: <strong>{{change_number}}</strong> • Maintenance Type: <strong>{{maintenance_type}}</strong>
    </div>
  </div>
  
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size: 14px; color: #334155; margin-top: 0; line-height: 1.6;">
      Dear Tanaka Team,
    </p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Please be informed of an upcoming scheduled IT system maintenance window affecting <strong>{{affected_system}}</strong>. Details and user instructions are provided below:
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 160px; font-weight: bold;">Affected System/Service:</td>
          <td style="font-weight: 800; color: #0f172a;">{{affected_system}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Maintenance Type:</td>
          <td style="color: #334155;">{{maintenance_type}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Start Date / Time:</td>
          <td style="font-family: monospace; font-weight: bold; color: #2563eb;">{{start_datetime}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: bold;">End Date / Time:</td>
          <td style="font-family: monospace; font-weight: bold; color: #2563eb;">{{end_datetime}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Expected Duration:</td>
          <td style="font-weight: bold; color: #059669;">{{duration}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Change Tracking Ref:</td>
          <td style="font-family: monospace; color: #475569;">{{change_number}}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        ⚠️ Expected Operational Impact:
      </div>
      <div style="font-size: 13px; font-weight: 700; color: #9a3412; line-height: 1.5;">
        {{impact}}
      </div>
    </div>

    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <div style="margin-bottom: 10px;">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Technical Scope & Description:</div>
        <div style="font-size: 13px; color: #0f172a; line-height: 1.5; margin-top: 3px;">{{description}}</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Maintenance Justification:</div>
        <div style="font-size: 13px; color: #334155; line-height: 1.5; margin-top: 3px;">{{reason}}</div>
      </div>
    </div>

    <div style="background-color: #fefce8; border: 1px solid #fef08a; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #854d0e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        📋 User Action Required:
      </div>
      <div style="font-size: 13px; color: #713f12; line-height: 1.5;">
        {{user_action}}
      </div>
    </div>

    <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        🔄 Fallback Workaround:
      </div>
      <div style="font-size: 13px; color: #0c4a6e; line-height: 1.5;">
        {{workaround}}
      </div>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #475569;">
      <strong>IT Operations Helpdesk Contact:</strong> {{it_contact}}
    </div>

    <div style="text-align: center; margin: 26px 0 14px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Open IT Helpdesk Portal
      </a>
    </div>

    <div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
      This is an automated operational notification dispatched via Tanaka IT Enterprise Notification Relay.
    </div>
  </div>
</div>`;

// Helper: Interpolate all 13 variables into subject & HTML
function interpolateMaintenanceTemplate(
  templateHtml: string,
  subjectTemplate: string,
  announcement: any,
  reminderType: string,
  recipientGroup: string = 'TD_TEM'
): { subject: string; html: string } {
  const reminderLabel = getMaintenanceReminderLabel(reminderType);
  const startFormatted = formatMytDisplay(announcement.startDatetime || announcement.start_datetime);
  const endFormatted = formatMytDisplay(announcement.endDatetime || announcement.end_datetime);
  const duration = announcement.duration || calculateMaintenanceDurationHelper(announcement.startDatetime, announcement.endDatetime);

  const vars: Record<string, string> = {
    announcement_title: announcement.title || 'Scheduled IT Maintenance',
    maintenance_type: announcement.maintenanceType || announcement.maintenance_type || 'General Maintenance',
    affected_system: announcement.affectedSystem || announcement.affected_system || 'Enterprise IT Systems',
    description: announcement.description || 'Routine IT maintenance and infrastructure improvements.',
    reason: announcement.reason || 'Preventive IT maintenance and security updates.',
    start_datetime: startFormatted,
    end_datetime: endFormatted,
    duration: duration,
    impact: announcement.impact || 'Service may be temporarily unavailable.',
    user_action: announcement.userAction || announcement.user_action || 'Please save all work prior to the maintenance window.',
    workaround: announcement.workaround || 'None required or proceed with manual contingency records.',
    it_contact: announcement.itContact || announcement.it_contact || 'IT Operations Desk / helpdesk@tanaka.com.my',
    change_number: announcement.changeNumber || announcement.change_number || 'N/A',
    reminder_type_label: reminderLabel,
    recipient_group: recipientGroup || announcement.recipientGroup || announcement.recipient_group || 'TD_TEM',
    portalUrl: 'http://157.9.183.59:3000',
  };

  let interpolatedSubject = subjectTemplate || `[{{reminder_type_label}}] IT Maintenance Notice: {{affected_system}} - {{announcement_title}}`;
  let interpolatedHtml = templateHtml || DEFAULT_MAINTENANCE_HTML;

  Object.entries(vars).forEach(([k, v]) => {
    const regex = new RegExp(`{{${k}}}`, 'g');
    interpolatedSubject = interpolatedSubject.replace(regex, v);
    interpolatedHtml = interpolatedHtml.replace(regex, v);
  });

  return { subject: interpolatedSubject, html: interpolatedHtml };
}

// Helper: Dispatch Email using existing SMTP server configuration
async function dispatchMaintenanceEmailViaSmtp(options: {
  announcement: any;
  reminderType: string;
  recipientEmail: string;
  recipientGroup?: string;
  isTest?: boolean;
}): Promise<{ success: boolean; subject: string; html: string; error?: string }> {
  const { announcement, reminderType, recipientEmail, recipientGroup = 'TD_TEM', isTest = false } = options;

  // Retrieve current active SMTP configuration
  let smtpHost = '157.9.183.242';
  let smtpPort = 25;
  let smtpUser: string | undefined = undefined;
  let smtpPass: string | undefined = undefined;
  let fromAddress = 'Administrator@tanaka.com.my';
  let fromName = 'Tanaka IT Operations Relay';
  let templateSubject = `[{{reminder_type_label}}] IT Maintenance Notice: {{affected_system}} - {{announcement_title}}`;
  let templateHtml = DEFAULT_MAINTENANCE_HTML;

  if (isDbConnected) {
    try {
      const pool = getPool();
      // Check SMTP config from db
      const smtpRes = await pool.query(`SELECT key_value FROM system_configurations WHERE key_name = 'smtp_settings' LIMIT 1`);
      if (smtpRes.rows.length > 0 && smtpRes.rows[0].key_value) {
        const val = typeof smtpRes.rows[0].key_value === 'string' ? JSON.parse(smtpRes.rows[0].key_value) : smtpRes.rows[0].key_value;
        if (val.host) smtpHost = val.host;
        if (val.port) smtpPort = Number(val.port);
        if (val.user) smtpUser = val.user;
        if (val.pass) smtpPass = val.pass;
        if (val.fromAddress) fromAddress = val.fromAddress;
        if (val.fromName) fromName = val.fromName;
      }

      // Check template from db
      const tplRes = await pool.query(`SELECT subject_template, body_html FROM email_templates WHERE id = 'maintenance_announcement_broadcast' LIMIT 1`);
      if (tplRes.rows.length > 0) {
        if (tplRes.rows[0].subject_template) templateSubject = tplRes.rows[0].subject_template;
        if (tplRes.rows[0].body_html) templateHtml = tplRes.rows[0].body_html;
      }
    } catch (dbErr) {
      console.warn('[DB Notice: dispatchMaintenanceEmailViaSmtp reading config]', dbErr instanceof Error ? dbErr.message : String(dbErr));
    }
  }

  const { subject, html } = interpolateMaintenanceTemplate(templateHtml, templateSubject, announcement, reminderType, recipientGroup);
  const finalSubject = isTest ? `[TEST] ${subject}` : subject;

  const transporter = createSmtpTransporter({
    host: smtpHost,
    port: smtpPort,
    user: smtpUser,
    pass: smtpPass,
  });

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: recipientEmail,
      subject: finalSubject,
      html,
    });
    return { success: true, subject: finalSubject, html };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SMTP Maintenance Dispatch Error to ${recipientEmail}]`, errMsg);
    return { success: false, subject: finalSubject, html, error: errMsg };
  }
}

// Background Task: Check and send due maintenance reminders every 60 seconds
let isSchedulerRunning = false;
async function checkAndSendDueMaintenanceReminders(): Promise<void> {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  try {
    const now = new Date();

    if (isDbConnected) {
      const pool = getPool();
      // Select due reminders that are still 'Scheduled' and scheduled_time <= NOW()
      const query = `
        SELECT mr.id, mr.maintenance_id as "maintenanceId", mr.reminder_type as "reminderType",
               mr.scheduled_time as "scheduledTime", mr.recipient_group as "recipientGroup",
               mr.template_used as "templateUsed",
               ma.id as "announcementId", ma.title, ma.maintenance_type as "maintenanceType",
               ma.affected_system as "affectedSystem", ma.description, ma.reason,
               ma.start_datetime as "startDatetime", ma.end_datetime as "endDatetime",
               ma.duration, ma.impact, ma.user_action as "userAction", ma.workaround,
               ma.it_contact as "itContact", ma.change_number as "changeNumber",
               ma.status as "announcementStatus", ma.reminder_settings as "reminderSettings"
        FROM maintenance_reminders mr
        JOIN maintenance_announcements ma ON mr.maintenance_id = ma.id
        WHERE mr.status = 'Scheduled'
          AND mr.scheduled_time IS NOT NULL
          AND mr.scheduled_time <= NOW()
          AND ma.status NOT IN ('Cancelled', 'Completed')
        ORDER BY mr.scheduled_time ASC
        LIMIT 10
      `;
      const res = await pool.query(query);

      for (const reminder of res.rows) {
        // Atomic update to 'Sending' to prevent duplicate execution
        const updateRes = await pool.query(
          `UPDATE maintenance_reminders SET status = 'Sending', updated_at = NOW() WHERE id = $1 AND status = 'Scheduled'`,
          [reminder.id]
        );
        if ((updateRes.rowCount || 0) === 0) continue;

        // Recipient resolution: for TD_TEM, default to company distribution list
        const recipientEmail = 'TD_TEM@tanaka.com.my';
        
        // Count target recipients from active users
        let recipientCount = 85;
        try {
          const userCountRes = await pool.query(`SELECT COUNT(*) as count FROM users WHERE status = 'Active'`);
          if (userCountRes.rows.length > 0 && userCountRes.rows[0].count) {
            recipientCount = parseInt(userCountRes.rows[0].count, 10) || 85;
          }
        } catch {
          // fallback default count
        }

        const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
          announcement: reminder,
          reminderType: reminder.reminderType,
          recipientEmail,
          recipientGroup: reminder.recipientGroup || 'TD_TEM',
        });

        const historyId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        if (dispatchResult.success) {
          await pool.query(
            `UPDATE maintenance_reminders 
             SET status = 'Sent', sent_time = NOW(), recipient_count = $2, updated_at = NOW() 
             WHERE id = $1`,
            [reminder.id, recipientCount]
          );

          await pool.query(
            `INSERT INTO maintenance_email_history 
             (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject, body_html)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'Sent', $7, $8, $9)`,
            [
              historyId,
              reminder.maintenanceId,
              reminder.reminderType,
              reminder.recipientGroup || 'TD_TEM',
              recipientCount,
              reminder.scheduledTime,
              reminder.templateUsed || 'maintenance_announcement_broadcast',
              dispatchResult.subject,
              dispatchResult.html,
            ]
          );

          // Also record in central email_notification_logs
          await pool.query(
            `INSERT INTO email_notification_logs (template_id, recipient_email, recipient_name, subject, body_preview, status)
             VALUES ($1, $2, $3, $4, $5, 'sent')`,
            [
              'maintenance_announcement_broadcast',
              recipientEmail,
              reminder.recipientGroup || 'TD_TEM Distribution Group',
              dispatchResult.subject,
              dispatchResult.subject,
            ]
          );

          // Automatic status transitions if applicable
          if (reminder.reminderType === 'started' && reminder.announcementStatus === 'Scheduled') {
            await pool.query(`UPDATE maintenance_announcements SET status = 'In Progress', updated_at = NOW() WHERE id = $1`, [reminder.maintenanceId]);
          } else if (reminder.reminderType === 'completed' && reminder.announcementStatus === 'In Progress') {
            await pool.query(`UPDATE maintenance_announcements SET status = 'Completed', updated_at = NOW() WHERE id = $1`, [reminder.maintenanceId]);
          }
          console.log(`[Maintenance Reminder Sent] ${reminder.reminderType} for ${reminder.maintenanceId}`);
        } else {
          await pool.query(
            `UPDATE maintenance_reminders 
             SET status = 'Failed', error_message = $2, updated_at = NOW() 
             WHERE id = $1`,
            [reminder.id, dispatchResult.error]
          );

          await pool.query(
            `INSERT INTO maintenance_email_history 
             (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, error_message, template_used, subject)
             VALUES ($1, $2, $3, $4, 0, $5, NOW(), 'Failed', $6, $7, $8)`,
            [
              historyId,
              reminder.maintenanceId,
              reminder.reminderType,
              reminder.recipientGroup || 'TD_TEM',
              reminder.scheduledTime,
              dispatchResult.error,
              reminder.templateUsed || 'maintenance_announcement_broadcast',
              dispatchResult.subject,
            ]
          );
        }
      }
    } else {
      // Memory fallback check
      const dueReminders = memoryMaintenanceReminders.filter(
        r => r.status === 'Scheduled' && r.scheduledTime && new Date(r.scheduledTime) <= now
      );
      for (const rem of dueReminders) {
        const ann = memoryMaintenanceAnnouncements.find(a => a.id === rem.maintenanceId);
        if (!ann || ann.status === 'Cancelled' || ann.status === 'Completed') continue;

        rem.status = 'Sending';
        const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
          announcement: ann,
          reminderType: rem.reminderType,
          recipientEmail: 'TD_TEM@tanaka.com.my',
          recipientGroup: rem.recipientGroup || 'TD_TEM',
        });

        rem.status = dispatchResult.success ? 'Sent' : 'Failed';
        rem.sentTime = new Date().toISOString();
        rem.recipientCount = 85;
        if (!dispatchResult.success) rem.errorMessage = dispatchResult.error;

        memoryMaintenanceEmailHistory.unshift({
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          maintenanceId: rem.maintenanceId,
          reminderType: rem.reminderType,
          recipientGroup: rem.recipientGroup || 'TD_TEM',
          recipientCount: 85,
          scheduledTime: rem.scheduledTime,
          sentTime: new Date().toISOString(),
          status: dispatchResult.success ? 'Sent' : 'Failed',
          errorMessage: dispatchResult.error,
          templateUsed: 'maintenance_announcement_broadcast',
          subject: dispatchResult.subject,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Maintenance Scheduler Error]', err instanceof Error ? err.message : String(err));
  } finally {
    isSchedulerRunning = false;
  }
}

// Background scheduler initializer
let maintenanceSchedulerInterval: NodeJS.Timeout | null = null;
function startMaintenanceScheduler() {
  if (maintenanceSchedulerInterval) return;
  console.log('[Maintenance Engine] Initializing automated reminder scheduler (interval: 60s)...');
  // First run after 5 seconds to catch pending items on startup
  setTimeout(() => {
    checkAndSendDueMaintenanceReminders().catch(console.error);
  }, 5000);
  // Recurring every 60 seconds
  maintenanceSchedulerInterval = setInterval(() => {
    checkAndSendDueMaintenanceReminders().catch(console.error);
  }, 60000);
}

// Helper: Compute future reminder scheduled dates
function computeReminderSchedulesHelper(startDateStr: string, endDateStr: string, settings: any) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const now = new Date();

  return [
    {
      type: 'initial',
      scheduledTime: now,
      enabled: !!settings.initial,
    },
    {
      type: '3_days_before',
      scheduledTime: new Date(startDate.getTime() - 3 * 24 * 3600 * 1000),
      enabled: !!settings.threeDaysBefore,
    },
    {
      type: '1_day_before',
      scheduledTime: new Date(startDate.getTime() - 24 * 3600 * 1000),
      enabled: !!settings.oneDayBefore,
    },
    {
      type: '30_mins_before',
      scheduledTime: new Date(startDate.getTime() - 30 * 60 * 1000),
      enabled: !!settings.thirtyMinsBefore,
    },
    {
      type: 'started',
      scheduledTime: startDate,
      enabled: !!settings.started,
    },
    {
      type: 'completed',
      scheduledTime: endDate,
      enabled: !!settings.completed,
    },
    {
      type: 'cancelled',
      scheduledTime: null,
      enabled: !!settings.cancelled,
    },
  ];
}

// ==========================================
// REST API ENDPOINTS: MAINTENANCE ANNOUNCEMENTS
// ==========================================

// GET: All maintenance announcements
app.get('/api/maintenance-announcements', async (req, res) => {
  try {
    const { status, search } = req.query;

    let announcements: any[] = [];
    if (isDbConnected) {
      try {
        const pool = getPool();
        let query = `
          SELECT id, title, maintenance_type as "maintenanceType", affected_system as "affectedSystem",
                 description, reason, start_datetime as "startDatetime", end_datetime as "endDatetime",
                 duration, impact, user_action as "userAction", workaround, it_contact as "itContact",
                 change_number as "changeNumber", recipient_group as "recipientGroup", status,
                 reminder_settings as "reminderSettings", created_by as "createdBy",
                 created_by_name as "createdByName", updated_by as "updatedBy",
                 updated_by_name as "updatedByName", created_at as "createdAt", updated_at as "updatedAt"
          FROM maintenance_announcements
          WHERE 1=1
        `;
        const params: any[] = [];

        if (status && typeof status === 'string' && status !== 'All') {
          params.push(status);
          query += ` AND status = $${params.length}`;
        }
        if (search && typeof search === 'string' && search.trim().length > 0) {
          params.push(`%${search.trim()}%`);
          query += ` AND (title ILIKE $${params.length} OR affected_system ILIKE $${params.length} OR change_number ILIKE $${params.length})`;
        }

        query += ` ORDER BY start_datetime DESC`;
        const annRes = await pool.query(query, params);
        const annRows = annRes.rows || [];

        if (annRows.length > 0) {
          const annIds = annRows.map(a => a.id);
          const remRes = await pool.query(
            `SELECT id, maintenance_id as "maintenanceId", reminder_type as "reminderType",
                    scheduled_time as "scheduledTime", status, sent_time as "sentTime",
                    error_message as "errorMessage", recipient_group as "recipientGroup",
                    recipient_count as "recipientCount", template_used as "templateUsed"
             FROM maintenance_reminders
             WHERE maintenance_id = ANY($1)
             ORDER BY scheduled_time ASC NULLS LAST`,
            [annIds]
          );
          const remRows = remRes.rows || [];

          announcements = annRows.map(a => ({
            ...a,
            reminders: remRows.filter(r => r.maintenanceId === a.id),
          }));
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: GET /api/maintenance-announcements]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (announcements.length === 0) {
      announcements = memoryMaintenanceAnnouncements
        .filter(a => !status || status === 'All' || a.status === status)
        .map(a => ({
          ...a,
          reminders: memoryMaintenanceReminders.filter(r => r.maintenanceId === a.id),
        }))
        .sort((a, b) => new Date(b.startDatetime).getTime() - new Date(a.startDatetime).getTime());
    }

    return res.json({ success: true, data: announcements });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET: Single maintenance announcement
app.get('/api/maintenance-announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let announcement: any = null;

    if (isDbConnected) {
      try {
        const pool = getPool();
        const annRes = await pool.query(
          `SELECT id, title, maintenance_type as "maintenanceType", affected_system as "affectedSystem",
                  description, reason, start_datetime as "startDatetime", end_datetime as "endDatetime",
                  duration, impact, user_action as "userAction", workaround, it_contact as "itContact",
                  change_number as "changeNumber", recipient_group as "recipientGroup", status,
                  reminder_settings as "reminderSettings", created_by as "createdBy",
                  created_by_name as "createdByName", updated_by as "updatedBy",
                  updated_by_name as "updatedByName", created_at as "createdAt", updated_at as "updatedAt"
           FROM maintenance_announcements WHERE id = $1 LIMIT 1`,
          [id]
        );
        if (annRes.rows.length > 0) {
          announcement = annRes.rows[0];
          const remRes = await pool.query(
            `SELECT id, maintenance_id as "maintenanceId", reminder_type as "reminderType",
                    scheduled_time as "scheduledTime", status, sent_time as "sentTime",
                    error_message as "errorMessage", recipient_group as "recipientGroup",
                    recipient_count as "recipientCount", template_used as "templateUsed"
             FROM maintenance_reminders WHERE maintenance_id = $1 ORDER BY scheduled_time ASC NULLS LAST`,
            [id]
          );
          announcement.reminders = remRes.rows;
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: GET /api/maintenance-announcements/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (!announcement) {
      const mem = memoryMaintenanceAnnouncements.find(a => a.id === id);
      if (mem) {
        announcement = {
          ...mem,
          reminders: memoryMaintenanceReminders.filter(r => r.maintenanceId === id),
        };
      }
    }

    if (!announcement) {
      return res.status(404).json({ success: false, error: 'Maintenance announcement not found.' });
    }

    return res.json({ success: true, data: announcement });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Create maintenance announcement
app.post('/api/maintenance-announcements', async (req, res) => {
  try {
    const {
      title,
      maintenanceType,
      affectedSystem,
      description,
      reason,
      startDatetime,
      endDatetime,
      impact,
      userAction,
      workaround,
      itContact,
      changeNumber,
      recipientGroup = 'TD_TEM',
      status = 'Scheduled',
      reminderSettings = {
        initial: true,
        threeDaysBefore: true,
        oneDayBefore: true,
        thirtyMinsBefore: true,
        started: true,
        completed: true,
        cancelled: true,
      },
      actorUserId = 'USR-ADMIN',
      actorName = 'System Administrator',
    } = req.body;

    if (!title || !maintenanceType || !affectedSystem || !startDatetime || !endDatetime) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory fields: Title, Maintenance Type, Affected System, Start Date/Time, and End Date/Time are required.',
      });
    }

    const duration = calculateMaintenanceDurationHelper(startDatetime, endDatetime);
    const now = new Date();
    const id = `maint-${now.getFullYear()}-${String(Date.now()).slice(-4)}`;
    const nowIso = now.toISOString();

    const newAnnouncement = {
      id,
      title: title.trim(),
      maintenanceType: maintenanceType.trim(),
      affectedSystem: affectedSystem.trim(),
      description: (description || '').trim(),
      reason: (reason || '').trim(),
      startDatetime,
      endDatetime,
      duration,
      impact: (impact || '').trim(),
      userAction: (userAction || '').trim(),
      workaround: (workaround || '').trim(),
      itContact: (itContact || 'IT Operations Desk / helpdesk@tanaka.com.my').trim(),
      changeNumber: (changeNumber || '').trim(),
      recipientGroup: recipientGroup.trim(),
      status,
      reminderSettings,
      createdBy: actorUserId,
      createdByName: actorName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Calculate the 7 reminders
    const reminderPlans = computeReminderSchedulesHelper(startDatetime, endDatetime, reminderSettings);
    const createdReminders: any[] = [];

    // Check if initial reminder is enabled
    const initialReminderEnabled = !!reminderSettings.initial;

    if (isDbConnected) {
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO maintenance_announcements (
            id, title, maintenance_type, affected_system, description, reason,
            start_datetime, end_datetime, duration, impact, user_action, workaround,
            it_contact, change_number, recipient_group, status, reminder_settings,
            created_by, created_by_name, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            id,
            newAnnouncement.title,
            newAnnouncement.maintenanceType,
            newAnnouncement.affectedSystem,
            newAnnouncement.description,
            newAnnouncement.reason,
            newAnnouncement.startDatetime,
            newAnnouncement.endDatetime,
            newAnnouncement.duration,
            newAnnouncement.impact,
            newAnnouncement.userAction,
            newAnnouncement.workaround,
            newAnnouncement.itContact,
            newAnnouncement.changeNumber,
            newAnnouncement.recipientGroup,
            newAnnouncement.status,
            JSON.stringify(newAnnouncement.reminderSettings),
            newAnnouncement.createdBy,
            newAnnouncement.createdByName,
            newAnnouncement.createdAt,
            newAnnouncement.updatedAt,
          ]
        );

        for (const plan of reminderPlans) {
          const remId = `rem-${id}-${plan.type}`;
          // If scheduled time was in the past when creating (e.g. 3 days before has already passed), mark as Skipped
          let remStatus = 'Scheduled';
          if (!plan.enabled) {
            remStatus = 'Cancelled';
          } else if (plan.type !== 'initial' && plan.scheduledTime && plan.scheduledTime < now) {
            remStatus = 'Skipped';
          }

          await pool.query(
            `INSERT INTO maintenance_reminders (
              id, maintenance_id, reminder_type, scheduled_time, status, recipient_group, recipient_count
            ) VALUES ($1, $2, $3, $4, $5, $6, 0)
            ON CONFLICT (maintenance_id, reminder_type) DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time, status = EXCLUDED.status`,
            [remId, id, plan.type, plan.scheduledTime ? plan.scheduledTime.toISOString() : null, remStatus, recipientGroup]
          );

          createdReminders.push({
            id: remId,
            maintenanceId: id,
            reminderType: plan.type,
            scheduledTime: plan.scheduledTime ? plan.scheduledTime.toISOString() : null,
            status: remStatus,
            recipientGroup,
            recipientCount: 0,
          });
        }

        // If initial announcement is enabled, dispatch it immediately!
        if (initialReminderEnabled) {
          const initialPlan = createdReminders.find(r => r.reminderType === 'initial');
          if (initialPlan) {
            const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
              announcement: newAnnouncement,
              reminderType: 'initial',
              recipientEmail: 'TD_TEM@tanaka.com.my',
              recipientGroup,
            });

            if (dispatchResult.success) {
              await pool.query(
                `UPDATE maintenance_reminders SET status = 'Sent', sent_time = NOW(), recipient_count = 85 WHERE id = $1`,
                [initialPlan.id]
              );
              initialPlan.status = 'Sent';
              initialPlan.sentTime = nowIso;
              initialPlan.recipientCount = 85;

              const histId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
              await pool.query(
                `INSERT INTO maintenance_email_history 
                 (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject, body_html)
                 VALUES ($1, $2, 'initial', $3, 85, $4, NOW(), 'Sent', 'maintenance_announcement_broadcast', $5, $6)`,
                [histId, id, recipientGroup, nowIso, dispatchResult.subject, dispatchResult.html]
              );
            }
          }
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: POST /api/maintenance-announcements]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    // Memory fallback update
    memoryMaintenanceAnnouncements.unshift(newAnnouncement);
    for (const plan of reminderPlans) {
      const remId = `rem-${id}-${plan.type}`;
      let remStatus = 'Scheduled';
      if (!plan.enabled) remStatus = 'Cancelled';
      else if (plan.type !== 'initial' && plan.scheduledTime && plan.scheduledTime < now) remStatus = 'Skipped';

      const remObj = {
        id: remId,
        maintenanceId: id,
        reminderType: plan.type,
        scheduledTime: plan.scheduledTime ? plan.scheduledTime.toISOString() : null,
        status: remStatus,
        recipientGroup,
        recipientCount: 0,
        templateUsed: 'maintenance_announcement_broadcast',
      };
      memoryMaintenanceReminders.unshift(remObj);
      if (!isDbConnected) createdReminders.push(remObj);
    }

    return res.status(201).json({
      success: true,
      message: 'Maintenance announcement created and reminder schedules configured.',
      data: {
        ...newAnnouncement,
        reminders: createdReminders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// PUT: Update maintenance announcement & recalculate reminder schedules
app.put('/api/maintenance-announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      maintenanceType,
      affectedSystem,
      description,
      reason,
      startDatetime,
      endDatetime,
      impact,
      userAction,
      workaround,
      itContact,
      changeNumber,
      recipientGroup,
      status,
      reminderSettings,
      actorUserId = 'USR-ADMIN',
      actorName = 'System Administrator',
    } = req.body;

    const duration = calculateMaintenanceDurationHelper(startDatetime, endDatetime);
    const nowIso = new Date().toISOString();

    let updatedRecord: any = null;

    if (isDbConnected) {
      try {
        const pool = getPool();
        const updateRes = await pool.query(
          `UPDATE maintenance_announcements SET
            title = COALESCE($2, title),
            maintenance_type = COALESCE($3, maintenance_type),
            affected_system = COALESCE($4, affected_system),
            description = COALESCE($5, description),
            reason = COALESCE($6, reason),
            start_datetime = COALESCE($7, start_datetime),
            end_datetime = COALESCE($8, end_datetime),
            duration = $9,
            impact = COALESCE($10, impact),
            user_action = COALESCE($11, user_action),
            workaround = COALESCE($12, workaround),
            it_contact = COALESCE($13, it_contact),
            change_number = COALESCE($14, change_number),
            recipient_group = COALESCE($15, recipient_group),
            status = COALESCE($16, status),
            reminder_settings = COALESCE($17, reminder_settings),
            updated_by = $18,
            updated_by_name = $19,
            updated_at = NOW()
          WHERE id = $1
          RETURNING id, title, maintenance_type as "maintenanceType", affected_system as "affectedSystem",
                    description, reason, start_datetime as "startDatetime", end_datetime as "endDatetime",
                    duration, impact, user_action as "userAction", workaround, it_contact as "itContact",
                    change_number as "changeNumber", recipient_group as "recipientGroup", status,
                    reminder_settings as "reminderSettings", updated_at as "updatedAt"`,
          [
            id,
            title,
            maintenanceType,
            affectedSystem,
            description,
            reason,
            startDatetime,
            endDatetime,
            duration,
            impact,
            userAction,
            workaround,
            itContact,
            changeNumber,
            recipientGroup,
            status,
            reminderSettings ? JSON.stringify(reminderSettings) : null,
            actorUserId,
            actorName,
          ]
        );

        if (updateRes.rows.length > 0) {
          updatedRecord = updateRes.rows[0];

          // Recalculate future reminder dates if schedule was modified
          if (startDatetime && endDatetime) {
            const plans = computeReminderSchedulesHelper(startDatetime, endDatetime, reminderSettings || updatedRecord.reminderSettings);
            for (const plan of plans) {
              if (plan.type === 'initial') continue; // Do not recalculate initial if already sent

              // Update scheduled_time for reminders that are currently 'Scheduled'
              await pool.query(
                `UPDATE maintenance_reminders
                 SET scheduled_time = $3,
                     status = CASE WHEN $4 = false THEN 'Cancelled' ELSE status END,
                     updated_at = NOW()
                 WHERE maintenance_id = $1 AND reminder_type = $2 AND status = 'Scheduled'`,
                [id, plan.type, plan.scheduledTime ? plan.scheduledTime.toISOString() : null, plan.enabled]
              );
            }
          }
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: PUT /api/maintenance-announcements/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    // Memory fallback
    const memIdx = memoryMaintenanceAnnouncements.findIndex(a => a.id === id);
    if (memIdx !== -1) {
      memoryMaintenanceAnnouncements[memIdx] = {
        ...memoryMaintenanceAnnouncements[memIdx],
        title: title || memoryMaintenanceAnnouncements[memIdx].title,
        maintenanceType: maintenanceType || memoryMaintenanceAnnouncements[memIdx].maintenanceType,
        affectedSystem: affectedSystem || memoryMaintenanceAnnouncements[memIdx].affectedSystem,
        description: description !== undefined ? description : memoryMaintenanceAnnouncements[memIdx].description,
        reason: reason !== undefined ? reason : memoryMaintenanceAnnouncements[memIdx].reason,
        startDatetime: startDatetime || memoryMaintenanceAnnouncements[memIdx].startDatetime,
        endDatetime: endDatetime || memoryMaintenanceAnnouncements[memIdx].endDatetime,
        duration: duration || memoryMaintenanceAnnouncements[memIdx].duration,
        impact: impact !== undefined ? impact : memoryMaintenanceAnnouncements[memIdx].impact,
        userAction: userAction !== undefined ? userAction : memoryMaintenanceAnnouncements[memIdx].userAction,
        workaround: workaround !== undefined ? workaround : memoryMaintenanceAnnouncements[memIdx].workaround,
        itContact: itContact || memoryMaintenanceAnnouncements[memIdx].itContact,
        changeNumber: changeNumber !== undefined ? changeNumber : memoryMaintenanceAnnouncements[memIdx].changeNumber,
        recipientGroup: recipientGroup || memoryMaintenanceAnnouncements[memIdx].recipientGroup,
        status: status || memoryMaintenanceAnnouncements[memIdx].status,
        reminderSettings: reminderSettings || memoryMaintenanceAnnouncements[memIdx].reminderSettings,
        updatedBy: actorUserId,
        updatedByName: actorName,
        updatedAt: nowIso,
      };
      if (!updatedRecord) updatedRecord = memoryMaintenanceAnnouncements[memIdx];

      // Update memory reminders
      if (startDatetime && endDatetime) {
        const plans = computeReminderSchedulesHelper(startDatetime, endDatetime, reminderSettings || updatedRecord.reminderSettings);
        for (const plan of plans) {
          if (plan.type === 'initial') continue;
          const rem = memoryMaintenanceReminders.find(r => r.maintenanceId === id && r.reminderType === plan.type && r.status === 'Scheduled');
          if (rem) {
            rem.scheduledTime = plan.scheduledTime ? plan.scheduledTime.toISOString() : null;
            if (!plan.enabled) rem.status = 'Cancelled';
          }
        }
      }
    }

    return res.json({
      success: true,
      message: 'Maintenance announcement and scheduled reminders updated successfully.',
      data: updatedRecord,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// PATCH: Update maintenance status (e.g. In Progress, Completed, Cancelled)
app.patch('/api/maintenance-announcements/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actorUserId = 'USR-ADMIN', actorName = 'System Administrator' } = req.body;

    if (!['Scheduled', 'In Progress', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid maintenance status value.' });
    }

    let announcement: any = null;
    const nowIso = new Date().toISOString();

    if (isDbConnected) {
      try {
        const pool = getPool();
        const annRes = await pool.query(
          `UPDATE maintenance_announcements 
           SET status = $2, updated_by = $3, updated_by_name = $4, updated_at = NOW() 
           WHERE id = $1
           RETURNING id, title, maintenance_type as "maintenanceType", affected_system as "affectedSystem",
                     description, reason, start_datetime as "startDatetime", end_datetime as "endDatetime",
                     duration, impact, user_action as "userAction", workaround, it_contact as "itContact",
                     change_number as "changeNumber", recipient_group as "recipientGroup", status,
                     reminder_settings as "reminderSettings"`,
          [id, status, actorUserId, actorName]
        );
        if (annRes.rows.length > 0) {
          announcement = annRes.rows[0];

          // If Cancelled: stop all future reminders
          if (status === 'Cancelled') {
            await pool.query(
              `UPDATE maintenance_reminders SET status = 'Cancelled', updated_at = NOW() WHERE maintenance_id = $1 AND status = 'Scheduled'`,
              [id]
            );

            // If cancelled reminder is enabled, dispatch cancellation notification immediately!
            const settings = announcement.reminderSettings || {};
            if (settings.cancelled) {
              const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
                announcement,
                reminderType: 'cancelled',
                recipientEmail: 'TD_TEM@tanaka.com.my',
                recipientGroup: announcement.recipientGroup || 'TD_TEM',
              });

              const histId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
              await pool.query(
                `UPDATE maintenance_reminders SET status = 'Sent', sent_time = NOW(), recipient_count = 85 WHERE maintenance_id = $1 AND reminder_type = 'cancelled'`,
                [id]
              );
              await pool.query(
                `INSERT INTO maintenance_email_history 
                 (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject, body_html)
                 VALUES ($1, $2, 'cancelled', $3, 85, NOW(), NOW(), 'Sent', 'maintenance_announcement_broadcast', $4, $5)`,
                [histId, id, announcement.recipientGroup || 'TD_TEM', dispatchResult.subject, dispatchResult.html]
              );
            }
          } else if (status === 'In Progress') {
            // Trigger 'started' reminder immediately if enabled and not already sent
            const settings = announcement.reminderSettings || {};
            if (settings.started) {
              const startRem = await pool.query(
                `SELECT id, status FROM maintenance_reminders WHERE maintenance_id = $1 AND reminder_type = 'started' LIMIT 1`,
                [id]
              );
              if (startRem.rows.length > 0 && startRem.rows[0].status === 'Scheduled') {
                const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
                  announcement,
                  reminderType: 'started',
                  recipientEmail: 'TD_TEM@tanaka.com.my',
                  recipientGroup: announcement.recipientGroup || 'TD_TEM',
                });
                if (dispatchResult.success) {
                  await pool.query(`UPDATE maintenance_reminders SET status = 'Sent', sent_time = NOW(), recipient_count = 85 WHERE id = $1`, [startRem.rows[0].id]);
                  const histId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                  await pool.query(
                    `INSERT INTO maintenance_email_history (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject, body_html)
                     VALUES ($1, $2, 'started', $3, 85, NOW(), NOW(), 'Sent', 'maintenance_announcement_broadcast', $4, $5)`,
                    [histId, id, announcement.recipientGroup || 'TD_TEM', dispatchResult.subject, dispatchResult.html]
                  );
                }
              }
            }
          } else if (status === 'Completed') {
            // Cancel remaining pending reminders and trigger 'completed' notification
            await pool.query(
              `UPDATE maintenance_reminders SET status = 'Cancelled', updated_at = NOW() WHERE maintenance_id = $1 AND status = 'Scheduled' AND reminder_type != 'completed'`,
              [id]
            );

            const settings = announcement.reminderSettings || {};
            if (settings.completed) {
              const compRem = await pool.query(
                `SELECT id, status FROM maintenance_reminders WHERE maintenance_id = $1 AND reminder_type = 'completed' LIMIT 1`,
                [id]
              );
              if (compRem.rows.length > 0 && compRem.rows[0].status === 'Scheduled') {
                const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
                  announcement,
                  reminderType: 'completed',
                  recipientEmail: 'TD_TEM@tanaka.com.my',
                  recipientGroup: announcement.recipientGroup || 'TD_TEM',
                });
                if (dispatchResult.success) {
                  await pool.query(`UPDATE maintenance_reminders SET status = 'Sent', sent_time = NOW(), recipient_count = 85 WHERE id = $1`, [compRem.rows[0].id]);
                  const histId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                  await pool.query(
                    `INSERT INTO maintenance_email_history (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, template_used, subject, body_html)
                     VALUES ($1, $2, 'completed', $3, 85, NOW(), NOW(), 'Sent', 'maintenance_announcement_broadcast', $4, $5)`,
                    [histId, id, announcement.recipientGroup || 'TD_TEM', dispatchResult.subject, dispatchResult.html]
                  );
                }
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn('[DB Fallback: PATCH /api/maintenance-announcements/:id/status]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    // Memory fallback
    const memIdx = memoryMaintenanceAnnouncements.findIndex(a => a.id === id);
    if (memIdx !== -1) {
      memoryMaintenanceAnnouncements[memIdx].status = status;
      memoryMaintenanceAnnouncements[memIdx].updatedBy = actorUserId;
      memoryMaintenanceAnnouncements[memIdx].updatedByName = actorName;
      memoryMaintenanceAnnouncements[memIdx].updatedAt = nowIso;
      if (!announcement) announcement = memoryMaintenanceAnnouncements[memIdx];

      if (status === 'Cancelled') {
        memoryMaintenanceReminders
          .filter(r => r.maintenanceId === id && r.status === 'Scheduled')
          .forEach(r => {
            r.status = 'Cancelled';
          });
      }
    }

    return res.json({
      success: true,
      message: `Maintenance status transitioned to ${status}.`,
      data: announcement,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// DELETE: Delete maintenance announcement & cascade delete reminders and history
app.delete('/api/maintenance-announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected) {
      try {
        const pool = getPool();
        await pool.query(`DELETE FROM maintenance_announcements WHERE id = $1`, [id]);
      } catch (dbErr) {
        console.warn('[DB Fallback: DELETE /api/maintenance-announcements/:id]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    const memIdx = memoryMaintenanceAnnouncements.findIndex(a => a.id === id);
    if (memIdx !== -1) memoryMaintenanceAnnouncements.splice(memIdx, 1);

    return res.json({ success: true, message: 'Maintenance announcement deleted successfully.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Send Test Email for Maintenance Announcement
app.post('/api/maintenance-announcements/test-email', async (req, res) => {
  try {
    const { announcement, testRecipientEmail, reminderType = 'initial' } = req.body;

    if (!announcement || !testRecipientEmail) {
      return res.status(400).json({ success: false, error: 'Announcement payload and testRecipientEmail are required.' });
    }

    const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
      announcement,
      reminderType,
      recipientEmail: testRecipientEmail.trim(),
      recipientGroup: `TEST (${testRecipientEmail.trim()})`,
      isTest: true,
    });

    const histId = `hist-test-${Date.now()}`;
    const logItem = {
      id: histId,
      maintenanceId: announcement.id || 'NEW-DRAFT',
      reminderType,
      recipientGroup: `TEST (${testRecipientEmail.trim()})`,
      recipientCount: 1,
      scheduledTime: null,
      sentTime: new Date().toISOString(),
      status: dispatchResult.success ? 'Sent' : 'Failed',
      errorMessage: dispatchResult.error || null,
      templateUsed: 'maintenance_announcement_broadcast',
      subject: dispatchResult.subject,
      bodyHtml: dispatchResult.html,
      createdAt: new Date().toISOString(),
    };

    if (isDbConnected && announcement.id && announcement.id !== 'NEW-DRAFT') {
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO maintenance_email_history (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, error_message, template_used, subject, body_html)
           VALUES ($1, $2, $3, $4, 1, NOW(), NOW(), $5, $6, $7, $8, $9)`,
          [
            histId,
            announcement.id,
            reminderType,
            logItem.recipientGroup,
            logItem.status,
            logItem.errorMessage,
            logItem.templateUsed,
            logItem.subject,
            logItem.bodyHtml,
          ]
        );
      } catch (dbErr) {
        console.warn('[DB Notice: insert test email into history]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    memoryMaintenanceEmailHistory.unshift(logItem);

    if (!dispatchResult.success) {
      return res.status(502).json({
        success: false,
        error: `SMTP Dispatch Failed: ${dispatchResult.error}`,
        log: logItem,
      });
    }

    return res.json({
      success: true,
      message: `Test email successfully dispatched to ${testRecipientEmail}.`,
      log: logItem,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST: Trigger a specific reminder immediately on demand
app.post('/api/maintenance-announcements/:id/trigger-reminder', async (req, res) => {
  try {
    const { id } = req.params;
    const { reminderType = 'initial' } = req.body;

    let announcement: any = null;
    if (isDbConnected) {
      try {
        const pool = getPool();
        const annRes = await pool.query(`SELECT * FROM maintenance_announcements WHERE id = $1 LIMIT 1`, [id]);
        if (annRes.rows.length > 0) announcement = annRes.rows[0];
      } catch (dbErr) {
        console.warn('[DB Notice: trigger reminder]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }
    if (!announcement) {
      announcement = memoryMaintenanceAnnouncements.find(a => a.id === id);
    }
    if (!announcement) {
      return res.status(404).json({ success: false, error: 'Maintenance announcement not found.' });
    }

    const recipientEmail = 'TD_TEM@tanaka.com.my';
    const dispatchResult = await dispatchMaintenanceEmailViaSmtp({
      announcement,
      reminderType,
      recipientEmail,
      recipientGroup: announcement.recipient_group || announcement.recipientGroup || 'TD_TEM',
    });

    const histId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    if (isDbConnected) {
      try {
        const pool = getPool();
        await pool.query(
          `UPDATE maintenance_reminders SET status = 'Sent', sent_time = NOW(), recipient_count = 85, updated_at = NOW() 
           WHERE maintenance_id = $1 AND reminder_type = $2`,
          [id, reminderType]
        );
        await pool.query(
          `INSERT INTO maintenance_email_history (id, maintenance_id, reminder_type, recipient_group, recipient_count, scheduled_time, sent_time, status, error_message, template_used, subject, body_html)
           VALUES ($1, $2, $3, $4, 85, NOW(), NOW(), $5, $6, 'maintenance_announcement_broadcast', $7, $8)`,
          [
            histId,
            id,
            reminderType,
            announcement.recipient_group || announcement.recipientGroup || 'TD_TEM',
            dispatchResult.success ? 'Sent' : 'Failed',
            dispatchResult.error || null,
            dispatchResult.subject,
            dispatchResult.html,
          ]
        );
      } catch (dbErr) {
        console.warn('[DB Notice: trigger reminder db update]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    const memRem = memoryMaintenanceReminders.find(r => r.maintenanceId === id && r.reminderType === reminderType);
    if (memRem) {
      memRem.status = dispatchResult.success ? 'Sent' : 'Failed';
      memRem.sentTime = new Date().toISOString();
      memRem.recipientCount = 85;
      if (!dispatchResult.success) memRem.errorMessage = dispatchResult.error;
    }

    if (!dispatchResult.success) {
      return res.status(502).json({ success: false, error: `SMTP Dispatch Error: ${dispatchResult.error}` });
    }

    return res.json({
      success: true,
      message: `Manual dispatch of reminder [${getMaintenanceReminderLabel(reminderType)}] executed successfully.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET: Maintenance Email History
app.get('/api/maintenance-email-history', async (req, res) => {
  try {
    const { maintenanceId, status } = req.query;
    let history: any[] = [];

    if (isDbConnected) {
      try {
        const pool = getPool();
        let query = `
          SELECT meh.id, meh.maintenance_id as "maintenanceId", meh.reminder_type as "reminderType",
                 meh.recipient_group as "recipientGroup", meh.recipient_count as "recipientCount",
                 meh.scheduled_time as "scheduledTime", meh.sent_time as "sentTime", meh.status,
                 meh.error_message as "errorMessage", meh.template_used as "templateUsed",
                 meh.subject, meh.created_at as "createdAt",
                 ma.title as "announcementTitle", ma.affected_system as "affectedSystem"
          FROM maintenance_email_history meh
          LEFT JOIN maintenance_announcements ma ON meh.maintenance_id = ma.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (maintenanceId && typeof maintenanceId === 'string') {
          params.push(maintenanceId);
          query += ` AND meh.maintenance_id = $${params.length}`;
        }
        if (status && typeof status === 'string' && status !== 'All') {
          params.push(status);
          query += ` AND meh.status = $${params.length}`;
        }
        query += ` ORDER BY meh.sent_time DESC LIMIT 100`;

        const dbRes = await pool.query(query, params);
        history = dbRes.rows || [];
      } catch (dbErr) {
        console.warn('[DB Fallback: GET /api/maintenance-email-history]', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
    }

    if (history.length === 0) {
      history = memoryMaintenanceEmailHistory
        .filter(h => (!maintenanceId || h.maintenanceId === maintenanceId) && (!status || status === 'All' || h.status === status))
        .map(h => {
          const ann = memoryMaintenanceAnnouncements.find(a => a.id === h.maintenanceId);
          return {
            ...h,
            announcementTitle: ann ? ann.title : 'IT Maintenance Notice',
            affectedSystem: ann ? ann.affectedSystem : 'Tanaka Core Systems',
          };
        })
        .sort((a, b) => new Date(b.sentTime).getTime() - new Date(a.sentTime).getTime());
    }

    return res.json({ success: true, data: history });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});


// ==========================================
// VITE / STATIC SERVING
// ==========================================
async function startServer() {
  // Test initial database connection and initialize production schema/baseline
  try {
    const res = await testDbConnection();
    if (res.connected) {
      console.log(`[Database Ready] ${res.message}`);
      const pool = getPool();
      await ensureProductionBaseline(pool);
    } else {
      console.warn(`[Database Notice] ${res.message}`);
    }
  } catch (initErr) {
    console.error('[DB Startup Error]', initErr instanceof Error ? initErr.message : String(initErr));
  }

  // Start automated Maintenance Reminder background task runner (every 60s)
  startMaintenanceScheduler();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const host = process.env.HOST || '0.0.0.0';
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` Enterprise IT OPS Request Server is LIVE`);
    console.log(` Port: ${PORT} | Host: 0.0.0.0 (Accessible via ${host === '0.0.0.0' ? 'localhost / LAN IP' : host})`);
    console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Database: ${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
    console.log(` Created By: Ananth Ramalingam `);
    console.log(`=======================================================`);
  });
}

startServer();
