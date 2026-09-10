import React, { useState, useMemo } from 'react';
import { api } from '../services/api';
import { ChangeRequest, UserProfile, CustomRoleDefinition } from '../types';
import { calculateSlaStatus, getSlaBadgeClass, getRiskBadgeClass, getChaseStageInfo } from '../utils/slaAndRisk';
import { formatDisplayDateTime, formatDisplayDate } from '../utils/timezone';
import { hasRolePermission, getEligibleDevelopers } from '../utils/rbac';
import { ItDirectModifyModal, ItDirectModifyPayload } from './ItDirectModifyModal';
import { mockUsers } from '../data/db';
import {
  X,
  FileText,
  Clock,
  User,
  Building,
  Mail,
  Tag,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  MessageSquare,
  ShieldAlert,
  GitCompare,
  Database,
  Timer,
  RotateCcw,
  Send,
  HardDrive,
  Download,
  Lock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Sliders,
  ArrowUpRight,
  ShieldX,
  Code2,
  Edit,
  PauseCircle,
  BellRing,
  AlertOctagon,
  Hourglass,
} from 'lucide-react';

interface RequestDetailModalProps {
  changeRequest: ChangeRequest | null;
  onClose: () => void;
  currentUser: UserProfile;
  developers?: UserProfile[];
  users?: UserProfile[];
  customRoles?: CustomRoleDefinition[];
  changeRequests?: ChangeRequest[];
  onNavigateTab?: (tab: string) => void;
  onEditRequest?: (cr: ChangeRequest) => void;
  onSendBackToRequester?: (crId: string, comments: string) => void;
  onItDirectModify?: (payload: ItDirectModifyPayload) => void;
  onRejectCase?: (crId: string, rejectionReason: string) => void;
  onReopenCase?: (crId: string, reopenComments: string) => void;
  onSendReminderNudge?: (crId: string, stage: 1 | 2 | 3, customNote?: string) => void;
  onAutoCloseInactive?: (crId: string, reason: string) => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  changeRequest,
  onClose,
  currentUser,
  developers: propDevelopers,
  users,
  customRoles = [],
  changeRequests,
  onNavigateTab,
  onEditRequest,
  onSendBackToRequester,
  onItDirectModify,
  onRejectCase,
  onReopenCase,
  onSendReminderNudge,
  onAutoCloseInactive,
}) => {
  const developers = useMemo(() => {
    if (propDevelopers && propDevelopers.length > 0) return propDevelopers;
    const source = users && users.length > 0 ? users : mockUsers;
    return getEligibleDevelopers(source, customRoles);
  }, [propDevelopers, users, customRoles]);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showItModifyModal, setShowItModifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [reopenComments, setReopenComments] = useState('');
  const [clarifyNotes, setClarifyNotes] = useState('');
  const [clarifyError, setClarifyError] = useState('');
  const [showItStorageInspector, setShowItStorageInspector] = useState(false);
  const [copiedAttId, setCopiedAttId] = useState<string | null>(null);

  // Chase Policy & Inactivity Modals State
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [nudgeStage, setNudgeStage] = useState<1 | 2 | 3>(1);
  const [customNudgeNote, setCustomNudgeNote] = useState('');
  const [showAutoCloseModal, setShowAutoCloseModal] = useState(false);
  const [autoCloseReason, setAutoCloseReason] = useState('');

  const latestReturnHistory = useMemo(() => {
    if (!changeRequest || !Array.isArray(changeRequest.approvalHistory)) return null;
    return (
      changeRequest.approvalHistory.find(
        (h) =>
          h &&
          (h.toStatus === 'Returned to Requester' ||
            h.decision === 'SendBack' ||
            (typeof h.comments === 'string' && h.comments.includes('notes:')) ||
            (typeof h.comments === 'string' && h.comments.toLowerCase().includes('clarification')))
      ) || null
    );
  }, [changeRequest]);

  const isItOrSystemAdmin =
    hasRolePermission(currentUser.role, 'canDirectModifyCatalog', customRoles) ||
    currentUser.role === 'IT Admin' ||
    currentUser.role === 'System Admin';

  const handleCopyPhysicalPath = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedAttId(id);
    setTimeout(() => setCopiedAttId(null), 2500);
  };

  if (!changeRequest) return null;

  const slaInfo = calculateSlaStatus(changeRequest);
  const risk = changeRequest.riskAssessment;

  const isItStaff =
    hasRolePermission(currentUser.role, 'canViewItAdminWorkspace', customRoles) ||
    hasRolePermission(currentUser.role, 'canViewDeveloperBoard', customRoles) ||
    currentUser.role === 'IT Admin' ||
    currentUser.role === 'Software Developer' ||
    currentUser.role === 'System Admin';

  const canEditOrProvideClarification =
    (changeRequest.status === 'Returned to Requester' || changeRequest.status === 'Draft') &&
    (currentUser.id === changeRequest.requesterId ||
      (currentUser.email && changeRequest.requesterEmail && currentUser.email.toLowerCase() === changeRequest.requesterEmail.toLowerCase()) ||
      currentUser.role === 'Requester' ||
      currentUser.role === 'System Admin') &&
    Boolean(onEditRequest);

  const canRequestClarification =
    (isItStaff || hasRolePermission(currentUser.role, 'canReturnToRequester', customRoles)) &&
    onSendBackToRequester &&
    changeRequest.status !== 'Draft' &&
    changeRequest.status !== 'Returned to Requester' &&
    changeRequest.status !== 'Closed (Completed)' &&
    changeRequest.status !== 'Closed (Rejected)';

  const canReject =
    (currentUser.role === 'IT Admin' ||
      currentUser.role === 'System Admin' ||
      currentUser.role === 'Software Developer' ||
      currentUser.role === 'Department HOD' ||
      currentUser.role === 'Head of Department (HOD)' ||
      hasRolePermission(currentUser.role, 'canApproveHodStage', customRoles) ||
      hasRolePermission(currentUser.role, 'canTriageAndAssignDevs', customRoles)) &&
    Boolean(onRejectCase) &&
    changeRequest.status !== 'Draft' &&
    changeRequest.status !== 'Closed (Completed)' &&
    changeRequest.status !== 'Closed (Rejected)';

  const canReopen =
    (currentUser.role === 'System Admin' ||
      hasRolePermission(currentUser.role, 'canReopenCases', customRoles)) &&
    Boolean(onReopenCase) &&
    changeRequest.status === 'Closed (Rejected)';

  const handleSendClarification = () => {
    if (!clarifyNotes.trim()) {
      setClarifyError('Please enter what technical details or clarifications are needed.');
      return;
    }
    if (onSendBackToRequester) {
      onSendBackToRequester(changeRequest.id, clarifyNotes);
    }
    setShowClarifyModal(false);
    setClarifyNotes('');
    onClose();
  };

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a mandatory justification reason for rejecting this case.');
      return;
    }
    if (onRejectCase) {
      onRejectCase(changeRequest.id, rejectionReason.trim());
    }
    setShowRejectModal(false);
    setRejectionReason('');
    setRejectionError('');
    onClose();
  };

  const handleConfirmReopen = () => {
    if (onReopenCase) {
      onReopenCase(changeRequest.id, reopenComments.trim());
    }
    setShowReopenModal(false);
    setReopenComments('');
    onClose();
  };

  const handleSaveItModify = (payload: ItDirectModifyPayload) => {
    if (onItDirectModify) {
      onItDirectModify(payload);
    }
    setShowItModifyModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
          {/* Header */}
        <div className="bg-slate-900 text-white p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <span className="font-mono text-sm font-bold text-blue-400 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                {changeRequest.id}
              </span>
              <span
                className={`text-xs font-semibold px-3 py-0.5 rounded-full border ${
                  changeRequest.status === 'Closed (Completed)'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : changeRequest.status === 'In Progress'
                    ? 'bg-blue-950 text-blue-300 border-blue-800'
                    : changeRequest.status === 'Pending IT Verification'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {changeRequest.status}
              </span>

              {(changeRequest.hodApprovalSkipped || (changeRequest.priority === 'Critical' && changeRequest.status !== 'Draft')) && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-slate-400" />
                  <span>HOD approval skipped</span>
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold">{changeRequest.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time SLA Status & Risk Indicator Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            {slaInfo.isPaused ? (
              <>
                <PauseCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                <span className="font-semibold text-amber-950">Resolution SLA:</span>
                <span className={`px-2.5 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1 ${getSlaBadgeClass(slaInfo.slaStatus)}`}>
                  <PauseCircle className="w-3 h-3 text-amber-700" />
                  <span>SLA PAUSED (Waiting on Requester)</span>
                </span>
                <span className="text-slate-600 text-[11px]">
                  ({slaInfo.daysWaitingOnRequester ?? 0}d {((slaInfo.hoursWaitingOnRequester ?? 0) % 24)}h paused • Net Active: {slaInfo.hoursElapsed}h / {slaInfo.targetHours}h)
                </span>
              </>
            ) : (
              <>
                <Timer className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-700">Stage SLA ({slaInfo.stageName}):</span>
                <span className={`px-2.5 py-0.5 rounded border text-[11px] font-bold ${getSlaBadgeClass(slaInfo.slaStatus)}`}>
                  {slaInfo.slaStatus === 'SLA Breached' ? 'SLA BREACHED' : slaInfo.slaStatus === 'Nearing Breach' ? 'NEARING BREACH' : 'ON TRACK'} 
                  {' '}({slaInfo.hoursElapsed}h elapsed / {slaInfo.targetHours}h SLA)
                </span>
              </>
            )}
          </div>

          {risk && (
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-slate-600" />
              <span className="font-semibold text-slate-700">Risk Assessment:</span>
              <span className={`px-2.5 py-0.5 rounded border text-[11px] ${getRiskBadgeClass(risk.riskLevel)}`}>
                {risk.riskLevel} Risk ({risk.riskScore}/100)
              </span>
            </div>
          )}
        </div>

        {/* Rejection Notification / System Admin Reopen Banner */}
        {(changeRequest.status === 'Closed (Rejected)' || changeRequest.rejectionReason) && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-4 flex items-start space-x-3 text-rose-950">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-rose-950 text-sm flex items-center gap-2">
                  <span>Case Status: Closed (Rejected)</span>
                  {changeRequest.rejectedByRole && (
                    <span className="bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-300">
                      Rejected by {changeRequest.rejectedByName || 'Staff'} ({changeRequest.rejectedByRole})
                    </span>
                  )}
                </span>
                {changeRequest.rejectedAt && (
                  <span className="text-[11px] text-rose-700 font-mono">
                    Rejected Date: {formatDisplayDateTime(changeRequest.rejectedAt)}
                  </span>
                )}
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-rose-200 text-rose-900">
                <strong className="text-rose-950 block mb-0.5">Rejection Reason & Justification:</strong>
                <p className="leading-relaxed whitespace-pre-wrap">{changeRequest.rejectionReason || 'No justification entered.'}</p>
              </div>

              {changeRequest.reopenedByName && (
                <div className="bg-indigo-50/90 p-2.5 rounded-xl border border-indigo-200 text-indigo-950 text-xs flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Previously Reopened by System Admin {changeRequest.reopenedByName}:</strong> "{changeRequest.reopenComments || 'Reopened and routed back.'}" ({formatDisplayDateTime(changeRequest.reopenedAt)})
                  </span>
                </div>
              )}

              {currentUser.role === 'System Admin' && changeRequest.status === 'Closed (Rejected)' && (
                <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-indigo-900 font-semibold bg-indigo-100/90 px-3 py-1 rounded-lg border border-indigo-300">
                    ⚡ System Admin Privilege: Reopening this case will automatically route it back to {changeRequest.rejectedByName || 'the person who rejected it'}.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Case Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clarification Requested Banner if Returned to Requester */}
        {changeRequest.status === 'Returned to Requester' && (
          <div className="bg-amber-500/10 border-b-2 border-amber-300 px-6 py-4 flex items-start space-x-3 text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <span>Action Required: Technical Details / Clarification Requested</span>
                  {changeRequest.returnedByRole && (
                    <span className="bg-amber-200/90 text-amber-900 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-300">
                      Requested by {latestReturnHistory?.actorName || 'Staff'} ({changeRequest.returnedByRole})
                    </span>
                  )}
                </span>
                {latestReturnHistory?.actionDate && (
                  <span className="text-[11px] text-amber-800 font-mono">
                    Returned: {formatDisplayDateTime(latestReturnHistory.actionDate)}
                  </span>
                )}
              </div>

              {latestReturnHistory?.comments && (
                <div className="bg-white/95 p-3 rounded-xl border border-amber-200 text-amber-900 shadow-2xs">
                  <strong className="text-amber-950 block mb-0.5">Questions / Requested Clarifications:</strong>
                  <p className="leading-relaxed whitespace-pre-wrap font-medium">{latestReturnHistory.comments}</p>
                </div>
              )}

              {/* 3-Stage Chase Policy & SLA Paused Metrics Card */}
              <div className="bg-white/80 rounded-xl border border-amber-200/80 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <PauseCircle className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-amber-950 text-xs">
                      SLA Clock is PAUSED — Waiting on Requester
                    </span>
                    <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 font-medium">
                      Paused duration: {slaInfo.daysWaitingOnRequester ?? 0}d {((slaInfo.hoursWaitingOnRequester ?? 0) % 24)}h
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Chase Status:</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getChaseStageInfo(slaInfo.chaseStage).colorClass}`}>
                      {getChaseStageInfo(slaInfo.chaseStage).shortBadge}
                    </span>
                  </div>
                </div>

                {/* 3-Strike Stage Progress Tracker */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className={`p-2 rounded-lg border text-center transition-all ${
                    slaInfo.chaseStage === 1
                      ? 'bg-amber-100/90 border-amber-400 font-bold text-amber-950 shadow-2xs'
                      : slaInfo.chaseStage > 1
                      ? 'bg-slate-100 border-slate-200 text-slate-600 line-through'
                      : 'bg-white/60 border-slate-200 text-slate-500'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wide font-bold">Stage 1 (Day 2+)</div>
                    <div className="text-[11px]">Friendly Nudge</div>
                  </div>

                  <div className={`p-2 rounded-lg border text-center transition-all ${
                    slaInfo.chaseStage === 2
                      ? 'bg-orange-100/90 border-orange-400 font-bold text-orange-950 shadow-2xs'
                      : slaInfo.chaseStage > 2
                      ? 'bg-slate-100 border-slate-200 text-slate-600 line-through'
                      : 'bg-white/60 border-slate-200 text-slate-500'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wide font-bold">Stage 2 (Day 4+)</div>
                    <div className="text-[11px]">Urgent (CC HOD)</div>
                  </div>

                  <div className={`p-2 rounded-lg border text-center transition-all ${
                    slaInfo.chaseStage === 3
                      ? 'bg-rose-100/90 border-rose-400 font-bold text-rose-950 shadow-2xs animate-pulse'
                      : 'bg-white/60 border-slate-200 text-slate-500'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wide font-bold">Stage 3 (Day 7+)</div>
                    <div className="text-[11px]">Final Notice (48h)</div>
                  </div>
                </div>

                {/* Reminder history summary */}
                <div className="text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-1 pt-1">
                  <span>
                    Reminders sent: <strong>{changeRequest.reminderCount || 0}</strong>
                    {changeRequest.lastReminderSentAt && (
                      <span className="text-slate-500 ml-1">
                        (Last sent: {formatDisplayDateTime(changeRequest.lastReminderSentAt)})
                      </span>
                    )}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Policy: Auto-withdrawal on 7+ days inactivity (with 1-click reopen guarantee)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                {canEditOrProvideClarification ? (
                  <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <span className="text-[11px] text-amber-900 font-medium">
                      Click below to respond, update technical specifications, or attach screenshots to resume the ticket.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onEditRequest) {
                          onEditRequest(changeRequest);
                        }
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Provide Clarification & Update Details</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <span className="text-[11px] text-slate-600">
                      Waiting for requester (<strong>{changeRequest.requesterName}</strong>) to respond.
                    </span>

                    <div className="flex items-center space-x-2">
                      {isItStaff && onSendReminderNudge && (
                        <button
                          type="button"
                          onClick={() => {
                            setNudgeStage((slaInfo.chaseStage || 1) as 1 | 2 | 3);
                            setCustomNudgeNote('');
                            setShowNudgeModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Dispatch Chase Nudge ({getChaseStageInfo(slaInfo.chaseStage).shortBadge})</span>
                        </button>
                      )}

                      {(isItStaff || isItOrSystemAdmin) && onAutoCloseInactive && (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoCloseReason(`Auto-withdrawn due to ${slaInfo.daysWaitingOnRequester ?? 7}+ days of inactivity with no requester response to clarification requests.`);
                            setShowAutoCloseModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-slate-700 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Auto-Withdraw (Inactive)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Metadata Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-500 block font-medium">Requester</span>
              <strong className="text-slate-900 text-sm">{changeRequest.requesterName}</strong>
              <div className="text-[10px] text-slate-500">{changeRequest.requesterEmail}</div>
            </div>

            <div>
              <span className="text-slate-500 block font-medium">Department</span>
              <strong className="text-slate-900 text-sm">{changeRequest.departmentName}</strong>
            </div>

            <div>
              <span className="text-slate-500 block font-medium">Type & Priority</span>
              <div className="font-semibold text-slate-900 flex items-center space-x-1.5 flex-wrap">
                <span>{changeRequest.requestType} •</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                  changeRequest.priority === 'Critical'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                    : changeRequest.priority === 'High'
                    ? 'bg-orange-50 text-orange-800 border-orange-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {changeRequest.priority}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block font-medium">Timeline</span>
              <div className="text-slate-800 font-semibold">
                Created: {formatDisplayDateTime(changeRequest.createdAt)}
              </div>
              <div className="text-slate-600">Target: {formatDisplayDate(changeRequest.requestedCompletionDate)}</div>
            </div>
          </div>

          {/* IT Priority Change Reason Banner (if priority was modified by IT) */}
          {changeRequest.priorityChangeReason && (
            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
              <div className="p-2 bg-amber-100/80 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-700" />
              </div>
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-semibold text-amber-950 text-xs flex items-center gap-1.5">
                    <span>Priority Adjusted by IT Operations</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-medium">
                      Direct IT Action • No Approval Required
                    </span>
                  </span>
                  {changeRequest.priorityChangedBy && (
                    <span className="text-[11px] text-amber-800 font-medium">
                      By: <strong>{changeRequest.priorityChangedBy}</strong> {changeRequest.priorityChangedAt ? `(${formatDisplayDateTime(changeRequest.priorityChangedAt)})` : ''}
                    </span>
                  )}
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-amber-950 font-normal">
                  "{changeRequest.priorityChangeReason}"
                </div>
                <p className="text-[11px] text-amber-800">
                  IT staff modified the priority directly based on operational triage. The requester was automatically notified via email.
                </p>
              </div>
            </div>
          )}

          {/* Service Catalog Classification Path */}
          {changeRequest.category && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-500 text-[11px]">Classification:</span>
                <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded text-xs font-medium">
                  {changeRequest.category}
                </span>
                {changeRequest.subcategory && (
                  <>
                    <span className="text-slate-400 text-xs">➔</span>
                    <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded text-xs font-medium">
                      {changeRequest.subcategory}
                    </span>
                  </>
                )}
                {changeRequest.applicationName && changeRequest.applicationName !== 'N/A' && (
                  <>
                    <span className="text-slate-400 text-xs">➔</span>
                    <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded text-xs font-medium">
                      {changeRequest.applicationName}
                    </span>
                  </>
                )}
                {changeRequest.issueType && (
                  <>
                    <span className="text-slate-400 text-xs">➔</span>
                    <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded text-xs font-medium">
                      {changeRequest.issueType}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Application Areas & Modules */}
          {changeRequest.applicationAreas && Array.isArray(changeRequest.applicationAreas) && changeRequest.applicationAreas.length > 0 ? (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-600 text-[11px] block">
                Target Application Area (Module ➔ Sub-Function ➔ Process)
              </span>
              <div className="flex flex-col gap-1.5">
                {changeRequest.applicationAreas.map((area, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  >
                    <span className="font-semibold text-slate-800">{area.moduleName}</span>
                    {area.subFunctionName && (
                      <>
                        <span className="text-slate-400">➔</span>
                        <span className="font-medium text-slate-700">{area.subFunctionName}</span>
                      </>
                    )}
                    {area.processName && (
                      <>
                        <span className="text-slate-400">➔</span>
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{area.processName}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : changeRequest.affectedModules && Array.isArray(changeRequest.affectedModules) && changeRequest.affectedModules.length > 0 ? (
            <div className="space-y-1">
              <span className="font-semibold text-slate-500 text-[11px] block">
                Affected Modules / Asset Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {changeRequest.affectedModules.map((m, idx) => (
                  <span
                    key={idx}
                    className="font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block">Current Behavior</span>
              <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                {changeRequest.currentBehaviorDescription}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block">Requested Solution</span>
              <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                {changeRequest.requestedChangeDescription}
              </p>
            </div>
          </div>

          {/* Business Justification */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-amber-950 space-y-1">
            <span className="font-bold block">Business Justification & Expected ROI</span>
            <p className="whitespace-pre-line leading-relaxed">{changeRequest.businessJustification}</p>
          </div>

          {/* Developer Technical Implementation & Code/DB Before-After Diff */}
          {(changeRequest.implementationNotes ||
            changeRequest.beforeChangeDetails ||
            changeRequest.afterChangeDetails ||
            changeRequest.hasCodeOrDatabaseChanges) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  <span>Technical Implementation</span>
                </div>
                {changeRequest.assignedDeveloperName && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Implemented by: <strong className="text-slate-800">{changeRequest.assignedDeveloperName}</strong>
                    {changeRequest.actualCompletionDate ? ` (${formatDisplayDate(changeRequest.actualCompletionDate)})` : ''}
                  </span>
                )}
              </div>

              {changeRequest.implementationNotes && (
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 space-y-1">
                  <span className="font-bold text-[11px] text-slate-700 block">Implementation & Testing Summary:</span>
                  <p className="whitespace-pre-wrap leading-relaxed text-xs">{changeRequest.implementationNotes}</p>
                </div>
              )}

              {(changeRequest.beforeChangeDetails || changeRequest.afterChangeDetails) && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600 text-[11px] flex items-center space-x-1">
                      <Database className="w-3.5 h-3.5 text-indigo-600 mr-1" />
                      <span>Code & Database Modifications (Before vs After Diff)</span>
                    </span>
                    
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Box 1: Before Changes */}
                    <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between font-bold text-rose-950 text-[11px]">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                          <span>1. Before Changes (Original Code / DB State)</span>
                        </span>
                        <span className="text-[9px] bg-rose-200/70 text-rose-900 px-1.5 py-0.5 rounded font-mono">BEFORE</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-slate-800 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {changeRequest.beforeChangeDetails || 'No baseline code or database details provided.'}
                      </div>
                    </div>

                    {/* Box 2: After Changes */}
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between font-bold text-emerald-950 text-[11px]">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                          <span>2. After Changes (Updated Code / DB Migration)</span>
                        </span>
                        <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded font-mono">AFTER</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {changeRequest.afterChangeDetails || 'No updated code or database details provided.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Revision Diff View (if resubmitted or returned) */}
          {changeRequest.revisionHistory && changeRequest.revisionHistory.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sky-900 font-bold">
                  <GitCompare className="w-4 h-4 text-sky-600" />
                  <span>Scope Revision Comparison (Diff Version Control)</span>
                </div>
                <button
                  onClick={() => setShowDiffModal(!showDiffModal)}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                >
                  {showDiffModal ? 'Hide Revision Diff' : 'View Revision Diff'}
                </button>
              </div>

              {showDiffModal && (
                <div className="space-y-3 pt-2 text-xs">
                  {changeRequest.revisionHistory.map((rev) => (
                    <div key={rev.revisionNumber} className="bg-white p-3.5 rounded-lg border border-sky-200 space-y-2">
                      <div className="flex items-center justify-between font-semibold text-sky-950">
                        <span>Revision v{rev.revisionNumber}: {rev.title}</span>
                        <span className="text-[10px] text-slate-400">{rev.updatedAt}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div className="bg-rose-50 p-2.5 rounded border border-rose-200">
                          <strong className="text-rose-900 block mb-1">Previous Behavior / Scope:</strong>
                          <p className="text-rose-800">{rev.currentBehaviorDescription}</p>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200">
                          <strong className="text-emerald-900 block mb-1">Previous Requested Solution:</strong>
                          <p className="text-emerald-800">{rev.requestedChangeDescription}</p>
                        </div>
                      </div>
                      {rev.comments && (
                        <p className="text-slate-500 italic text-[11px]">Reason for resubmission: "{rev.comments}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}



          {/* Attachments */}
          {(changeRequest.attachments || []).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  <span>Attachment({(changeRequest.attachments || []).length})</span>
                </span>
                
              </div>

              {/* End-user sanitized file cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(changeRequest.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200/90 transition-all shadow-2xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 truncate block">
                          {att.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {att.fileSizeKb} KB • {att.uploadedAt || '2026-08-20'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.downloadAttachment(att.id, currentUser);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Unable to download attachment.');
                        }
                      }}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* IT Admin & System Admin Storage Path Inspector */}
              {isItOrSystemAdmin ? (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowItStorageInspector(!showItStorageInspector)}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center space-x-1 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>IT & Admin Physical Storage Vault Inspector</span>
                    {showItStorageInspector ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-1" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-1" />
                    )}
                  </button>

                  {showItStorageInspector && (
                    <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl space-y-2.5 text-xs font-mono border border-slate-800 animate-fadeIn">
                      <div className="flex items-center justify-between text-indigo-300 font-bold border-b border-slate-800 pb-1.5">
                        <span className="flex items-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Privileged Storage Mapping (Hidden from Requesters/HODs)</span>
                        </span>
                        <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50">
                          IT Access Only
                        </span>
                      </div>

                      {(changeRequest.attachments || []).map((att) => {
                        const effectivePath =
                          att.storedPath ||
                          `\\\\tanaka-nas01.corp.internal\\PCS_Attachments\\prod_vault\\2026\\08\\${changeRequest.id}\\${att.fileName}`;
                        const effectiveChecksum =
                          att.fileChecksum ||
                          `sha256-${att.id.replace('att-', '')}a98fb72c81e289c03b12984576dfa`;

                        return (
                          <div key={att.id} className="p-2 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
                              <span>{att.fileName}</span>
                              <span className="text-[10px] text-emerald-400 font-mono">
                                {att.encryptionAlgorithm || 'AES-256-GCM'}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-400 break-all flex items-center justify-between">
                              <span>{effectivePath}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyPhysicalPath(effectivePath, att.id)}
                                className="text-slate-400 hover:text-white p-1 ml-2 shrink-0 cursor-pointer"
                                title="Copy physical path"
                              >
                                {copiedAttId === att.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Checksum: {effectiveChecksum}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">
               
                </div>
              )}
            </div>
          )}

          {/* Immutable Audit Log Timeline */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Communication Trail ({(changeRequest.approvalHistory || []).length} events)</span>
            </h3>

            {(changeRequest.approvalHistory || []).length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 italic">
                No previous approval decisions or stage transition records found for this ticket.
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-blue-500 space-y-4">
                {(changeRequest.approvalHistory || []).map((history, idx) => (
                  <div key={history.id || `hist-${idx}`} className="relative space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="absolute -left-[31px] top-3.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                    <div className="flex items-center justify-between font-semibold text-slate-900 flex-wrap gap-1">
                      <span className="text-slate-800">
                        {history.actorName || 'System'} ({history.actorRole || 'System Actor'})
                      </span>
                      <span className="text-slate-400 font-normal text-[11px]">{formatDisplayDateTime(history.actionDate)}</span>
                    </div>
                    <div className="text-slate-600 text-xs">
                      Action: <strong className="text-slate-900">{history.decision || 'Transition'}</strong> • From Status:{' '}
                      <span className="text-slate-700">{history.fromStatus || 'N/A'}</span> → To Status:{' '}
                      <span className="text-blue-700 font-semibold">{history.toStatus || 'N/A'}</span>
                    </div>
                    {history.comments && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 italic text-slate-700 text-xs mt-1">
                        "{history.comments}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {isItStaff && onItDirectModify && changeRequest.status !== 'Closed (Completed)' && changeRequest.status !== 'Closed (Rejected)' && (
              <button
                type="button"
                onClick={() => setShowItModifyModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>IT Modify Case (Category, Priority, Reassign)</span>
              </button>
            )}

            {canReject && (
              <button
                type="button"
                onClick={() => {
                  setRejectionReason('');
                  setRejectionError('');
                  setShowRejectModal(true);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject Ticket</span>
              </button>
            )}

            {canReopen && (
              <button
                type="button"
                onClick={() => {
                  setReopenComments('');
                  setShowReopenModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Case (System Admin)</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {canEditOrProvideClarification && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onEditRequest) {
                    onEditRequest(changeRequest);
                  }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{changeRequest.status === 'Draft' ? 'Edit Draft Request' : 'Provide Clarification & Update Details'}</span>
              </button>
            )}

            {canRequestClarification && (
              <button
                type="button"
                onClick={() => {
                  setClarifyNotes('');
                  setClarifyError('');
                  setShowClarifyModal(true);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Request Clarification</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>

      {/* IT Staff Direct Modify Modal */}
      {showItModifyModal && onItDirectModify && (
        <ItDirectModifyModal
          isOpen={showItModifyModal}
          onClose={() => setShowItModifyModal(false)}
          changeRequest={changeRequest}
          currentUser={currentUser}
          developers={developers}
          changeRequests={changeRequests}
          onSave={handleSaveItModify}
        />
      )}

      {/* Case Rejection Modal (IT Admin, System Admin, Developer, HOD) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-rose-950 font-bold text-sm">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Case / Ticket ({currentUser.role})</span>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 space-y-1">
              <p className="font-semibold text-rose-950">CR: {changeRequest.id} — {changeRequest.title}</p>
              <p className="text-[11px] text-rose-800">
                Requester: <strong>{changeRequest.requesterName}</strong> ({changeRequest.departmentName})
              </p>
              <p className="text-[11px] text-rose-900 pt-1 border-t border-rose-200">
                ⚠️ <strong>Audit Policy:</strong> Rejecting will immediately close this ticket as <strong>Closed (Rejected)</strong>. The requester and department HOD will be notified. Reopening this ticket can only be done subsequently by a <strong>System Administrator</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Rejection Justification / Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setRejectionError('');
                }}
                placeholder="State the technical, operational, or policy reason for rejecting this change request..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              {rejectionError && <p className="text-xs text-rose-600 font-semibold mt-1">{rejectionError}</p>}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirm & Reject Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Admin Reopen Modal with Automatic Routing to Rejector */}
      {showReopenModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-indigo-950 font-bold text-sm">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <span>Reopen Rejected Case (System Administrator)</span>
              </div>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 space-y-2">
              <div className="font-semibold text-indigo-950">CR: {changeRequest.id} — {changeRequest.title}</div>
              <div className="text-[11px] text-indigo-900 bg-white/70 p-2 rounded-lg border border-indigo-100 space-y-0.5">
                <div><strong>Rejected By:</strong> {changeRequest.rejectedByName || 'Staff'} ({changeRequest.rejectedByRole || 'IT Staff'})</div>
                <div><strong>Rejection Reason:</strong> "{changeRequest.rejectionReason || 'No reason recorded'}"</div>
              </div>
              <div className="text-[11px] text-indigo-900 pt-1 border-t border-indigo-200">
                🔄 <strong>Automatic Route Rule:</strong> When reopened, this ticket will automatically route directly back to <strong>{changeRequest.rejectedByName || 'the original rejector'}</strong> ({changeRequest.rejectedByRole || 'Staff'}) into their active queue.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Admin Reopen Directives / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={reopenComments}
                onChange={(e) => setReopenComments(e.target.value)}
                placeholder="Provide instructions or clarification for the assigned person regarding why this ticket is being reopened..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm & Reopen Case</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IT Staff Clarification Modal */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <RotateCcw className="w-4.5 h-4.5 text-amber-600" />
                <span>Request Clarification ({currentUser.role})</span>
              </div>
              <button
                onClick={() => setShowClarifyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
              <p className="font-semibold text-amber-900">CR: {changeRequest.id} — {changeRequest.title}</p>
              <p className="text-[11px] text-amber-800">
                Requester: <strong>{changeRequest.requesterName}</strong> ({changeRequest.requesterEmail})
              </p>
              <p className="text-[11px] text-amber-900/90 pt-1 border-t border-amber-200/80">
                💡 <strong>Direct Workflow:</strong> As HOD approval was already granted, the requester's resubmission will bypass HOD re-approval and route directly to IT / assigned developer ({changeRequest.assignedDeveloperName || 'Alex Chen'}). The HOD will receive a carbon-copy audit notification.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IT Clarification Notes / Questions for Requester <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={clarifyNotes}
                onChange={(e) => {
                  setClarifyNotes(e.target.value);
                  setClarifyError('');
                }}
                placeholder="Explain what specific technical requirements, screenshots, mockups, or clarification is needed from the user..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {clarifyError && <p className="text-xs text-rose-500 mt-1">{clarifyError}</p>}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowClarifyModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendClarification}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Return to Requester for Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔔 Chase Policy Reminder Modal */}
      {showNudgeModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-amber-950 font-bold text-sm">
                <BellRing className="w-5 h-5 text-amber-600" />
                <span>Dispatch Chase Reminder ({getChaseStageInfo(nudgeStage).shortBadge})</span>
              </div>
              <button
                onClick={() => setShowNudgeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
              <div className="font-semibold text-amber-950">CR: {changeRequest.id} — {changeRequest.title}</div>
              <div className="text-[11px] text-amber-800">
                Requester: <strong>{changeRequest.requesterName}</strong> ({changeRequest.requesterEmail})
              </div>
              <div className="text-[11px] text-amber-900/90 pt-1 border-t border-amber-200/80">
                📬 <strong>Automated Delivery:</strong> This will dispatch an official SMTP notification email and a high-priority dashboard banner to the requester.
                {nudgeStage >= 2 && ' Department HOD will be carbon-copied (CC) on this notice.'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Chase Stage Policy Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((stageNum) => {
                  const stageInfo = getChaseStageInfo(stageNum);
                  const isSelected = nudgeStage === stageNum;
                  return (
                    <button
                      key={stageNum}
                      type="button"
                      onClick={() => setNudgeStage(stageNum as 1 | 2 | 3)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] uppercase">{stageInfo.shortBadge}</div>
                      <div className="text-[11px] font-semibold">{stageInfo.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Reminder Note (Optional)
              </label>
              <textarea
                rows={3}
                value={customNudgeNote}
                onChange={(e) => setCustomNudgeNote(e.target.value)}
                placeholder="Add any specific context or friendly note for the requester..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowNudgeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSendReminderNudge) {
                    onSendReminderNudge(changeRequest.id, nudgeStage, customNudgeNote);
                  }
                  setShowNudgeModal(false);
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Send {getChaseStageInfo(nudgeStage).shortBadge}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 Auto-Close / Withdraw Inactive Case Modal */}
      {showAutoCloseModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-rose-950 font-bold text-sm">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <span>Auto-Withdraw Inactive Case (3-Strike Rule)</span>
              </div>
              <button
                onClick={() => setShowAutoCloseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 space-y-2">
              <div className="font-semibold text-rose-950">CR: {changeRequest.id} — {changeRequest.title}</div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                This ticket has been waiting for requester response with no clarification provided. Under IT operations policy, inactive tickets may be auto-withdrawn to keep active backlogs clean.
              </p>
              <div className="text-[11px] text-rose-900 bg-white/70 p-2 rounded-lg border border-rose-100">
                🛡️ <strong>1-Click Reopen Guarantee:</strong> If the requester returns at a later time, the ticket can be seamlessly reopened by System Admin or the Requester without losing prior progress.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Auto-Withdrawal Audit Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={autoCloseReason}
                onChange={(e) => setAutoCloseReason(e.target.value)}
                placeholder="Reason for closing inactive case..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAutoCloseModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onAutoCloseInactive && autoCloseReason.trim()) {
                    onAutoCloseInactive(changeRequest.id, autoCloseReason.trim());
                  }
                  setShowAutoCloseModal(false);
                }}
                disabled={!autoCloseReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Confirm Auto-Withdrawal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
