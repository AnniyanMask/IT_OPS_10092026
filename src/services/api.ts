import {
  ChangeRequest,
  Attachment,
  EmailNotificationLog,
  UserProfile,
  Department,
  TemporaryApproverDelegation,
  ItDirectModifyPayload,
  EmailTemplateDefinition,
  SmtpTestResult,
  SmtpConfig,
  CustomRoleDefinition,
  CategoryMaster,
  ServiceMaster,
  ApplicationAssetMaster,
  IssueTypeMaster,
  ApplicationModuleMaster,
  ApplicationSubFunctionMaster,
  ApplicationProcessMaster,
  DeviceOutRequest,
  DeviceOutApproval,
  LabelTemplate,
  LabelPrintHistory,
  ReleaseNote,
  ReleaseNoteItem,
  ReleaseStatus,
} from '../types';

export interface CatalogData {
  categories?: CategoryMaster[];
  services?: ServiceMaster[];
  applications?: ApplicationAssetMaster[];
  issueTypes?: IssueTypeMaster[];
  modules?: ApplicationModuleMaster[];
  subFunctions?: ApplicationSubFunctionMaster[];
  processes?: ApplicationProcessMaster[];
}

const API_BASE = '/api';

export interface DbStatusResponse {
  connected: boolean;
  message: string;
  config?: {
    host?: string;
    port?: number;
    user?: string;
    database?: string;
  };
}

export const api = {
  // DB Connection status check
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const res = await fetch(`${API_BASE}/db/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : 'Database check unreachable',
      };
    }
  },

  async initializeSchema(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/db/initialize-schema`, { method: 'POST' });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 1. User Management & Auth
  async registerUser(user: Partial<UserProfile>): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async loginUser(email: string, password?: string): Promise<{ success: boolean; user?: UserProfile; message?: string; fallback?: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async getUsers(): Promise<{ success: boolean; data?: UserProfile[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async createUser(user: Partial<UserProfile>): Promise<{ success: boolean; data?: UserProfile; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<{ success: boolean; data?: UserProfile; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || `PostgreSQL rejected user update (HTTP ${res.status})`,
        };
      }
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteUser(id: string): Promise<{ success: boolean; deleted?: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async approveUser(id: string, details?: Partial<UserProfile> & { password?: string }): Promise<{ success: boolean; verified?: boolean; database?: string; table?: string; data?: UserProfile; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details || {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          verified: false,
          message: data.message || `PostgreSQL rejected user approval (HTTP ${res.status})`,
        };
      }
      return data;
    } catch (err) {
      return {
        success: false,
        verified: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async requestPasswordResetOtp(email: string, otpCode?: string): Promise<{ success: boolean; message: string; otpCode?: string; targetUser?: UserProfile }> {
    try {
      const res = await fetch(`${API_BASE}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async completePasswordReset(userId: string, newPassword: string, otpCode?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword, otpCode }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 2. Departments
  async getDepartments(): Promise<{ success: boolean; data?: Department[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/departments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async updateDepartment(dept: Department): Promise<{ success: boolean; data?: Department; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dept),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async deleteDepartment(id: number): Promise<{ success: boolean; deleted?: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/departments/${id}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 3. Change Requests & Immutable Audit
  async getChangeRequests(user?: { id: string; role: string; departmentId?: number }): Promise<{ success: boolean; data?: ChangeRequest[]; message?: string }> {
    try {
      const params = new URLSearchParams();
      if (user?.id) params.set('userId', user.id);
      if (user?.role) params.set('role', user.role);
      if (user?.departmentId !== undefined) params.set('departmentId', String(user.departmentId));
      const query = params.toString();
      const res = await fetch(`${API_BASE}/change-requests${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async getStorageVault(currentUser: UserProfile): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const params = new URLSearchParams({ role: currentUser.role });
      const res = await fetch(`${API_BASE}/storage-vault?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) return { success: false, message: data.message || `Storage configuration load failed (HTTP ${res.status})` };
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async saveStorageVault(config: any, currentUser: UserProfile): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/storage-vault`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          role: currentUser.role,
          updatedBy: `${currentUser.fullName} (${currentUser.role})`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { success: false, message: data.message || `Storage configuration save failed (HTTP ${res.status})` };
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async uploadAttachment(file: File, currentUser: UserProfile, changeRequestId?: string): Promise<{ success: boolean; attachment?: Attachment; message?: string }> {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API_BASE}/attachments/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
          dataUrl,
          uploadedBy: currentUser.fullName,
          uploadedByUserId: currentUser.id,
          changeRequestId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { success: false, message: data.message || `Upload failed (HTTP ${res.status})` };
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async downloadAttachment(attachmentId: string, currentUser?: UserProfile): Promise<void> {
    const params = new URLSearchParams();
    if (currentUser?.id) params.set('userId', currentUser.id);
    if (currentUser?.role) params.set('role', currentUser.role);
    if (currentUser?.departmentId !== undefined) params.set('departmentId', String(currentUser.departmentId));
    const res = await fetch(`${API_BASE}/attachments/${encodeURIComponent(attachmentId)}${params.toString() ? `?${params.toString()}` : ''}`);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match?.[1] || 'attachment';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async createChangeRequest(cr: Partial<ChangeRequest>): Promise<{ success: boolean; data?: ChangeRequest; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cr),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || `PostgreSQL rejected change request creation (HTTP ${res.status})`,
        };
      }
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateChangeRequest(id: string, updates: Record<string, unknown>): Promise<{ success: boolean; data?: ChangeRequest; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/change-requests/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || `PostgreSQL rejected change request update (HTTP ${res.status})`,
        };
      }
      return data;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  },

  async itDirectModify(payload: ItDirectModifyPayload | Record<string, unknown>): Promise<{ success: boolean; result?: unknown; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/it-direct-modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 4. Email Notifications & Live SMTP Dispatch
  async getEmailLogs(): Promise<{ success: boolean; data?: EmailNotificationLog[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/email-logs`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async logEmail(email: Partial<EmailNotificationLog>): Promise<{ success: boolean; data?: EmailNotificationLog; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/email-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async sendLiveEmail(payload: {
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    bodyHtml: string;
    triggerEvent?: string;
    changeRequestId?: string;
    smtpConfig?: SmtpConfig;
  }): Promise<{ success: boolean; delivered?: boolean; status?: string; serverResponse?: string; data?: EmailNotificationLog; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async testSmtpRelay(options: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    to?: string;
    fromAddress?: string;
    fromName?: string;
  }): Promise<SmtpTestResult> {
    try {
      const res = await fetch(`${API_BASE}/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      return await res.json();
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
        serverHost: options.host || '157.9.183.242',
        serverPort: options.port || 25,
        testedAt: new Date().toISOString(),
        errorCode: 'CLIENT_NETWORK_ERROR',
      };
    }
  },

  async getEmailTemplates(): Promise<{ success: boolean; data?: EmailTemplateDefinition[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/email-templates`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async saveEmailTemplate(template: EmailTemplateDefinition): Promise<{ success: boolean; data?: EmailTemplateDefinition; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/email-templates/${encodeURIComponent(template.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 5. Delegations
  async getDelegations(): Promise<{ success: boolean; data?: TemporaryApproverDelegation[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/delegations`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async saveDelegation(delegation: Partial<TemporaryApproverDelegation>): Promise<{ success: boolean; data?: TemporaryApproverDelegation; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/delegations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delegation),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async revokeDelegation(id: string, revokedBy: string, revocationReason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/delegations/${encodeURIComponent(id)}/revoke`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokedBy, revocationReason }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 6. Custom Roles & Permission Matrix
  async getCustomRoles(): Promise<{ success: boolean; data?: CustomRoleDefinition[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/custom-roles`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async createCustomRole(role: Partial<CustomRoleDefinition>): Promise<{ success: boolean; data?: CustomRoleDefinition; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/custom-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async updateCustomRole(id: string, role: Partial<CustomRoleDefinition>): Promise<{ success: boolean; data?: CustomRoleDefinition; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/custom-roles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async deleteCustomRole(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/custom-roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // 7. IT Service Catalog & 3-Tier Hierarchy Management (PostgreSQL Single Source of Truth)
  async getCatalog(): Promise<{ success: boolean; data?: CatalogData; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/catalog`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async saveCatalog(payload: CatalogData): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/catalog/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  async deleteCatalogItem(type: 'categories' | 'services' | 'applications' | 'issuetypes' | 'modules' | 'subfunctions' | 'processes', id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/catalog/${type}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },

  // ============================================================================
  // 8. BRING DEVICE OUT & SATO CL4NX STICKER LABEL API
  // ============================================================================
  async getDeviceOutRequests(params?: { userId?: string; role?: string; departmentId?: number }): Promise<{ success: boolean; data?: DeviceOutRequest[]; count?: number; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (params?.userId) q.set('userId', params.userId);
      if (params?.role) q.set('role', params.role);
      if (params?.departmentId) q.set('departmentId', String(params.departmentId));
      const res = await fetch(`${API_BASE}/device-out-requests?${q.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getDeviceOutRequest(id: string): Promise<{ success: boolean; data?: DeviceOutRequest & { approvals?: DeviceOutApproval[]; printHistory?: LabelPrintHistory[] }; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/device-out-requests/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async createDeviceOutRequest(payload: Partial<DeviceOutRequest>): Promise<{ success: boolean; data?: DeviceOutRequest; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/device-out-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async approveDeviceOutRequest(id: string, payload: { approvedBy: string; approvedByName?: string; approverRole?: string; comments?: string }): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/device-out-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async rejectDeviceOutRequest(id: string, payload: { rejectedBy: string; rejectedByName?: string; approverRole?: string; rejectionReason: string }): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/device-out-requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async returnDeviceOutRequest(id: string, payload: { returnedBy: string; returnedByName?: string; approverRole?: string; remarks?: string }): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/device-out-requests/${encodeURIComponent(id)}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getLabelTemplates(): Promise<{ success: boolean; data?: LabelTemplate[]; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/label-templates`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async saveLabelTemplate(template: Partial<LabelTemplate>): Promise<{ success: boolean; data?: LabelTemplate; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/label-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteLabelTemplate(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/label-templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async recordLabelPrint(payload: { requestId: string; templateId?: string; printedBy: string; printedByName?: string; printerName?: string; printCount?: number }): Promise<{ success: boolean; data?: LabelPrintHistory; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/label-print-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // ============================================================================
  // 9. WHAT'S NEW / RELEASE NOTES API
  // ============================================================================
  async getReleaseNotes(params?: { userId?: string; includeDrafts?: boolean; actorRole?: string }): Promise<{ success: boolean; data?: ReleaseNote[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (params?.userId) q.set('userId', params.userId);
      if (params?.includeDrafts) q.set('includeDrafts', 'true');
      if (params?.actorRole) q.set('actorRole', params.actorRole);
      const res = await fetch(`${API_BASE}/release-notes?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getUnreadReleaseNotesCount(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      if (!userId) return { success: true, count: 0 };
      const res = await fetch(`${API_BASE}/release-notes/unread-count?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, count: 0, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async markReleaseNoteAsRead(id: string, userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/release-notes/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async createReleaseNote(payload: {
    version: string;
    title: string;
    releaseDate: string;
    summary: string;
    status?: ReleaseStatus;
    items?: Partial<ReleaseNoteItem>[];
    actorUserId?: string;
    actorRole?: string;
    actorName?: string;
  }): Promise<{ success: boolean; data?: ReleaseNote; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/release-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateReleaseNote(
    id: string,
    payload: {
      version: string;
      title: string;
      releaseDate: string;
      summary: string;
      status?: ReleaseStatus;
      items?: Partial<ReleaseNoteItem>[];
      actorUserId?: string;
      actorRole?: string;
      actorName?: string;
    }
  ): Promise<{ success: boolean; data?: ReleaseNote; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/release-notes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async publishReleaseNote(
    id: string,
    payload: {
      status: 'Published' | 'Draft';
      actorUserId?: string;
      actorRole?: string;
      actorName?: string;
    }
  ): Promise<{ success: boolean; message?: string; status?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/release-notes/${encodeURIComponent(id)}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteReleaseNote(id: string, actorRole?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const q = actorRole ? `?actorRole=${encodeURIComponent(actorRole)}` : '';
      const res = await fetch(`${API_BASE}/release-notes/${encodeURIComponent(id)}${q}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // ==========================================
  // MAINTENANCE ANNOUNCEMENTS & EMAIL REMINDERS
  // ==========================================

  async getMaintenanceAnnouncements(status?: string, actorRole?: string): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (status && status !== 'All') q.set('status', status);
      if (actorRole) q.set('actorRole', actorRole);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const res = await fetch(`${API_BASE}/maintenance-announcements${queryStr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getMaintenanceAnnouncement(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async createMaintenanceAnnouncement(payload: any): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateMaintenanceAnnouncement(id: string, payload: any): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateMaintenanceStatus(
    id: string,
    status: string,
    actorRole?: string,
    actorId?: string,
    actorName?: string
  ): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actorRole, actorId, actorName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteMaintenanceAnnouncement(id: string, actorRole?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const q = actorRole ? `?actorRole=${encodeURIComponent(actorRole)}` : '';
      const res = await fetch(`${API_BASE}/maintenance-announcements/${encodeURIComponent(id)}${q}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async sendMaintenanceTestEmail(payload: {
    announcement: any;
    testRecipientEmail: string;
    reminderType?: string;
    actorRole?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; log?: any }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async triggerMaintenanceReminder(
    id: string,
    reminderType: string,
    actorRole?: string,
    actorName?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/maintenance-announcements/${encodeURIComponent(id)}/trigger-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderType, actorRole, actorName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getMaintenanceEmailHistory(
    maintenanceId?: string,
    status?: string
  ): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (maintenanceId) q.set('maintenanceId', maintenanceId);
      if (status && status !== 'All') q.set('status', status);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const res = await fetch(`${API_BASE}/maintenance-email-history${queryStr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) };
    }
  },
};
