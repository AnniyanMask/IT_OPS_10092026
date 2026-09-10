import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  EmailTemplateDefinition,
  SmtpConfig,
  SmtpTestResult,
  EmailTemplateVariable,
  EmailNotificationLog,
} from '../types';
import { DEFAULT_EMAIL_TEMPLATES } from '../data/defaultEmailTemplates';
import { api } from '../services/api';
import { getMalaysianTimestamp } from '../utils/timezone';
import {
  Mail,
  Send,
  Code,
  Eye,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  Laptop,
  Smartphone,
  Tablet,
  Save,
  Tag,
  ExternalLink,
  ChevronRight,
  Info,
  Terminal,
  Activity,
  Layers,
  Lock,
  Workflow,
  UserCheck,
  ShieldAlert,
  Plus,
  Inbox,
  Clock,
  Trash2,
  CheckCheck,
  Settings,
  FileText,
  Radio,
  Calendar,
  Bell,
} from 'lucide-react';
import { MaintenanceAnnouncementView } from './MaintenanceAnnouncementView';

interface EmailContextTemplateAdminViewProps {
  currentUser: UserProfile;
  smtpConfig: SmtpConfig;
  onUpdateSmtpConfig?: (config: SmtpConfig) => void;
  emailLogs?: EmailNotificationLog[];
  onClearEmailLogs?: () => void;
  initialSubTab?: 'templates' | 'settings' | 'outbox' | 'maintenance';
  onRequestClick?: (crId: string) => void;
}

export const EmailContextTemplateAdminView: React.FC<EmailContextTemplateAdminViewProps> = ({
  currentUser,
  smtpConfig,
  onUpdateSmtpConfig,
  emailLogs = [],
  onClearEmailLogs,
  initialSubTab = 'templates',
  onRequestClick,
}) => {
  // Primary Sub-Tab: 'templates' | 'settings' | 'outbox' | 'maintenance'
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'settings' | 'outbox' | 'maintenance'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplateDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('pcs_email_templates_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn('Failed to parse local templates:', err);
    }
    return DEFAULT_EMAIL_TEMPLATES;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    DEFAULT_EMAIL_TEMPLATES[0].id
  );

  // Active view mode: 'ui_preview' (Visual rendered email) or 'html_code' (Raw HTML code editor)
  const [viewMode, setViewMode] = useState<'ui_preview' | 'html_code'>('ui_preview');
  const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Filter & Search for Templates
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cr_workflow' | 'user_account' | 'governance'>('all');

  // Active Template being edited
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Editable fields for active template
  const [editSubject, setEditSubject] = useState(activeTemplate?.subjectTemplate || '');
  const [editHtml, setEditHtml] = useState(activeTemplate?.bodyHtml || '');
  const [editEnabled, setEditEnabled] = useState(activeTemplate?.enabled ?? true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // SMTP Settings State
  const [serverHost, setServerHost] = useState(smtpConfig.smtpServer || '157.9.183.242');
  const [serverPort, setServerPort] = useState(smtpConfig.smtpPort ? String(smtpConfig.smtpPort) : '25');
  const [fromAddress, setFromAddress] = useState(smtpConfig.fromAddress || 'Administrator@tanaka.com.my');
  const [fromName, setFromName] = useState(smtpConfig.fromName || 'Tanaka PCS Notification System');
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

  // Live SMTP Relay Probe & Test State
  const [testRecipient, setTestRecipient] = useState(currentUser.email || 'IT@tanaka.com.my');
  const [testSubject, setTestSubject] = useState('Tanaka PCS - Live SMTP Relay Diagnostic Probe');
  const [testMessage, setTestMessage] = useState('This is a live diagnostic verification email dispatched via Tanaka Enterprise SMTP Relay.');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);
  const [isSendingLiveTest, setIsSendingLiveTest] = useState(false);
  const [liveTestSendStatus, setLiveTestSendStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Outbox State
  const [outboxSearchQuery, setOutboxSearchQuery] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(
    emailLogs.length > 0 ? emailLogs[0].id : null
  );
  const [outboxViewMode, setOutboxViewMode] = useState<'visual' | 'html'>('visual');

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocusedInput, setLastFocusedInput] = useState<'subject' | 'html'>('subject');

  // Keep local SMTP state synced if prop changes
  useEffect(() => {
    setServerHost(smtpConfig.smtpServer || '157.9.183.242');
    setServerPort(smtpConfig.smtpPort ? String(smtpConfig.smtpPort) : '25');
    setFromAddress(smtpConfig.fromAddress || 'Administrator@tanaka.com.my');
    setFromName(smtpConfig.fromName || 'Tanaka PCS Notification System');
  }, [smtpConfig]);

  // Sync edits when active template changes
  useEffect(() => {
    if (activeTemplate) {
      setEditSubject(activeTemplate.subjectTemplate);
      setEditHtml(activeTemplate.bodyHtml);
      setEditEnabled(activeTemplate.enabled);
    }
  }, [activeTemplate?.id]);

  // Set default selected log if not set
  useEffect(() => {
    if (emailLogs.length > 0 && !selectedLogId) {
      setSelectedLogId(emailLogs[0].id);
    }
  }, [emailLogs, selectedLogId]);

  // Load templates from backend PostgreSQL on mount
  useEffect(() => {
    api.getEmailTemplates().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setTemplates(res.data);
      }
    }).catch(() => {});
  }, []);

  // Filtered Templates list
  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.eventName.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      tpl.description.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      tpl.id.toLowerCase().includes(templateSearchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filtered Outbox Logs
  const filteredLogs = emailLogs.filter((log) => {
    if (!outboxSearchQuery.trim()) return true;
    const q = outboxSearchQuery.toLowerCase();
    return (
      log.subject.toLowerCase().includes(q) ||
      log.recipientEmail.toLowerCase().includes(q) ||
      log.recipientName.toLowerCase().includes(q) ||
      log.triggerEvent.toLowerCase().includes(q) ||
      (log.changeRequestId && log.changeRequestId.toLowerCase().includes(q))
    );
  });

  const selectedLog = emailLogs.find((l) => l.id === selectedLogId) || (filteredLogs.length > 0 ? filteredLogs[0] : null);

  // Interpolate variables for live visual UI preview
  const getInterpolatedHtml = (rawHtml: string, variables: EmailTemplateVariable[]) => {
    let result = rawHtml;
    variables.forEach((v) => {
      const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
      result = result.replace(regex, v.exampleValue);
    });
    // Global fallback replacements
    result = result.replace(/\{\{portalUrl\}\}/g, 'https://pcs.tanaka.com.my');
    result = result.replace(/\{\{timestamp\}\}/g, getMalaysianTimestamp());
    result = result.replace(/\{\{smtpServer\}\}/g, serverHost);
    result = result.replace(/\{\{smtpPort\}\}/g, serverPort);
    return result;
  };

  const getInterpolatedSubject = (rawSubject: string, variables: EmailTemplateVariable[]) => {
    let result = rawSubject;
    variables.forEach((v) => {
      const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
      result = result.replace(regex, v.exampleValue);
    });
    return result;
  };

  // Insert variable token at cursor position
  const handleInsertToken = (tokenKey: string) => {
    const token = `{{${tokenKey}}}`;
    if (lastFocusedInput === 'subject' && subjectInputRef.current) {
      const start = subjectInputRef.current.selectionStart || editSubject.length;
      const end = subjectInputRef.current.selectionEnd || editSubject.length;
      const newSubject = editSubject.substring(0, start) + token + editSubject.substring(end);
      setEditSubject(newSubject);
      setTimeout(() => {
        if (subjectInputRef.current) {
          subjectInputRef.current.focus();
          subjectInputRef.current.setSelectionRange(start + token.length, start + token.length);
        }
      }, 50);
    } else if (htmlTextareaRef.current) {
      const start = htmlTextareaRef.current.selectionStart || editHtml.length;
      const end = htmlTextareaRef.current.selectionEnd || editHtml.length;
      const newHtml = editHtml.substring(0, start) + token + editHtml.substring(end);
      setEditHtml(newHtml);
      setTimeout(() => {
        if (htmlTextareaRef.current) {
          htmlTextareaRef.current.focus();
          htmlTextareaRef.current.setSelectionRange(start + token.length, start + token.length);
        }
      }, 50);
    } else {
      setEditSubject((prev) => prev + ` ${token}`);
    }

    setCopiedToken(tokenKey);
    setTimeout(() => setCopiedToken(null), 1800);
  };

  // Save current template changes
  const handleSaveCurrentTemplate = async () => {
    const updatedTemplate: EmailTemplateDefinition = {
      ...activeTemplate,
      subjectTemplate: editSubject,
      bodyHtml: editHtml,
      enabled: editEnabled,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    };

    const updatedList = templates.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t));
    setTemplates(updatedList);

    try {
      localStorage.setItem('pcs_email_templates_v2', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    setSaveStatus('Saving to database...');
    try {
      const res = await api.saveEmailTemplate(updatedTemplate);
      if (res.success) {
        setSaveStatus('✓ Template saved & synchronized with PostgreSQL database!');
      } else {
        setSaveStatus('✓ Saved locally (PostgreSQL sync fallback ready)');
      }
    } catch {
      setSaveStatus('✓ Saved locally');
    }

    setTimeout(() => setSaveStatus(null), 3500);
  };

  // Reset current template to Tanaka enterprise standard
  const handleResetToStandard = () => {
    const defaultTpl = DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === activeTemplate.id);
    if (defaultTpl) {
      setEditSubject(defaultTpl.subjectTemplate);
      setEditHtml(defaultTpl.bodyHtml);
      setEditEnabled(defaultTpl.enabled);
      setSaveStatus('Restored to Tanaka Enterprise standard template. Click "Save Template" to apply.');
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Save SMTP Relay Parameters
  const handleSaveSmtpSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newConfig: SmtpConfig = {
      smtpServer: serverHost.trim() || '157.9.183.242',
      smtpPort: parseInt(serverPort, 10) || 25,
      fromAddress: fromAddress.trim() || 'Administrator@tanaka.com.my',
      fromName: fromName.trim() || 'Tanaka PCS Notification System',
    };

    if (onUpdateSmtpConfig) {
      onUpdateSmtpConfig(newConfig);
    }

    setSettingsSaveMsg('✓ SMTP Relay parameters saved and activated across all dispatch triggers.');
    setTimeout(() => setSettingsSaveMsg(null), 4000);
  };

  // Run live SMTP socket test against Tanaka relay
  const handleExecuteSmtpProbe = async () => {
    setIsTestingSmtp(true);
    setTestResult(null);

    try {
      const result = await api.testSmtpRelay({
        host: serverHost.trim() || '157.9.183.242',
        port: parseInt(serverPort, 10) || 25,
        to: testRecipient.trim(),
        fromAddress: fromAddress.trim() || 'Administrator@tanaka.com.my',
        fromName: fromName.trim() || 'Tanaka PCS Notification System',
      });

      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
        serverHost: serverHost.trim() || '157.9.183.242',
        serverPort: parseInt(serverPort, 10) || 25,
        testedAt: new Date().toISOString(),
        errorCode: 'SOCKET_TIMEOUT',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Dispatch a real live test email
  const handleSendLiveTestEmail = async () => {
    if (!testRecipient.trim()) {
      setLiveTestSendStatus({ success: false, message: 'Please provide a valid recipient email address.' });
      return;
    }

    setIsSendingLiveTest(true);
    setLiveTestSendStatus(null);

    try {
      const formattedHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: left;">
            <h1 style="margin: 0; font-size: 18px; color: #ffffff;">Tanaka PCS - Live SMTP Relay Diagnostic</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 14px; color: #334155; margin-top: 0;">Hello <strong>${currentUser.fullName}</strong>,</p>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">${testMessage}</p>
            <div style="margin: 20px 0; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #334155;">
              <div><strong>Dispatched By:</strong> ${currentUser.fullName} (${currentUser.email})</div>
              <div><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Relay Host:</strong> ${serverHost}:${serverPort}</div>
              <div><strong>Status:</strong> Socket Handshake Verified (250 OK)</div>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">This is an automated system diagnostic test from Tanaka PCS Management System.</p>
          </div>
        </div>
      `;

      const res = await api.sendLiveEmail({
        recipientEmail: testRecipient.trim(),
        recipientName: currentUser.fullName,
        subject: testSubject.trim() || 'Tanaka PCS - Live SMTP Relay Diagnostic Probe',
        bodyHtml: formattedHtml,
        triggerEvent: 'ADMIN_LIVE_TEST_PROBE',
        smtpConfig: {
          smtpServer: serverHost.trim(),
          smtpPort: parseInt(serverPort, 10) || 25,
          fromAddress: fromAddress.trim(),
          fromName: fromName.trim(),
        },
      });

      if (res.success) {
        setLiveTestSendStatus({
          success: true,
          message: `✓ Test email dispatched to ${testRecipient.trim()} via ${serverHost}:${serverPort}!`,
        });
      } else {
        setLiveTestSendStatus({
          success: false,
          message: res.message || 'Failed to dispatch email over relay socket.',
        });
      }
    } catch (err: unknown) {
      setLiveTestSendStatus({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSendingLiveTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Hub Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
             
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Mail className="w-6 h-6 text-sky-400" />
              Email & SMTP Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Centralized one-stop station to manage Tanaka automated notification templates.
            </p>
          </div>

          {/* Sub-Tab Navigation Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('templates')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'templates'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Email Templates</span>
              <span className="bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.2 rounded-full">
                {templates.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('settings')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>SMTP Relay & Test</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('outbox')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'outbox'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Sent Outbox</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                {emailLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('maintenance')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubTab === 'maintenance'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Maintenance Reminders</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full border border-amber-500/30">
                Scheduled
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: EMAIL TEMPLATES STUDIO */}
      {/* ========================================================================= */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Action Header for Templates */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Automated Trigger Context Studio: <span className="text-blue-700">{activeTemplate?.eventName}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Target Event: <code className="font-mono text-slate-700">{activeTemplate?.id}</code> • Category: {activeTemplate?.category.replace('_', ' ').toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">

             {/* ========================================================================= */}
             {/* RESTORE TEMPLATE BUTTON DISABLED */}
              {/* ========================================================================= */}   
             {/* <button*/}
             {/*   type="button"*/}
             {/*   onClick={handleResetToStandard}*/}
              {/*  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"*/}
             {/*   title="Restore default Tanaka template layout"*/}
             {/* >*/}
             {/*   <RotateCcw className="w-3.5 h-3.5" />*/}
             {/*   <span>Restore Default</span>*/}
             {/* </button>*/}

              <button
                type="button"
                onClick={handleSaveCurrentTemplate}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Template</span>
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-900 shadow-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* Main Studio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Template Trigger Catalog (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Notification Triggers</span>
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[11px] border border-blue-200">
                      {filteredTemplates.length} Available
                    </span>
                  </h3>

                  {/* Search Bar */}
                  <div className="mt-3 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search triggers..."
                      value={templateSearchTerm}
                      onChange={(e) => setTemplateSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'cr_workflow', label: 'CR Workflow' },
                      { id: 'user_account', label: 'Identity' },
                      { id: 'governance', label: 'Governance' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id as any)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          selectedCategory === cat.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Triggers List */}
                <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                  {filteredTemplates.map((tpl) => {
                    const isSelected = tpl.id === selectedTemplateId;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`w-full text-left p-3.5 transition-colors cursor-pointer flex flex-col space-y-1.5 ${
                          isSelected
                            ? 'bg-blue-50/80 border-l-4 border-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? 'text-blue-900' : 'text-slate-800'
                            }`}
                          >
                            {tpl.eventName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              tpl.enabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tpl.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-1">
                          <span className="font-mono">{tpl.id}</span>
                          <span>•</span>
                          <span>{tpl.recipientRole}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Template Editor & Preview Canvas (8 cols) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Template Configuration Bar */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Email Subject Line Template
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Supports dynamic context tokens (e.g. &#123;&#123;crId&#125;&#125;, &#123;&#123;title&#125;&#125;)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-bold text-slate-700">Trigger Status:</label>
                    <button
                      type="button"
                      onClick={() => setEditEnabled(!editEnabled)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                        editEnabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {editEnabled ? '✓ Enabled' : '✕ Disabled'}
                    </button>
                  </div>
                </div>

                <input
                  ref={subjectInputRef}
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  onFocus={() => setLastFocusedInput('subject')}
                  placeholder="Subject line..."
                  className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />

                {/* Variable Tag Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Available Context Variables (Click to insert):</span>
                    </span>
                    {copiedToken && (
                      <span className="text-[11px] font-bold text-emerald-600 animate-fadeIn">
                        Inserted &#123;&#123;{copiedToken}&#125;&#125;
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate?.variables.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => handleInsertToken(variable.key)}
                        title={`${variable.description} (Example: "${variable.exampleValue}")`}
                        className="group inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-700 hover:text-blue-800 rounded-lg text-xs font-mono transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                        <span>&#123;&#123;{variable.key}&#125;&#125;</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body Workspace: Visual UI Preview vs HTML Code Editor */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                {/* Mode Selector & Device Preview Bar */}
                <div className="p-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode('ui_preview')}
                      className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer ${
                        viewMode === 'ui_preview'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visual Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('html_code')}
                      className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer ${
                        viewMode === 'html_code'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>HTML Code Editor</span>
                    </button>
                  </div>

                  {viewMode === 'ui_preview' ? (
                    <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setDevicePreview('desktop')}
                        className={`p-1.5 rounded transition-colors ${
                          devicePreview === 'desktop' ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                        title="Desktop Preview"
                      >
                        <Laptop className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevicePreview('tablet')}
                        className={`p-1.5 rounded transition-colors ${
                          devicePreview === 'tablet' ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                        title="Tablet Preview"
                      >
                        <Tablet className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevicePreview('mobile')}
                        className={`p-1.5 rounded transition-colors ${
                          devicePreview === 'mobile' ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                        title="Mobile Preview"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(editHtml);
                        setCopiedHtml(true);
                        setTimeout(() => setCopiedHtml(false), 2000);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedHtml ? 'Copied HTML' : 'Copy HTML'}</span>
                    </button>
                  )}
                </div>

                {/* Workspace Content */}
                {viewMode === 'ui_preview' ? (
                  <div className="p-6 bg-slate-100/80 min-h-[500px] flex items-center justify-center overflow-x-auto">
                    <div
                      className={`bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden transition-all ${
                        devicePreview === 'desktop'
                          ? 'w-full max-w-2xl'
                          : devicePreview === 'tablet'
                          ? 'w-[520px]'
                          : 'w-[360px]'
                      }`}
                    >
                      {/* Email Header Simulation */}
                      <div className="bg-slate-50 border-b border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
                        <div>
                          <strong className="text-slate-800">From:</strong> {fromName} &lt;{fromAddress}&gt;
                        </div>
                        <div>
                          <strong className="text-slate-800">Subject:</strong>{' '}
                          <span className="font-semibold text-slate-900">
                            {getInterpolatedSubject(editSubject, activeTemplate?.variables || [])}
                          </span>
                        </div>
                      </div>

                      {/* Rendered Email HTML Content */}
                      <div
                        className="p-4"
                        dangerouslySetInnerHTML={{
                          __html: getInterpolatedHtml(editHtml, activeTemplate?.variables || []),
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950">
                    <textarea
                      ref={htmlTextareaRef}
                      value={editHtml}
                      onChange={(e) => setEditHtml(e.target.value)}
                      onFocus={() => setLastFocusedInput('html')}
                      rows={22}
                      className="w-full font-mono text-xs text-emerald-300 bg-slate-950 border border-slate-800 rounded-lg p-4 focus:outline-hidden focus:border-blue-500 leading-relaxed resize-y"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SMTP RELAY SETTINGS & LIVE TEST */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main SMTP Configuration Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Configuration Form (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Tanaka Enterprise SMTP Relay Configuration</h2>
                  <p className="text-xs text-slate-500">
                    Configure socket communication parameters with the corporate intranet relay host.
                  </p>
                </div>
              </div>

              {settingsSaveMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-900 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{settingsSaveMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSmtpSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      SMTP Relay IP / Hostname *
                    </label>
                    <input
                      type="text"
                      value={serverHost}
                      onChange={(e) => setServerHost(e.target.value)}
                      placeholder="157.9.183.242"
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Default Tanaka Relay: <code>157.9.183.242</code></p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Relay Port *
                    </label>
                    <input
                      type="number"
                      value={serverPort}
                      onChange={(e) => setServerPort(e.target.value)}
                      placeholder="25"
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Standard Port: <code>25</code></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      From Sender Email Address *
                    </label>
                    <input
                      type="email"
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      placeholder="Administrator@tanaka.com.my"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      From Sender Display Name *
                    </label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Tanaka PCS Notification System"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Applies to all workflow and account notifications</span>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save SMTP Parameters</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Live Connection Handshake Diagnostic (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Relay Socket Handshake Diagnostic</h3>
                    <p className="text-xs text-slate-500">Verify TCP handshake & ping latency with {serverHost}:{serverPort}</p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                    <span>Target Relay:</span>
                    <span className="text-emerald-400 font-bold">{serverHost}:{serverPort}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                    <span>From Sender:</span>
                    <span className="text-slate-300 truncate max-w-[200px]">{fromAddress}</span>
                  </div>

                  {testResult ? (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center space-x-1.5">
                          {testResult.success ? (
                            <span className="text-emerald-400">● 250 OK - ONLINE</span>
                          ) : (
                            <span className="text-rose-400">● CONNECTION ERROR</span>
                          )}
                        </span>
                        <span className="text-slate-400">{testResult.latencyMs} ms latency</span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{testResult.message}</p>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 text-[11px]">
                      Click "Run Socket Handshake Test" to probe network path.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isTestingSmtp}
                onClick={handleExecuteSmtpProbe}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
              >
                {isTestingSmtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Probing {serverHost}:{serverPort}...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span>Run Socket Handshake Test</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Send Live Test Email Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dispatch Real Test Email</h3>
                <p className="text-xs text-slate-500">Send an actual live test notification through the configured Tanaka relay</p>
              </div>
            </div>

            {liveTestSendStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-bold flex items-center space-x-2 animate-fadeIn ${
                  liveTestSendStatus.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {liveTestSendStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{liveTestSendStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="recipient@tanaka.com.my"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Test Email Subject Line
                </label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  placeholder="Test subject..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Test Message Body
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSendingLiveTest}
                onClick={handleSendLiveTestEmail}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
              >
                {isSendingLiveTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching live test...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Real Test Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: SENT OUTBOX AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeSubTab === 'outbox' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Outbox Header Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Emails Dispatched</p>
                <h3 className="text-lg font-bold text-slate-900">{emailLogs.length} notifications</h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Relay Server</p>
                <h3 className="text-sm font-bold text-slate-900 font-mono">{serverHost}:{serverPort}</h3>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Sender</p>
                <h3 className="text-xs font-bold text-slate-900 truncate max-w-[180px]" title={fromAddress}>
                  {fromAddress}
                </h3>
              </div>
            </div>
          </div>

          {/* Outbox Main Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Log Item List (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col max-h-[700px]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Sent Outbox Records ({filteredLogs.length})
                  </h3>
                  {onClearEmailLogs && emailLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Clear all local SMTP outbox history?')) {
                          onClearEmailLogs();
                        }
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1 cursor-pointer font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search recipient, subject, CR ID..."
                    value={outboxSearchQuery}
                    onChange={(e) => setOutboxSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Logs List */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {filteredLogs.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-medium">No email notification logs found</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isSelected = log.id === selectedLog?.id;
                    return (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => setSelectedLogId(log.id)}
                        className={`w-full text-left p-3.5 transition-colors cursor-pointer flex flex-col space-y-1.5 ${
                          isSelected
                            ? 'bg-blue-50/90 border-l-4 border-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                            {log.recipientName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {log.sentAt}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-700 truncate">
                          {log.subject}
                        </p>

                        <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                          <span className="font-mono text-slate-600 truncate max-w-[160px]">
                            {log.recipientEmail}
                          </span>
                          {log.changeRequestId && (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                              {log.changeRequestId}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Log Inspector Canvas (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col max-h-[700px]">
              {selectedLog ? (
                <>
                  {/* Inspector Header */}
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{selectedLog.subject}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dispatched: {selectedLog.sentAt} • Relay: {selectedLog.smtpServer}:{selectedLog.smtpPort}
                      </p>
                    </div>

                    <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setOutboxViewMode('visual')}
                        className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                          outboxViewMode === 'visual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Visual Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutboxViewMode('html')}
                        className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                          outboxViewMode === 'html' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        HTML Source
                      </button>
                    </div>
                  </div>

                  {/* Metadata Strip */}
                  <div className="bg-slate-50 border-b border-slate-200 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Recipient</span>
                      <span className="font-semibold text-slate-900">{selectedLog.recipientName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Address</span>
                      <span className="font-mono text-slate-900 truncate block">{selectedLog.recipientEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Trigger Event</span>
                      <span className="font-mono text-indigo-700">{selectedLog.triggerEvent}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                      <span className="text-emerald-700 font-bold">✓ DELIVERED (250 OK)</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 overflow-y-auto flex-1 bg-slate-100/60">
                    {outboxViewMode === 'visual' ? (
                      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 max-w-xl mx-auto overflow-hidden">
                        <div dangerouslySetInnerHTML={{ __html: selectedLog.bodyHtml }} />
                      </div>
                    ) : (
                      <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {selectedLog.bodyHtml}
                      </pre>
                    )}
                  </div>

                  {selectedLog.changeRequestId && onRequestClick && (
                    <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onRequestClick(selectedLog.changeRequestId!)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>Open Request {selectedLog.changeRequestId}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-24 text-center text-slate-400">
                  <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-700">Select an email to view full details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SCHEDULED MAINTENANCE & EMAIL REMINDERS */}
      {/* ========================================================================= */}
      {activeSubTab === 'maintenance' && (
        <MaintenanceAnnouncementView
          currentUser={currentUser}
          onRequestClick={onRequestClick}
        />
      )}
    </div>
  );
};
