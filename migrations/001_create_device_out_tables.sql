-- ==============================================================================
-- DATABASE MIGRATION 001: Bring Device Out & SATO CL4NX Sticker Label System
-- Project: Tanaka IT Ops Helpdesk
-- Targets: PostgreSQL 14+ / Enterprise Change Management System
-- ==============================================================================

-- 1. Sequence & Generator for Device Out Requests (DEV-OUT-YYYY-XXXXX)
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

-- ------------------------------------------------------------------------------
-- 2. TABLE: device_out_requests
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_out_requests (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_device_out_request_id(),
    request_id VARCHAR(50) UNIQUE,
    requester_id VARCHAR(50) NOT NULL,
    requester_name VARCHAR(150) NOT NULL,
    requester_email VARCHAR(150),
    department_id INTEGER,
    department_name VARCHAR(150),
    asset_type VARCHAR(100) NOT NULL, -- 'Laptop', 'Thumbdrive', 'External Hard Disk', 'Application Asset'
    asset_id VARCHAR(100),
    asset_name VARCHAR(255) NOT NULL,
    asset_serial_no VARCHAR(100),
    from_date VARCHAR(50) NOT NULL,
    to_date VARCHAR(50) NOT NULL,
    vpn_required VARCHAR(50) NOT NULL DEFAULT 'Not Required', -- 'Required' | 'Not Required'
    business_purpose TEXT NOT NULL,
    approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    approval_status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Returned/Closed'
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

-- Constraint: To Date cannot be earlier than From Date
ALTER TABLE device_out_requests DROP CONSTRAINT IF EXISTS chk_device_out_dates;
ALTER TABLE device_out_requests ADD CONSTRAINT chk_device_out_dates CHECK (to_date >= from_date);

-- Indexing for fast search and role visibility
CREATE INDEX IF NOT EXISTS idx_devout_requester ON device_out_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_devout_status ON device_out_requests(approval_status);
CREATE INDEX IF NOT EXISTS idx_devout_created_at ON device_out_requests(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. TABLE: device_out_approvals (Audit trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_out_approvals (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    approver_id VARCHAR(50) NOT NULL,
    approver_name VARCHAR(150),
    approver_role VARCHAR(100),
    action VARCHAR(50) NOT NULL, -- 'Pending', 'Approved', 'Rejected', 'Returned/Closed'
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devout_approvals_req ON device_out_approvals(request_id);

-- ------------------------------------------------------------------------------
-- 4. TABLE: label_templates (For SATO CL4NX & Windows Printers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS label_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    width_mm NUMERIC(10,2) NOT NULL DEFAULT 100,
    height_mm NUMERIC(10,2) NOT NULL DEFAULT 50,
    orientation VARCHAR(20) NOT NULL DEFAULT 'Landscape', -- 'Landscape' | 'Portrait'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. TABLE: label_template_elements (Draggable/resizable field layout)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS label_template_elements (
    id VARCHAR(50) PRIMARY KEY,
    template_id VARCHAR(50) NOT NULL REFERENCES label_templates(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL DEFAULT 'text', -- 'text', 'badge', 'barcode', 'qr', 'line'
    field_key VARCHAR(100) NOT NULL,
    x_mm NUMERIC(10,2) NOT NULL DEFAULT 0,
    y_mm NUMERIC(10,2) NOT NULL DEFAULT 0,
    width_mm NUMERIC(10,2) NOT NULL DEFAULT 40,
    height_mm NUMERIC(10,2) NOT NULL DEFAULT 10,
    font_size INTEGER NOT NULL DEFAULT 12,
    font_weight VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'normal', 'bold', 'medium'
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    alignment VARCHAR(20) NOT NULL DEFAULT 'left', -- 'left', 'center', 'right'
    rotation INTEGER NOT NULL DEFAULT 0 -- 0, 90, 180, 270
);

CREATE INDEX IF NOT EXISTS idx_template_elements_tpl ON label_template_elements(template_id);

-- ------------------------------------------------------------------------------
-- 6. TABLE: label_print_history
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_print_history_req ON label_print_history(request_id);

-- ------------------------------------------------------------------------------
-- 7. BASELINE SEED: Default SATO CL4NX Label Template (100x50mm)
-- ------------------------------------------------------------------------------
INSERT INTO label_templates (id, name, width_mm, height_mm, orientation, is_active, created_by)
VALUES ('tpl-sato-cl4nx-std', 'SATO CL4NX Standard Out-Pass (100mm x 50mm)', 100.00, 50.00, 'Landscape', TRUE, 'USR-SYSTEM')
ON CONFLICT (id) DO UPDATE SET
    width_mm = EXCLUDED.width_mm,
    height_mm = EXCLUDED.height_mm,
    orientation = EXCLUDED.orientation,
    updated_at = CURRENT_TIMESTAMP;

DELETE FROM label_template_elements WHERE template_id = 'tpl-sato-cl4nx-std';

INSERT INTO label_template_elements (id, template_id, element_type, field_key, x_mm, y_mm, width_mm, height_mm, font_size, font_weight, visible, alignment, rotation)
VALUES
  ('el-01', 'tpl-sato-cl4nx-std', 'badge', 'APPROVED', 4, 3, 92, 7, 13, 'bold', TRUE, 'center', 0),
  ('el-02', 'tpl-sato-cl4nx-std', 'text', 'request_number', 4, 12, 45, 6, 9, 'bold', TRUE, 'left', 0),
  ('el-03', 'tpl-sato-cl4nx-std', 'text', 'requester_name', 4, 18, 92, 6, 9, 'bold', TRUE, 'left', 0),
  ('el-04', 'tpl-sato-cl4nx-std', 'text', 'asset_name', 4, 24, 92, 6, 9, 'bold', TRUE, 'left', 0),
  ('el-05', 'tpl-sato-cl4nx-std', 'text', 'from_date', 4, 30, 44, 5, 8, 'normal', TRUE, 'left', 0),
  ('el-06', 'tpl-sato-cl4nx-std', 'text', 'to_date', 50, 30, 46, 5, 8, 'normal', TRUE, 'left', 0),
  ('el-07', 'tpl-sato-cl4nx-std', 'text', 'approver_name', 4, 36, 92, 5, 8, 'bold', TRUE, 'left', 0),
  ('el-08', 'tpl-sato-cl4nx-std', 'text', 'security_footer', 4, 42, 92, 5, 7, 'normal', TRUE, 'center', 0);
