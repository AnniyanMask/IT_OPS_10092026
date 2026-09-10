import React, { useState } from 'react';
import { UserProfile, ChangeRequest, TemporaryApproverDelegation, Department } from '../types';
import { DelegationManagementModal } from './DelegationManagementModal';
import { getUserDelegationContext, getDelegationCurrentStatus, getDaysRemainingInDelegation } from '../utils/delegationUtils';
import { getPrioritySlaHours } from '../utils/slaAndRisk';
import { formatDisplayDateTime, formatDisplayDate } from '../utils/timezone';
import { mockUsers, mockDepartments } from '../data/db';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
  MessageSquare,
  Shield,
  Layers,
  Search,
  Paperclip,
  CheckSquare,
  Square,
  Zap,
  UserPlus,
  Lock,
  History,
  AlertCircle,
  Check,
  ChevronRight,
  Info,
  X
} from 'lucide-react';

interface HodQueueViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  onProcessApproval: (crId: string, decision: 'Approve' | 'Reject' | 'SendBack', comments: string) => void;
  onRequestClick: (crId: string) => void;
  delegations?: TemporaryApproverDelegation[];
  onSaveDelegation?: (data: {
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
    reason: any;
    notes?: string;
  }) => void;
  onRevokeDelegation?: (delegationId: string, reason: string) => void;
  users?: UserProfile[];
}

export const HodQueueView: React.FC<HodQueueViewProps> = ({
  currentUser,
  changeRequests,
  onProcessApproval,
  onRequestClick,
  delegations = [],
  onSaveDelegation,
  onRevokeDelegation,
  users: propUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'pending_approval' | 'critical_skipped' | 'all_dept' | 'delegations'>('pending_approval');
  const [selectedCrId, setSelectedCrId] = useState<string | null>(null);
  const [actionDecision, setActionDecision] = useState<'Approve' | 'Reject' | 'SendBack'>('Approve');
  const [comments, setComments] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Delegation Modal State
  const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
  const [revokingDelegationId, setRevokingDelegationId] = useState<string | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revokeError, setRevokeError] = useState('');

  // Batch Selection State
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchComments, setBatchComments] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  const allUsers = propUsers && propUsers.length > 0 ? propUsers : mockUsers;

  // Evaluate user delegation context
  const delegationCtx = getUserDelegationContext(currentUser, delegations);

  // Effective Department for requests display
  const effectiveDeptId = delegationCtx.effectiveDepartmentId || currentUser.departmentId;
  const effectiveDeptName = delegationCtx.effectiveDepartmentName || currentUser.departmentName;

  // Department Filter
  const deptRequests = changeRequests.filter(
    (cr) => cr.departmentId === effectiveDeptId
  );

  // Department HODs approval queue
  const pendingQueue = deptRequests.filter(
    (cr) => cr.status === 'Pending HOD Approval'
  );

  // Critical Requests that bypassed HOD or have Critical priority in department
  const criticalSkippedQueue = deptRequests.filter(
    (cr) => (cr.hodApprovalSkipped || cr.priority === 'Critical') && cr.status !== 'Draft'
  );

  // Delegations for this department
  const departmentDelegations = delegations.filter(
    (d) => d.departmentId === effectiveDeptId
  );

  const activeDepartmentDelegations = departmentDelegations.filter(
    (d) => getDelegationCurrentStatus(d) === 'Active'
  );

  // Filter based on active tab
  const displayedQueue =
    activeTab === 'pending_approval'
      ? pendingQueue
      : activeTab === 'critical_skipped'
      ? criticalSkippedQueue
      : deptRequests;

  const selectedCr = changeRequests.find((cr) => cr.id === selectedCrId) || displayedQueue[0];

  const handleAction = () => {
    if (!delegationCtx.canExecuteApproval) {
      setErrorMsg('Approval actions are disabled because your delegation period has expired.');
      return;
    }
    if (!comments.trim()) {
      setErrorMsg('Mandatory approval comments are required for audit trail logging.');
      return;
    }
    if (!selectedCr) return;

    // Append acting approver note if acting
    const auditComment = delegationCtx.hasActiveDelegation
      ? `[⚡ Acting HOD Action by ${currentUser.fullName} on behalf of ${delegationCtx.delegatedByHodName}] ${comments.trim()}`
      : comments.trim();

    onProcessApproval(selectedCr.id, actionDecision, auditComment);
    setComments('');
    setErrorMsg('');
    setSelectedCrId(null);
  };

  // Toggle single batch item
  const toggleBatchSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedBatchIds.includes(id)) {
      setSelectedBatchIds(selectedBatchIds.filter((item) => item !== id));
    } else {
      setSelectedBatchIds([...selectedBatchIds, id]);
    }
  };

  // Select/Deselect All Batch
  const toggleSelectAll = () => {
    if (selectedBatchIds.length === pendingQueue.length) {
      setSelectedBatchIds([]);
    } else {
      setSelectedBatchIds(pendingQueue.map((item) => item.id));
    }
  };

  // Process Batch Approval
  const handleExecuteBatchApprove = () => {
    if (!delegationCtx.canExecuteApproval) {
      setErrorMsg('Batch approval is disabled because your delegation has expired.');
      return;
    }
    if (!batchComments.trim()) {
      setErrorMsg('Mandatory batch approval comment is required.');
      return;
    }

    const prefix = delegationCtx.hasActiveDelegation
      ? `[⚡ Batch Acting HOD Approval by ${currentUser.fullName} on behalf of ${delegationCtx.delegatedByHodName}]`
      : `[Batch HOD Approval]`;

    selectedBatchIds.forEach((id) => {
      onProcessApproval(id, 'Approve', `${prefix} ${batchComments}`);
    });

    setSelectedBatchIds([]);
    setBatchComments('');
    setShowBatchModal(false);
    setErrorMsg('');
  };

  const handleConfirmRevoke = () => {
    if (!revokingDelegationId) return;
    if (!revocationReason.trim()) {
      setRevokeError('Please provide a reason for early revocation.');
      return;
    }

    if (onRevokeDelegation) {
      onRevokeDelegation(revokingDelegationId, revocationReason.trim());
    }

    setRevokingDelegationId(null);
    setRevocationReason('');
    setRevokeError('');
  };

  // Helper for SLA styling
  const calculateSlaStatus = (cr: ChangeRequest) => {
    const created = new Date(cr.createdAt).getTime();
    const now = new Date().getTime();
    const elapsedHours = (now - created) / (1000 * 60 * 60);
    const limit = cr.slaTargetHours || getPrioritySlaHours(cr.priority);
    const remaining = Math.max(0, Math.round(limit - elapsedHours));

    return {
      hoursRemaining: remaining,
      slaStatus: remaining === 0 ? 'SLA Breached' : remaining <= Math.max(6, Math.round(limit * 0.25)) ? 'Near Breach' : 'Within SLA',
    };
  };

  const getSlaBadgeClass = (status: string) => {
    switch (status) {
      case 'Within SLA':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Near Breach':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SLA Breached':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'Low':
        return 'bg-blue-100 text-blue-800';
      case 'Medium':
        return 'bg-amber-100 text-amber-800';
      case 'High':
        return 'bg-orange-100 text-orange-800';
      case 'Critical':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const isOfficialHod = currentUser.role === 'Department HOD' || currentUser.role === 'System Admin';

  return (
    <div className="space-y-6">
      {/* Banner Quick Actions (if official HOD) */}
      {isOfficialHod && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsDelegationModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Assign Temporary Approver</span>
          </button>
        </div>
      )}

      {/* Acting Approver Notice Banners */}
      {delegationCtx.hasActiveDelegation && delegationCtx.activeDelegation && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-blue-50 border border-amber-300/80 rounded-2xl p-4.5 shadow-sm text-xs text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <strong className="text-amber-900 text-sm">Active Temporary Approver Authority Granted</strong>
                
              </div>
              <p className="text-amber-900 mt-0.5">
                Department HOD <strong>{delegationCtx.delegatedByHodName}</strong> has authorized you to act as approving authority for{' '}
                <strong>{delegationCtx.effectiveDepartmentName}</strong> during their {delegationCtx.activeDelegation.reason}.
              </p>
              <div className="flex items-center space-x-3 mt-1 text-[11px] text-amber-800 font-medium">
                <span>📅 Time Frame: <strong>{formatDisplayDate(delegationCtx.activeDelegation.startDate)}</strong> to <strong>{formatDisplayDate(delegationCtx.activeDelegation.endDate)}</strong></span>
                <span>⏳ Time Remaining: <strong>{getDaysRemainingInDelegation(delegationCtx.activeDelegation)}</strong></span>
              </div>
            </div>
          </div>
          
        </div>
      )}

      {delegationCtx.hasExpiredDelegation && !delegationCtx.hasActiveDelegation && (
        <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4.5 shadow-sm text-xs text-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <strong className="text-slate-900 text-sm">Temporary Approver Time Frame Ended (Read-Only Mode)</strong>
                <span className="bg-slate-200 text-slate-700 font-mono font-bold px-2 py-0.2 rounded-full text-[10px]">
                  Expired
                </span>
              </div>
              <p className="text-slate-600 mt-0.5">
                Your temporary approval delegation for <strong>{delegationCtx.effectiveDepartmentName}</strong> expired on{' '}
                <strong>{formatDisplayDate(delegationCtx.expiredDelegations[0]?.endDate)}</strong>.You have <strong>Read-Only Access</strong> to inspect requests, attachments, and audit history.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            
          </div>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setActiveTab('pending_approval');
            setSelectedCrId(null);
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'pending_approval'
              ? 'bg-amber-50/90 border-amber-500 shadow-sm ring-1 ring-amber-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending HOD Approvals
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{pendingQueue.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Requires department clearance</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('critical_skipped');
            setSelectedCrId(null);
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'critical_skipped'
              ? 'bg-purple-50/90 border-purple-500 shadow-sm ring-1 ring-purple-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
              <span>⚡ Critical (HOD Skipped)</span>
            </span>
            
          </div>
          <div className="text-2xl font-bold text-purple-950 mt-2">{criticalSkippedQueue.length}</div>
          <p className="text-[11px] text-purple-800 mt-1">Direct to IT; visible for tracking</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('all_dept');
            setSelectedCrId(null);
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'all_dept'
              ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Department Total
            </span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{deptRequests.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">All tickets submitted by staff</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('delegations');
            setSelectedCrId(null);
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'delegations'
              ? 'bg-amber-50/90 border-amber-600 shadow-sm ring-1 ring-amber-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
              <span>Acting Approvers</span>
            </span>
            <UserCheck className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 flex items-center space-x-2">
            <span>{activeDepartmentDelegations.length}</span>
            {activeDepartmentDelegations.length > 0 ? (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Active
              </span>
            ) : (
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                None Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active acting delegations only</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs font-bold flex-wrap gap-y-2">
        
 

       

        
      </div>

      {/* VIEW 1: DELEGATION MANAGEMENT TAB (ACTIVE ONLY) */}
      {activeTab === 'delegations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <UserCheck className="w-5 h-5 text-amber-600" />
                    <span>Temporary Approver Delegation Management</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active Only
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage active acting approvers for <strong>{effectiveDeptName}</strong>. Revoked or expired authorizations are archived in the Reports.
                </p>
              </div>

             
            </div>

            {/* Active Delegations List */}
            {activeDepartmentDelegations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-3">
                <UserCheck className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                <p className="text-sm font-semibold text-slate-600">No active temporary approver delegations for this department.</p>
                
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDepartmentDelegations.map((delegation) => {
                  const status = getDelegationCurrentStatus(delegation);
                  const isActive = status === 'Active';

                  return (
                    <div
                      key={delegation.id}
                      className="p-5 rounded-2xl border transition-all space-y-3.5 relative bg-gradient-to-br from-amber-50/60 to-white border-amber-400 shadow-sm ring-1 ring-amber-300"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs bg-amber-600 text-white">
                            {delegation.delegateName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-bold text-slate-900 text-sm">{delegation.delegateName}</h3>
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                {delegation.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{delegation.delegateEmail}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Active Authority</span>
                          </span>
                        </div>
                      </div>

                      {/* Delegation Details */}
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Reason</span>
                            <p className="font-bold text-slate-800 mt-0.5">{delegation.reason}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Granting HOD</span>
                            <p className="font-bold text-slate-800 mt-0.5">{delegation.hodName}</p>
                          </div>
                        </div>

                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Time Frame Window</span>
                            <span className="font-bold text-amber-800">
                              {getDaysRemainingInDelegation(delegation)}
                            </span>
                          </div>
                          <p className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                            📅 {formatDisplayDate(delegation.startDate)} → {formatDisplayDate(delegation.endDate)}
                          </p>
                        </div>

                        {delegation.notes && (
                          <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 text-amber-950">
                            <span className="text-[10px] text-amber-800 font-bold uppercase block mb-0.5">Handover Notes:</span>
                            <p className="italic text-[11px]">{delegation.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      {isOfficialHod && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Created: {formatDisplayDateTime(delegation.createdAt)}</span>
                          <button
                            onClick={() => setRevokingDelegationId(delegation.id)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Revoke Authority Early</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* VIEW 2: REQUEST LIST & REVIEW PANELS (for pending, critical, or all tabs) */}
      {activeTab !== 'delegations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Request Queue (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {activeTab === 'pending_approval'
                  ? `Pending Department Requests (${displayedQueue.length})`
                  : activeTab === 'critical_skipped'
                  ? `⚡ Critical Expedited Requests (${displayedQueue.length})`
                  : `Department Requests (${displayedQueue.length})`}
              </h2>

              {activeTab === 'pending_approval' && pendingQueue.length > 1 && delegationCtx.canExecuteApproval && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
                >
                  {selectedBatchIds.length === pendingQueue.length ? (
                    <CheckSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>{selectedBatchIds.length === pendingQueue.length ? 'Deselect All' : 'Select All'}</span>
                </button>
              )}
            </div>

            {/* Batch Action Bar */}
            {activeTab === 'pending_approval' && selectedBatchIds.length > 0 && delegationCtx.canExecuteApproval && (
              <div className="bg-amber-500/10 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">
                  {selectedBatchIds.length} item(s) selected
                </span>
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Batch Approve ({selectedBatchIds.length})</span>
                </button>
              </div>
            )}

            <div className="space-y-3">
              {displayedQueue.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No IT Request found.</p>
                </div>
              ) : (
                displayedQueue.map((cr) => {
                  const isSelected = selectedCr?.id === cr.id;
                  const isBatchChecked = selectedBatchIds.includes(cr.id);
                  const sla = calculateSlaStatus(cr);
                  const risk = cr.riskAssessment;
                  const isHodSkipped = cr.hodApprovalSkipped || (cr.priority === 'Critical' && cr.status !== 'Draft');

                  return (
                    <div
                      key={cr.id}
                      onClick={() => setSelectedCrId(cr.id)}
                      className={`p-4 rounded-xl border text-xs cursor-pointer transition-all space-y-2 relative ${
                        isSelected
                          ? isHodSkipped && cr.status !== 'Pending HOD Approval'
                            ? 'bg-purple-50/90 border-purple-500 shadow-md ring-1 ring-purple-500'
                            : 'bg-amber-50/90 border-amber-500 shadow-md ring-1 ring-amber-500'
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {activeTab === 'pending_approval' && delegationCtx.canExecuteApproval && (
                            <button
                              onClick={(e) => toggleBatchSelect(cr.id, e)}
                              className="text-slate-400 hover:text-amber-600 p-0.5 cursor-pointer"
                            >
                              {isBatchChecked ? (
                                <CheckSquare className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          )}
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {cr.id}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          {isHodSkipped && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 text-purple-600 fill-purple-600" />
                              <span>HOD Skipped</span>
                            </span>
                          )}

                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[10px] ${getSlaBadgeClass(sla.slaStatus)}`}
                          >
                            {sla.slaStatus === 'SLA Breached' ? 'OVERDUE' : `${sla.hoursRemaining}h left`}
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                              cr.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : cr.priority === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {cr.priority}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{cr.title}</h3>

                      {cr.category && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 flex-wrap">
                          <span className="bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                            {cr.category}
                          </span>
                          {cr.subcategory && (
                            <span className="bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                              {cr.subcategory}
                            </span>
                          )}
                          {cr.issueType && (
                            <span className="bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                              {cr.issueType}
                            </span>
                          )}
                        </div>
                      )}

                      {risk && (
                        <div className="flex items-center space-x-2 pt-0.5">
                          <span className="text-[10px] text-slate-500 font-medium">Risk Level:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${getRiskBadgeClass(risk.riskLevel)}`}>
                            {risk.riskLevel} ({risk.riskScore}/100)
                          </span>
                        </div>
                      )}

                      {cr.assignedDeveloperName && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <Zap className="w-3 h-3 text-slate-500" />
                          <span>Pre-assigned Dev: <strong className="text-slate-900">{cr.assignedDeveloperName}</strong></span>
                        </div>
                      )}

                      <div className="text-slate-500 flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span>By: {cr.requesterName}</span>
                        <span className="font-bold text-slate-700">{cr.status}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Detailed Action Panel (7 cols) */}
          {selectedCr && (
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-lg p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {selectedCr.id}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        selectedCr.status === 'Pending HOD Approval'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : selectedCr.status === 'Closed (Completed)'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedCr.status}
                    </span>

                    {selectedCr.hodApprovalSkipped && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-purple-600 fill-purple-600" />
                        <span>HOD Approval Skipped (Critical Priority)</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-2">{selectedCr.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requested by <strong>{selectedCr.requesterName}</strong> ({selectedCr.departmentName}) • Submitted on{' '}
                    {formatDisplayDateTime(selectedCr.createdAt)}
                  </p>
                </div>
              </div>

              {/* Priority & Risk Assessment Block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Priority</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedCr.priority}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Module</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedCr.moduleName || 'General PCS'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Category</span>
                  <p className="font-bold text-blue-700 mt-0.5">{selectedCr.category || 'General'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Issue Type</span>
                  <p className="font-bold text-rose-700 mt-0.5">{selectedCr.issueType || 'Change Request'}</p>
                </div>
              </div>

              {/* Description Sections */}
              <div className="space-y-4 text-xs">
                <div>
                  <strong className="text-slate-800 block mb-1">Current Problem / Behavior:</strong>
                  <p className="text-slate-700 whitespace-pre-line">{selectedCr.currentBehaviorDescription}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <strong className="text-slate-800 block mb-1">Requested Solution:</strong>
                  <p className="text-slate-700 whitespace-pre-line">{selectedCr.requestedChangeDescription}</p>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-amber-950">
                  <strong className="text-amber-900 block mb-1">Business Justification:</strong>
                  <p className="text-amber-900 whitespace-pre-line">{selectedCr.businessJustification}</p>
                </div>
              </div>

              {/* Attachments */}
              {selectedCr.attachments && selectedCr.attachments.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-700 block">Attachments ({selectedCr.attachments.length})</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedCr.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-medium text-slate-800">{att.fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HOD Action Execution Box ONLY if status is Pending HOD Approval */}
              {selectedCr.status === 'Pending HOD Approval' ? (
                <div className="border-t border-slate-200 pt-5 space-y-4">
                  {delegationCtx.canExecuteApproval ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          <span>Execute HOD Approval Decision</span>
                        </h3>
                        
                      </div>

                      {/* Decision selections */}
                      {selectedCr.assignedDeveloperName && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-start space-x-2.5">
                          <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-blue-900">Direct Developer Routing: </span>
                            <span className="text-blue-800">
                              This request is pre-assigned to Software Developer <strong>{selectedCr.assignedDeveloperName}</strong>. Approving will bypass IT Admin triage and route straight to {selectedCr.assignedDeveloperName}'s active In Progress task board.
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setActionDecision('Approve')}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            actionDecision === 'Approve'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{selectedCr.assignedDeveloperName ? `Approve to ${selectedCr.assignedDeveloperName.split(' ')[0]}` : 'Approve to IT'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionDecision('SendBack')}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            actionDecision === 'SendBack'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Send Back</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionDecision('Reject')}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                            actionDecision === 'Reject'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject CR</span>
                        </button>
                      </div>

                      {/* Comment area */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Audit Log Decision Comments <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={comments}
                          onChange={(e) => {
                            setComments(e.target.value);
                            setErrorMsg('');
                          }}
                          placeholder={
                            actionDecision === 'Approve'
                              ? 'Provide reasoning for approval to IT...'
                              : actionDecision === 'SendBack'
                              ? 'Explain what clarification or documents the requester must provide...'
                              : 'State justification for rejection...'
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                        {errorMsg && <p className="text-xs text-rose-500 mt-1">{errorMsg}</p>}
                      </div>

                      <button
                        type="button"
                        onClick={handleAction}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <span>
                          Submit HOD Decision ({actionDecision})
                          {delegationCtx.hasActiveDelegation ? ' on behalf of HOD' : ''}
                        </span>
                      </button>
                    </>
                  ) : (
                    /* Read-Only Mode for Expired Delegates */
                    <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-center space-y-2">
                      <Lock className="w-6 h-6 mx-auto text-slate-500" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Approval Decisions Locked (Read-Only Mode)
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Your temporary approver delegation for this department has ended. You can view all request specifications and history, but approval submission is reserved for the active HOD.
                      </p>
                      <button
                        onClick={() => onRequestClick(selectedCr.id)}
                        className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Inspect Full Audit Trail
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Status: <strong className="text-slate-800">{selectedCr.status}</strong>
                    {selectedCr.assignedDeveloperName && (
                      <span className="ml-2">• Assigned Developer: <strong className="text-blue-700">{selectedCr.assignedDeveloperName}</strong></span>
                    )}
                  </div>
                  <button
                    onClick={() => onRequestClick(selectedCr.id)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Inspect Full Audit Trail
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch Approval Confirmation Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                <span>Batch Approve {selectedBatchIds.length} Request(s)</span>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are about to batch approve the following request IDs to the IT Admin Review stage:
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
              {selectedBatchIds.map((id) => (
                <span key={id} className="font-mono text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {id}
                </span>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shared Audit Approval Comment <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={batchComments}
                onChange={(e) => setBatchComments(e.target.value)}
                placeholder="Enter audit approval reasoning for all selected change requests..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBatchApprove}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Confirm Batch Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Delegation Modal */}
      {revokingDelegationId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Revoke Temporary Approver Authority</span>
              </div>
              <button
                onClick={() => setRevokingDelegationId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to end this delegation early? The assigned colleague will immediately lose approval rights and transition to read-only archive mode.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Revocation Reason / Handover Conclusion <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={revocationReason}
                onChange={(e) => {
                  setRevocationReason(e.target.value);
                  setRevokeError('');
                }}
                placeholder="e.g., Returned from leave earlier than scheduled. Authority resumed by HOD."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              {revokeError && <p className="text-xs text-rose-600 mt-1">{revokeError}</p>}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setRevokingDelegationId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Revoke Authority Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Temporary Approver Modal */}
      {isDelegationModalOpen && onSaveDelegation && (
        <DelegationManagementModal
          isOpen={isDelegationModalOpen}
          onClose={() => setIsDelegationModalOpen(false)}
          currentUser={currentUser}
          departmentUsers={allUsers}
          onSaveDelegation={onSaveDelegation}
        />
      )}
    </div>
  );
};
