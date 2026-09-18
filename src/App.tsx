/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import {
  UserProfile,
  Department,
  ChangeRequest,
  RequestStatus,
  ApprovalHistoryEntry,
  NotificationItem,
  SmtpConfig,
  EmailNotificationLog,
  StorageConfig,
  CategoryMaster,
  ServiceMaster,
  ApplicationAssetMaster,
  IssueTypeMaster,
  ApplicationModuleMaster,
  ApplicationSubFunctionMaster,
  ApplicationProcessMaster,
  TemporaryApproverDelegation,
  DelegationReason,
  CustomRoleDefinition,
} from './types';
import {
  MASTER_CATEGORIES,
  MASTER_SERVICES,
  MASTER_APPLICATIONS_ASSETS,
  MASTER_ISSUE_TYPES,
  MASTER_APPLICATION_MODULES,
  MASTER_APPLICATION_SUBFUNCTIONS,
  MASTER_APPLICATION_PROCESSES,
} from './data/serviceCatalog';
import {
  mockDepartments,
  mockUsers,
  defaultSmtpConfig,
  defaultStorageConfig,
  baselineCustomRoles,
} from './data/db';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ChangeRequestForm } from './components/ChangeRequestForm';
import { MyRequestsView } from './components/MyRequestsView';
import { HodQueueView } from './components/HodQueueView';
import { ItAdminQueueView } from './components/ItAdminQueueView';
import { DeveloperKanbanView } from './components/DeveloperKanbanView';
import { ClosedCasesView } from './components/ClosedCasesView';
import { RequestDetailModal } from './components/RequestDetailModal';
import { AdminUserMgmtView } from './components/AdminUserMgmtView';
import { EmailContextTemplateAdminView } from './components/EmailContextTemplateAdminView';
import { ReportsView } from './components/ReportsView';
import { DeviceOutView } from './components/DeviceOutView';
import { HowToUseView } from './components/HowToUseView';
import { WhatsNewView } from './components/WhatsNewView';
import { LoginModal } from './components/LoginModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { ItDirectModifyPayload } from './components/ItDirectModifyModal';
import {
  createWelcomeAccountEmail,
  createNewUserRegisteredPendingAdminEmail,
  createStateTransitionEmail,
  createUserApprovedEmail,
  createUserDepartmentReassignedEmail,
  createPasswordResetOtpEmail,
  createPasswordChangedConfirmationEmail,
  createAdminEmergencyPasswordResetEmail,
  createTemporaryApproverAssignedEmail,
  createDelegationRevokedEmail,
  createItDirectModificationEmail,
} from './utils/emailNotifier';
import { getUserDelegationContext } from './utils/delegationUtils';
import { hasRolePermission } from './utils/rbac';
import { getPrioritySlaHours, getChaseStageInfo, calculateTotalPausedClarificationHours } from './utils/slaAndRisk';
import { generateVerificationOtp, generateCompliantPassword } from './utils/passwordPolicy';
import { getMalaysianTimestamp } from './utils/timezone';
import { Mail, LogOut, Bell } from 'lucide-react';

export default function App() {
  // Active User State (Stored in localStorage, defaults to null for unauthenticated initial login view)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('pcs_current_user_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse current user from storage:', err);
    }
    return null; // Require login upon first opening the app
  });

  // Helper to normalize legacy PCS-CR prefix to ITO-CR prefix and ensure safe array fields
  const normalizeCr = (item: ChangeRequest): ChangeRequest => {
    if (!item) return item;
    const oldId = item.id;
    const newId = oldId && oldId.startsWith('PCS-CR-') ? oldId.replace(/^PCS-CR-/, 'ITO-CR-') : (oldId || '');
    const approvalHistory = Array.isArray(item.approvalHistory) ? item.approvalHistory : [];
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const affectedModules = Array.isArray(item.affectedModules) ? item.affectedModules : [];
    const applicationAreas = Array.isArray(item.applicationAreas) ? item.applicationAreas : [];
    const revisionHistory = Array.isArray(item.revisionHistory) ? item.revisionHistory : [];

    return {
      ...item,
      id: newId,
      approvalHistory: approvalHistory.map((h) => ({
        ...h,
        changeRequestId: (h.changeRequestId && typeof h.changeRequestId === 'string' && h.changeRequestId.startsWith('PCS-CR-'))
          ? h.changeRequestId.replace(/^PCS-CR-/, 'ITO-CR-')
          : (h.changeRequestId || newId),
      })),
      attachments,
      affectedModules,
      applicationAreas,
      revisionHistory,
    };
  };

  // Master State Collections (Production - hydrated strictly from PostgreSQL)
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);

  // Hydrate change requests, users, departments, delegations, and email logs from backend PostgreSQL
  useEffect(() => {
    let isMounted = true;

    // Check DB status & heartbeat
    api.getDbStatus().then((status) => {
      if (isMounted) {
        setBackendConnected(status.connected);
      }
    }).catch(() => {
      if (isMounted) setBackendConnected(false);
    });

    // 1. Change Requests (Hydrated from PostgreSQL database as the single source of truth)
    if (currentUser) api.getChangeRequests({ id: currentUser.id, role: currentUser.role, departmentId: currentUser.departmentId }).then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeCr);
        setChangeRequests(normalized);
      }
    }).catch(() => {});

    // 2. Users
    api.getUsers().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setUsers(res.data);
      }
    }).catch(() => {});

    // 3. Departments
    api.getDepartments().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setDepartments(res.data);
      }
    }).catch(() => {});

    // 4. Delegations
    api.getDelegations().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        setDelegations(res.data);
      }
    }).catch(() => {});

    // 5. Email Logs
    api.getEmailLogs().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        setEmailLogs(res.data);
      }
    }).catch(() => {});

    // 6. Custom Roles & Governance Matrix
    api.getCustomRoles().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setCustomRoles(res.data);
      }
    }).catch(() => {});

    // 7. Enterprise IT Service Catalog & 3-Tier Hierarchy (PostgreSQL Single Source of Truth)
    api.getCatalog().then((res) => {
      if (isMounted && res.success && res.data) {
        if (Array.isArray(res.data.categories)) {
          setCategories(res.data.categories);
          try { localStorage.setItem('pcs_catalog_cats_v1', JSON.stringify(res.data.categories)); } catch {}
        }
        if (Array.isArray(res.data.services)) {
          setServices(res.data.services);
          try { localStorage.setItem('pcs_catalog_services_v1', JSON.stringify(res.data.services)); } catch {}
        }
        if (Array.isArray(res.data.applications)) {
          setApplications(res.data.applications);
          try { localStorage.setItem('pcs_catalog_apps_v1', JSON.stringify(res.data.applications)); } catch {}
        }
        if (Array.isArray(res.data.issueTypes)) {
          setIssueTypes(res.data.issueTypes);
          try { localStorage.setItem('pcs_catalog_issuetypes_v1', JSON.stringify(res.data.issueTypes)); } catch {}
        }
        if (Array.isArray(res.data.modules)) {
          setModules(res.data.modules);
          try { localStorage.setItem('pcs_catalog_modules_v1', JSON.stringify(res.data.modules)); } catch {}
        }
        if (Array.isArray(res.data.subFunctions)) {
          setSubFunctions(res.data.subFunctions);
          try { localStorage.setItem('pcs_catalog_subfunctions_v1', JSON.stringify(res.data.subFunctions)); } catch {}
        }
        if (Array.isArray(res.data.processes)) {
          setProcesses(res.data.processes);
          try { localStorage.setItem('pcs_catalog_processes_v1', JSON.stringify(res.data.processes)); } catch {}
        }
      }
    }).catch((err) => console.warn('[Load Catalog Error]', err));

    return () => { isMounted = false; };
  }, []);

  // Custom Roles & Automated Governance Matrix State (localStorage + PostgreSQL synced)
  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_custom_roles_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse custom roles from storage:', err);
    }
    return baselineCustomRoles;
  });

  const handleUpdateCustomRoles = (updatedRoles: CustomRoleDefinition[]) => {
    setCustomRoles(updatedRoles);
    try {
      localStorage.setItem('pcs_custom_roles_v1', JSON.stringify(updatedRoles));
    } catch (err) {
      console.error('Failed to save custom roles to storage:', err);
    }
  };

  // Temporary Approver Delegations Database State (localStorage backed + PostgreSQL synced)
  const [delegations, setDelegations] = useState<TemporaryApproverDelegation[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_delegations_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse delegations from storage:', err);
    }
    return [];
  });

  const handleSaveDelegation = (data: {
    departmentId: number;
    departmentName: string;
    hodUserId: string;
    hodName: string;
    hodEmail: string;
    delegateUserId: string;
    delegateName: string;
    delegateEmail: string;
    delegateRole: string;
    startDate: string;
    endDate: string;
    reason: DelegationReason;
    notes?: string;
  }) => {
    const now = getMalaysianTimestamp();
    const newId = `DEL-2026-${String(delegations.length + 1).padStart(4, '0')}`;
    const newDelegation: TemporaryApproverDelegation = {
      id: newId,
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      hodUserId: data.hodUserId,
      hodName: data.hodName,
      hodEmail: data.hodEmail,
      delegateUserId: data.delegateUserId,
      delegateName: data.delegateName,
      delegateEmail: data.delegateEmail,
      delegateRole: data.delegateRole as any,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      notes: data.notes,
      status: 'Active',
      createdAt: now,
      createdBy: data.hodName,
    };

    const updated = [newDelegation, ...delegations];
    setDelegations(updated);
    try {
      localStorage.setItem('pcs_delegations_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save delegations:', e);
    }

    // Persist to PostgreSQL database
    api.saveDelegation(newDelegation).catch((err) => console.warn('[DB Save Delegation Notice]', err));

    // Dispatch automated SMTP notification to delegate & HOD
    const emailLog = createTemporaryApproverAssignedEmail(
      {
        departmentName: data.departmentName,
        hodName: data.hodName,
        hodEmail: data.hodEmail,
        delegateName: data.delegateName,
        delegateEmail: data.delegateEmail,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        notes: data.notes,
      },
      smtpConfig
    );
    dispatchEmailLog(emailLog);

    // Dispatch UI notification to delegate
    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: data.delegateUserId,
      title: '⚡ Temporary Approver Authority Assigned',
      message: `${data.hodName} assigned you as Acting Approver for ${data.departmentName} (${data.startDate.split(' ')[0]} to ${data.endDate.split(' ')[0]}).`,
      createdAt: now,
      read: false,
    };
    setNotifications([notif, ...notifications]);
  };

  const handleRevokeDelegation = (delegationId: string, revocationReason: string) => {
    const now = getMalaysianTimestamp();
    let targetDel: TemporaryApproverDelegation | undefined;

    const updated = delegations.map((d) => {
      if (d.id === delegationId) {
        targetDel = d;
        return {
          ...d,
          status: 'Revoked' as const,
          revokedAt: now,
          revokedBy: currentUser?.fullName || 'System',
          revocationReason,
        };
      }
      return d;
    });

    setDelegations(updated);
    try {
      localStorage.setItem('pcs_delegations_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save delegations:', e);
    }

    // Persist revocation to PostgreSQL database
    api.revokeDelegation(delegationId, currentUser?.fullName || 'System', revocationReason).catch((err) => console.warn('[DB Revoke Delegation Notice]', err));

    if (targetDel) {
      // Dispatch automated SMTP email for revocation
      const emailLog = createDelegationRevokedEmail(
        {
          departmentName: targetDel.departmentName,
          hodName: targetDel.hodName,
          delegateName: targetDel.delegateName,
          delegateEmail: targetDel.delegateEmail,
          hodEmail: targetDel.hodEmail,
          revocationReason,
        },
        smtpConfig
      );
      dispatchEmailLog(emailLog);

      // Dispatch UI notification
      const notif: NotificationItem = {
        id: `notif-${Date.now()}`,
        userId: targetDel.delegateUserId,
        title: 'Delegation Authority Concluded / Revoked',
        message: `Your temporary approver authority for ${targetDel.departmentName} was concluded by ${currentUser.fullName}. Reason: ${revocationReason}`,
        createdAt: now,
        read: false,
      };
      setNotifications([notif, ...notifications]);
    }
  };

  // Departments Database State (localStorage backed)
  const [departments, setDepartments] = useState<Department[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_departments_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse departments from storage:', err);
    }
    return mockDepartments;
  });

  const handleUpdateDepartments = (updatedDepts: Department[]) => {
    setDepartments(updatedDepts);
    try {
      localStorage.setItem('pcs_departments_v2', JSON.stringify(updatedDepts));
    } catch (err) {
      console.error('Failed to save departments to storage:', err);
    }
  };

  // Registered System Users State (localStorage backed)
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_users_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse users from storage:', err);
    }
    return mockUsers;
  });

  const handleUpdateUsers = (updatedUsers: UserProfile[]) => {
    setUsers(updatedUsers);
    try {
      localStorage.setItem('pcs_users_v2', JSON.stringify(updatedUsers));
    } catch (err) {
      console.error('Failed to save users to storage:', err);
    }
  };

  // SMTP Relay Configuration State (localStorage backed)
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(() => {
    try {
      const saved = localStorage.getItem('pcs_smtp_config_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse SMTP config from storage:', err);
    }
    return defaultSmtpConfig;
  });

  const handleUpdateSmtpConfig = (newConfig: SmtpConfig) => {
    setSmtpConfig(newConfig);
    try {
      localStorage.setItem('pcs_smtp_config_v2', JSON.stringify(newConfig));
    } catch (err) {
      console.error('Failed to save SMTP config to storage:', err);
    }
  };

  // Enterprise Storage Vault & Location Configuration.
// PostgreSQL is authoritative; localStorage is retained only as a UI fallback/cache.
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => {
    try {
      const saved = localStorage.getItem('pcs_storage_config_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse storage config from storage:', err);
    }
    return defaultStorageConfig;
  });

  useEffect(() => {
    if (!currentUser || !['IT Admin', 'System Admin'].includes(currentUser.role)) return;
    api.getStorageVault(currentUser).then((result) => {
      if (result.success && result.data) {
        const row = result.data;
        const config: StorageConfig = {
          id: row.id,
          storageType: row.storage_type,
          storageLocationPath: row.storage_location_path,
          backupLocationPath: row.backup_location_path || '',
          subfolderPattern: row.subfolder_pattern,
          encryptionAtRest: Boolean(row.encryption_at_rest),
          maxFileSizeMb: Number(row.max_file_size_mb || 25),
          allowedExtensions: Array.isArray(row.allowed_extensions) ? row.allowed_extensions : defaultStorageConfig.allowedExtensions,
          lastTestedStatus: row.last_tested_status || 'CONFIGURING',
          lastTestedAt: row.last_tested_at || '',
          updatedBy: row.updated_by || '',
          updatedAt: row.updated_at || '',
        };
        setStorageConfig(config);
        try { localStorage.setItem('pcs_storage_config_v2', JSON.stringify(config)); } catch {}
      }
    }).catch((err) => console.warn('[Storage Config Load Notice]', err));
  }, [currentUser]);

  const handleUpdateStorageConfig = async (newConfig: StorageConfig) => {
    if (!currentUser || !['IT Admin', 'System Admin'].includes(currentUser.role)) {
      throw new Error('Only IT Admin or System Admin can update storage repository configuration.');
    }
    const result = await api.saveStorageVault(newConfig, currentUser);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to save storage repository configuration.');
    }
    const row = result.data;
    const persisted: StorageConfig = {
      ...newConfig,
      id: row.id,
      storageType: row.storage_type,
      storageLocationPath: row.storage_location_path,
      backupLocationPath: row.backup_location_path || '',
      subfolderPattern: row.subfolder_pattern,
      encryptionAtRest: Boolean(row.encryption_at_rest),
      maxFileSizeMb: Number(row.max_file_size_mb || 25),
      allowedExtensions: Array.isArray(row.allowed_extensions) ? row.allowed_extensions : newConfig.allowedExtensions,
      lastTestedStatus: row.last_tested_status || newConfig.lastTestedStatus,
      lastTestedAt: row.last_tested_at || newConfig.lastTestedAt,
      updatedBy: row.updated_by || newConfig.updatedBy,
      updatedAt: row.updated_at || newConfig.updatedAt,
    };
    setStorageConfig(persisted);
    try { localStorage.setItem('pcs_storage_config_v2', JSON.stringify(persisted)); } catch {}
  };

  // Automated Email Notification Outbox Logs State (localStorage backed)
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_email_logs_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse email logs from storage:', err);
    }
    return [];
  });

  const dispatchEmailLog = (log: EmailNotificationLog) => {
    setEmailLogs((prev) => {
      const updated = [log, ...prev];
      try {
        localStorage.setItem('pcs_email_logs_v2', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save email logs to storage:', err);
      }
      return updated;
    });

    // Real live SMTP email dispatch across Tanaka Enterprise Relay (157.9.183.242) + PostgreSQL logging
    api.sendLiveEmail({
      recipientEmail: log.recipientEmail,
      recipientName: log.recipientName,
      subject: log.subject,
      bodyHtml: log.bodyHtml,
      triggerEvent: log.triggerEvent,
      changeRequestId: log.changeRequestId,
      smtpConfig,
    }).then((res) => {
      if (res && res.data) {
        console.log('[Live SMTP Email Dispatched]', res.data);
      }
    }).catch((err) => console.warn('[Live SMTP Notice]', err));
  };

  // Service Catalog Collections State (localStorage backed)
  const [categories, setCategories] = useState<CategoryMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_categories_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse categories from storage:', err);
    }
    return MASTER_CATEGORIES;
  });

  const handleUpdateCategories = (updated: CategoryMaster[]) => {
    setCategories(updated);
    try {
      localStorage.setItem('pcs_catalog_categories_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save categories to storage:', err);
    }
    api.saveCatalog({ categories: updated }).catch((err) => console.warn('[Save Categories DB]', err));
  };

  const [services, setServices] = useState<ServiceMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_services_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse services from storage:', err);
    }
    return MASTER_SERVICES;
  });

  const handleUpdateServices = (updated: ServiceMaster[]) => {
    setServices(updated);
    try {
      localStorage.setItem('pcs_catalog_services_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save services to storage:', err);
    }
    api.saveCatalog({ services: updated }).catch((err) => console.warn('[Save Services DB]', err));
  };

  const [applications, setApplications] = useState<ApplicationAssetMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_apps_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse applications from storage:', err);
    }
    return MASTER_APPLICATIONS_ASSETS;
  });

  const handleUpdateApplications = (updated: ApplicationAssetMaster[]) => {
    setApplications(updated);
    try {
      localStorage.setItem('pcs_catalog_apps_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save applications to storage:', err);
    }
    api.saveCatalog({ applications: updated }).catch((err) => console.warn('[Save Applications DB]', err));
  };

  const [issueTypes, setIssueTypes] = useState<IssueTypeMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_issuetypes_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse issue types from storage:', err);
    }
    return MASTER_ISSUE_TYPES;
  });

  const handleUpdateIssueTypes = (updated: IssueTypeMaster[]) => {
    setIssueTypes(updated);
    try {
      localStorage.setItem('pcs_catalog_issuetypes_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save issue types to storage:', err);
    }
    api.saveCatalog({ issueTypes: updated }).catch((err) => console.warn('[Save Issue Types DB]', err));
  };

  const [modules, setModules] = useState<ApplicationModuleMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_modules_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse modules from storage:', err);
    }
    return MASTER_APPLICATION_MODULES;
  });

  const handleUpdateModules = (updated: ApplicationModuleMaster[]) => {
    setModules(updated);
    try {
      localStorage.setItem('pcs_catalog_modules_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save modules to storage:', err);
    }
    api.saveCatalog({ modules: updated }).catch((err) => console.warn('[Save Modules DB]', err));
  };

  const [subFunctions, setSubFunctions] = useState<ApplicationSubFunctionMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_subfunctions_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse subfunctions from storage:', err);
    }
    return MASTER_APPLICATION_SUBFUNCTIONS;
  });

  const handleUpdateSubFunctions = (updated: ApplicationSubFunctionMaster[]) => {
    setSubFunctions(updated);
    try {
      localStorage.setItem('pcs_catalog_subfunctions_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save subfunctions to storage:', err);
    }
    api.saveCatalog({ subFunctions: updated }).catch((err) => console.warn('[Save SubFunctions DB]', err));
  };

  const [processes, setProcesses] = useState<ApplicationProcessMaster[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_catalog_processes_v1');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse processes from storage:', err);
    }
    return MASTER_APPLICATION_PROCESSES;
  });

  const handleUpdateProcesses = (updated: ApplicationProcessMaster[]) => {
    setProcesses(updated);
    try {
      localStorage.setItem('pcs_catalog_processes_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save processes to storage:', err);
    }
    api.saveCatalog({ processes: updated }).catch((err) => console.warn('[Save Processes DB]', err));
  };

  // Modal Dialog States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Detail Modal & Form State
  const [selectedCrForModal, setSelectedCrForModal] = useState<ChangeRequest | null>(null);
  const [editingCr, setEditingCr] = useState<ChangeRequest | null>(null);
  const [appNavTab, setAppNavTab] = useState<string>('dashboard');
  const [adminInitialTab, setAdminInitialTab] = useState<'catalog' | 'roles' | 'workload' | 'hierarchy' | 'users' | 'departments' | 'storage' | 'postgres' | 'label-designer' | 'device-out' | 'releases' | 'maintenance'>('catalog');
  const [emailInitialSubTab, setEmailInitialSubTab] = useState<'templates' | 'settings' | 'outbox' | 'maintenance'>('templates');
  const [unreadReleaseNotesCount, setUnreadReleaseNotesCount] = useState<number>(0);

  const fetchUnreadReleaseNotesCount = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await api.getUnreadReleaseNotesCount(currentUser.id);
      if (res.success) {
        setUnreadReleaseNotesCount(res.count);
      }
    } catch (err) {
      console.warn('Failed to fetch unread release count:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchUnreadReleaseNotesCount();
    }
  }, [currentUser?.id]);

  const handleOpenEmailAndSmtpHub = () => {
    setAppNavTab('emails');
  };

  const handleClearEmailLogs = () => {
    setEmailLogs([]);
    try {
      localStorage.removeItem('pcs_email_logs_v2');
    } catch (e) {
      console.warn('Failed to clear email logs from localStorage:', e);
    }
  };

  // Compute pending counts for badge numbers
  const pendingHodCount = currentUser
    ? changeRequests.filter(
        (cr) => cr.departmentId === currentUser.departmentId && cr.status === 'Pending HOD Approval'
      ).length
    : 0;

  const pendingItCount = changeRequests.filter(
    (cr) => cr.status === 'Pending IT Admin Review' || cr.status === 'Pending IT Verification'
  ).length;

  const assignedDevCount = currentUser
    ? changeRequests.filter(
        (cr) => cr.assignedDeveloperId === currentUser.id && cr.status === 'In Progress'
      ).length
    : 0;

  // Handlers for authentication and user sessions
  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('pcs_current_user_v2', JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save current user:', e);
    }

    // Immediately re-sync change requests and users from PostgreSQL on login/switch
    api.getChangeRequests({ id: user.id, role: user.role, departmentId: user.departmentId }).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeCr);
        setChangeRequests(normalized);
      }
    }).catch(() => {});

    api.getUsers().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setUsers(res.data);
      }
    }).catch(() => {});

    if (user.role === 'Department HOD') setAppNavTab('hod');
    else if (user.role === 'IT Admin' || user.role === 'IT Helpdesk') setAppNavTab('itadmin');
    else if (user.role === 'Software Developer') setAppNavTab('dev');
    else if (user.role === 'System Admin') setAppNavTab('admin');
    else setAppNavTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('pcs_current_user_v2');
    } catch (e) {
      console.error('Failed to remove current user:', e);
    }
    setShowLoginModal(true);
  };

  const handleRegisterUser = async (newUser: UserProfile): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    const matchedDept = departments.find((d) => d.id === newUser.departmentId) || departments[0];
    const userToRegister: UserProfile = {
      ...newUser,
      departmentId: matchedDept.id,
      departmentName: matchedDept.name,
      status: 'Pending IT Approval',
      mustChangePassword: false,
      registeredAt: getMalaysianTimestamp(),
    };

    let savedUser = userToRegister;
    let apiSuccess = false;
    let apiMessage = '';

    try {
      const res = await api.registerUser(userToRegister);
      if (res.success && res.user) {
        savedUser = {
          ...userToRegister,
          ...res.user,
          departmentName: res.user.departmentName || matchedDept.name,
        };
        apiSuccess = true;
        apiMessage = res.message || 'Account successfully registered and saved in PostgreSQL database (Pending IT Approval).';
      } else {
        apiSuccess = false;
        apiMessage = res.message || 'Database write failed. Check PostgreSQL connection.';
        console.error('[DB Register User Error]', apiMessage);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      apiSuccess = false;
      apiMessage = `Database connection failed: ${msg}`;
      console.warn('[DB Register User Notice]', msg);
    }

    const updatedUsers = [savedUser, ...users.filter((u) => u.id !== savedUser.id && u.email.toLowerCase() !== savedUser.email.toLowerCase())];
    handleUpdateUsers(updatedUsers);

    // IT notification & Email (Alert IT Admin ONLY - no credentials sent to user at this stage)
    const itNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: 'user-it-admin',
      title: 'New Account Registration Pending Approval',
      message: `New user registration submitted by ${savedUser.fullName} (${savedUser.email}, ${savedUser.departmentName}). Review and approve in System Administration.`,
      createdAt: getMalaysianTimestamp(),
      read: false,
    };
    setNotifications((prev) => [itNotif, ...prev]);

    const adminPendingAlert = createNewUserRegisteredPendingAdminEmail(
      savedUser,
      'IT@tanaka.com.my',
      smtpConfig
    );
    dispatchEmailLog(adminPendingAlert);

    return { success: apiSuccess, message: apiMessage, user: savedUser };
  };

  const handleRequestPasswordResetOtp = (email: string) => {
    const targetUser = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!targetUser) {
      return { success: false, message: `No account found with email "${email}".` };
    }
    const code = generateVerificationOtp();

    // 1. Dispatch official OTP verification email with Login button
    const otpEmailLog = createPasswordResetOtpEmail(targetUser, code, smtpConfig);
    dispatchEmailLog(otpEmailLog);

    // 2. Persist OTP token to PostgreSQL with identical code
    api.requestPasswordResetOtp(email, code).catch(() => {});

    return { success: true, message: `OTP code sent to ${email}`, otpCode: code, targetUser };
  };

  const handleCompletePasswordReset = (userId: string, newPassword: string) => {
    const targetUser = users.find((u) => u.id === userId);

    api.completePasswordReset(userId, newPassword).catch(() => {});
    const updated = users.map((u) => (u.id === userId ? { ...u, password: newPassword, mustChangePassword: false } : u));
    handleUpdateUsers(updated);

    // Dispatch security confirmation email
    if (targetUser) {
      const confirmEmail = createPasswordChangedConfirmationEmail(targetUser, 'Self-Reset', smtpConfig);
      dispatchEmailLog(confirmEmail);
    }
  };

  const handleCreateOrUpdateRequest = async (requestData: Partial<ChangeRequest>, isDraft: boolean): Promise<boolean> => {
    const isEdit = !!requestData.id;
    const now = getMalaysianTimestamp();

    if (isEdit && requestData.id) {
      const targetCrId = requestData.id;
      const existingCr = changeRequests.find((cr) => cr.id === targetCrId);
      const isCritical = (requestData.priority === 'Critical') || (!requestData.priority && existingCr?.priority === 'Critical');
      const isAlreadyHodApproved = !!(
        existingCr?.hodApprovedAt ||
        existingCr?.hodApprovedBy ||
        existingCr?.returnedByRole === 'IT Admin' ||
        existingCr?.returnedByRole === 'Software Developer' ||
        existingCr?.itClarificationRequested
      );
      const isAssignedToDev = !!(existingCr?.assignedDeveloperId);

      const newStatus: RequestStatus = isDraft
        ? 'Draft'
        : isCritical || isAlreadyHodApproved
        ? (isAssignedToDev ? 'In Progress' : 'Pending IT Admin Review')
        : 'Pending HOD Approval';

      const decisionLabel = isDraft
        ? 'Submitted'
        : isCritical
        ? 'HOD Bypassed (Critical)'
        : isAlreadyHodApproved
        ? isAssignedToDev
          ? 'Clarification Provided to Developer'
          : 'Clarification Provided to IT Admin'
        : 'Submitted';

      const clarificationText = requestData.clarificationReply
        ? `Requester Response: "${requestData.clarificationReply}". `
        : '';

      const auditComment = isDraft
        ? 'Saved changes as draft.'
        : isCritical
        ? isAssignedToDev
          ? `${clarificationText}Critical Priority Request: Bypassed HOD approval and returned directly to assigned IT staff ${existingCr?.assignedDeveloperName}.`
          : `${clarificationText}Critical Priority Request: Automatically bypassed Department HOD approval and routed directly to IT Admin`
        : isAlreadyHodApproved
        ? isAssignedToDev
          ? `${clarificationText}Clarification provided. Returned directly to assigned IT staff ${existingCr?.assignedDeveloperName}.`
          : `${clarificationText}Clarification provided. Returned to IT Admin queue.`
        : `${clarificationText}Resubmitted`;

      const newHistory: ApprovalHistoryEntry = {
        id: `hist-${Date.now()}`,
        changeRequestId: targetCrId,
        actorUserId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        actionDate: now,
        fromStatus: existingCr?.status || 'Draft',
        toStatus: newStatus,
        decision: decisionLabel as any,
        comments: auditComment,
      };

      const additionalPausedHours = existingCr?.slaPausedAt
        ? Math.max(0, Math.round((new Date(now).getTime() - new Date(existingCr.slaPausedAt).getTime()) / (1000 * 60 * 60)))
        : 0;
      const newTotalPausedHours = (existingCr?.totalSlaPausedHours || 0) + additionalPausedHours;

      const updatePayload = {
        ...requestData,
        status: newStatus,
        slaTargetHours: getPrioritySlaHours(requestData.priority || existingCr?.priority || 'Medium'),
        hodApprovalSkipped: !isDraft && isCritical ? true : existingCr?.hodApprovalSkipped,
        hodSkipReason: !isDraft && isCritical ? 'Critical Priority Direct-Route to IT (Emergency)' : existingCr?.hodSkipReason,
        returnedByRole: null,
        itClarificationRequested: false,
        slaPausedAt: null,
        totalSlaPausedHours: newTotalPausedHours,
        reminderCount: 0,
        lastReminderSentAt: null,
        lastReminderStage: null,
        newApprovalHistoryEntry: newHistory,
      };

      const res = await api.updateChangeRequest(targetCrId, updatePayload);
      if (!res.success || !res.data) {
        alert(`Failed to update change request in PostgreSQL database: ${res.message || 'Unknown database error'}`);
        return false;
      }

      const updatedRecord = normalizeCr(res.data);
      setChangeRequests((prev) => prev.map((item) => (item.id === targetCrId ? updatedRecord : item)));

      if (!isDraft) {
        const targetDept = departments.find((d) => d.id === currentUser.departmentId) || departments[0];
        const targetHodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';
        const targetHodName = targetDept?.hodName || 'Loh Pui Ling (Ms. Astrid)';

        if (isCritical || isAlreadyHodApproved) {
          const devUser = existingCr?.assignedDeveloperId ? users.find((u) => u.id === existingCr.assignedDeveloperId) : undefined;
          const devEmail = devUser?.email || 'alex.chen@company.com';

          const recipientEmails = isAssignedToDev
            ? `${devEmail}; ${currentUser.email}; ${targetHodEmail}`
            : `TEMIT@tanaka.com.my; ${currentUser.email}; ${targetHodEmail}`;

          const emailLog = createStateTransitionEmail({
            changeRequestId: targetCrId,
            requestTitle: requestData.title || existingCr?.title || 'Untitled Request',
            recipientEmail: recipientEmails,
            recipientName: isAssignedToDev
              ? `${existingCr?.assignedDeveloperName || 'Developer'} & ${currentUser.fullName}`
              : `IT Admin Team & ${currentUser.fullName}`,
            previousStatus: existingCr?.status || 'Returned to Requester',
            newStatus: newStatus,
            actionTaken: isCritical
              ? (isAssignedToDev ? `CRITICAL EMERGENCY: Returned Directly to Dev (${existingCr?.assignedDeveloperName})` : 'CRITICAL EMERGENCY: HOD Approval Bypassed')
              : (isAssignedToDev ? `Clarification Provided — Returned to Developer (${existingCr?.assignedDeveloperName})` : 'Clarification Provided — Returned to IT Admin'),
            actorName: currentUser.fullName,
            comments: isAssignedToDev
              ? `Clarification provided by Requester. HOD approval is already on file; routed directly to assigned developer ${existingCr?.assignedDeveloperName} as In Progress.`
              : 'Clarification provided by Requester. HOD approval is already on file; routed directly to IT Admin for developer assignment.',
            smtpConfig,
          });
          dispatchEmailLog(emailLog);

          if (isAssignedToDev && existingCr?.assignedDeveloperId) {
            const devNotif: NotificationItem = {
              id: `notif-${Date.now()}`,
              userId: existingCr.assignedDeveloperId,
              title: 'Clarification Provided (In Progress)',
              message: `CR ${targetCrId} (${requestData.title || existingCr.title}): ${currentUser.fullName} has provided the requested technical details. Ticket is active in your In Progress workbench.`,
              createdAt: now,
              read: false,
              changeRequestId: targetCrId,
            };
            setNotifications((prev) => [devNotif, ...prev]);
          } else {
            const itNotif: NotificationItem = {
              id: `notif-${Date.now()}`,
              userId: 'user-it-admin',
              title: 'Clarified Request Returned to IT',
              message: `CR ${targetCrId} (${requestData.title || existingCr?.title}): ${currentUser.fullName} provided clarification. HOD approval on file; ready for developer assignment.`,
              createdAt: now,
              read: false,
              changeRequestId: targetCrId,
            };
            setNotifications((prev) => [itNotif, ...prev]);
          }
        } else {
          const recipientEmails = targetHodEmail;

          const emailLog = createStateTransitionEmail({
            changeRequestId: targetCrId,
            requestTitle: requestData.title || existingCr?.title || 'Untitled Request',
            recipientEmail: recipientEmails,
            recipientName: targetHodName,
            previousStatus: existingCr?.status || 'Returned to Requester',
            newStatus: 'Pending HOD Approval',
            actionTaken: 'Submitted for HOD Approval',
            actorName: currentUser.fullName,
            actorRole: 'Requester',
            comments: 'Change Request revised and submitted for Department HOD authorization.',
            smtpConfig,
          });
          dispatchEmailLog(emailLog);

          const targetHodUserId = targetDept?.hodUserId || 'user-hod-prod';
          const newNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            userId: targetHodUserId,
            title: 'HOD Approval Required',
            message: `CR ${targetCrId} (${requestData.title || existingCr?.title}) submitted by ${currentUser.fullName}. Automated SMTP Email dispatched to HOD: ${targetHodName} <${targetHodEmail}>.`,
            createdAt: now,
            read: false,
            changeRequestId: targetCrId,
          };

          setNotifications((prev) => [newNotif, ...prev]);
        }
      }

      setEditingCr(null);
      setAppNavTab('myrequests');
    } else {
      // New change request creation
      const isCritical = requestData.priority === 'Critical';
      const newStatus: RequestStatus = isDraft
        ? 'Draft'
        : isCritical
        ? 'Pending IT Admin Review'
        : 'Pending HOD Approval';

      const decisionLabel = isDraft
        ? 'Submitted'
        : isCritical
        ? 'HOD Bypassed (Critical)'
        : 'Submitted';

      const auditComment = isDraft
        ? 'Initial draft saved.'
        : isCritical
        ? 'Critical Priority Request: Automatically bypassed Department HOD approval and routed directly to IT Admin for urgent triage (monitored in HOD dashboard).'
        : 'Submitted for HOD Approval.';

      const initialHistory: ApprovalHistoryEntry = {
        id: `hist-${Date.now()}`,
        changeRequestId: '',
        actorUserId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        actionDate: now,
        fromStatus: 'Draft',
        toStatus: newStatus,
        decision: decisionLabel as any,
        comments: auditComment,
      };

      const newCrPayload: Partial<ChangeRequest> = {
        title: requestData.title || 'Untitled Request',
        requesterId: currentUser.id,
        requesterName: currentUser.fullName,
        requesterEmail: currentUser.email,
        departmentId: currentUser.departmentId,
        departmentName: currentUser.departmentName,
        requestType: requestData.requestType || 'Enhancement',
        priority: requestData.priority || 'Medium',
        slaTargetHours: getPrioritySlaHours(requestData.priority || 'Medium'),
        hodApprovalSkipped: !isDraft && isCritical,
        hodSkipReason: !isDraft && isCritical ? 'Critical Priority Direct-Route to IT Admin (Emergency)' : undefined,
        categoryId: requestData.categoryId || 'cat-biz-apps',
        categoryName: requestData.categoryName || requestData.category || 'Business Applications',
        category: requestData.category || 'Business Applications',
        serviceId: requestData.serviceId || 'srv-biz-prod',
        serviceName: requestData.serviceName || requestData.subcategory || 'Production System',
        subcategory: requestData.subcategory || 'Production System',
        applicationAssetId: requestData.applicationAssetId || 'app-pcs-net',
        applicationAssetName: requestData.applicationAssetName || requestData.applicationName || 'PCS.NET',
        applicationName: requestData.applicationName || 'PCS.NET',
        assetTag: requestData.assetTag,
        issueTypeId: requestData.issueTypeId || 'issue-incident',
        issueTypeName: requestData.issueTypeName || requestData.issueType || 'Incident',
        issueType: requestData.issueType || 'Incident',
        applicationAreas: requestData.applicationAreas || [],
        affectedModules: requestData.affectedModules || [],
        currentBehaviorDescription: requestData.currentBehaviorDescription || '',
        requestedChangeDescription: requestData.requestedChangeDescription || '',
        businessJustification: requestData.businessJustification || '',
        attachments: requestData.attachments || [],
        requestedCompletionDate: requestData.requestedCompletionDate || now,
        status: newStatus,
        approvalHistory: [initialHistory],
      };

      // Persist directly to PostgreSQL database
      const res = await api.createChangeRequest(newCrPayload);
      if (!res.success || !res.data) {
        alert(`Failed to save change request to PostgreSQL database: ${res.message || 'Unknown database error'}`);
        return false;
      }

      const persistedRecord = normalizeCr(res.data);
      const targetCrId = persistedRecord.id;

      // Update React state strictly with the confirmed PostgreSQL persisted record
      setChangeRequests((prev) => [persistedRecord, ...prev]);

      if (!isDraft && targetCrId) {
        const targetDept = departments.find((d) => d.id === currentUser.departmentId) || departments[0];
        const targetHodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';
        const targetHodName = targetDept?.hodName || 'Loh Pui Ling (Ms. Astrid)';

        if (isCritical) {
          // Critical Priority HOD Bypass Email & Notifications
          const emailLog = createStateTransitionEmail({
            changeRequestId: targetCrId,
            requestTitle: requestData.title || 'Untitled Request',
            recipientEmail: `TEMIT@tanaka.com.my; ${currentUser.email}; ${targetHodEmail}`,
            recipientName: `IT Admin Team & ${currentUser.fullName}`,
            previousStatus: 'New Request',
            newStatus: 'Pending IT Admin Review',
            actionTaken: 'CRITICAL EMERGENCY: HOD Approval Bypassed',
            actorName: currentUser.fullName,
            comments: 'Critical Priority Change Request submitted. Department HOD approval bypassed for immediate IT emergency triage. Monitored in HOD dashboard.',
            smtpConfig,
          });
          dispatchEmailLog(emailLog);

          const itNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            userId: 'user-it-admin',
            title: '⚡ URGENT: Critical Request Bypassed HOD',
            message: `CR ${targetCrId} (${requestData.title || 'Untitled'}) submitted with Critical Priority by ${currentUser.fullName}. HOD approval bypassed; immediate IT triage required.`,
            createdAt: now,
            read: false,
            changeRequestId: targetCrId,
          };

          const hodNotif: NotificationItem = {
            id: `notif-${Date.now() + 1}`,
            userId: targetDept?.hodUserId || 'user-hod-prod',
            title: '⚡ Critical Request Alert (HOD Monitored)',
            message: `CR ${targetCrId} (${requestData.title || 'Untitled'}) by ${currentUser.fullName} bypassed HOD approval due to Critical Priority. Visible in HOD dashboard for real-time monitoring.`,
            createdAt: now,
            read: false,
            changeRequestId: targetCrId,
          };

          setNotifications((prev) => [itNotif, hodNotif, ...prev]);
        } else {
          // Standard first-time submission to HOD (sent strictly to HOD for approval)
          const emailLog = createStateTransitionEmail({
            changeRequestId: targetCrId,
            requestTitle: requestData.title || 'Untitled Request',
            recipientEmail: targetHodEmail,
            recipientName: targetHodName,
            previousStatus: 'New Request',
            newStatus: 'Pending HOD Approval',
            actionTaken: 'Submitted for HOD Approval',
            actorName: currentUser.fullName,
            actorRole: 'Requester',
            comments: 'Change Request submitted for Department HOD authorization.',
            smtpConfig,
          });
          dispatchEmailLog(emailLog);

          const targetHodUserId = targetDept?.hodUserId || 'user-hod-prod';
          const newNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            userId: targetHodUserId,
            title: 'HOD Approval Notification Sent',
            message: `CR ${targetCrId} submitted by ${currentUser.fullName}. Automated SMTP Email dispatched to HOD: ${targetHodName} <${targetHodEmail}>.`,
            createdAt: now,
            read: false,
            changeRequestId: targetCrId,
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }
      }

      setEditingCr(null);
      setAppNavTab('myrequests');
    }

    return true;
  };

  const handleProcessHodApproval = (
    crId: string,
    decision: 'Approve' | 'Reject' | 'SendBack',
    comments: string
  ) => {
    const now = getMalaysianTimestamp();
    const delegationCtx = getUserDelegationContext(currentUser, delegations);

    const targetCr = changeRequests.find((c) => c.id === crId);
    const hasAssignedDev = !!(targetCr?.assignedDeveloperId);

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        let newStatus: RequestStatus;
        if (decision === 'Approve') {
          // If developer was already assigned to this case, route straight to In Progress for that developer!
          // Should NOT go to IT Admin review queue.
          newStatus = hasAssignedDev ? 'In Progress' : 'Pending IT Admin Review';
        } else if (decision === 'Reject') {
          newStatus = 'Closed (Rejected)';
        } else {
          newStatus = 'Returned to Requester';
        }

        const actorRole = delegationCtx.hasActiveDelegation ? 'Acting Department HOD' : 'Department HOD';
        const actorName = delegationCtx.hasActiveDelegation
          ? `${currentUser.fullName} (Acting HOD for ${delegationCtx.delegatedByHodName})`
          : currentUser.fullName;

        const auditDecisionComment = decision === 'Approve' && hasAssignedDev
          ? `[HOD Re-Approval] Approved by ${actorName}. Pre-assigned to developer ${cr.assignedDeveloperName}; dispatched straight to developer active task board.`
          : comments;

        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: actorName,
          actorRole: actorRole,
          actionDate: now,
          fromStatus: cr.status,
          toStatus: newStatus,
          decision: decision === 'Approve' ? 'Approved' : decision === 'Reject' ? 'Rejected' : 'Sent Back',
          comments: auditDecisionComment,
        };

        // Dispatch Automated SMTP Email Notification
        if (decision === 'Approve') {
          if (hasAssignedDev && cr.assignedDeveloperId) {
            const devUser = users.find((u) => u.id === cr.assignedDeveloperId);
            const devEmail = devUser?.email || 'alex.chen@company.com';

            const emailLog = createStateTransitionEmail({
              changeRequestId: cr.id,
              requestTitle: cr.title,
              recipientEmail: `${devEmail}; ${cr.requesterEmail}`,
              recipientName: `${cr.assignedDeveloperName} & ${cr.requesterName}`,
              previousStatus: cr.status,
              newStatus: 'In Progress',
              actionTaken: `HOD Approved — Routed Straight to Assigned Developer (${cr.assignedDeveloperName})`,
              actorName: currentUser.fullName,
              comments: `HOD / Acting HOD ${actorName} authorized the revised change request. As a software developer was already assigned, this case is dispatched straight to ${cr.assignedDeveloperName}'s workbench for development.`,
              smtpConfig,
            });
            dispatchEmailLog(emailLog);

            // Direct Notification to Assigned Developer
            const devNotif: NotificationItem = {
              id: `notif-${Date.now()}`,
              userId: cr.assignedDeveloperId,
              title: '⚡ Clarified CR Approved by HOD (Active in your board)',
              message: `CR ${cr.id} (${cr.title}) has been re-approved by ${actorName}. It is now In Progress on your developer task board.`,
              createdAt: now,
              read: false,
              changeRequestId: cr.id,
            };

            // Notification to Requester
            const reqNotif: NotificationItem = {
              id: `notif-${Date.now() + 1}`,
              userId: cr.requesterId,
              title: 'CR Re-Approved by HOD',
              message: `Your CR ${cr.id} was approved by ${actorName} and dispatched straight to assigned developer ${cr.assignedDeveloperName} for implementation.`,
              createdAt: now,
              read: false,
              changeRequestId: cr.id,
            };

            // Notification to IT Admin
            const itAdminNotif: NotificationItem = {
              id: `notif-${Date.now() + 2}`,
              userId: 'user-it-admin',
              title: `CR Re-Approved by HOD (Direct to ${cr.assignedDeveloperName})`,
              message: `CR ${cr.id} re-approved by ${actorName} and returned straight to assigned developer ${cr.assignedDeveloperName}.`,
              createdAt: now,
              read: false,
              changeRequestId: cr.id,
            };

            setNotifications([devNotif, reqNotif, itAdminNotif, ...notifications]);
          } else {
            // No developer assigned yet -> IT Admin Review queue
            const emailLog = createStateTransitionEmail({
              changeRequestId: cr.id,
              requestTitle: cr.title,
              recipientEmail: 'TEMIT@tanaka.com.my',
              recipientName: 'IT Admin Team',
              previousStatus: cr.status,
              newStatus: 'Pending IT Admin Review',
              actionTaken: 'HOD Approved — Sent to IT Admin for Assignment',
              actorName: currentUser.fullName,
              actorRole: actorRole,
              comments,
              smtpConfig,
            });
            dispatchEmailLog(emailLog);

            const itNotif: NotificationItem = {
              id: `notif-${Date.now()}`,
              userId: 'user-it-admin',
              title: 'HOD Approved Change Request',
              message: `CR ${cr.id} (${cr.title}) approved by ${actorName}. Awaiting developer assignment.`,
              createdAt: now,
              read: false,
              changeRequestId: cr.id,
            };

            const reqNotif: NotificationItem = {
              id: `notif-${Date.now() + 1}`,
              userId: cr.requesterId,
              title: 'HOD Approved Request',
              message: `Your CR ${cr.id} was approved by ${actorName} and sent to IT Admin for developer assignment.`,
              createdAt: now,
              read: false,
              changeRequestId: cr.id,
            };

            setNotifications([itNotif, reqNotif, ...notifications]);
          }
        } else {
          // Reject or Send Back
          const emailLog = createStateTransitionEmail({
            changeRequestId: cr.id,
            requestTitle: cr.title,
            recipientEmail: cr.requesterEmail,
            recipientName: cr.requesterName,
            previousStatus: cr.status,
            newStatus,
            actionTaken: `HOD Decision: ${decision}`,
            actorName: currentUser.fullName,
            comments,
            smtpConfig,
          });
          dispatchEmailLog(emailLog);

          const reqNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            userId: cr.requesterId,
            title: decision === 'Reject' ? 'Change Request Rejected by HOD' : 'Change Request Returned by HOD',
            message: `CR ${cr.id} was ${decision === 'Reject' ? 'rejected' : 'returned for clarification'} by ${actorName}: "${comments}".`,
            createdAt: now,
            read: false,
            changeRequestId: cr.id,
          };
          setNotifications([reqNotif, ...notifications]);
        }

        return {
          ...cr,
          status: newStatus,
          hodApprovedAt: decision === 'Approve' ? (cr.hodApprovedAt || now) : cr.hodApprovedAt,
          hodApprovedBy: decision === 'Approve' ? currentUser.fullName : cr.hodApprovedBy,
          returnedByRole: decision === 'SendBack' ? 'Department HOD' : undefined,
          itClarificationRequested: decision === 'Approve' ? false : cr.itClarificationRequested,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist HOD approval decision to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: targetUpdated.status,
        hodApprovedAt: targetUpdated.hodApprovedAt,
        hodApprovedBy: targetUpdated.hodApprovedBy,
        returnedByRole: targetUpdated.returnedByRole || null,
        itClarificationRequested: targetUpdated.itClarificationRequested,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Process HOD Notice]', err));
    }
  };

  // IT Staff (IT Admin, Developer, System Admin) Return to Requester for Clarification
  const handleItSendBackToRequester = (crId: string, comments: string) => {
    const now = getMalaysianTimestamp();
    const actorRoleTitle = currentUser.role === 'Software Developer' ? 'Software Developer' : currentUser.role === 'System Admin' ? 'System Admin' : currentUser.role === 'IT Helpdesk' ? 'IT Helpdesk' : 'IT Admin';

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          actionDate: now,
          fromStatus: cr.status,
          toStatus: 'Returned to Requester',
          decision: 'Returned for Clarification',
          comments: comments || `${actorRoleTitle} (${currentUser.fullName}) requested additional technical details/clarification from requester.`,
        };

        // Find HOD for Department
        const targetDept = departments.find((d) => d.id === cr.departmentId);
        const hodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';
        const hodName = targetDept?.hodName || 'Department HOD';

        // Dispatch Email directly to Requester
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: cr.requesterEmail,
          recipientName: cr.requesterName,
          previousStatus: cr.status,
          newStatus: 'Returned to Requester',
          actionTaken: `IT Clarification Requested by ${currentUser.fullName} (${actorRoleTitle})`,
          actorName: currentUser.fullName,
          actorRole: actorRoleTitle,
          comments: `${actorRoleTitle} notes: ${comments}. (SLA Timer is paused until your response).`,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        // Notifications
        const reqNotif: NotificationItem = {
          id: `notif-${Date.now()}`,
          userId: cr.requesterId,
          title: `⚠️ Action Required: IT Requested Details (${actorRoleTitle})`,
          message: `${currentUser.fullName} (${actorRoleTitle}) requested clarification on ${cr.id}: "${comments}". SLA timer is paused until you reply.`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        const hodNotif: NotificationItem = {
          id: `notif-${Date.now() + 1}`,
          userId: targetDept?.hodUserId || 'user-hod-prod',
          title: 'Audit Notice: IT Sent Back to Requester',
          message: `IT staff ${currentUser.fullName} (${actorRoleTitle}) returned ${cr.id} (${cr.title}) to requester for technical clarification.`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        setNotifications([reqNotif, hodNotif, ...notifications]);

        return {
          ...cr,
          status: 'Returned to Requester' as RequestStatus,
          returnedByRole: actorRoleTitle as any,
          itClarificationRequested: true,
          slaPausedAt: now,
          reminderCount: 0,
          lastReminderSentAt: undefined,
          lastReminderStage: undefined,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist IT Return to Requester in PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: 'Returned to Requester',
        returnedByRole: actorRoleTitle,
        itClarificationRequested: true,
        slaPausedAt: now,
        reminderCount: 0,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Send Back Notice]', err));
    }
  };

  // 🔔 3-Stage Chase Policy Dispatcher
  const handleSendReminderNudge = (crId: string, stage: 1 | 2 | 3, customNote?: string) => {
    const now = getMalaysianTimestamp();
    const stageInfo = getChaseStageInfo(stage);
    const targetCr = changeRequests.find((c) => c.id === crId);
    if (!targetCr) return;

    const newReminderCount = (targetCr.reminderCount || 0) + 1;
    const history: ApprovalHistoryEntry = {
      id: `hist-${Date.now()}`,
      changeRequestId: crId,
      actorUserId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      actionDate: now,
      fromStatus: targetCr.status,
      toStatus: targetCr.status,
      decision: 'Reminder Sent (Chase Policy)',
      comments: customNote || `${stageInfo.shortBadge} (${stageInfo.title}) dispatched by ${currentUser.fullName}. Reminder #${newReminderCount}.`,
    };

    const targetDept = departments.find((d) => d.id === targetCr.departmentId);
    const hodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';

    const recipientEmails = stage >= 2
      ? `${targetCr.requesterEmail}; ${hodEmail}`
      : targetCr.requesterEmail;

    // Dispatch Email Notification
    const emailLog = createStateTransitionEmail({
      changeRequestId: targetCr.id,
      requestTitle: targetCr.title,
      recipientEmail: recipientEmails,
      recipientName: targetCr.requesterName,
      previousStatus: targetCr.status,
      newStatus: targetCr.status,
      actionTaken: `CHASE NOTICE [${stageInfo.shortBadge}]: Action Required`,
      actorName: currentUser.fullName,
      comments: customNote || `Action required on CR ${targetCr.id}. The resolution SLA timer is currently paused awaiting your response. Please review and provide the requested details.`,
      smtpConfig,
    });
    dispatchEmailLog(emailLog);

    // In-App Notification
    const reqNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: targetCr.requesterId,
      title: stage === 3 ? '🚨 FINAL NOTICE: CR Awaiting Clarification' : stage === 2 ? '⚠️ Urgent Reminder: Clarification Needed' : '🔔 Friendly Reminder: Clarification Needed',
      message: customNote || `CR ${targetCr.id} (${targetCr.title}) requires your clarification. SLA is paused. Please provide updates. (${stageInfo.shortBadge})`,
      createdAt: now,
      read: false,
      changeRequestId: targetCr.id,
    };
    setNotifications((prev) => [reqNotif, ...prev]);

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        return {
          ...cr,
          reminderCount: newReminderCount,
          lastReminderSentAt: now,
          lastReminderStage: stage,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });
    setChangeRequests(updated);

    api.updateChangeRequest(crId, {
      reminderCount: newReminderCount,
      lastReminderSentAt: now,
      lastReminderStage: stage,
      newApprovalHistoryEntry: history,
    }).catch((err) => console.warn('[DB Nudge Update]', err));
  };

  // 🚨 3-Strike Rule Auto-Withdrawal
  const handleAutoCloseInactive = (crId: string, reason: string) => {
    const now = getMalaysianTimestamp();
    const targetCr = changeRequests.find((c) => c.id === crId);
    if (!targetCr) return;

    const history: ApprovalHistoryEntry = {
      id: `hist-${Date.now()}`,
      changeRequestId: crId,
      actorUserId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      actionDate: now,
      fromStatus: targetCr.status,
      toStatus: 'Closed (Rejected)',
      decision: 'Auto-Closed (No Response)',
      comments: `Auto-withdrawn under 3-Strike Inactivity Policy: "${reason}". Seamlessly reopenable anytime by Requester or Admin.`,
    };

    const targetDept = departments.find((d) => d.id === targetCr.departmentId);
    const hodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';

    const emailLog = createStateTransitionEmail({
      changeRequestId: targetCr.id,
      requestTitle: targetCr.title,
      recipientEmail: `${targetCr.requesterEmail}; ${hodEmail}`,
      recipientName: `${targetCr.requesterName} & Department HOD`,
      previousStatus: targetCr.status,
      newStatus: 'Closed (Rejected)',
      actionTaken: 'Auto-Withdrawn (3-Strike Inactivity Policy)',
      actorName: `${currentUser.fullName} (IT Policy Automation)`,
      comments: reason,
      smtpConfig,
    });
    dispatchEmailLog(emailLog);

    const reqNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: targetCr.requesterId,
      title: 'CR Auto-Withdrawn (Inactivity Policy)',
      message: `CR ${targetCr.id} was auto-withdrawn due to 7+ days of inactivity without clarification. You can reopen this request at any time when ready.`,
      createdAt: now,
      read: false,
      changeRequestId: targetCr.id,
    };
    setNotifications((prev) => [reqNotif, ...prev]);

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        return {
          ...cr,
          status: 'Closed (Rejected)' as RequestStatus,
          isAutoClosedInactive: true,
          rejectionReason: reason,
          rejectedByName: `${currentUser.fullName} (3-Strike Auto-Policy)`,
          rejectedByRole: 'IT Admin' as any,
          rejectedAt: now,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });
    setChangeRequests(updated);

    api.updateChangeRequest(crId, {
      status: 'Closed (Rejected)',
      rejectionReason: reason,
      rejectedByName: `${currentUser.fullName} (3-Strike Auto-Policy)`,
      rejectedByRole: 'IT Admin',
      rejectedAt: now,
      newApprovalHistoryEntry: history,
    }).catch((err) => console.warn('[DB Auto-Close Update]', err));
  };

  const handleAssignDeveloper = (
    crId: string,
    developerId: string,
    developerName: string,
    targetDate: string,
    comments: string
  ) => {
    const now = getMalaysianTimestamp();

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          actionDate: now,
          fromStatus: cr.status,
          toStatus: 'In Progress',
          decision: 'Assigned',
          comments,
        };

        const devUser = users.find((u) => u.id === developerId);
        const devEmail = devUser?.email || 'sarah.dev@company.com';

        // Dispatch Automated SMTP Email
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: `${devEmail}; ${cr.requesterEmail}`,
          recipientName: `${developerName} & ${cr.requesterName}`,
          previousStatus: cr.status,
          newStatus: 'In Progress',
          actionTaken: `Assigned to ${developerName}`,
          actorName: currentUser.fullName,
          comments: `Assigned for development with target completion by ${targetDate}. Note: ${comments}`,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        return {
          ...cr,
          status: 'In Progress' as RequestStatus,
          assignedDeveloperId: developerId,
          assignedDeveloperName: developerName,
          targetCompletionDate: targetDate,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist developer assignment to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: 'In Progress',
        assignedDeveloperId: developerId,
        assignedDeveloperName: developerName,
        targetCompletionDate: targetDate,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Assign Dev Notice]', err));
    }
  };

  const handleUpdateDevStatus = (
    crId: string,
    newStatus: RequestStatus,
    techNotes: string,
    updatedRisk?: any,
    beforeChangeDetails?: string,
    afterChangeDetails?: string,
    hasCodeOrDatabaseChanges?: boolean
  ) => {
    const now = getMalaysianTimestamp();

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        const auditComment = [
          techNotes,
          beforeChangeDetails ? `[Before Changes]: ${beforeChangeDetails.substring(0, 100)}...` : '',
          afterChangeDetails ? `[After Changes]: ${afterChangeDetails.substring(0, 100)}...` : '',
        ].filter(Boolean).join(' | ') || `Status updated to ${newStatus}`;

        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: 'Software Developer',
          actionDate: now,
          fromStatus: cr.status,
          toStatus: newStatus,
          decision: 'Status Update',
          comments: auditComment,
        };

        // Dispatch Automated SMTP Email Notification
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: cr.requesterEmail,
          recipientName: cr.requesterName,
          previousStatus: cr.status,
          newStatus,
          actionTaken: `Development Status Updated to ${newStatus}`,
          actorName: currentUser.fullName,
          comments: techNotes || 'Development work complete, ready for IT Release Verification.',
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        return {
          ...cr,
          status: newStatus,
          implementationNotes: techNotes,
          hasCodeOrDatabaseChanges: hasCodeOrDatabaseChanges !== undefined ? hasCodeOrDatabaseChanges : cr.hasCodeOrDatabaseChanges,
          beforeChangeDetails: beforeChangeDetails !== undefined ? beforeChangeDetails : cr.beforeChangeDetails,
          afterChangeDetails: afterChangeDetails !== undefined ? afterChangeDetails : cr.afterChangeDetails,
          riskAssessment: updatedRisk || cr.riskAssessment,
          updatedAt: now,
          actualCompletionDate: newStatus === 'Pending IT Verification' ? now.split(' ')[0] : cr.actualCompletionDate,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist developer status updates and technical notes to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: newStatus,
        implementationNotes: techNotes,
        hasCodeOrDatabaseChanges: targetUpdated.hasCodeOrDatabaseChanges,
        beforeChangeDetails: targetUpdated.beforeChangeDetails,
        afterChangeDetails: targetUpdated.afterChangeDetails,
        riskAssessment: targetUpdated.riskAssessment,
        actualCompletionDate: targetUpdated.actualCompletionDate,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Dev Status Update Notice]', err));
    }
  };

  const handleVerifyRelease = (crId: string, verified: boolean, comments: string) => {
    const now = getMalaysianTimestamp();

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        const newStatus: RequestStatus = verified ? 'Closed (Completed)' : 'In Progress';

        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: 'IT Admin',
          actionDate: now,
          fromStatus: cr.status,
          toStatus: newStatus,
          decision: verified ? 'Verified' : 'Rejected',
          comments,
        };

        // Dispatch Automated SMTP Email Notification
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: cr.requesterEmail,
          recipientName: cr.requesterName,
          previousStatus: cr.status,
          newStatus,
          actionTaken: verified ? 'Release Verified & Closed' : 'Verification Rejected - Returned to Dev',
          actorName: currentUser.fullName,
          comments,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        return {
          ...cr,
          status: newStatus,
          updatedAt: now,
          actualCompletionDate: verified ? now.split(' ')[0] : cr.actualCompletionDate,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist release verification to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: targetUpdated.status,
        actualCompletionDate: targetUpdated.actualCompletionDate,
        itVerifiedAt: now,
        itVerifiedBy: currentUser.fullName,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Verify Release Notice]', err));
    }
  };

  const handleItDirectModify = (payload: ItDirectModifyPayload) => {
    const now = getMalaysianTimestamp();
    const targetCategory = payload.categoryName || payload.category || '';
    const targetIssueType = payload.issueTypeName || payload.issueType;
    const targetApplication = payload.applicationAssetName || payload.applicationName;
    const targetSubcategory = payload.serviceName || payload.subcategory;

    const updated = changeRequests.map((cr) => {
      if (cr.id === payload.crId) {
        const priorityChanged = cr.priority !== payload.priority;
        const categoryChanged = targetCategory ? cr.category !== targetCategory : false;
        const developerChanged = (payload.assignedDeveloperId || '') !== (cr.assignedDeveloperId || '');

        // Build descriptive audit comment
        const changesList: string[] = [];
        if (priorityChanged) {
          changesList.push(`Priority: ${cr.priority} → ${payload.priority} (Reason: "${payload.priorityChangeReason}")`);
        }
        if (categoryChanged && targetCategory) {
          changesList.push(`Category: ${cr.category || 'N/A'} → ${targetCategory}`);
        }
        if (targetSubcategory && targetSubcategory !== cr.subcategory) {
          changesList.push(`Subcategory: ${targetSubcategory}`);
        }
        if (targetApplication && targetApplication !== cr.applicationName) {
          changesList.push(`Application: ${targetApplication}`);
        }
        if (targetIssueType && targetIssueType !== cr.issueType) {
          changesList.push(`Issue Type: ${targetIssueType}`);
        }
        if (developerChanged) {
          changesList.push(`Developer: ${cr.assignedDeveloperName || 'Unassigned'} → ${payload.assignedDeveloperName || 'Unassigned'}`);
        }
        if (payload.targetCompletionDate && payload.targetCompletionDate !== cr.targetCompletionDate) {
          changesList.push(`Target Date: ${payload.targetCompletionDate}`);
        }
        if (payload.comments) {
          changesList.push(`Comments: "${payload.comments}"`);
        }

        const history: ApprovalHistoryEntry = {
          id: `hist-it-mod-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role as any,
          actionDate: now,
          fromStatus: cr.status,
          toStatus: cr.status === 'Pending IT Admin Review' && payload.assignedDeveloperId ? 'In Progress' : cr.status,
          decision: 'IT Direct Modification',
          comments: `Direct IT Modification (No Approval Required): ${changesList.join(' | ')}`,
        };

        // Dispatch Automated SMTP Notification to Requester and Developer
        const emailLog = createItDirectModificationEmail({
          changeRequest: cr,
          actor: currentUser,
          oldCategory: cr.category,
          newCategory: targetCategory || cr.category,
          oldPriority: cr.priority,
          newPriority: payload.priority,
          priorityReason: payload.priorityChangeReason,
          oldDeveloperName: cr.assignedDeveloperName,
          newDeveloperName: payload.assignedDeveloperName,
          generalComments: payload.comments,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        // In-app notification for Requester
        const notif: NotificationItem = {
          id: `notif-itmod-${Date.now()}`,
          userId: cr.requesterId,
          title: `IT Adjusted CR-${cr.id} (${payload.priority} Priority)`,
          message: `IT Staff (${currentUser.fullName}) directly updated CR-${cr.id} category/priority. ${priorityChanged ? `Priority Reason: "${payload.priorityChangeReason}".` : ''} No action required.`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };
        setNotifications((prev) => [notif, ...prev]);

        const nextStatus: RequestStatus =
          cr.status === 'Pending IT Admin Review' && payload.assignedDeveloperId
            ? 'In Progress'
            : cr.status;

        const updatedCr: ChangeRequest = {
          ...cr,
          status: nextStatus,
          category: targetCategory || cr.category,
          subcategory: targetSubcategory || cr.subcategory,
          applicationName: targetApplication || cr.applicationName,
          issueType: targetIssueType || cr.issueType,
          priority: payload.priority,
          slaTargetHours: getPrioritySlaHours(payload.priority),
          priorityChangeReason: priorityChanged
            ? payload.priorityChangeReason
            : cr.priorityChangeReason,
          priorityChangedBy: priorityChanged ? currentUser.fullName : cr.priorityChangedBy,
          priorityChangedAt: priorityChanged ? now : cr.priorityChangedAt,
          categoryChangedBy: categoryChanged ? currentUser.fullName : cr.categoryChangedBy,
          categoryChangedAt: categoryChanged ? now : cr.categoryChangedAt,
          reassignedBy: developerChanged ? currentUser.fullName : cr.reassignedBy,
          reassignedAt: developerChanged ? now : cr.reassignedAt,
          assignedDeveloperId: payload.assignedDeveloperId !== undefined ? payload.assignedDeveloperId : cr.assignedDeveloperId,
          assignedDeveloperName: payload.assignedDeveloperName !== undefined ? payload.assignedDeveloperName : cr.assignedDeveloperName,
          targetCompletionDate: payload.targetCompletionDate || cr.targetCompletionDate,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };

        // Update modal state if open
        if (selectedCrForModal?.id === cr.id) {
          setSelectedCrForModal(updatedCr);
        }

        return updatedCr;
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist IT direct modifications to PostgreSQL database
    api.itDirectModify({ ...payload, actorUserId: currentUser.id, actorName: currentUser.fullName, actorRole: currentUser.role }).catch((err) => console.warn('[DB IT Direct Modify Notice]', err));
  };

  // IT Admin, System IT Admin, IT Staff, Developer, and HOD can reject a case or ticket
  const handleRejectCase = (crId: string, rejectionReason: string) => {
    const now = getMalaysianTimestamp();

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          actionDate: now,
          fromStatus: cr.status,
          toStatus: 'Closed (Rejected)',
          decision: 'Rejected',
          comments: rejectionReason || `Ticket rejected by ${currentUser.fullName}.`,
        };

        // Find HOD for Department
        const targetDept = departments.find((d) => d.id === cr.departmentId);
        const hodEmail = targetDept?.hodEmail || 'ASTRID@tanaka.com.my';

        // Dispatch Email Notification to Requester, CC HOD and IT Admin
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: `${cr.requesterEmail}; ${hodEmail}`,
          recipientName: `${cr.requesterName} & HOD`,
          previousStatus: cr.status,
          newStatus: 'Closed (Rejected)',
          actionTaken: `Case Rejected by ${currentUser.fullName}`,
          actorName: currentUser.fullName,
          comments: `Rejection Justification: ${rejectionReason}. Note: Case can only be reopened by a System Administrator.`,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        // Notifications
        const reqNotif: NotificationItem = {
          id: `notif-${Date.now()}`,
          userId: cr.requesterId,
          title: `❌ Change Request Rejected (${cr.id})`,
          message: `CR ${cr.id} (${cr.title}) was rejected by ${currentUser.fullName}: "${rejectionReason}".`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        const hodNotif: NotificationItem = {
          id: `notif-${Date.now() + 1}`,
          userId: targetDept?.hodUserId || 'user-hod-prod',
          title: `Audit Notice: CR ${cr.id} Rejected`,
          message: `${currentUser.fullName} rejected CR ${cr.id}. Reason: "${rejectionReason}".`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        setNotifications([reqNotif, hodNotif, ...notifications]);

        const updatedCr: ChangeRequest = {
          ...cr,
          status: 'Closed (Rejected)' as RequestStatus,
          rejectedByUserId: currentUser.id,
          rejectedByName: currentUser.fullName,
          rejectedByRole: currentUser.role,
          rejectedAt: now,
          rejectionReason: rejectionReason,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };

        if (selectedCrForModal?.id === cr.id) {
          setSelectedCrForModal(updatedCr);
        }

        return updatedCr;
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist ticket rejection to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: 'Closed (Rejected)',
        rejectedByUserId: currentUser.id,
        rejectedByName: currentUser.fullName,
        rejectedByRole: currentUser.role,
        rejectedAt: now,
        rejectionReason: rejectionReason,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Reject Case Notice]', err));
    }
  };

  // Reopen logic: Case can be reopened ONLY by System Admin and automatically routes to the person who rejected it!
  const handleReopenCase = (crId: string, reopenComments: string) => {
    if (currentUser.role !== 'System Admin') {
      alert('Permission Denied: Only a System Administrator can reopen a rejected case.');
      return;
    }

    const now = getMalaysianTimestamp();

    const updated = changeRequests.map((cr) => {
      if (cr.id === crId) {
        // Find rejecting actor information
        const historyList = Array.isArray(cr.approvalHistory) ? cr.approvalHistory : [];
        const rejectorUserId = cr.rejectedByUserId || (historyList.find((h) => h.decision === 'Rejected')?.actorUserId) || 'user-dev-1';
        const rejectorName = cr.rejectedByName || (historyList.find((h) => h.decision === 'Rejected')?.actorName) || 'Alex Chen';
        const rejectorRole = cr.rejectedByRole || (historyList.find((h) => h.decision === 'Rejected')?.actorRole) || 'Software Developer';

        // Determine destination status & assignments
        let targetStatus: RequestStatus = 'In Progress';
        let targetDevId = cr.assignedDeveloperId;
        let targetDevName = cr.assignedDeveloperName;

        if (rejectorRole === 'Software Developer') {
          targetStatus = 'In Progress';
          targetDevId = rejectorUserId;
          targetDevName = rejectorName;
        } else if (rejectorRole === 'IT Admin' || rejectorRole === 'System Admin') {
          targetStatus = 'Pending IT Admin Review';
        } else if (rejectorRole === 'Department HOD' || rejectorRole === 'Acting Department HOD') {
          targetStatus = 'Pending HOD Approval';
        } else {
          targetStatus = 'Pending IT Admin Review';
        }

        const history: ApprovalHistoryEntry = {
          id: `hist-${Date.now()}`,
          changeRequestId: cr.id,
          actorUserId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: 'System Admin',
          actionDate: now,
          fromStatus: 'Closed (Rejected)',
          toStatus: targetStatus,
          decision: 'Reopened',
          comments: reopenComments
            ? `[Reopened by System Admin] Case reopened by ${currentUser.fullName} and automatically routed to ${rejectorName} (${rejectorRole}). Instructions: ${reopenComments}`
            : `[Reopened by System Admin] Case reopened by ${currentUser.fullName} and automatically routed to ${rejectorName} (${rejectorRole}).`,
        };

        // Find rejector user profile
        const rejectorUser = users.find((u) => u.id === rejectorUserId || u.fullName === rejectorName);
        const rejectorEmail = rejectorUser?.email || 'sarah.dev@company.com';

        // Dispatch Email Notification to Rejector and Requester
        const emailLog = createStateTransitionEmail({
          changeRequestId: cr.id,
          requestTitle: cr.title,
          recipientEmail: `${rejectorEmail}; ${cr.requesterEmail}`,
          recipientName: `${rejectorName} & ${cr.requesterName}`,
          previousStatus: 'Closed (Rejected)',
          newStatus: targetStatus,
          actionTaken: `Case Reopened by System Admin (${currentUser.fullName})`,
          actorName: currentUser.fullName,
          comments: `Reopened by System Administrator ${currentUser.fullName} and automatically routed back to ${rejectorName} (${rejectorRole}). Instructions: ${reopenComments || 'Please resume investigation and resolution.'}`,
          smtpConfig,
        });
        dispatchEmailLog(emailLog);

        // Notifications
        const rejectorNotif: NotificationItem = {
          id: `notif-${Date.now()}`,
          userId: rejectorUserId,
          title: `🔄 Rejected Ticket Reopened by System Admin`,
          message: `System Admin ${currentUser.fullName} reopened CR ${cr.id} (${cr.title}) and automatically routed it back to your queue. Instructions: "${reopenComments || 'Resume development/review.'}"`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        const reqNotif: NotificationItem = {
          id: `notif-${Date.now() + 1}`,
          userId: cr.requesterId,
          title: `🔄 Change Request Reopened (${cr.id})`,
          message: `Your rejected CR ${cr.id} has been reopened by System Admin ${currentUser.fullName} and automatically returned to ${rejectorName} for resolution.`,
          createdAt: now,
          read: false,
          changeRequestId: cr.id,
        };

        setNotifications([rejectorNotif, reqNotif, ...notifications]);

        const updatedCr: ChangeRequest = {
          ...cr,
          status: targetStatus,
          assignedDeveloperId: targetDevId,
          assignedDeveloperName: targetDevName,
          reopenedByUserId: currentUser.id,
          reopenedByName: currentUser.fullName,
          reopenedAt: now,
          reopenComments: reopenComments,
          updatedAt: now,
          approvalHistory: [history, ...(cr.approvalHistory || [])],
        };

        if (selectedCrForModal?.id === cr.id) {
          setSelectedCrForModal(updatedCr);
        }

        return updatedCr;
      }
      return cr;
    });

    setChangeRequests(updated);

    // Persist reopened case to PostgreSQL database
    const targetUpdated = updated.find((c) => c.id === crId);
    if (targetUpdated && targetUpdated.approvalHistory && targetUpdated.approvalHistory.length > 0) {
      api.updateChangeRequest(crId, {
        status: targetUpdated.status,
        assignedDeveloperId: targetUpdated.assignedDeveloperId,
        assignedDeveloperName: targetUpdated.assignedDeveloperName,
        reopenedByUserId: currentUser.id,
        reopenedByName: currentUser.fullName,
        reopenedAt: now,
        reopenComments: reopenComments,
        newApprovalHistoryEntry: targetUpdated.approvalHistory[0],
      }).catch((err) => console.warn('[DB Reopen Case Notice]', err));
    }
  };

  const handleSendWelcomeEmail = (newUser: UserProfile) => {
    const emailLog = createWelcomeAccountEmail(newUser, smtpConfig);
    dispatchEmailLog(emailLog);
  };

  const handleApproveUser = async (userId: string, assignedDeptId?: number): Promise<{ success: boolean; verified?: boolean; message?: string; data?: UserProfile; database?: string }> => {
    const now = getMalaysianTimestamp();
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return { success: false, message: `User with ID "${userId}" not found in system records.` };

    // 1. Resolve Department: Ensure department ID and Name are valid and verified
    const targetDeptId = assignedDeptId || targetUser.departmentId;
    const targetDept = departments.find((d) => d.id === targetDeptId);
    if (!targetDept) {
      return {
        success: false,
        verified: false,
        message: `Cannot approve user: Department ID (${targetDeptId}) could not be resolved. Please assign a valid Tanaka department.`,
      };
    }

    if (!targetUser.fullName || !targetUser.email) {
      return {
        success: false,
        verified: false,
        message: 'Cannot approve user: Missing required full name or work email address.',
      };
    }

    try {
      // 2. Execute Real-Time Approval & Verification in PostgreSQL (Preserving user's registered password)
      const res = await api.approveUser(userId, {
        fullName: targetUser.fullName,
        email: targetUser.email,
        username: targetUser.username || targetUser.email.split('@')[0],
        departmentId: targetDept.id,
        departmentName: targetDept.name,
        role: targetUser.role || 'Requester',
      });

      if (!res.success || !res.verified) {
        throw new Error(res.message || 'PostgreSQL database rejected user approval.');
      }

      const approvedUser: UserProfile = {
        ...targetUser,
        ...(res.data || {}),
        status: 'Active',
        departmentId: targetDept.id,
        departmentName: targetDept.name,
        role: targetUser.role || 'Requester',
        password: targetUser.password,
        mustChangePassword: false,
      };

      const updatedUsers = users.map((u) => (u.id === userId ? approvedUser : u));
      handleUpdateUsers(updatedUsers);

      // 3. Send Official Account Approval Notification (With direct Login button)
      const approvalEmail = createUserApprovedEmail(
        approvedUser,
        currentUser?.fullName || 'IT Administration',
        smtpConfig
      );
      dispatchEmailLog(approvalEmail);

      // In-app Notification
      const notif: NotificationItem = {
        id: `notif-${Date.now()}`,
        userId: approvedUser.id,
        title: 'Account Approved & Activated',
        message: `Your Tanaka IT OPS account has been approved by IT Admin ${currentUser?.fullName || 'Administrator'}. You may now log in using your registered password.`,
        createdAt: now,
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);

      return {
        success: true,
        verified: true,
        database: res.database || 'PostgreSQL (IT_OPS)',
        data: approvedUser,
        message: `Account for "${approvedUser.fullName}" successfully approved and activated. Approval confirmation email dispatched to ${approvedUser.email}.`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Approval Action Error]', errorMsg);
      return { success: false, verified: false, message: errorMsg };
    }
  };

  const handleReassignDepartment = (userId: string, newDeptId: number) => {
    const now = getMalaysianTimestamp();
    const targetUser = users.find((u) => u.id === userId);
    const newDept = departments.find((d) => d.id === newDeptId);
    if (!targetUser || !newDept) return;

    const oldDeptName = targetUser.departmentName;

    const reassignedUser: UserProfile = {
      ...targetUser,
      departmentId: newDept.id,
      departmentName: newDept.name,
    };

    const updatedUsers = users.map((u) => (u.id === userId ? reassignedUser : u));
    handleUpdateUsers(updatedUsers);

    // Persist reassignment to PostgreSQL database
    api.updateUser(userId, {
      departmentId: newDept.id,
      departmentName: newDept.name,
    }).catch((err) => console.warn('[DB Department Reassign Notice]', err));

    // Send automated SMTP notification email to user
    const emailLog = createUserDepartmentReassignedEmail(
      reassignedUser,
      oldDeptName,
      newDept.name,
      newDept.hodName,
      currentUser.fullName,
      smtpConfig
    );
    dispatchEmailLog(emailLog);

    // Notification for user and HOD
    const userNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: reassignedUser.id,
      title: 'Department Reassigned',
      message: `Your department has been updated from ${oldDeptName} to ${newDept.name} (HOD: ${newDept.hodName}).`,
      createdAt: now,
      read: false,
    };

    const hodNotif: NotificationItem = {
      id: `notif-${Date.now() + 1}`,
      userId: newDept.hodUserId,
      title: 'New Department Member Assigned',
      message: `IT Admin ${currentUser.fullName} assigned ${reassignedUser.fullName} (${reassignedUser.email}) to your department (${newDept.name}).`,
      createdAt: now,
      read: false,
    };

    setNotifications([userNotif, hodNotif, ...notifications]);
  };

  const handleAdminResetPassword = (userId: string, newPassword: string, mustChangeOnNextLogin: boolean = true) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const updatedUser: UserProfile = {
      ...targetUser,
      password: newPassword,
      mustChangePassword: mustChangeOnNextLogin,
    };

    const updatedUsers = users.map((u) => (u.id === userId ? updatedUser : u));
    handleUpdateUsers(updatedUsers);

    // Persist password reset to PostgreSQL database
    api.updateUser(userId, {
      password: newPassword,
      mustChangePassword: mustChangeOnNextLogin,
    }).catch((err) => console.warn('[DB Password Reset Notice]', err));

    // Dispatch automated emergency reset email via SMTP
    const emailLog = createAdminEmergencyPasswordResetEmail(
      targetUser,
      newPassword,
      currentUser.fullName,
      mustChangeOnNextLogin,
      smtpConfig
    );
    dispatchEmailLog(emailLog);

    // Notification
    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: targetUser.id,
      title: 'Emergency Password Reset Issued',
      message: `Your account password was reset by IT Administrator ${currentUser.fullName}. Temporary credentials were dispatched to ${targetUser.email}.`,
      createdAt: getMalaysianTimestamp(),
      read: false,
    };
    setNotifications([notif, ...notifications]);
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(
      notifications.map((n) =>
        n.userId === currentUser?.id || !n.userId || n.userId === 'all'
          ? { ...n, read: true }
          : n
      )
    );
  };

  const handleOpenDetailModal = (crId: string) => {
    const target = changeRequests.find((cr) => cr.id === crId);
    if (target) setSelectedCrForModal(target);
  };

  // View title helper for top bar
  const getViewTitle = () => {
    const delegationCtx = getUserDelegationContext(currentUser, delegations);
    switch (appNavTab) {
      case 'dashboard':
        return currentUser.role === 'Software Developer' || currentUser.role === 'IT Admin' || currentUser.role === 'System Admin' || currentUser.role === 'IT Helpdesk'
          ? 'IT Dashboard'
          : `${currentUser.role} Dashboard`;
      case 'myrequests':
        return 'My Requests';
      case 'new':
        return editingCr ? `Edit Request: ${editingCr.id}` : 'New Request Page';
      case 'hod':
        return delegationCtx.hasActiveDelegation
          ? `⚡ ${delegationCtx.effectiveDepartmentName || 'Production'} Acting Approver Queue`
          : delegationCtx.hasExpiredDelegation && !delegationCtx.hasActiveDelegation
          ? `HOD Departmental Archive (Read-Only)`
          : 'HOD Departmental Approval Queue';
      case 'itadmin':
        return 'IT Admin Workspace';
      case 'dev':
        return 'Service Queue';
      case 'closed':
        return 'Closed Cases Archive & Completion Register';
      case 'admin':
        return 'System Administration';
      case 'reports':
        return 'SLA Performance';
      case 'emails':
        return 'Email Communications & Maintenance Announcements';
      case 'whatsnew':
        return "What's New & Release Notes";
      case 'howtouse':
        return 'How to use';
      default:
        return 'PCS Change Request Management System';
    }
  };

  const closedCasesCount = changeRequests.filter(
    (cr) => cr.status === 'Closed (Completed)' || cr.status === 'Closed (Rejected)'
  ).length;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <LoginModal
          isOpen={true}
          users={users}
          currentUser={null}
          departments={departments}
          smtpConfig={smtpConfig}
          onSelectUser={(user) => {
            handleSwitchUser(user);
            setShowLoginModal(false);
          }}
          onLoginUser={(user) => {
            handleSwitchUser(user);
            setShowLoginModal(false);
          }}
          onRegisterUser={handleRegisterUser}
          onRequestPasswordResetOtp={handleRequestPasswordResetOtp}
          onCompletePasswordReset={handleCompletePasswordReset}
          onClose={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans antialiased">
      {/* Sleek Dark Left Sidebar */}
      <Sidebar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeAppTab={appNavTab}
        onAppTabChange={(tab) => setAppNavTab(tab)}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onRequestClick={handleOpenDetailModal}
        onOpenNotificationsModal={() => setShowNotificationsModal(true)}
        pendingHodCount={pendingHodCount}
        pendingItCount={pendingItCount}
        assignedDevCount={assignedDevCount}
        closedCasesCount={closedCasesCount}
        onCreateNewRequest={() => {
          setEditingCr(null);
          setAppNavTab('new');
        }}
        onOpenSmtpConsole={() => {
          setEmailInitialSubTab('templates');
          setAppNavTab('emails');
        }}
        emailCount={emailLogs.length}
        users={users}
        delegations={delegations}
        customRoles={customRoles}
        unreadReleaseNotesCount={unreadReleaseNotesCount}
      />

      {/* Main Right Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Sleek Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{getViewTitle()}</h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Notification Bell in Top Bar */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center space-x-2"
              title="Open Notification Center"
              aria-label="Open Notification Center"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              <span className="hidden md:inline text-xs font-semibold text-slate-700">Notifications</span>
              {notifications.filter((n) => !n.read && (n.userId === currentUser.id || !n.userId || n.userId === 'all')).length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
                  {notifications.filter((n) => !n.read && (n.userId === currentUser.id || !n.userId || n.userId === 'all')).length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content Workspace Canvas */}
        <main className="flex-1 p-6">
          {appNavTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              changeRequests={changeRequests}
              onNavigateTab={(tab) => setAppNavTab(tab)}
              onRequestClick={handleOpenDetailModal}
              onEditRequest={(cr) => {
                setEditingCr(cr);
                setAppNavTab('new');
              }}
              onCreateNewRequest={() => {
                setEditingCr(null);
                setAppNavTab('new');
              }}
              delegations={delegations}
            />
          )}

          {appNavTab === 'myrequests' && (
            <MyRequestsView
              currentUser={currentUser}
              changeRequests={changeRequests}
              onRequestClick={handleOpenDetailModal}
              onEditRequest={(cr) => {
                setEditingCr(cr);
                setAppNavTab('new');
              }}
              onCreateNewRequest={() => {
                setEditingCr(null);
                setAppNavTab('new');
              }}
            />
          )}

          {appNavTab === 'new' && (
            <ChangeRequestForm
              key={editingCr?.id || 'new-cr-form'}
              currentUser={currentUser}
              initialData={editingCr}
              onSubmitRequest={handleCreateOrUpdateRequest}
              onCancel={() => {
                setEditingCr(null);
                setAppNavTab('myrequests');
              }}
              departments={departments}
              storageConfig={storageConfig}
              categories={categories}
              services={services}
              applications={applications}
              issueTypes={issueTypes}
              modules={modules}
              subFunctions={subFunctions}
              processes={processes}
            />
          )}

          {appNavTab === 'hod' && (
            <HodQueueView
              currentUser={currentUser}
              changeRequests={changeRequests}
              onProcessApproval={handleProcessHodApproval}
              onRequestClick={handleOpenDetailModal}
              delegations={delegations}
              onSaveDelegation={handleSaveDelegation}
              onRevokeDelegation={handleRevokeDelegation}
              users={users}
            />
          )}

          {appNavTab === 'itadmin' && (
            <ItAdminQueueView
              currentUser={currentUser}
              changeRequests={changeRequests}
              users={users}
              customRoles={customRoles}
              onAssignDeveloper={handleAssignDeveloper}
              onVerifyRelease={handleVerifyRelease}
              onSendBackToRequester={handleItSendBackToRequester}
              onItDirectModify={handleItDirectModify}
              onRejectCase={handleRejectCase}
              onRequestClick={handleOpenDetailModal}
            />
          )}

          {appNavTab === 'dev' && (
            <DeveloperKanbanView
              currentUser={currentUser}
              changeRequests={changeRequests}
              users={users}
              customRoles={customRoles}
              onUpdateDevStatus={handleUpdateDevStatus}
              onSendBackToRequester={handleItSendBackToRequester}
              onItDirectModify={handleItDirectModify}
              onRejectCase={handleRejectCase}
              onRequestClick={handleOpenDetailModal}
            />
          )}

          {appNavTab === 'closed' && (
            <ClosedCasesView
              currentUser={currentUser}
              changeRequests={changeRequests}
              onReopenCase={handleReopenCase}
              onRequestClick={handleOpenDetailModal}
            />
          )}

          {appNavTab === 'admin' && (
            <AdminUserMgmtView
              currentUser={currentUser}
              departments={departments}
              onUpdateDepartments={handleUpdateDepartments}
              users={users}
              onUpdateUsers={handleUpdateUsers}
              onSendWelcomeEmail={handleSendWelcomeEmail}
              onApproveUser={handleApproveUser}
              onReassignDepartment={handleReassignDepartment}
              onAdminResetPassword={handleAdminResetPassword}
              storageConfig={storageConfig}
              onUpdateStorageConfig={handleUpdateStorageConfig}
              changeRequests={changeRequests}
              categories={categories}
              onUpdateCategories={handleUpdateCategories}
              services={services}
              onUpdateServices={handleUpdateServices}
              applications={applications}
              onUpdateApplications={handleUpdateApplications}
              issueTypes={issueTypes}
              onUpdateIssueTypes={handleUpdateIssueTypes}
              modules={modules}
              onUpdateModules={handleUpdateModules}
              subFunctions={subFunctions}
              onUpdateSubFunctions={handleUpdateSubFunctions}
              processes={processes}
              onUpdateProcesses={handleUpdateProcesses}
              smtpConfig={smtpConfig}
              onUpdateSmtpConfig={handleUpdateSmtpConfig}
              emailLogs={emailLogs}
              onClearEmailLogs={handleClearEmailLogs}
              customRoles={customRoles}
              onUpdateCustomRoles={handleUpdateCustomRoles}
              initialAdminTab={adminInitialTab}
              onRequestClick={handleOpenDetailModal}
              onRequestViewWhatsNew={() => setAppNavTab('whatsnew')}
            />
          )}

          {appNavTab === 'whatsnew' && (
            <WhatsNewView
              currentUser={currentUser}
              onNavigateToAdminReleases={() => {
                setAdminInitialTab('releases');
                setAppNavTab('admin');
              }}
              onRefreshUnreadCount={fetchUnreadReleaseNotesCount}
            />
          )}

          {appNavTab === 'emails' && hasRolePermission(currentUser.role, 'canViewEmailHub', customRoles) && (
            <EmailContextTemplateAdminView
              currentUser={currentUser}
              smtpConfig={smtpConfig}
              onUpdateSmtpConfig={handleUpdateSmtpConfig}
              emailLogs={emailLogs}
              onClearEmailLogs={handleClearEmailLogs}
              initialSubTab={emailInitialSubTab}
              onRequestClick={handleOpenDetailModal}
            />
          )}

          {appNavTab === 'reports' && (
            <ReportsView
              changeRequests={changeRequests}
              currentUser={currentUser}
              users={users}
              delegations={delegations}
            />
          )}

          {appNavTab === 'device-out' && (
            <DeviceOutView
              currentUser={currentUser}
              onOpenCreateModal={() => {
                setEditingCr(null);
                setAppNavTab('new');
              }}
            />
          )}

          {appNavTab === 'howtouse' && (
            <HowToUseView
              currentUser={currentUser}
              onNavigateTab={(tab) => setAppNavTab(tab)}
              onCreateNewRequest={() => {
                setEditingCr(null);
                setAppNavTab('new');
              }}
            />
          )}
        </main>
      </div>

      {/* Comprehensive Request Detail Modal Drawer */}
      {selectedCrForModal && (
        <RequestDetailModal
          changeRequest={selectedCrForModal}
          onClose={() => setSelectedCrForModal(null)}
          currentUser={currentUser}
          users={users}
          customRoles={customRoles}
          changeRequests={changeRequests}
          onEditRequest={(cr) => {
            setSelectedCrForModal(null);
            setEditingCr(cr);
            setAppNavTab('new');
          }}
          onSendBackToRequester={handleItSendBackToRequester}
          onItDirectModify={handleItDirectModify}
          onRejectCase={handleRejectCase}
          onReopenCase={handleReopenCase}
          onSendReminderNudge={handleSendReminderNudge}
          onAutoCloseInactive={handleAutoCloseInactive}
        />
      )}

      {/* Authentication Login & Account Switcher Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          users={users}
          currentUser={currentUser}
          departments={departments}
          smtpConfig={smtpConfig}
          onSelectUser={(user) => {
            handleSwitchUser(user);
            setShowLoginModal(false);
          }}
          onLoginUser={(user) => {
            handleSwitchUser(user);
            setShowLoginModal(false);
          }}
          onRegisterUser={handleRegisterUser}
          onRequestPasswordResetOtp={handleRequestPasswordResetOtp}
          onCompletePasswordReset={handleCompletePasswordReset}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Full-Featured Notification Center Modal */}
      {showNotificationsModal && (
        <NotificationCenterModal
          isOpen={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
          notifications={notifications}
          currentUser={currentUser}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onRequestClick={handleOpenDetailModal}
        />
      )}
    </div>
  );
}
