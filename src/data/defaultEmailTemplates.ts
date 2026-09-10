import { EmailTemplateDefinition } from '../types';

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: 'cr_submitted_hod_approval',
    category: 'cr_workflow',
    eventName: 'Change Request Submitted (Pending HOD Review)',
    description: 'Triggered when a Requester submits a new Change Request or resubmits an amended request for Departmental HOD clearance.',
    subjectTemplate: '[IT OPS Action Required] Pending HOD Approval: {{crId}} - {{crTitle}}',
    recipientDescription: 'Department Head (HOD)',
    defaultRecipientRole: 'HOD Approver',
    enabled: true,
    variables: [
      { key: 'crId', label: 'CR Number', exampleValue: 'ITO-CR-2026-00001', description: 'Unique Change Request tracking ID' },
      { key: 'crTitle', label: 'CR Title', exampleValue: 'CD2 Wire Scrap Calculation Formula Update', description: 'Subject/title of the change request' },
      { key: 'requesterName', label: 'Requester Name', exampleValue: 'Ahmad Faiz', description: 'Full name of the requesting user' },
      { key: 'requesterEmail', label: 'Requester Email', exampleValue: 'faiz@tanaka.com.my', description: 'Email address of the requester' },
      { key: 'departmentName', label: 'Department', exampleValue: 'Production & Manufacturing', description: 'Originating department' },
      { key: 'hodName', label: 'HOD Name', exampleValue: 'Hafidhzul', description: 'Department Head' },
      { key: 'priority', label: 'Priority', exampleValue: 'High', description: 'Priority level (Low, Medium, High, Critical)' },
      { key: 'category', label: 'Category', exampleValue: 'Application Enhancement', description: 'Service catalog category' },
      { key: 'reasonForChange', label: 'Reason for Change', exampleValue: 'Enhance accuracy of scrap calculation for monthly KPI audit', description: 'Business justification' },
      { key: 'portalUrl', label: 'Portal Link', exampleValue: 'https://IT OPS.tanaka.com.my/requests', description: 'Direct link to the request' },
      { key: 'timestamp', label: 'Submission Time', exampleValue: '2026-08-28 10:30', description: 'Date and time of submission' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  <div style="background-color: #0f172a; color: #ffffff; padding: 22px 24px; text-align: left;">
    <h1 style="margin: 0; font-size: 18px; color: #ffffff;">Action Required: Change Request Pending HOD Approval</h1>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Case Reference: <strong>{{crId}}</strong> • Submitted by {{requesterName}} ({{departmentName}})</div>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>{{hodName}}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      A new Change Request has been submitted by <strong>{{requesterName}}</strong> from the <strong>{{departmentName}}</strong> department and requires your departmental review and endorsement.
    </p>

    <!-- CR Highlights Box -->
    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: bold;">CR Number:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">{{crId}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Title:</td><td style="font-weight: bold; color: #0f172a;">{{crTitle}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Priority:</td><td><span style="background-color: #fee2e2; color: #dc2626; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{{priority}}</span></td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Category:</td><td style="color: #334155;">{{category}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Submission Date:</td><td style="color: #64748b;">{{timestamp}}</td></tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Business Justification / Reason:</div>
      <div style="font-size: 13px; color: #0f172a; line-height: 1.5;">{{reasonForChange}}</div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Login
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
      If you are away or on leave, your appointed Temporary Approver may endorse on your behalf.
    </p>
  </div>

  
</div>`,
  },
  {
    id: 'cr_hod_approved_pending_it',
    category: 'cr_workflow',
    eventName: 'HOD Approved (Pending IT Clearance & Developer Assignment)',
    description: 'Triggered when Department Head approves a request and transfers it to IT Admin Queue for technical assessment.',
    subjectTemplate: '[IT OPS Review] Endorsed by HOD: {{crId}} - {{crTitle}}',
    recipientDescription: 'IT Admin Team',
    defaultRecipientRole: 'IT Administrator',
    enabled: true,
    variables: [
      { key: 'crId', label: 'CR Number', exampleValue: 'ITO-CR-2026-00001', description: 'Unique Change Request tracking ID' },
      { key: 'crTitle', label: 'CR Title', exampleValue: 'CD2 Wire Scrap Calculation Formula Update', description: 'Subject/title of the change request' },
      { key: 'requesterName', label: 'Requester Name', exampleValue: 'Ahmad Faiz', description: 'Full name of the requesting user' },
      { key: 'departmentName', label: 'Department', exampleValue: 'Production & Manufacturing', description: 'Originating department' },
      { key: 'hodName', label: 'Endorsing HOD', exampleValue: 'Hafidhzul', description: 'Department Head who approved' },
      { key: 'comments', label: 'HOD Approval Remarks', exampleValue: 'Approved for urgent implementation to avoid monthly reporting discrepancies.', description: 'Remarks entered during approval' },
      { key: 'priority', label: 'Priority', exampleValue: 'High', description: 'Priority level' },
      { key: 'portalUrl', label: 'Portal Link', exampleValue: 'https://IT OPS.tanaka.com.my/it-admin', description: 'Direct link to IT Admin queue' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #1e3a8a; color: #ffffff; padding: 22px 24px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; font-weight: bold; margin-bottom: 4px;">TANAKA IT OPS • Departmental Endorsement</div>
    <h1 style="margin: 0; font-size: 18px; color: #ffffff;">HOD Endorsed: Ready for IT Review & Developer Assignment</h1>
    <div style="font-size: 11px; color: #bfdbfe; margin-top: 6px;">CR Reference: <strong>{{crId}}</strong> • Approved by HOD {{hodName}}</div>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>IT Operations Team</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Change Request <strong>{{crId}}</strong> from <strong>{{departmentName}}</strong> has been formally endorsed by Department Head <strong>{{hodName}}</strong>. It is now queued for IT technical screening, workload estimation, and developer assignment.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 8px;">✓ HOD Approval Verification</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: bold;">CR Title:</td><td style="font-weight: bold; color: #0f172a;">{{crTitle}}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Requester:</td><td style="color: #334155;">{{requesterName}} ({{departmentName}})</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Endorsing HOD:</td><td style="color: #166534; font-weight: bold;">{{hodName}}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">HOD Comments:</td><td style="color: #0f172a; font-style: italic;">"{{comments}}"</td></tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Login
      </a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'cr_developer_assigned',
    category: 'cr_workflow',
    eventName: 'Developer Assigned & Scheduled',
    description: 'Triggered when IT Administrator assigns a software engineer or developer to implement the change request.',
    subjectTemplate: 'IT OPS Development] Assigned to {{assignedDeveloper}}: {{crId}} - {{crTitle}}',
    recipientDescription: 'Assigned Developer & Requester (CC)',
    defaultRecipientRole: 'Developer',
    enabled: true,
    variables: [
      { key: 'crId', label: 'CR Number', exampleValue: 'ITO-CR-2026-00001', description: 'Unique Change Request tracking ID' },
      { key: 'crTitle', label: 'CR Title', exampleValue: 'CD2 Wire Scrap Calculation Formula Update', description: 'Subject/title of the change request' },
      { key: 'assignedDeveloper', label: 'Assigned Developer', exampleValue: 'Alex Chen', description: 'Name of assigned developer' },
      { key: 'itAdminName', label: 'Assigning IT Admin', exampleValue: 'IT Administrator', description: 'IT Administrator who assigned' },
      { key: 'requesterName', label: 'Requester Name', exampleValue: 'Ahmad Faiz', description: 'Requester name' },
      { key: 'targetReleaseDate', label: 'Target Release Date', exampleValue: '2026-09-15', description: 'Estimated release date' },
      { key: 'portalUrl', label: 'Portal Link', exampleValue: 'https://IT OPS.tanaka.com.my/dev-board', description: 'Developer Kanban link' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #065f46; color: #ffffff; padding: 22px 24px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a7f3d0; font-weight: bold; margin-bottom: 4px;">TANAKA IT DEVELOPMENT • Task Assignment</div>
    <h1 style="margin: 0; font-size: 18px; color: #ffffff;">Developer Assigned: {{assignedDeveloper}}</h1>
    <div style="font-size: 11px; color: #d1fae5; margin-top: 6px;">Case Reference: <strong>{{crId}}</strong> • Assigned by IT Admin {{itAdminName}}</div>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>{{assignedDeveloper}}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      You have been assigned as the lead developer for Change Request <strong>{{crId}}</strong> (<strong>{{crTitle}}</strong>).
    </p>

    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: bold;">CR Number:</td><td style="font-family: monospace; font-weight: bold; color: #047857;">{{crId}}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Requester:</td><td style="color: #334155;">{{requesterName}}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Target Release:</td><td style="font-weight: bold; color: #0f172a;">{{targetReleaseDate}}</td></tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Login
      </a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'user_onboarding_welcome',
    category: 'user_account',
    eventName: 'User Account Approved & Activated',
    description: 'Dispatched to users when IT Administration approves their registration request. Informs user to sign in with their registered password.',
    subjectTemplate: '[IT OPS] Your Tanaka IT OPS Portal Account Has Been Approved',
    recipientDescription: 'Registered User Work Email',
    defaultRecipientRole: 'Approved User',
    enabled: true,
    variables: [
      { key: 'fullName', label: 'Full Name', exampleValue: 'Siti Nurhaliza', description: 'User full name' },
      { key: 'email', label: 'Work Email', exampleValue: 'siti@tanaka.com.my', description: 'Registered email' },
      { key: 'role', label: 'Assigned Role', exampleValue: 'Requester', description: 'System role' },
      { key: 'departmentName', label: 'Department', exampleValue: 'Quality Assurance', description: 'Assigned department' },
      { key: 'portalUrl', label: 'Portal URL', exampleValue: 'http://157.9.183.59:3000', description: 'Portal login URL' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 22px 24px; text-align: left;">

    <h1 style="margin: 4px 0 0 0; font-size: 18px; color: #ffffff;">Your IT OPS Portal Account is Now Active</h1>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Department: <strong>{{departmentName}}</strong> • Role: {{role}}</div>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>{{fullName}}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Great news! Your account request on the Tanaka IT OPS Portal has been reviewed and approved by IT Administration.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 10px;">✓ Active Account Profile</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #475569; width: 140px; font-weight: bold;">Work Email:</td><td style="font-family: monospace; font-weight: bold; color: #0f172a; background-color: #dcfce7; padding: 2px 8px; border-radius: 4px; display: inline-block;">{{email}}</td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Department:</td><td style="color: #334155;">{{departmentName}}</td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Assigned Role:</td><td><span style="background-color: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{{role}}</span></td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Status:</td><td style="font-weight: bold; color: #16a34a;">Active • Verified</td></tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 4px;">🔑 Login Instructions</div>
      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
        You can now sign in using your registered work email (<strong>{{email}}</strong>) and the <strong>password you created during registration</strong>.
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #4338ca; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 23px; font-size: 14px; font-weight: 600; display: inline-block; letter-spacing: 0.3px;">
        Log in
      </a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'security_password_reset_otp',
    category: 'user_account',
    eventName: 'Password Reset OTP Verification Code',
    description: 'Dispatched when a user requests a self-service password reset code.',
    subjectTemplate: '[IT OPS Security] Password Reset Verification Code: {{otpCode}}',
    recipientDescription: 'User Work Email',
    defaultRecipientRole: 'All Users',
    enabled: true,
    variables: [
      { key: 'fullName', label: 'Full Name', exampleValue: 'Sample User', description: 'User full name' },
      { key: 'email', label: 'Work Email', exampleValue: 'TEMIT@tanaka.com.my', description: 'User email' },
      { key: 'otpCode', label: '6-Digit OTP Code', exampleValue: '849201', description: 'One-time verification code' },
      { key: 'expiryMinutes', label: 'Expiry Duration', exampleValue: '15', description: 'Validity duration in minutes' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 22px 24px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; font-weight: bold; margin-bottom: 4px;">TANAKA IDENTITY SECURITY • Password Reset Request</div>
    <h1 style="margin: 0; font-size: 18px; color: #ffffff;">Verification Code for Password Reset</h1>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>{{fullName}}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      A password reset request was initiated for your Tanaka IT OPS account (<strong>{{email}}</strong>).
    </p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit Verification Code</div>
      <div style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; margin: 12px 0;">
        {{otpCode}}
      </div>
      <div style="font-size: 11px; color: #64748b;">This verification code expires in {{expiryMinutes}} minutes. Do not share this code with anyone.</div>
    </div>

    <div style="text-align: center; margin: 20px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Login
      </a>
    </div>

    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
      If you did not request this verification code, please ignore this email or notify IT Security immediately.
    </p>
  </div>
</div>`,
  },
  {
    id: 'governance_temporary_approver_assigned',
    category: 'governance',
    eventName: 'Temporary Approver Authority Granted',
    description: 'Dispatched to both Acting Delegate and HOD when temporary approval delegation is created.',
    subjectTemplate: '[IT OPS Authorization] Temporary HOD Approver Delegation for {{departmentName}} ({{startDate}} to {{endDate}})',
    recipientDescription: 'Acting Approver & Delegating HOD (CC)',
    defaultRecipientRole: 'Acting Approver',
    enabled: true,
    variables: [
      { key: 'departmentName', label: 'Department Name', exampleValue: 'IT Operations', description: 'Department being delegated' },
      { key: 'hodName', label: 'Delegating HOD', exampleValue: 'Hafidhzul', description: 'Department Head delegating authority' },
      { key: 'delegateName', label: 'Acting Approver', exampleValue: 'Astrid', description: 'User receiving temporary authority' },
      { key: 'startDate', label: 'Start Date', exampleValue: '2026-08-28', description: 'Beginning of delegation window' },
      { key: 'endDate', label: 'End Date', exampleValue: '2026-09-05', description: 'End of delegation window' },
      { key: 'reason', label: 'Absence Reason', exampleValue: 'Annual Leave', description: 'Reason for delegation' },
      { key: 'notes', label: 'Handover Notes', exampleValue: 'Please prioritize urgent CD2 scrap formulas and critical server enhancements.', description: 'Handover instructions' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #78350f; color: #ffffff; padding: 22px 24px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fde68a; font-weight: bold; margin-bottom: 4px;">TANAKA GOVERNANCE • Departmental HOD Delegation</div>
    <h1 style="margin: 0; font-size: 18px; color: #ffffff;">Temporary Approver Authority Granted ({{departmentName}})</h1>
    <div style="font-size: 11px; color: #fef08a; margin-top: 6px;">Acting Approver: <strong>{{delegateName}}</strong> • Window: {{startDate}} → {{endDate}}</div>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>{{delegateName}}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Department Head <strong>{{hodName}}</strong> has appointed you as <strong>Acting Approver</strong> for the <strong>{{departmentName}}</strong> department.
    </p>

    <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 150px; font-weight: bold;">Department:</td><td style="font-weight: bold; color: #0f172a;">{{departmentName}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Delegating HOD:</td><td style="color: #334155;">{{hodName}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Authorized Window:</td><td style="font-family: monospace; font-weight: bold; color: #854d0e;">{{startDate}} → {{endDate}}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Absence Reason:</td><td><span style="background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{{reason}}</span></td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Handover Notes:</td><td style="color: #0f172a; font-style: italic;">"{{notes}}"</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
      During this period, you have full authority in the Tanaka IT OPS portal to approve, reject, or return departmental Change Requests.
    </p>

    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Login
      </a>
    </div>
  </div>
</div>`,
  },
  {
    id: 'maintenance_announcement_broadcast',
    category: 'governance',
    eventName: 'IT Maintenance Announcement & Automated Reminder Broadcast',
    description: 'Centralized broadcast template dispatched to enterprise recipient groups (e.g. TD_TEM) for scheduled IT maintenance windows, countdown reminders, operational kickoff, completion, and cancellation notices.',
    subjectTemplate: '[{{reminder_type_label}}] IT Maintenance Notice: {{affected_system}} - {{announcement_title}}',
    recipientDescription: 'Enterprise Recipient Group (TD_TEM / All Employees)',
    defaultRecipientRole: 'All Employees',
    enabled: true,
    variables: [
      { key: 'announcement_title', label: 'Announcement Title', exampleValue: 'Quarterly Core ERP & MES Network Switch Infrastructure Upgrade', description: 'Title or subject of the scheduled maintenance' },
      { key: 'maintenance_type', label: 'Maintenance Type', exampleValue: 'Network Upgrade', description: 'Type of maintenance (e.g., Network Upgrade, Server Patching, Database Migration, ERP Maintenance)' },
      { key: 'affected_system', label: 'Affected System/Service', exampleValue: 'SAP Production & Factory Floor Wi-Fi Relay', description: 'Systems, platforms, or equipment affected during maintenance' },
      { key: 'description', label: 'Description', exampleValue: 'Comprehensive firmware updates and redundancy switch replacement across core distribution racks to ensure system resilience.', description: 'Technical scope and overview of the maintenance activity' },
      { key: 'reason', label: 'Reason for Maintenance', exampleValue: 'Hardware lifecycle upgrade and high-severity security patch application in compliance with IT security standards.', description: 'Operational justification or requirement' },
      { key: 'start_datetime', label: 'Start Date/Time', exampleValue: '2026-09-15 22:00 (MYT)', description: 'Scheduled start date and time of the maintenance window' },
      { key: 'end_datetime', label: 'End Date/Time', exampleValue: '2026-09-16 02:00 (MYT)', description: 'Scheduled end date and time of the maintenance window' },
      { key: 'duration', label: 'Duration', exampleValue: '4 hours', description: 'Estimated duration calculated from start and end time' },
      { key: 'impact', label: 'Expected Impact', exampleValue: 'Complete Service Downtime across SAP & Factory Floor terminals', description: 'Anticipated user impact during the maintenance window' },
      { key: 'user_action', label: 'User Action Required', exampleValue: 'Please save all pending MES transactions and log off from SAP Production by 21:45.', description: 'Action items required from end users prior to or during the outage' },
      { key: 'workaround', label: 'Workaround', exampleValue: 'Production operators may record wire lot clearances on physical shift runner forms.', description: 'Alternative operational workaround during service downtime' },
      { key: 'it_contact', label: 'IT Contact', exampleValue: 'IT Helpdesk Desk ext. 4321 / Helpdesk@tanaka.com.my', description: 'Contact channel for support and escalations' },
      { key: 'change_number', label: 'Change/Request Number', exampleValue: 'ITO-CR-2026-00088', description: 'Associated Change/Request reference tracking number' },
      { key: 'reminder_type_label', label: 'Reminder Type', exampleValue: 'REMINDER (1 DAY BEFORE)', description: 'Stage of the maintenance reminder notification' },
      { key: 'recipient_group', label: 'Recipient Group', exampleValue: 'TD_TEM', description: 'Target distribution group' },
      { key: 'portalUrl', label: 'Portal Link', exampleValue: 'http://157.9.183.59:3000', description: 'Link to Tanaka IT Helpdesk portal' },
    ],
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
  <!-- Header Banner -->
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
  
  <!-- Content Body -->
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size: 14px; color: #334155; margin-top: 0; line-height: 1.6;">
      Dear Tanaka Team,
    </p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Please be informed of an upcoming scheduled IT system maintenance window affecting <strong>{{affected_system}}</strong>. Details and user instructions are provided below:
    </p>

    <!-- Key Schedule & Maintenance Matrix -->
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

    <!-- Expected Impact Alert Box -->
    <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        ⚠️ Expected Operational Impact:
      </div>
      <div style="font-size: 13px; font-weight: 700; color: #9a3412; line-height: 1.5;">
        {{impact}}
      </div>
    </div>

    <!-- Scope Description & Reason -->
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

    <!-- User Action Required -->
    <div style="background-color: #fefce8; border: 1px solid #fef08a; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #854d0e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        📋 User Action Required:
      </div>
      <div style="font-size: 13px; color: #713f12; line-height: 1.5;">
        {{user_action}}
      </div>
    </div>

    <!-- Workaround Procedure -->
    <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
        🔄 Fallback Workaround:
      </div>
      <div style="font-size: 13px; color: #0c4a6e; line-height: 1.5;">
        {{workaround}}
      </div>
    </div>

    <!-- IT Contact Information -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #475569;">
      <strong>IT Operations Helpdesk Contact:</strong> {{it_contact}}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 26px 0 14px 0;">
      <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px; border: 1px solid #1e293b;">
        Open IT Helpdesk Portal
      </a>
    </div>

    <div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
      This is an automated operational notification dispatched via Tanaka IT Enterprise Notification Relay.
    </div>
  </div>
</div>`,
  },
];
