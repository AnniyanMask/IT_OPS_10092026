import React, { useState, useEffect, useMemo } from 'react';
import {
  MaintenanceAnnouncement,
  MaintenanceReminder,
  MaintenanceEmailHistory,
  MaintenanceStatus,
  MaintenanceReminderType,
  UserProfile,
  calculateMaintenanceDuration,
} from '../types';
import { api } from '../services/api';
import {
  Calendar,
  Clock,
  Mail,
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  Edit2,
  Trash2,
  Play,
  CheckCheck,
  RefreshCw,
  Search,
  Plus,
  X,
  ChevronRight,
  Info,
  ExternalLink,
  Users,
  Check,
  Smartphone,
  Tablet,
  Laptop,
  ArrowRight,
  Sparkles,
  Server,
  Layers,
  History,
  Radio,
} from 'lucide-react';

interface MaintenanceAnnouncementViewProps {
  currentUser: UserProfile;
  onRequestClick?: (crId: string) => void;
}

const DEFAULT_REMINDER_SETTINGS = {
  initial: true,
  threeDaysBefore: true,
  oneDayBefore: true,
  thirtyMinsBefore: true,
  started: true,
  completed: true,
  cancelled: true,
};

const MAINTENANCE_TYPES = [
  'Network & Server Maintenance',
  'ERP System Upgrade (SAP)',
  'MES Shop Floor System Maintenance',
  'Database Server Maintenance',
  'Operating System & Security Patching',
  'Datacenter Power & Facility Maintenance',
  'Storage & Backup Infrastructure',
  'Email & Communication Systems',
  'Emergency Corrective Maintenance',
];

export const MaintenanceAnnouncementView: React.FC<MaintenanceAnnouncementViewProps> = ({
  currentUser,
  onRequestClick,
}) => {
  // State
  const [announcements, setAnnouncements] = useState<MaintenanceAnnouncement[]>([]);
  const [emailHistory, setEmailHistory] = useState<MaintenanceEmailHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'announcements' | 'history'>('announcements');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<MaintenanceAnnouncement | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<MaintenanceAnnouncement | null>(null);
  const [previewReminderType, setPreviewReminderType] = useState<MaintenanceReminderType>('initial');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState<boolean>(false);
  const [testEmailAnnouncement, setTestEmailAnnouncement] = useState<MaintenanceAnnouncement | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>(currentUser.email || 'Administrator@tanaka.com.my');
  const [testReminderType, setTestReminderType] = useState<MaintenanceReminderType>('initial');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [scheduleTargetAnnouncement, setScheduleTargetAnnouncement] = useState<MaintenanceAnnouncement | null>(null);

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    maintenanceType: MAINTENANCE_TYPES[0],
    affectedSystem: '',
    description: '',
    reason: '',
    startDatetime: '',
    endDatetime: '',
    duration: '',
    impact: '',
    userAction: '',
    workaround: '',
    itContact: 'Tanaka IT Operations Desk ext. 4321 / helpdesk@tanaka.com.my',
    changeNumber: '',
    recipientGroup: 'TD_TEM',
    status: 'Scheduled' as MaintenanceStatus,
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
  });

  // Calculate duration automatically whenever dates change
  useEffect(() => {
    if (formData.startDatetime && formData.endDatetime) {
      const computed = calculateMaintenanceDuration(formData.startDatetime, formData.endDatetime);
      setFormData((prev) => ({ ...prev, duration: computed }));
    }
  }, [formData.startDatetime, formData.endDatetime]);

  // Load announcements and history
  const fetchData = async () => {
    try {
      setLoading(true);
      const [annRes, histRes] = await Promise.all([
        api.getMaintenanceAnnouncements(),
        api.getMaintenanceEmailHistory(),
      ]);

      if (annRes.success && Array.isArray(annRes.data)) {
        setAnnouncements(annRes.data);
      }
      if (histRes.success && Array.isArray(histRes.data)) {
        setEmailHistory(histRes.data);
      }
    } catch (err) {
      console.error('Error fetching maintenance announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  // Notification helper
  const showNotice = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMsg(msg);
      setTimeout(() => setActionErrorMsg(null), 5000);
    } else {
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Helper: format dates
  const formatDateTimeDisplay = (dt: string | undefined | null) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return dt;
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })} (MYT)`;
    } catch {
      return dt;
    }
  };

  // Helper: format reminder label
  const getReminderLabel = (type: MaintenanceReminderType) => {
    switch (type) {
      case 'initial':
        return 'Initial Announcement';
      case '3_days_before':
        return '3 Days Before';
      case '1_day_before':
        return '1 Day Before';
      case '30_mins_before':
        return '30 Minutes Before';
      case 'started':
        return 'Maintenance Started';
      case 'completed':
        return 'Maintenance Completed';
      case 'cancelled':
        return 'Maintenance Cancelled';
      default:
        return type;
    }
  };

  // Calculate preview reminder execution times
  const calculatePreviewScheduleTime = (type: MaintenanceReminderType, startStr: string, endStr: string) => {
    if (!startStr) return 'Pending date selection';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : start;

    switch (type) {
      case 'initial':
        return 'Immediately upon saving announcement';
      case '3_days_before':
        return formatDateTimeDisplay(new Date(start.getTime() - 3 * 24 * 3600 * 1000).toISOString());
      case '1_day_before':
        return formatDateTimeDisplay(new Date(start.getTime() - 24 * 3600 * 1000).toISOString());
      case '30_mins_before':
        return formatDateTimeDisplay(new Date(start.getTime() - 30 * 60 * 1000).toISOString());
      case 'started':
        return formatDateTimeDisplay(start.toISOString());
      case 'completed':
        return formatDateTimeDisplay(end.toISOString());
      case 'cancelled':
        return 'Triggered if maintenance is marked Cancelled';
      default:
        return '—';
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const now = new Date();
    // Default start date = tomorrow 22:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(22, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(tomorrowEnd.getHours() + 4);

    const pad = (n: number) => String(n).padStart(2, '0');
    const toInputStr = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setEditingAnnouncement(null);
    setFormData({
      title: '',
      maintenanceType: MAINTENANCE_TYPES[0],
      affectedSystem: '',
      description: '',
      reason: '',
      startDatetime: toInputStr(tomorrow),
      endDatetime: toInputStr(tomorrowEnd),
      duration: '4 hours',
      impact: 'Temporary service disruption during the scheduled window.',
      userAction: 'Users must save all work and log out of the affected systems before maintenance begins.',
      workaround: 'Manual operational procedures or offline batch travelers if required.',
      itContact: 'Tanaka IT Operations Desk ext. 4321 / helpdesk@tanaka.com.my',
      changeNumber: `CR-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      recipientGroup: 'TD_TEM',
      status: 'Scheduled',
      reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: MaintenanceAnnouncement) => {
    setEditingAnnouncement(item);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toInputStr = (val: string) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d.getTime())) return val.substring(0, 16);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      title: item.title,
      maintenanceType: item.maintenanceType,
      affectedSystem: item.affectedSystem,
      description: item.description,
      reason: item.reason,
      startDatetime: toInputStr(item.startDatetime),
      endDatetime: toInputStr(item.endDatetime),
      duration: item.duration || calculateMaintenanceDuration(item.startDatetime, item.endDatetime),
      impact: item.impact,
      userAction: item.userAction,
      workaround: item.workaround,
      itContact: item.itContact || 'Tanaka IT Operations Desk ext. 4321 / helpdesk@tanaka.com.my',
      changeNumber: item.changeNumber || '',
      recipientGroup: item.recipientGroup || 'TD_TEM',
      status: item.status,
      reminderSettings: item.reminderSettings || { ...DEFAULT_REMINDER_SETTINGS },
    });
    setIsFormModalOpen(true);
  };

  // Save Announcement (Create / Update)
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showNotice('Please enter an announcement title.', true);
      return;
    }
    if (!formData.affectedSystem.trim()) {
      showNotice('Please enter the affected system or service.', true);
      return;
    }
    if (!formData.startDatetime || !formData.endDatetime) {
      showNotice('Please specify both Start Date/Time and End Date/Time.', true);
      return;
    }

    try {
      const payload = {
        ...formData,
        actorUserId: currentUser.id,
        actorName: currentUser.fullName,
      };

      if (editingAnnouncement) {
        const res = await api.updateMaintenanceAnnouncement(editingAnnouncement.id, payload);
        if (res.success) {
          showNotice('Maintenance announcement and scheduled reminders updated successfully.');
          setIsFormModalOpen(false);
          fetchData();
        } else {
          showNotice(res.error || 'Failed to update maintenance announcement.', true);
        }
      } else {
        const res = await api.createMaintenanceAnnouncement(payload);
        if (res.success) {
          showNotice('Maintenance announcement scheduled! Automated reminders have been queued.');
          setIsFormModalOpen(false);
          fetchData();
        } else {
          showNotice(res.error || 'Failed to create maintenance announcement.', true);
        }
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), true);
    }
  };

  // Quick Status Transition (e.g. In Progress, Completed, Cancelled)
  const handleUpdateStatus = async (id: string, newStatus: MaintenanceStatus) => {
    const actionLabel =
      newStatus === 'Cancelled'
        ? 'cancel this scheduled maintenance and send cancellation notifications'
        : newStatus === 'In Progress'
        ? 'mark maintenance as IN PROGRESS and send "Started" notifications'
        : `mark maintenance as ${newStatus.toUpperCase()}`;

    if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) {
      return;
    }

    try {
      const res = await api.updateMaintenanceStatus(id, newStatus, currentUser.id, currentUser.fullName);
      if (res.success) {
        showNotice(`Maintenance status updated to ${newStatus}. Reminders updated accordingly.`);
        fetchData();
      } else {
        showNotice(res.error || 'Failed to update status.', true);
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), true);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to completely delete "${title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await api.deleteMaintenanceAnnouncement(id);
      if (res.success) {
        showNotice('Maintenance announcement and associated schedules deleted.');
        fetchData();
      } else {
        showNotice(res.error || 'Failed to delete announcement.', true);
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), true);
    }
  };

  // Manual trigger of a reminder stage
  const handleTriggerReminderNow = async (id: string, reminderType: MaintenanceReminderType) => {
    const label = getReminderLabel(reminderType);
    if (!window.confirm(`Are you sure you want to immediately dispatch the [${label}] reminder to TD_TEM via Tanaka SMTP relay?`)) {
      return;
    }

    try {
      const res = await api.triggerMaintenanceReminder(id, reminderType);
      if (res.success) {
        showNotice(`Reminder [${label}] successfully dispatched to TD_TEM.`);
        fetchData();
      } else {
        showNotice(res.error || 'Failed to trigger reminder dispatch.', true);
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), true);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (item: MaintenanceAnnouncement, reminderType: MaintenanceReminderType = 'initial') => {
    setPreviewAnnouncement(item);
    setPreviewReminderType(reminderType);
    setIsPreviewModalOpen(true);
  };

  // Open Test Email Modal
  const handleOpenTestEmail = (item: MaintenanceAnnouncement, reminderType: MaintenanceReminderType = 'initial') => {
    setTestEmailAnnouncement(item);
    setTestReminderType(reminderType);
    setTestEmailResult(null);
    setIsTestEmailModalOpen(true);
  };

  // Send Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAnnouncement) return;
    if (!testRecipientEmail.trim()) {
      setTestEmailResult({ success: false, message: 'Please enter a valid recipient email address.' });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const res = await api.sendMaintenanceTestEmail({
        announcement: testEmailAnnouncement,
        testRecipientEmail: testRecipientEmail.trim(),
        reminderType: testReminderType,
      });

      if (res.success) {
        setTestEmailResult({
          success: true,
          message: `Verification email successfully dispatched to ${testRecipientEmail} via Tanaka SMTP relay (157.9.183.242:25).`,
        });
        fetchData();
      } else {
        setTestEmailResult({
          success: false,
          message: res.error || 'SMTP dispatch failed. Please check Tanaka relay connection.',
        });
      }
    } catch (err: unknown) {
      setTestEmailResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.affectedSystem.toLowerCase().includes(q) ||
        (item.changeNumber && item.changeNumber.toLowerCase().includes(q)) ||
        item.maintenanceType.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [announcements, statusFilter, searchQuery]);

  // Status Badge Helper
  const renderStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Scheduled':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Scheduled</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <Radio className="w-3.5 h-3.5 text-amber-600" />
            <span>In Progress</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Generate Live Rendered HTML for the preview modal
  const generatePreviewHtml = (announcement: MaintenanceAnnouncement, reminderType: MaintenanceReminderType) => {
    const reminderLabel = getReminderLabel(reminderType).toUpperCase();
    const startMyt = formatDateTimeDisplay(announcement.startDatetime);
    const endMyt = formatDateTimeDisplay(announcement.endDatetime);
    const duration = announcement.duration || calculateMaintenanceDuration(announcement.startDatetime, announcement.endDatetime);

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px; text-align: left; border-bottom: 3px solid #3b82f6;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span style="background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 4px; letter-spacing: 0.8px; text-transform: uppercase;">
              TANAKA IT OPERATIONS NOTICE
            </span>
            <span style="background-color: #f59e0b; color: #000000; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 4px; text-transform: uppercase;">
              ${reminderLabel}
            </span>
          </div>
          <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 800; line-height: 1.3;">
            ${announcement.title}
          </h1>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
            Target Audience: <strong>${announcement.recipientGroup || 'TD_TEM'}</strong> • Ref: <strong>${announcement.changeNumber || 'N/A'}</strong> • Maintenance Type: <strong>${announcement.maintenanceType}</strong>
          </div>
        </div>
        
        <div style="padding: 24px; color: #1e293b;">
          <p style="font-size: 14px; color: #334155; margin-top: 0; line-height: 1.6;">
            Dear All,
          </p>
          <p style="font-size: 13px; color: #475569; line-height: 1.6;">
            Please be informed of an upcoming scheduled IT system maintenance window affecting <strong>${announcement.affectedSystem}</strong>. Details and user instructions are provided below:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 18px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 160px; font-weight: bold;">Affected System/Service:</td>
                <td style="font-weight: 800; color: #0f172a;">${announcement.affectedSystem}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Maintenance Type:</td>
                <td style="color: #334155;">${announcement.maintenanceType}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Start Date / Time:</td>
                <td style="font-family: monospace; font-weight: bold; color: #2563eb;">${startMyt}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">End Date / Time:</td>
                <td style="font-family: monospace; font-weight: bold; color: #2563eb;">${endMyt}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Expected Duration:</td>
                <td style="font-weight: bold; color: #059669;">${duration}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Change Tracking Ref:</td>
                <td style="font-family: monospace; color: #475569;">${announcement.changeNumber || 'N/A'}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              ⚠️ Expected Operational Impact:
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #9a3412; line-height: 1.5;">
              ${announcement.impact || 'Service will be temporarily unavailable during maintenance.'}
            </div>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
            <div style="margin-bottom: 10px;">
              <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Technical Scope & Description:</div>
              <div style="font-size: 13px; color: #0f172a; line-height: 1.5; margin-top: 3px;">${announcement.description || 'Routine maintenance and improvements.'}</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Maintenance Justification:</div>
              <div style="font-size: 13px; color: #334155; line-height: 1.5; margin-top: 3px;">${announcement.reason || 'Preventive maintenance and stability updates.'}</div>
            </div>
          </div>

          <div style="background-color: #fefce8; border: 1px solid #fef08a; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 800; color: #854d0e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              📋 User Action Required:
            </div>
            <div style="font-size: 13px; color: #713f12; line-height: 1.5;">
              ${announcement.userAction || 'Please ensure all open files and active sessions are closed.'}
            </div>
          </div>

          <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              🔄 Fallback Workaround:
            </div>
            <div style="font-size: 13px; color: #0c4a6e; line-height: 1.5;">
              ${announcement.workaround || 'Standard contingency offline protocols apply.'}
            </div>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #475569;">
            <strong>IT Operations Helpdesk Contact:</strong> ${announcement.itContact || 'IT Operations Desk / helpdesk@tanaka.com.my'}
          </div>

          <div style="text-align: center; margin: 26px 0 14px 0;">
            <a href="http://157.9.183.59:3000" target="_blank" rel="noopener noreferrer" style="background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block; letter-spacing: 0.5px;">
              Open IT Helpdesk Portal
            </a>
          </div>

          <div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            This is an automated operational notification.
          </div>
        </div>
      </div>
    `;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Alert Notifications */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-slideDown">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-slideDown">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Status Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Maintenance Announcements & Email Reminders
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Plan scheduled IT system maintenance windows with automated staged reminders (3 Days, 1 Day, 30 Mins, Started, Completed, Cancelled) dispatched via Tanaka SMTP Relay to the <span className="font-mono text-blue-300 font-bold bg-blue-900/50 px-1.5 py-0.5 rounded">TD_TEM</span> distribution group.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/10 flex items-center space-x-2 cursor-pointer"
              title="Refresh announcements and schedules"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer hover:shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Maintenance</span>
            </button>
          </div>
        </div>

        {/* Live Engine Diagnostic Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Scheduler Engine: <strong className="text-white">Active (60s interval)</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>SMTP Relay: <strong className="text-white">157.9.183.242:25</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Default Recipient: <strong className="text-white">TD_TEM@tanaka.com.my</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-[11px] text-slate-400">Total Scheduled Reminders:</span>
            <span className="font-mono font-bold text-white">
              {announcements.reduce((acc, a) => acc + (a.reminders?.filter((r) => r.status === 'Scheduled').length || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'announcements'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Announcements</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-mono">
              {announcements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>Email History & Logs</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
              {emailHistory.length}
            </span>
          </button>
        </div>

        {activeTab === 'announcements' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Pills */}
            <div className="flex items-center space-x-1 text-xs">
              {['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: ANNOUNCEMENTS LIST */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm font-medium">Loading maintenance announcements...</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Maintenance Announcements Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'All'
                  ? 'No announcements match the selected filter criteria.'
                  : 'Get started by scheduling a new system maintenance window with automated reminders.'}
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors cursor-pointer"
              >
                Schedule Maintenance Now
              </button>
            </div>
          ) : (
            filteredAnnouncements.map((item) => {
              const pendingCount = item.reminders?.filter((r) => r.status === 'Scheduled').length || 0;
              const sentCount = item.reminders?.filter((r) => r.status === 'Sent').length || 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Main Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {renderStatusBadge(item.status)}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {item.maintenanceType}
                        </span>
                        {item.changeNumber && (
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {item.changeNumber}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Target: <strong className="text-slate-700 font-mono">{item.recipientGroup || 'TD_TEM'}</strong>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 text-xs text-slate-600 pt-1">
                        <div>
                          <span className="text-slate-400 font-medium">Affected System: </span>
                          <strong className="text-slate-800">{item.affectedSystem}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Window: </span>
                          <span className="font-mono text-blue-700 font-semibold">
                            {formatDateTimeDisplay(item.startDatetime)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Expected Duration: </span>
                          <strong className="text-emerald-700">{item.duration}</strong>
                        </div>
                      </div>

                      {item.impact && (
                        <div className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-1.5 flex items-start space-x-2 mt-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span><strong>Expected Impact:</strong> {item.impact}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-start pt-1">
                      {/* Preview Button */}
                      <button
                        onClick={() => handleOpenPreview(item)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
                        title="Preview generated broadcast email template"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Email</span>
                      </button>

                      {/* Send Test Email */}
                      <button
                        onClick={() => handleOpenTestEmail(item)}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer border border-indigo-200"
                        title="Dispatch test email via Tanaka SMTP relay"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Test Email</span>
                      </button>

                      {/* Reminder Schedules Modal Button */}
                      <button
                        onClick={() => {
                          setScheduleTargetAnnouncement(item);
                          setIsScheduleModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer border border-blue-200"
                        title="View and manage automated reminder triggers"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Reminders ({pendingCount} pending)</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit announcement and reschedule reminders"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteAnnouncement(item.id, item.title)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Reminder Timeline Visual Strip */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                      <span className="font-semibold text-slate-700 mr-1">Reminder Pipeline:</span>
                      {[
                        { type: 'initial', label: 'Initial' },
                        { type: '3_days_before', label: '3-Day' },
                        { type: '1_day_before', label: '1-Day' },
                        { type: '30_mins_before', label: '30-Min' },
                        { type: 'started', label: 'Started' },
                        { type: 'completed', label: 'Completed' },
                        { type: 'cancelled', label: 'Cancelled' },
                      ].map((stage) => {
                        const rem = item.reminders?.find((r) => r.reminderType === stage.type);
                        const isSent = rem?.status === 'Sent';
                        const isScheduled = rem?.status === 'Scheduled';
                        const isFailed = rem?.status === 'Failed';
                        const isCancelled = rem?.status === 'Cancelled';

                        return (
                          <span
                            key={stage.type}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1 ${
                              isSent
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : isScheduled
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : isFailed
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : isCancelled
                                ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                            title={`Status: ${rem?.status || 'Not configured'} • Scheduled: ${rem?.scheduledTime || 'N/A'}`}
                          >
                            {isSent && <Check className="w-3 h-3 text-emerald-600" />}
                            {isScheduled && <Clock className="w-3 h-3 text-blue-500" />}
                            {isFailed && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                            <span>{stage.label}</span>
                          </span>
                        );
                      })}
                    </div>

                    {/* Quick Status Advance Buttons */}
                    <div className="flex items-center space-x-2">
                      {item.status === 'Scheduled' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'In Progress')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Play className="w-3 h-3 text-amber-600" />
                            <span>Mark Started</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'Cancelled')}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {item.status === 'In Progress' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'Completed')}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 rounded-md transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Mark Completed</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: EMAIL HISTORY & LOGS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Tanaka IT Maintenance Dispatched Emails</h3>
              <p className="text-xs text-slate-500">
                Audit log of all initial broadcasts, staged reminders, status transitions, and test emails sent via SMTP.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Sent Time (MYT)</th>
                  <th className="py-3 px-4">Maintenance Notice</th>
                  <th className="py-3 px-4">Reminder Stage</th>
                  <th className="py-3 px-4">Recipient Group</th>
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {emailHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No maintenance emails dispatched yet.
                    </td>
                  </tr>
                ) : (
                  emailHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDateTimeDisplay(log.sentTime || log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                        {log.announcementTitle || log.maintenanceId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                          {getReminderLabel(log.reminderType)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {log.recipientGroup}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {log.recipientCount} users
                      </td>
                      <td className="py-3 px-4">
                        {log.status === 'Sent' ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Sent (250 OK)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm truncate" title={log.subject}>
                        {log.subject}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SCHEDULE / EDIT MAINTENANCE ANNOUNCEMENT FORM */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingAnnouncement ? 'Edit Maintenance Announcement' : 'Schedule New IT Maintenance'}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Configure technical scope, affected systems, maintenance window, and automated reminder triggers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveAnnouncement} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Announcement Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise SAP ERP & Core Network Switch Infrastructure Upgrade"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Row 2: Type & Affected System */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Maintenance Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.maintenanceType}
                    onChange={(e) => setFormData({ ...formData, maintenanceType: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MAINTENANCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Affected System / Service <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SAP Production & MES Shop Floor Gateway"
                    value={formData.affectedSystem}
                    onChange={(e) => setFormData({ ...formData, affectedSystem: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Row 3: Start & End Date/Time & Calculated Duration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Maintenance Window & Duration Calculation (Malaysian Time - MYT)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Start Date / Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startDatetime}
                      onChange={(e) => setFormData({ ...formData, startDatetime: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      End Date / Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.endDatetime}
                      onChange={(e) => setFormData({ ...formData, endDatetime: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Calculated Duration
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.duration}
                      className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-emerald-800 font-bold font-mono cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Technical Scope (Description) & Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Technical Scope & Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe specific hardware, switch upgrades, firmware patching, or cabling work..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Maintenance Reason / Justification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Hardware end-of-life replacement, security vulnerability patch, capacity upgrade..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Row 5: Impact, User Action Required, & Workaround */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Expected Impact
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Complete downtime for SAP ERP, MES terminals..."
                    value={formData.impact}
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    User Action Required
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Save all transactions and log out before window..."
                    value={formData.userAction}
                    onChange={(e) => setFormData({ ...formData, userAction: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Workaround / Contingency
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Manual paper traveler forms for shop floor..."
                    value={formData.workaround}
                    onChange={(e) => setFormData({ ...formData, workaround: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Row 6: IT Contact, Change Ref, Recipient Group */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    IT Contact Details
                  </label>
                  <input
                    type="text"
                    value={formData.itContact}
                    onChange={(e) => setFormData({ ...formData, itContact: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Change / Request Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ITO-CR-2026-00088"
                    value={formData.changeNumber}
                    onChange={(e) => setFormData({ ...formData, changeNumber: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Recipient Group
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.recipientGroup}
                      onChange={(e) => setFormData({ ...formData, recipientGroup: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-normal">
                      (All Staff)
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 7: Automated Reminder Settings (7 Reminder Types) */}
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Automated Reminder Schedules (Enabled Triggers)
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    Tanaka Relay checks every minute
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* 1. Initial Announcement */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.initial}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, initial: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">1. Initial Announcement</div>
                      <div className="text-[11px] text-slate-500">
                        Dispatched immediately when announcement is saved.
                      </div>
                    </div>
                  </label>

                  {/* 2. Reminder 3 days before */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.threeDaysBefore}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, threeDaysBefore: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">2. Reminder 3 Days Before</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {calculatePreviewScheduleTime('3_days_before', formData.startDatetime, formData.endDatetime)}
                      </div>
                    </div>
                  </label>

                  {/* 3. Reminder 1 day before */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.oneDayBefore}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, oneDayBefore: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">3. Reminder 1 Day Before</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {calculatePreviewScheduleTime('1_day_before', formData.startDatetime, formData.endDatetime)}
                      </div>
                    </div>
                  </label>

                  {/* 4. Reminder 30 mins before */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.thirtyMinsBefore}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, thirtyMinsBefore: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">4. Reminder 30 Minutes Before</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {calculatePreviewScheduleTime('30_mins_before', formData.startDatetime, formData.endDatetime)}
                      </div>
                    </div>
                  </label>

                  {/* 5. Maintenance Started */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.started}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, started: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">5. Maintenance Started</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {calculatePreviewScheduleTime('started', formData.startDatetime, formData.endDatetime)}
                      </div>
                    </div>
                  </label>

                  {/* 6. Maintenance Completed */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.completed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, completed: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">6. Maintenance Completed</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {calculatePreviewScheduleTime('completed', formData.startDatetime, formData.endDatetime)}
                      </div>
                    </div>
                  </label>

                  {/* 7. Maintenance Cancelled */}
                  <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={formData.reminderSettings.cancelled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSettings: { ...formData.reminderSettings, cancelled: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800">7. Maintenance Cancelled</div>
                      <div className="text-[11px] text-slate-500">
                        Dispatched automatically if Admin updates status to "Cancelled".
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer hover:shadow-blue-500/25"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingAnnouncement ? 'Save Changes' : 'Publish & Queue Reminders'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LIVE EMAIL PREVIEW MODAL */}
      {/* ========================================================================= */}
      {isPreviewModalOpen && previewAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Rendered Email Preview: {previewAnnouncement.title}</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Visual presentation dispatched to <strong>{previewAnnouncement.recipientGroup || 'TD_TEM'}</strong>
                </p>
              </div>

              {/* Reminder Stage Switcher */}
              <div className="flex items-center space-x-2">
                <select
                  value={previewReminderType}
                  onChange={(e) => setPreviewReminderType(e.target.value as MaintenanceReminderType)}
                  className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none"
                >
                  <option value="initial">Stage: Initial Announcement</option>
                  <option value="3_days_before">Stage: 3 Days Before</option>
                  <option value="1_day_before">Stage: 1 Day Before</option>
                  <option value="30_mins_before">Stage: 30 Mins Before</option>
                  <option value="started">Stage: Maintenance Started</option>
                  <option value="completed">Stage: Maintenance Completed</option>
                  <option value="cancelled">Stage: Maintenance Cancelled</option>
                </select>

                {/* Device Selector */}
                <div className="flex items-center space-x-1 p-0.5 bg-slate-800 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Desktop Preview"
                  >
                    <Laptop className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('tablet')}
                    className={`p-1.5 rounded transition-colors ${previewDevice === 'tablet' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Tablet Preview"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="Mobile Preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Simulated Email Client View */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex flex-col space-y-1">
              <div>
                <strong className="text-slate-500">From:</strong> Tanaka IT Operations Relay &lt;Administrator@tanaka.com.my&gt;
              </div>
              <div>
                <strong className="text-slate-500">To:</strong> {previewAnnouncement.recipientGroup || 'TD_TEM'} &lt;TD_TEM@tanaka.com.my&gt;
              </div>
              <div>
                <strong className="text-slate-500">Subject:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  [{getReminderLabel(previewReminderType).toUpperCase()}] IT Maintenance Notice: {previewAnnouncement.affectedSystem} - {previewAnnouncement.title}
                </span>
              </div>
            </div>

            {/* Email Render Frame */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200/60 flex justify-center items-start">
              <div
                className={`transition-all duration-300 w-full ${
                  previewDevice === 'desktop'
                    ? 'max-w-2xl'
                    : previewDevice === 'tablet'
                    ? 'max-w-md'
                    : 'max-w-sm'
                }`}
                dangerouslySetInnerHTML={{
                  __html: generatePreviewHtml(previewAnnouncement, previewReminderType),
                }}
              />
            </div>

            {/* Preview Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <span className="text-xs text-slate-500">
               
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    handleOpenTestEmail(previewAnnouncement, previewReminderType);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SEND TEST EMAIL MODAL */}
      {/* ========================================================================= */}
      {isTestEmailModalOpen && testEmailAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Send Maintenance Test Email</h3>
                  <p className="text-xs text-slate-400">Validate SMTP relay delivery before broadcast</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestEmailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendTestEmail} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Maintenance Notice
                </label>
                <div className="text-xs font-semibold text-slate-800 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  {testEmailAnnouncement.title}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reminder Stage to Test <span className="text-rose-500">*</span>
                </label>
                <select
                  value={testReminderType}
                  onChange={(e) => setTestReminderType(e.target.value as MaintenanceReminderType)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="initial">Initial Announcement</option>
                  <option value="3_days_before">Reminder (3 Days Before)</option>
                  <option value="1_day_before">Reminder (1 Day Before)</option>
                  <option value="30_mins_before">Reminder (30 Minutes Before)</option>
                  <option value="started">Maintenance Started Notice</option>
                  <option value="completed">Maintenance Completed Notice</option>
                  <option value="cancelled">Maintenance Cancelled Notice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Test Recipient Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. your.email@tanaka.com.my"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Dispatches immediately to this mailbox through host: 157.9.183.242:25.
                </span>
              </div>

              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                    testEmailResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {testEmailResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testEmailResult.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsTestEmailModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={isSendingTestEmail}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingTestEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Test Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REMINDER SCHEDULES & MANUAL TRIGGER MODAL */}
      {/* ========================================================================= */}
      {isScheduleModalOpen && scheduleTargetAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Automated Reminder Pipeline</h3>
                  <p className="text-xs text-slate-300">
                    {scheduleTargetAnnouncement.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reminder Schedule Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                Scheduled reminders are verified every 60 seconds by the background scheduler. You can also manually trigger any reminder stage immediately below.
              </div>

              {[
                { type: 'initial' as MaintenanceReminderType, label: '1. Initial Announcement', desc: 'Dispatched immediately when announcement is saved.' },
                { type: '3_days_before' as MaintenanceReminderType, label: '2. Reminder 3 Days Before', desc: 'Alerts users 72 hours in advance of the maintenance start.' },
                { type: '1_day_before' as MaintenanceReminderType, label: '3. Reminder 1 Day Before', desc: 'Alerts users 24 hours in advance to save critical tasks.' },
                { type: '30_mins_before' as MaintenanceReminderType, label: '4. Reminder 30 Minutes Before', desc: 'Final urgent reminder to log out of affected systems.' },
                { type: 'started' as MaintenanceReminderType, label: '5. Maintenance Started', desc: 'Notifies staff that maintenance window is now active.' },
                { type: 'completed' as MaintenanceReminderType, label: '6. Maintenance Completed', desc: 'Informs users that systems have been restored to normal.' },
                { type: 'cancelled' as MaintenanceReminderType, label: '7. Maintenance Cancelled', desc: 'Broadcasted if maintenance is aborted or rescheduled.' },
              ].map((item) => {
                const rem = scheduleTargetAnnouncement.reminders?.find((r) => r.reminderType === item.type);
                const status = rem?.status || 'Not Configured';

                return (
                  <div
                    key={item.type}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            status === 'Sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'Scheduled'
                              ? 'bg-blue-100 text-blue-800'
                              : status === 'Failed'
                              ? 'bg-rose-100 text-rose-800'
                              : status === 'Cancelled'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                      <div className="text-[11px] font-mono text-slate-600">
                        Scheduled Execution: <strong>{formatDateTimeDisplay(rem?.scheduledTime || '')}</strong>
                        {rem?.sentTime && ` • Sent at: ${formatDateTimeDisplay(rem.sentTime)}`}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-center">
                      <button
                        onClick={() => handleTriggerReminderNow(scheduleTargetAnnouncement.id, item.type)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                        title="Force send this reminder immediately"
                      >
                        <Send className="w-3 h-3 text-blue-600" />
                        <span>Send Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Close Pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
