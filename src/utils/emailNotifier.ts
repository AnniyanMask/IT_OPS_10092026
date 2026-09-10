import { ChangeRequest, EmailNotificationLog, SmtpConfig, UserProfile } from '../types';
import { defaultSmtpConfig } from '../data/db';
import { getMalaysianTimestamp } from './timezone';

export const PORTAL_LOGIN_URL = 'http://157.9.183.59:3000';

function renderLoginButtonHtml(url: string = PORTAL_LOGIN_URL): string {
  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      align="center"
      style="margin: 24px auto 16px auto;"
    >
      <tr>
        <td align="center">

          <!--[if mso]>
          <v:roundrect
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${url}"
            style="height:46px;v-text-anchor:middle;width:160px;"
            arcsize="50%"
            strokecolor="#4338ca"
            fillcolor="#4338ca"
          >
            <w:anchorlock/>
            <center
              style="
                color:#ffffff;
                font-family:Arial,sans-serif;
                font-size:14px;
                font-weight:bold;
              "
            >
              Log in
            </center>
          </v:roundrect>
          <![endif]-->

          <!--[if !mso]><!-->
          <a
            href="${url}"
            target="_blank"
            style="
              display:inline-block;
              background-color:#4338ca;
              color:#ffffff;
              padding:14px 40px;
              text-decoration:none;
              border-radius:23px;
              -webkit-border-radius:23px;
              font-size:14px;
              line-height:18px;
              font-weight:600;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
              letter-spacing:0.3px;
            "
          >
            Log in
          </a>
          <!--<![endif]-->

        </td>
      </tr>
    </table>
  `;
}


export function createWelcomeAccountEmail(
  user: UserProfile,
  smtpConfig: SmtpConfig,
  customNote?: string
): EmailNotificationLog {
  const now = getMalaysianTimestamp();
  const portalUrl = PORTAL_LOGIN_URL;
  const deptName = user.departmentName && user.departmentName !== 'undefined' && user.departmentName !== '[object Object]' 
    ? user.departmentName 
    : 'Production';

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Welcome to Tanaka IT OPS Portal</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Great news! Your Tanaka IT OPS Portal account has been reviewed and <strong style="color: #16a34a;">approved</strong> by IT Administration.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #0f172a; text-transform: uppercase; margin-bottom: 10px;">📋 Approved Account Profile</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: bold;">Full Name:</td><td style="font-weight: bold; color: #0f172a;">${user.fullName}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: bold;">Login Work Email:</td><td style="font-family: monospace; color: #2563eb; font-weight: bold;">${user.email}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: bold;">Department:</td><td style="font-weight: bold; color: #0f172a;">${deptName}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: bold;">Authorized Role:</td><td><span style="background-color: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${user.role}</span></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: bold;">Account Status:</td><td style="font-weight: bold; color: #16a34a;">Active • Authorized</td></tr>
      </table>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 8px;">🔑 Sign In Instructions</div>
      <p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.5;">
        You can now sign in directly using your work email (<strong>${user.email}</strong>) and the <strong>password you created during registration</strong>.
      </p>
    </div>

    ${customNote ? `<p style="font-size: 12px; color: #475569; margin: 12px 0;">${customNote}</p>` : ''}

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
  
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `Tanaka IT OPS - Your Account Has Been Approved (${deptName})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `User Provisioned: ${user.fullName} (${user.role}) - Account Activated`,
  };
}

export function createNewUserRegisteredPendingAdminEmail(
  user: UserProfile,
  adminEmail: string,
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();
  const deptName = user.departmentName && user.departmentName !== 'undefined' ? user.departmentName : 'Production';

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">New User Registration Pending Approval</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>IT Administrator</strong>,</p>
    <p style="font-size: 13px; color: #475569;">A new staff member has submitted a registration request for the Tanaka IT OPS portal and requires IT review and authorization.</p>

    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; margin-bottom: 10px;">📋 Pending Registration Details</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: bold;">Full Name:</td><td style="font-weight: bold; color: #0f172a;">${user.fullName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Work Email:</td><td style="font-family: monospace; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Requested Dept:</td><td style="font-weight: bold; color: #0f172a;">${deptName}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Status:</td><td><span style="background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Pending IT Approval</span></td></tr>
        <tr><td style="padding: 5px 0; color: #64748b; font-weight: bold;">Submitted At:</td><td style="font-family: monospace; color: #475569;">${user.registeredAt || now}</td></tr>
      </table>
    </div>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
 
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: adminEmail,
    recipientName: 'IT Administrator',
    subject: `[Pending Approval] New User Registration: ${user.fullName} (${deptName})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Registration Pending: ${user.fullName} (${user.email}) -> IT Admin Alert`,
  };
}

export interface StateTransitionEmailOptions {
  changeRequestId: string;
  requestTitle: string;
  recipientEmail: string;
  recipientName: string;
  previousStatus: string;
  newStatus: string;
  actionTaken?: string;
  actorName: string;
  actorRole?: string;
  comments?: string;
  smtpConfig: SmtpConfig;
}

function normalizeEmailCrId(id: string): string {
  if (!id) return id;
  if (id.startsWith('PCS-CR-')) {
    return id.replace(/^PCS-CR-/, 'ITO-CR-');
  }
  return id;
}

export function createStateTransitionEmail(
  optsOrCr: StateTransitionEmailOptions | ChangeRequest,
  fromStatus?: string,
  toStatus?: string,
  recipientName?: string,
  recipientEmail?: string,
  actorName?: string,
  actorRole?: string,
  comments?: string,
  smtpConfig?: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  let crId = '';
  let crTitle = '';
  let recipEmail = '';
  let recipName = '';
  let prevStat = '';
  let newStat = '';
  let actName = '';
  let actRole = '';
  let comms = '';
  let cfg = defaultSmtpConfig;

  if ('changeRequestId' in optsOrCr) {
    crId = normalizeEmailCrId(optsOrCr.changeRequestId);
    crTitle = optsOrCr.requestTitle;
    recipEmail = optsOrCr.recipientEmail;
    recipName = optsOrCr.recipientName;
    prevStat = optsOrCr.previousStatus;
    newStat = optsOrCr.newStatus;
    actName = optsOrCr.actorName;
    actRole = optsOrCr.actorRole || '';
    comms = optsOrCr.comments || '';
    cfg = optsOrCr.smtpConfig;
  } else {
    crId = normalizeEmailCrId(optsOrCr.id);
    crTitle = optsOrCr.title;
    prevStat = fromStatus || optsOrCr.status;
    newStat = toStatus || optsOrCr.status;
    recipName = recipientName || optsOrCr.requesterName;
    recipEmail = recipientEmail || optsOrCr.requesterEmail;
    actName = actorName || 'System';
    actRole = actorRole || '';
    comms = comments || '';
    if (smtpConfig) cfg = smtpConfig;
  }

  // Deduce user's actual role if not explicitly provided
  if (!actRole || actRole === 'System Workflow' || actRole === 'System Role') {
    const lowerAct = (actName || '').toLowerCase();
    if (lowerAct.includes('helpdesk') || lowerAct.includes('siti')) {
      actRole = 'IT Helpdesk';
    } else if (lowerAct.includes('david') || lowerAct.includes('it admin') || lowerAct.includes('admin') || lowerAct.includes('ng')) {
      actRole = 'IT Administrator';
    } else if (lowerAct.includes('nakamura') || lowerAct.includes('astrid') || lowerAct.includes('hod') || lowerAct.includes('tanaka') || lowerAct.includes('loh')) {
      actRole = 'Department HOD';
    } else if (lowerAct.includes('alex') || lowerAct.includes('chen') || lowerAct.includes('dev') || lowerAct.includes('developer')) {
      actRole = 'IT Developer';
    } else if (prevStat.includes('Returned') || newStat.includes('Pending HOD') || newStat.includes('Pending IT Admin')) {
      actRole = 'Requester';
    } else if (newStat.includes('In Progress') || newStat.includes('Developer')) {
      actRole = 'IT Administrator';
    } else if (newStat.includes('Verification') || newStat.includes('UAT')) {
      actRole = 'IT Developer';
    } else if (newStat.includes('Closed') || newStat.includes('Completed')) {
      actRole = 'Requester';
    } else {
      actRole = 'IT Operations';
    }
  }

  let statusBadgeColor = '#3b82f6';
  let headerTitle = 'IT OPS Request State Updated';

  if (newStat.includes('HOD')) {
    statusBadgeColor = '#d97706';
    headerTitle = 'Action Required: IT Request Pending HOD Approval';
  } else if (newStat.includes('IT Admin') || newStat.includes('Review')) {
    statusBadgeColor = '#2563eb';
    headerTitle = 'IT Clearance Required: Pending IT Admin Review';
  } else if (newStat.includes('In Progress')) {
    statusBadgeColor = '#059669';
    headerTitle = 'IT Request In Progress: Developer Assigned';
  } else if (newStat.includes('Completed') || newStat.includes('Closed')) {
    statusBadgeColor = '#16a34a';
    headerTitle = 'IT Request Successfully Closed';
  } else if (newStat.includes('Returned')) {
    statusBadgeColor = '#dc2626';
    headerTitle = 'Action Required: Request Returned to Requester';
  }

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <h1 style="margin: 0; font-size: 17px; color: #ffffff;">${headerTitle}</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${recipName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">The IT OPS Request <strong>${crId}</strong> has transitioned into a new workflow status by <strong>${actName}</strong> (${actRole}).</p>

    <!-- State Transition Banner -->
    <div style="background-color: #f8fafc; border-left: 4px solid ${statusBadgeColor}; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 16px 0;">
      <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; tracking: 0.5px;">Workflow Transition</div>
      <div style="font-size: 14px; margin-top: 4px; font-weight: bold;">
        <span style="color: #64748b; text-decoration: line-through;">${prevStat}</span>
        <span style="color: #94a3b8; margin: 0 8px;">➔</span>
        <span style="color: ${statusBadgeColor}; font-size: 15px;">${newStat}</span>
      </div>
    </div>

    <!-- CR Summary Card -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 140px; font-weight: bold;">CR Reference:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${crId}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Title:</td><td style="font-weight: bold; color: #0f172a;">${crTitle}</td></tr>
      </table>
    </div>

    ${comms ? `
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; margin: 16px 0;">
      <div style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase;">Remarks / Audit Trail Comments</div>
      <div style="font-size: 13px; color: #0f172a; margin-top: 4px; font-style: italic;">"${comms}"</div>
    </div>` : ''}


    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    changeRequestId: crId,
    recipientEmail: recipEmail,
    recipientName: recipName,
    subject: `[IT OPS] ${crId} - ${newStat}: ${crTitle}`,
    bodyHtml,
    sentAt: now,
    smtpServer: cfg.smtpServer,
    smtpPort: cfg.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `State Transition: ${prevStat} -> ${newStat}`,
  };
}

export function createRegistrationSubmittedAdminEmail(
  user: UserProfile,
  itAdminEmail: string,
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; font-weight: bold;">TANAKA IT OPS • New Account Registration Alert</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">New User Registration Pending IT Admin Approval</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Attention <strong>IT Administration Team</strong>,</p>
    <p style="font-size: 13px; color: #475569;">A new user has submitted a self-registration request on the IT OPS Portal. This account requires your security review and authorization before the user can log in.</p>

    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; margin-bottom: 10px;">📋 Applicant Registration Details</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 140px; font-weight: bold;">Full Name:</td><td style="font-weight: bold; color: #0f172a;">${user.fullName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Work Email:</td><td style="font-family: monospace; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Requested Dept:</td><td style="font-weight: bold; color: #0f172a;">${user.departmentName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Requested Role:</td><td><span style="background-color: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${user.role}</span></td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Submitted At:</td><td style="color: #64748b;">${user.registeredAt || now}</td></tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
      <p style="font-size: 12px; color: #475569; margin: 0;">
        💡 <strong>Action Required:</strong> Log in to the IT OPS Portal as IT Admin, navigate to <strong>System Administration ➔ Requesters & Users</strong>, and click <strong>"Approve Access"</strong> or reassign the department if the user selected incorrectly.
      </p>
    </div>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
 
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: itAdminEmail,
    recipientName: 'IT Administrator Team',
    subject: `[IT OPS User Onboarding] New User Registration Pending Approval - ${user.fullName} (${user.email})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `User Self-Registration: ${user.fullName} (${user.departmentName})`,
  };
}

export function createUserApprovedEmail(
  user: UserProfile,
  approvedByAdminName: string,
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Your IT OPS Portal Account is Now Active</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">Great news! Your IT OPS portal access request has been reviewed and <strong style="color: #16a34a;">approved</strong> by IT Administrator <strong>${approvedByAdminName}</strong>.</p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 10px;">✓ Active Account Profile</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 140px; font-weight: bold;">Login Email:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Department:</td><td style="font-weight: bold; color: #0f172a;">${user.departmentName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Authorized Role:</td><td><span style="background-color: #dcfce7; color: #166534; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${user.role}</span></td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Account Status:</td><td style="font-weight: bold; color: #16a34a;">Active • Verified</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569; line-height: 1.6;">You can now log in using your registered work email (<strong>${user.email}</strong>) and the <strong>password you created during registration</strong>. Any Requests you submit will automatically route to your department HOD for approval.</p>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
  
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `Account Approved - Welcome to Tanaka IT OPS Portal (${user.departmentName})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `User Account Approved: ${user.email}`,
  };
}

export function createUserDepartmentReassignedEmail(
  user: UserProfile,
  oldDeptName: string,
  newDeptName: string,
  newHodName: string,
  adminName: string,
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; font-weight: bold;">TANAKA IT OPS • Department Reassignment Notice</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Department Assignment Updated</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">Your assigned department on the IT OPS portal has been updated by Administrator <strong>${adminName}</strong>.</p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 140px; font-weight: bold;">User Email:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Previous Dept:</td><td style="color: #64748b; text-decoration: line-through;">${oldDeptName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">New Department:</td><td style="font-weight: bold; color: #1e40af; font-size: 14px;">${newDeptName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Department HOD:</td><td style="font-weight: bold; color: #0f172a;">${newHodName}</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569;">All subsequent IT OPS Requests you submit will now automatically bind to <strong>${newDeptName}</strong> and route to <strong>${newHodName}</strong> for approval.</p>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `[IT OPS] Department Reassignment Notice: ${oldDeptName} ➔ ${newDeptName}`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Department Reassigned: ${user.fullName} -> ${newDeptName}`,
  };
}

export function createPasswordResetOtpEmail(
  user: UserProfile,
  otpCode: string,
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; font-weight: bold;">TANAKA IDENTITY SECURITY • Password Reset Request</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Verification Code for Password Reset</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">A password reset was requested for your IT OPS account associated with work email <strong>${user.email}</strong>.</p>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit Password Reset Verification Code</div>
      <div style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; margin: 12px 0;">
        ${otpCode}
      </div>
      <div style="font-size: 11px; color: #64748b;">This verification code expires in 15 minutes. Do not share this code with anyone.</div>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
      <div style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 4px;">🛡️ Enterprise Password Policy Compliance Reminder:</div>
      <ul style="font-size: 12px; color: #475569; margin: 4px 0 0 16px; padding: 0;">
        <li>At least 10 characters in length</li>
        <li>At least one uppercase letter (A-Z)</li>
        <li>At least one number (0-9)</li>
        <li>At least one special character (!@#$%^&* etc.)</li>
      </ul>
    </div>

    

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `[IT OPS Security] Password Reset Verification Code: ${otpCode}`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Password Reset Verification Code Dispatched: ${user.email}`,
  };
}

export function createPasswordChangedConfirmationEmail(
  user: UserProfile,
  resetType: 'Self-Reset' | 'IT-Admin-Emergency',
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; font-weight: bold;">TANAKA IDENTITY SECURITY • Security Confirmation</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Password Successfully Updated</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">This is an automated confirmation that the password for your IT OPS account (<strong>${user.email}</strong>) has been successfully changed.</p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #475569; width: 140px; font-weight: bold;">Account Email:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Method:</td><td style="color: #0f172a;">${resetType === 'Self-Reset' ? 'Self-Service Email Verification Reset' : 'IT Admin Emergency Assistance'}</td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Policy Compliance:</td><td style="color: #16a34a; font-weight: bold;">✓ Enterprise Password Policy Compliant</td></tr>
        <tr><td style="padding: 5px 0; color: #475569; font-weight: bold;">Timestamp:</td><td style="color: #64748b;">${now}</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569;">You can now log in using your newly updated password.</p>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `[IT OPS Security] Password Successfully Changed for ${user.email}`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Password Changed Confirmation: ${user.email}`,
  };
}

export function createTemporaryApproverAssignedEmail(
  delegation: {
    departmentName: string;
    hodName: string;
    hodEmail: string;
    delegateName: string;
    delegateEmail: string;
    startDate: string;
    endDate: string;
    reason: string;
    notes?: string;
  },
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #78350f; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fde68a; font-weight: bold;">TANAKA IT OPS • Departmental HOD Delegation</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Temporary Approver Authority Granted (${delegation.departmentName})</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${delegation.delegateName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">
      Department Head <strong>${delegation.hodName}</strong> has assigned you as the <strong>Temporary / Acting Approver</strong> for the <strong>${delegation.departmentName}</strong> department during their absence.
    </p>

    <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #854d0e; text-transform: uppercase; margin-bottom: 10px;">⚡ Delegation Parameters</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 160px; font-weight: bold;">Department:</td><td style="font-weight: bold; color: #0f172a;">${delegation.departmentName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Delegating HOD:</td><td style="font-weight: bold; color: #0f172a;">${delegation.hodName} (${delegation.hodEmail})</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Acting Approver:</td><td style="font-weight: bold; color: #0f172a;">${delegation.delegateName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Authorized Window:</td><td style="font-family: monospace; font-weight: bold; color: #1e3a8a; background-color: #dbeafe; padding: 2px 6px; border-radius: 4px; display: inline-block;">${delegation.startDate} → ${delegation.endDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Absence Reason:</td><td><span style="background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${delegation.reason}</span></td></tr>
        ${delegation.notes ? `<tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Handover Notes:</td><td style="color: #334155; font-style: italic;">"${delegation.notes}"</td></tr>` : ''}
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 12px; color: #475569;">
      <strong style="color: #0f172a;">Governance & Privilege Guidelines:</strong>
      <ul style="margin: 6px 0 0 0; padding-left: 18px; line-height: 1.6;">
        <li>During this period, you have full authority to review, approve, send back, or reject pending departmental IT Requests.</li>
        <li>Your normal requester capabilities (e.g. creating new CRs, viewing My Requests) remain fully available.</li>
        <li>After the end date (${delegation.endDate}), your approval actions will automatically expire, but you will retain read-only historical archive access to past requests.</li>
      </ul>
    </div>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: `${delegation.delegateEmail}; ${delegation.hodEmail}`,
    recipientName: `${delegation.delegateName} (CC: HOD ${delegation.hodName})`,
    subject: `[IT OPS Authorization] Temporary HOD Approver Delegation for ${delegation.departmentName} (${delegation.startDate} to ${delegation.endDate})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Temporary Approver Appointed: ${delegation.delegateName} on behalf of HOD ${delegation.hodName}`,
  };
}

export function createAdminEmergencyPasswordResetEmail(
  user: UserProfile,
  tempPassword: string,
  adminName: string,
  mustChangePassword: boolean = true,
  smtpConfig: SmtpConfig = defaultSmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #f87171; font-weight: bold;">TANAKA IDENTITY SECURITY • Emergency Password Reset</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Temporary Password Issued by IT Administrator</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">An emergency password reset has been performed on your IT OPS account by Administrator <strong>${adminName}</strong>.</p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #991b1b; text-transform: uppercase; margin-bottom: 10px;">🔑 Temporary Login Credentials</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 150px; font-weight: bold;">Account Email:</td><td style="font-family: monospace; color: #2563eb;">${user.email}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Temporary Password:</td><td style="font-family: monospace; font-weight: bold; color: #dc2626; background-color: #fee2e2; padding: 2px 8px; border-radius: 4px; display: inline-block;">${tempPassword}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Reset Authorized By:</td><td style="font-weight: bold; color: #0f172a;">${adminName}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569; font-weight: bold;">Policy Enforcement:</td><td style="color: #b91c1c; font-weight: bold;">Must change password upon next login</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b;">Please log in with this temporary password and update it immediately in the Security settings.</p>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: user.email,
    recipientName: user.fullName,
    subject: `[IT OPS Security Alert] Emergency Password Reset - Temporary Credentials Issued`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Admin Emergency Reset: ${user.email} by ${adminName}`,
  };
}

export function createDelegationRevokedEmail(
  delegation: {
    departmentName: string;
    hodName: string;
    delegateName: string;
    delegateEmail: string;
    hodEmail: string;
    revocationReason?: string;
  },
  smtpConfig: SmtpConfig
): EmailNotificationLog {
  const now = getMalaysianTimestamp();

  const bodyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #475569; color: #ffffff; padding: 20px; text-align: left;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1; font-weight: bold;">TANAKA IT OPS • Delegation Revoked</div>
    <h1 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Temporary Approver Authority Concluded / Revoked</h1>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">Dear <strong>${delegation.delegateName}</strong>,</p>
    <p style="font-size: 13px; color: #475569;">
      The temporary approval delegation for <strong>${delegation.departmentName}</strong> department assigned by HOD <strong>${delegation.hodName}</strong> has been concluded / revoked.
    </p>
    ${delegation.revocationReason ? `<p style="font-size: 13px; color: #334155; background-color: #f1f5f9; padding: 10px; border-radius: 6px;"><strong>Revocation Reason / Handover Note:</strong> ${delegation.revocationReason}</p>` : ''}
    <p style="font-size: 12px; color: #64748b;">You retain read-only historical visibility to the departmental audit log.</p>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: `${delegation.delegateEmail}; ${delegation.hodEmail}`,
    recipientName: `${delegation.delegateName} & HOD ${delegation.hodName}`,
    subject: `[IT OPS Notice] Temporary Approver Delegation for ${delegation.departmentName} Concluded`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `Temporary Delegation Revoked for ${delegation.delegateName}`,
  };
}

export interface ItDirectModificationEmailParams {
  changeRequest: ChangeRequest;
  actor: UserProfile;
  oldCategory?: string;
  newCategory?: string;
  oldPriority: string;
  newPriority: string;
  priorityReason?: string;
  oldDeveloperName?: string;
  newDeveloperName?: string;
  generalComments?: string;
  smtpConfig: SmtpConfig;
}

export function createItDirectModificationEmail(
  params: ItDirectModificationEmailParams
): EmailNotificationLog {
  const {
    changeRequest,
    actor,
    oldCategory,
    newCategory,
    oldPriority,
    newPriority,
    priorityReason,
    oldDeveloperName,
    newDeveloperName,
    generalComments,
    smtpConfig,
  } = params;

  const now = getMalaysianTimestamp();
  const priorityChanged = oldPriority !== newPriority;
  const categoryChanged = oldCategory !== newCategory;
  const developerChanged = (newDeveloperName || '') !== (oldDeveloperName || '');

  const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 22px 24px; text-align: left;">
    <div style="display: inline-block; background-color: rgba(99, 102, 241, 0.3); border: 1px solid rgba(165, 180, 252, 0.4); border-radius: 4px; padding: 3px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #c7d2fe; font-weight: bold; margin-bottom: 8px;">
      ⚡ Direct IT Operations Notification • No Approval Required
    </div>
    <h1 style="margin: 0; font-size: 18px; line-height: 1.3; color: #ffffff;">
      IT Modified Case: ${changeRequest.id} — ${changeRequest.title}
    </h1>
    <div style="font-size: 11px; color: #a5b4fc; margin-top: 6px;">
      Modified by <strong>${actor.fullName}</strong> (${actor.role}) on ${now}
    </div>
  </div>

  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #334155; margin-top: 0;">
      Dear <strong>${changeRequest.requesterName}</strong>,
    </p>
    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
      Your IT Request <strong>${changeRequest.id}</strong> has been updated directly by IT Operations (<strong>${actor.fullName}</strong>). In accordance with IT operational policies, these adjustments are applied immediately without requiring additional departmental approval cycles.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <div style="font-size: 12px; font-weight: bold; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
        📋 Summary of IT Adjustments
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        ${
          priorityChanged
            ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Priority Level:</td>
          <td style="padding: 8px 0;">
            <span style="color: #94a3b8; text-decoration: line-through;">${oldPriority}</span>
            <span style="color: #3b82f6; font-weight: bold; margin: 0 6px;">→</span>
            <span style="background-color: ${newPriority === 'Critical' ? '#fee2e2' : newPriority === 'High' ? '#ffedd5' : '#e0e7ff'}; color: ${newPriority === 'Critical' ? '#991b1b' : newPriority === 'High' ? '#9a3412' : '#3730a3'}; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${newPriority}</span>
          </td>
        </tr>`
            : ''
        }

        ${
          priorityReason
            ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #b45309; font-weight: 600; vertical-align: top;">Priority Reason:</td>
          <td style="padding: 8px 0;">
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; font-style: italic;">
              "${priorityReason}"
            </div>
          </td>
        </tr>`
            : ''
        }

        ${
          categoryChanged
            ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Category:</td>
          <td style="padding: 8px 0;">
            <span style="color: #94a3b8; text-decoration: line-through;">${oldCategory || 'N/A'}</span>
            <span style="color: #3b82f6; font-weight: bold; margin: 0 6px;">→</span>
            <span style="color: #1e293b; font-weight: bold;">${newCategory}</span>
          </td>
        </tr>`
            : ''
        }

        ${
          developerChanged
            ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Assigned Developer:</td>
          <td style="padding: 8px 0;">
            <span style="color: #94a3b8; text-decoration: line-through;">${oldDeveloperName || 'Unassigned'}</span>
            <span style="color: #3b82f6; font-weight: bold; margin: 0 6px;">→</span>
            <span style="color: #047857; font-weight: bold;">${newDeveloperName || 'Unassigned'}</span>
          </td>
        </tr>`
            : ''
        }
      </table>

      ${
        generalComments
          ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
        <strong>IT Staff Comments:</strong>
        <p style="margin: 4px 0 0 0; color: #334155; font-style: italic;">"${generalComments}"</p>
      </div>`
          : ''
      }
    </div>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #1e40af; line-height: 1.5;">
      ℹ️ <strong>Direct Workflow Update:</strong> No approval action is required from you. The request is active immediately in your Portal Dashboard and in the Developer Kanban queue.
    </div>

    ${renderLoginButtonHtml(PORTAL_LOGIN_URL)}
  </div>
</div>`;

  return {
    id: `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: `${changeRequest.requesterEmail}${
      newDeveloperName && newDeveloperName !== oldDeveloperName
        ? '; alex.chen@company.com'
        : ''
    }`,
    recipientName: `${changeRequest.requesterName} (Requester)`,
    subject: `[IT OPS Update] ${normalizeEmailCrId(changeRequest.id)}: Direct IT Modifications Applied (Priority: ${newPriority})`,
    bodyHtml,
    sentAt: now,
    smtpServer: smtpConfig.smtpServer,
    smtpPort: smtpConfig.smtpPort,
    status: 'DELIVERED (250 OK)',
    triggerEvent: `IT Direct Reclassification / Priority Update (${normalizeEmailCrId(changeRequest.id)})`,
  };
}

/**
 * Dispatches real live email via Tanaka Enterprise SMTP Relay (157.9.183.242)
 * and logs the response into PostgreSQL database.
 */
export async function dispatchRealNotificationEmail(
  emailLog: EmailNotificationLog,
  smtpConfig?: SmtpConfig
): Promise<EmailNotificationLog> {
  try {
    const { api } = await import('../services/api');
    const result = await api.sendLiveEmail({
      recipientEmail: emailLog.recipientEmail,
      recipientName: emailLog.recipientName,
      subject: emailLog.subject,
      bodyHtml: emailLog.bodyHtml,
      triggerEvent: emailLog.triggerEvent,
      changeRequestId: emailLog.changeRequestId,
      smtpConfig: smtpConfig || {
        smtpServer: emailLog.smtpServer || '157.9.183.242',
        smtpPort: emailLog.smtpPort || 25,
        fromAddress: 'IT OPS-noreply@tanaka.com.my',
        fromName: 'IT OPS Notifications',
      },
    });

    if (result.data) {
      return result.data;
    }
  } catch (err) {
    console.warn('[Real SMTP Dispatch Warning]', err);
  }
  return emailLog;
}


