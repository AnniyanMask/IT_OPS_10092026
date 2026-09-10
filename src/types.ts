export type UserRole = 'Requester' | 'Department HOD' | 'IT Helpdesk' | 'IT Admin' | 'Software Developer' | 'System Admin' | string;

export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Network'
  | 'Email & Microsoft 365'
  | 'User Account & Access'
  | 'Printer & Scanning'
  | 'Security'
  | 'Server & Infrastructure'
  | 'Business Applications'
  | 'IT Request'
  | 'Bring Device Out'
  | 'Other';

export type TicketIssueType =
  | 'Incident'
  | 'Service Request'
  | 'Access Request'
  | 'Information / How-To'
  | 'Password / Account'
  | 'Change Request';

export type RequestType =
  | TicketIssueType
  | 'Bug Fix'
  | 'Enhancement'
  | 'New Feature'
  | 'Data Amendment';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

// ==========================================
// UNIFIED IT SERVICE CATALOG RELATIONAL SCHEMA
// ==========================================

export interface CategoryMaster {
  id: string;
  name: TicketCategory;
  code: string;
  description: string;
  iconName?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ServiceMaster {
  id: string;
  categoryId: string;
  categoryName: TicketCategory;
  name: string;
  code: string;
  description?: string;
  isAssetBased: boolean; // True for Hardware, Printers, Scanners etc.
  displayOrder: number;
  isActive: boolean;
}

export interface ApplicationAssetMaster {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryId: string;
  name: string;
  code: string;
  type: 'Application' | 'Asset';
  assetTag?: string; // e.g. LAPTOP-TEM-0234, DESKTOP-HQ-0199
  serialNumber?: string;
  location?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  hasApplicationArea: boolean; // True if configurable with Module -> SubFunction -> Process (e.g. PCS.NET, APMS.NET, SOMS)
  description?: string;
  isActive: boolean;
}

export interface IssueTypeMaster {
  id: string;
  name: TicketIssueType | string;
  code: string;
  description: string;
  badgeColor: string;
  defaultPriority: PriorityLevel;
  isActive: boolean;
  displayOrder: number;
}

export interface ApplicationModuleMaster {
  id: string;
  applicationId: string; // References ApplicationAssetMaster (e.g. app-pcs-net)
  applicationName?: string;
  code: string; // e.g. 107_PCS.NET, 101_APMS.NET, 104_E-INVOICE.NET
  name: string;
  description?: string;
  leadDeveloper?: string;
  displayOrder?: number;
  isActive: boolean;
}

export interface ApplicationSubFunctionMaster {
  id: string;
  moduleId: string; // References ApplicationModuleMaster
  moduleCode?: string;
  code: string;
  name: string; // e.g. CD2 Wire Operations, Spool Management
  description?: string;
  displayOrder?: number;
  isActive: boolean;
}

export interface ApplicationProcessMaster {
  id: string;
  subFunctionId: string; // References ApplicationSubFunctionMaster
  subFunctionName?: string;
  code: string;
  name: string; // e.g. CD2 Issue Case ID, Spool Trace Label Issue
  description?: string;
  displayOrder?: number;
  isActive: boolean;
}

export interface ApplicationAreaSelection {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  subFunctionId?: string;
  subFunctionName?: string;
  processId?: string;
  processName?: string;
}

export type RequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HOD Approval'
  | 'Returned to Requester'
  | 'Pending IT Admin Review'
  | 'In Progress'
  | 'Pending IT Verification'
  | 'Closed (Completed)'
  | 'Closed (Rejected)';

export interface Department {
  id: number;
  name: string;
  code: string;
  hodUserId: string;
  hodName: string;
  hodEmail: string;
}

export type DelegationReason =
  | 'Annual Leave'
  | 'Medical Leave / Emergency'
  | 'Business Travel / Duty Outstation'
  | 'Resignation / Transition Handover'
  | 'Special Assignment'
  | 'Other';

export interface TemporaryApproverDelegation {
  id: string; // e.g. DEL-2026-0001
  departmentId: number;
  departmentName: string;
  hodUserId: string;
  hodName: string;
  hodEmail: string;
  delegateUserId: string;
  delegateName: string;
  delegateEmail: string;
  delegateRole?: UserRole;
  startDate: string; // YYYY-MM-DD or YYYY-MM-DD HH:mm
  endDate: string;   // YYYY-MM-DD or YYYY-MM-DD HH:mm
  reason: DelegationReason;
  notes?: string;
  status: 'Active' | 'Expired' | 'Revoked';
  createdAt: string;
  createdBy: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  username?: string;
  password?: string;
  departmentId: number;
  departmentName: string;
  role: UserRole;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  status?: 'Active' | 'Pending IT Approval' | 'Suspended';
  registeredAt?: string;
}

export interface CustomRolePermissions {
  canViewMyRequests: boolean;
  canViewHodQueue: boolean;
  canViewItAdminWorkspace: boolean;
  canViewDeveloperBoard: boolean;
  canViewClosedCases: boolean;
  canViewReports: boolean;
  canViewAdminHub: boolean;
  canViewEmailHub: boolean;
  canViewDeviceOut: boolean;

  canApproveHodStage: boolean;
  canTriageAndAssignDevs: boolean;
  canReturnToRequester: boolean;
  canDirectModifyCatalog: boolean;
  canVerifyRelease: boolean;
  canReopenCases: boolean;
  canManageUsers: boolean;
}

export interface CustomRoleWorkflowRouting {
  receivesHodReview: boolean;
  receivesItAdminReview: boolean;
  canBeAssignedAsDeveloper: boolean;
  receivesCriticalEscalations: boolean;
}

export interface CustomRoleEmailSubscriptions {
  notifyNewSubmissions: boolean;
  notifyClarificationReplies: boolean;
  notifyStatusTransitions: boolean;
  notifyReleaseVerifications: boolean;
  notifyUserRegistrations: boolean;
  notifyDelegations: boolean;
}

export interface CustomRoleDefinition {
  id: string;
  roleName: string;
  archetype: 'Requester' | 'Department HOD' | 'IT Helpdesk' | 'IT Admin' | 'Software Developer' | 'System Admin' | 'Auditor' | 'Custom';
  description: string;
  isSystemRole: boolean;
  permissions: CustomRolePermissions;
  workflowRouting: CustomRoleWorkflowRouting;
  emailSubscriptions: CustomRoleEmailSubscriptions;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SmtpConfig {
  smtpServer: string;
  smtpPort: number;
  fromAddress: string;
  fromName: string;
  authRequired?: boolean;
  authUser?: string;
  authPass?: string;
  useTls?: boolean;
}

export interface EmailTemplateVariable {
  key: string;
  label: string;
  exampleValue: string;
  description: string;
}

export interface EmailTemplateDefinition {
  id: string;
  category: 'cr_workflow' | 'user_account' | 'governance';
  eventName: string;
  description: string;
  subjectTemplate: string;
  recipientDescription: string;
  defaultRecipientRole?: string;
  variables: EmailTemplateVariable[];
  bodyHtml: string;
  enabled: boolean;
  lastUpdated?: string;
  updatedBy?: string;
}

export interface SmtpTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  serverHost: string;
  serverPort: number;
  testedAt: string;
  protocolResponse?: string;
  smtpLog?: string[];
  errorCode?: string;
}

export interface EmailNotificationLog {
  id: string;
  changeRequestId?: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyHtml: string;
  sentAt: string;
  smtpServer: string;
  smtpPort: number;
  status: 'DELIVERED (250 OK)' | 'PENDING' | 'FAILED';
  triggerEvent: string;
}

export interface StorageConfig {
  id: string;
  storageType: 'UNC_NETWORK_SHARE' | 'LOCAL_DIRECTORY' | 'ENTERPRISE_SAN_NAS' | 'ENCRYPTED_CLOUD_VAULT';
  storageLocationPath: string; // e.g. \\tanaka-nas01.corp.internal\PCS_Attachments\prod_vault\
  backupLocationPath?: string;
  subfolderPattern: 'YEAR_MONTH' | 'YEAR_MONTH_CRID' | 'DEPARTMENT_CRID' | 'FLAT';
  encryptionAtRest: boolean;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  lastTestedStatus: 'HEALTHY' | 'WARNING' | 'UNREACHABLE' | 'CONFIGURING';
  lastTestedAt: string;
  updatedBy: string;
  updatedAt: string;
  totalFilesStored?: number;
  totalBytesConsumedMb?: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeKb: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  storedPath?: string; // Secure physical path on server/NAS (Visible ONLY to Admin & IT)
  storageVaultId?: string;
  fileChecksum?: string;
  encryptionAlgorithm?: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  changeRequestId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole | 'Acting Department HOD' | string;
  actionDate: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  decision:
    | 'Submitted'
    | 'Approved'
    | 'Rejected'
    | 'Sent Back'
    | 'Returned for Clarification'
    | 'Reminder Sent (Chase Policy)'
    | 'Auto-Closed (No Response)'
    | 'Assigned'
    | 'Status Update'
    | 'Verified'
    | 'Closed'
    | 'Resubmitted to IT'
    | 'HOD Bypassed (Critical)'
    | 'Priority Changed by IT'
    | 'Category Changed by IT'
    | 'Reassigned by IT'
    | 'IT Direct Modification'
    | 'Reopened';
  comments: string;
}

export interface ChangeRequest {
  id: string; // e.g. ITO-CR-2026-00001 or IT-REQ-2026-00001
  submissionId?: string; // Idempotency key for safe retries/double-click protection
  title: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  departmentId: number;
  departmentName: string;
  // Unified Relational Classification
  categoryId?: string;
  categoryName?: TicketCategory;
  category?: TicketCategory;
  serviceId?: string;
  serviceName?: string;
  subcategory?: string;
  applicationAssetId?: string;
  applicationAssetName?: string;
  applicationName?: string;
  assetTag?: string;
  issueTypeId?: string;
  issueTypeName?: TicketIssueType;
  issueType?: TicketIssueType;
  requestType: RequestType;
  priority: PriorityLevel;
  priorityChangeReason?: string;
  priorityChangedBy?: string;
  priorityChangedAt?: string;
  categoryChangedBy?: string;
  categoryChangedAt?: string;
  reassignedBy?: string;
  reassignedAt?: string;
  hodApprovalSkipped?: boolean;
  hodSkipReason?: string;
  applicationAreas?: ApplicationAreaSelection[];
  affectedModules: string[];
  currentBehaviorDescription: string;
  requestedChangeDescription: string;
  businessJustification: string;
  attachments: Attachment[];
  requestedCompletionDate: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  hodApprovedAt?: string;
  hodApprovedBy?: string;
  returnedByRole?: 'Department HOD' | 'IT Helpdesk' | 'IT Admin' | 'Software Developer' | 'System Admin';
  itClarificationRequested?: boolean;
  clarificationReply?: string;
  assignedDeveloperId?: string;
  assignedDeveloperName?: string;
  implementationNotes?: string;
  hasCodeOrDatabaseChanges?: boolean;
  beforeChangeDetails?: string;
  afterChangeDetails?: string;
  actualCompletionDate?: string;
  // Rejection & Reopen Tracking
  rejectedByUserId?: string;
  rejectedByName?: string;
  rejectedByRole?: 'IT Helpdesk' | 'IT Admin' | 'System Admin' | 'Software Developer' | 'Department HOD' | 'Acting Department HOD' | string;
  rejectedAt?: string;
  rejectionReason?: string;
  reopenedByUserId?: string;
  reopenedByName?: string;
  reopenedAt?: string;
  reopenComments?: string;
  approvalHistory: ApprovalHistoryEntry[];
  targetCompletionDate?: string;
  slaTargetHours?: number;
  // SLA Clock Pause & 3-Stage Chase Policy Tracking
  slaPausedAt?: string;
  totalSlaPausedHours?: number;
  reminderCount?: number; // 0, 1, 2, 3 (3-Strike Rule)
  lastReminderSentAt?: string;
  lastReminderStage?: 1 | 2 | 3;
  autoClosureWarnedAt?: string;
  isAutoClosedInactive?: boolean;
  withdrawnAt?: string;
  withdrawnReason?: string;
  riskAssessment?: {
    riskScore: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Severe';
    downtimeRequired: boolean;
    schemaChangeRequired: boolean;
  };
  revisionHistory?: {
    revisionNumber: number;
    title: string;
    requestedChangeDescription: string;
    currentBehaviorDescription: string;
    updatedAt: string;
    comments?: string;
  }[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  changeRequestId?: string;
}

export interface PcsModule {
  id: string;
  name: string;
  description: string;
  leadDeveloper: string;
  active: boolean;
}

export interface ItDirectModifyPayload {
  crId: string;
  actorUserId?: string;
  actorName?: string;
  actorRole?: string;
  categoryId?: string;
  categoryName?: TicketCategory;
  category?: TicketCategory;
  serviceId?: string;
  serviceName?: string;
  subcategory?: string;
  applicationAssetId?: string;
  applicationAssetName?: string;
  applicationName?: string;
  issueTypeId?: string;
  issueTypeName?: TicketIssueType;
  issueType?: TicketIssueType;
  priority: PriorityLevel;
  priorityChangeReason?: string;
  assignedDeveloperId?: string;
  assignedDeveloperName?: string;
  targetCompletionDate?: string;
  comments?: string;
}

export interface CodeFile {
  path: string;
  category: 'Program & Config' | 'Database SQL (RLS)' | 'EF Core Models' | 'Controllers' | 'Razor Views' | 'Documentation';
  language: 'csharp' | 'sql' | 'json' | 'razor' | 'markdown';
  content: string;
}

export interface SystemTurnaroundMetrics {
  avgHodClearanceDays: number;
  hodClearanceDisplay: string;
  hodSlaCompliancePercent: number;
  hodSlaComplianceDisplay: string;
  hodEvaluatedCount: number;
  avgItDevCycleDays: number;
  itDevCycleDisplay: string;
  itDevSlaCompliancePercent: number;
  itDevSlaComplianceDisplay: string;
  itEvaluatedCount: number;
  totalClosedCases: number;
  completedCount: number;
  rejectedCount: number;
  totalCases: number;
  verificationRatePercent: number;
  verificationDisplay: string;
  priorityDistribution: Record<PriorityLevel | string, number>;
  statusDistribution: Record<string, number>;
  avgOverallResolutionDays: number;
  calculatedAt: string;
  source: 'postgresql_engine' | 'fallback_computed';
}

// ==========================================
// BRING DEVICE OUT & SATO CL4NX LABEL SYSTEM
// ==========================================

export type DeviceOutAssetType = 'Laptop' | 'Thumbdrive' | 'External Hard Disk' | 'Application Asset';

export type DeviceOutApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Returned/Closed';

export type VpnRequirement = 'Required' | 'Not Required';

export interface DeviceOutApproval {
  id?: number | string;
  requestId: string;
  approverId: string;
  approverName?: string;
  approverRole?: string;
  action: DeviceOutApprovalStatus | 'Submitted';
  comments?: string;
  createdAt: string;
}

export interface DeviceOutRequest {
  id: string; // e.g. DEV-OUT-2026-00001
  requestId?: string; // alias/database request_id
  assetType: DeviceOutAssetType;
  serviceName?: string;
  assetId?: string;
  assetName: string;
  assetSerialNo?: string;
  serialNumber?: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  vpnRequired: VpnRequirement;
  businessPurpose: string;
  approvalRequired: boolean;
  approvalStatus: DeviceOutApprovalStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  returnedAt?: string;
  returnedBy?: string;
  returnedByName?: string;
  returnRemarks?: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  departmentId?: number;
  departmentName?: string;
  createdAt: string;
  updatedAt?: string;
  approvals?: DeviceOutApproval[];
  printCount?: number;
  lastPrintedAt?: string;
}

export interface LabelTemplateElement {
  id: string;
  templateId: string;
  elementType: 'text' | 'badge' | 'barcode' | 'qr' | 'line';
  fieldKey: string; // 'status_approved' | 'requester_name' | 'asset_name' | 'asset_serial_no' | 'from_date' | 'to_date' | 'approver_name' | 'request_number' | 'custom'
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'medium';
  visible: boolean;
  alignment: 'left' | 'center' | 'right';
  rotation: number; // 0, 90, 180, 270
}

export interface LabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  orientation: 'Landscape' | 'Portrait';
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  elements?: LabelTemplateElement[];
}

export interface LabelPrintHistory {
  id?: number | string;
  requestId: string;
  templateId?: string;
  printedBy: string;
  printedByName?: string;
  printerName: string;
  printCount: number;
  printedAt: string;
}

// ==========================================
// WHAT'S NEW / RELEASE NOTES MODULE SCHEMA
// ==========================================

export type ReleaseStatus = 'Draft' | 'Published';

export type ReleaseItemType = "What's New" | 'Improvements' | 'Bug Fixes' | 'Important Notices';

export interface ReleaseNoteItem {
  id: string;
  releaseId?: string;
  type: ReleaseItemType;
  description: string;
  sortOrder: number;
}

export interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  releaseDate: string; // YYYY-MM-DD
  summary: string;
  status: ReleaseStatus;
  publishedAt?: string | null;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt?: string;
  items?: ReleaseNoteItem[];
  isRead?: boolean;
}

export interface ReleaseNoteRead {
  id: string;
  releaseId: string;
  userId: string;
  readAt: string;
}

// ==========================================
// MAINTENANCE ANNOUNCEMENTS & EMAIL REMINDERS
// ==========================================

export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export type MaintenanceReminderType =
  | 'initial'
  | '3_days_before'
  | '1_day_before'
  | '30_mins_before'
  | 'started'
  | 'completed'
  | 'cancelled';

export type MaintenanceReminderStatus = 'Scheduled' | 'Sent' | 'Failed' | 'Cancelled' | 'Skipped';

export type MaintenanceEmailHistoryStatus = 'Scheduled' | 'Sent' | 'Failed' | 'Cancelled';

export interface MaintenanceReminderSettings {
  initial: boolean;
  threeDaysBefore: boolean;
  oneDayBefore: boolean;
  thirtyMinsBefore: boolean;
  started: boolean;
  completed: boolean;
  cancelled: boolean;
}

export interface MaintenanceAnnouncement {
  id: string;
  title: string;
  maintenanceType: string;
  affectedSystem: string;
  description: string;
  reason: string;
  startDatetime: string; // ISO string or YYYY-MM-DDTHH:mm
  endDatetime: string;   // ISO string or YYYY-MM-DDTHH:mm
  duration: string;      // Automatically calculated e.g. "3 hours 30 mins"
  impact: string;
  userAction: string;
  workaround: string;
  itContact: string;
  changeNumber?: string;
  recipientGroup: string; // default: "TD_TEM"
  status: MaintenanceStatus;
  reminderSettings: MaintenanceReminderSettings;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt?: string;
  reminders?: MaintenanceReminder[];
}

export interface MaintenanceReminder {
  id: string;
  maintenanceId: string;
  reminderType: MaintenanceReminderType;
  scheduledTime?: string | null;
  status: MaintenanceReminderStatus;
  sentTime?: string | null;
  errorMessage?: string | null;
  recipientGroup: string;
  recipientCount: number;
  templateUsed: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceEmailHistory {
  id: string;
  maintenanceId: string;
  reminderType: MaintenanceReminderType;
  recipientGroup: string;
  recipientCount: number;
  scheduledTime?: string | null;
  sentTime: string;
  status: MaintenanceEmailHistoryStatus;
  errorMessage?: string | null;
  templateUsed: string;
  subject?: string;
  bodyHtml?: string;
  createdAt?: string;
}

export function calculateMaintenanceDuration(start: string, end: string): string {
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
