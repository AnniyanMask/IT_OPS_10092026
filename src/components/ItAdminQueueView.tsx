import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, ChangeRequest, UserProfile as UserType, CustomRoleDefinition } from '../types';
import { mockUsers, mockModules } from '../data/db';
import { calculateSlaStatus, getSlaBadgeClass, getRiskBadgeClass } from '../utils/slaAndRisk';
import { formatDisplayDate } from '../utils/timezone';
import { hasRolePermission, getEligibleDevelopers } from '../utils/rbac';
import { ItDirectModifyModal, ItDirectModifyPayload } from './ItDirectModifyModal';
import { StaffWorkloadTable } from './StaffWorkloadTable';
import {
  Cpu,
  UserCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Users,
  Settings,
  Layers,
  Clock,
  ArrowRight,
  CheckSquare,
  Square,
  ShieldAlert,
  Timer,
  X,
  RotateCcw,
  Send,
  HelpCircle,
  Sliders,
  Zap,
  Database
} from 'lucide-react';

interface ItAdminQueueViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  users?: UserProfile[];
  customRoles?: CustomRoleDefinition[];
  onAssignDeveloper: (crId: string, developerId: string, developerName: string, targetDate: string, comments: string) => void;
  onVerifyRelease: (crId: string, verified: boolean, comments: string) => void;
  onSendBackToRequester?: (crId: string, comments: string) => void;
  onItDirectModify?: (payload: ItDirectModifyPayload) => void;
  onRejectCase?: (crId: string, rejectionReason: string) => void;
  onRequestClick: (crId: string) => void;
}

export const ItAdminQueueView: React.FC<ItAdminQueueViewProps> = ({
  currentUser,
  changeRequests,
  users,
  customRoles = [],
  onAssignDeveloper,
  onVerifyRelease,
  onSendBackToRequester,
  onItDirectModify,
  onRejectCase,
  onRequestClick,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'verification' | 'masterdata'>('review');
  const [selectedCrId, setSelectedCrId] = useState<string | null>(null);
  const [showDirectModifyModal, setShowDirectModifyModal] = useState(false);

  // Rejection modal states for IT Staff / IT Admin / System Admin
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Dynamic capability check for triage and assignment
  const canAssignTickets = hasRolePermission(currentUser.role, 'canTriageAndAssignDevs', customRoles);
  const canDirectModify = hasRolePermission(currentUser.role, 'canDirectModifyCatalog', customRoles);
  const canVerifyReleasePerm = hasRolePermission(currentUser.role, 'canVerifyRelease', customRoles);
  const canReturnPerm = hasRolePermission(currentUser.role, 'canReturnToRequester', customRoles);

  // Dynamic developer list derived from live system users & Custom Roles Matrix
  const developers = useMemo(() => {
    const source = users && users.length > 0 ? users : mockUsers;
    const eligible = getEligibleDevelopers(source, customRoles);
    if (eligible.length > 0) return eligible;

    // Fallback if no matching role
    const devs = source.filter(
      (u) => (u.role === 'Software Developer' || u.role === 'IT Admin') && u.status !== 'Deactivated'
    );
    return devs.length > 0 ? devs : source;
  }, [users, customRoles]);

  // Form states for developer assignment
  const [selectedDevId, setSelectedDevId] = useState<string>(developers[0]?.id || '');
  const [targetDate, setTargetDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [assignComments, setAssignComments] = useState<string>('');
  const [verifyComments, setVerifyComments] = useState<string>('');
  const [returnComments, setReturnComments] = useState<string>('');
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Batch IT Admin Selection State
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchDevId, setBatchDevId] = useState<string>(developers[0]?.id || '');
  const [batchTargetDate, setBatchTargetDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Synchronize developer selection when developer roster updates
  useEffect(() => {
    if (developers.length > 0) {
      if (!selectedDevId || !developers.some((d) => d.id === selectedDevId)) {
        setSelectedDevId(developers[0].id);
      }
      if (!batchDevId || !developers.some((d) => d.id === batchDevId)) {
        setBatchDevId(developers[0].id);
      }
    }
  }, [developers]);

  const pendingItReview = changeRequests.filter((cr) => cr.status === 'Pending IT Admin Review');
  const pendingVerification = changeRequests.filter((cr) => cr.status === 'Pending IT Verification');

  const selectedCr = changeRequests.find((cr) => cr.id === selectedCrId) || pendingItReview[0] || pendingVerification[0];

  const handleAssignSubmit = () => {
    if (!canAssignTickets || !selectedCr) return;
    if (!selectedDevId) {
      setErrorMsg('Please select a developer to assign this change request.');
      return;
    }

    const dev = developers.find((d) => d.id === selectedDevId);
    onAssignDeveloper(selectedCr.id, selectedDevId, dev?.fullName || 'Developer', targetDate, assignComments || 'Assigned to developer');
    setAssignComments('');
    setErrorMsg('');
    setSelectedCrId(null);
  };

  const handleReturnSubmit = () => {
    if (!selectedCr) return;
    if (!returnComments.trim()) {
      setErrorMsg('Please detail the technical information or clarification required from the requester.');
      return;
    }

    if (onSendBackToRequester) {
      onSendBackToRequester(selectedCr.id, returnComments);
    }
    setReturnComments('');
    setShowReturnModal(false);
    setErrorMsg('');
    setSelectedCrId(null);
  };

  const handleVerifySubmit = (verified: boolean) => {
    if (!selectedCr) return;
    if (!verifyComments.trim()) {
      setErrorMsg('Verification audit comments are required.');
      return;
    }

    onVerifyRelease(selectedCr.id, verified, verifyComments);
    setVerifyComments('');
    setErrorMsg('');
    setSelectedCrId(null);
  };

  const toggleBatchSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedBatchIds.includes(id)) {
      setSelectedBatchIds(selectedBatchIds.filter((item) => item !== id));
    } else {
      setSelectedBatchIds([...selectedBatchIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedBatchIds.length === pendingItReview.length) {
      setSelectedBatchIds([]);
    } else {
      setSelectedBatchIds(pendingItReview.map((item) => item.id));
    }
  };

  const handleExecuteBatchAssign = () => {
    if (!canAssignTickets) return;
    const dev = developers.find((d) => d.id === batchDevId);
    if (!dev) return;

    selectedBatchIds.forEach((id) => {
      onAssignDeveloper(id, batchDevId, dev.fullName, batchTargetDate, '[Batch Assignment] Assigned by IT Admin');
    });

    setSelectedBatchIds([]);
    setShowBatchModal(false);
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-slate-800 text-slate-300 rounded-xl border border-slate-700">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            
            <h1 className="text-2xl font-bold">IT Admin Queue Assignment</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Logged in as <strong className="text-white">{currentUser.fullName}</strong>
            </p>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'review' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Developer Assignment ({pendingItReview.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'verification' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>UAT & Verification ({pendingVerification.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('masterdata')}
            className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'masterdata' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>PCS Master Data</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Developer Assignment */}
      {activeTab === 'review' && (
        <>
          {pendingItReview.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-base font-bold text-slate-800">No Pending Request Assignments</h2>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                All HOD-approved change requests have been assigned to developers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    HOD-Approved CRs ({pendingItReview.length})
                  </h2>

                  {pendingItReview.length > 1 && canAssignTickets && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 cursor-pointer"
                    >
                      {selectedBatchIds.length === pendingItReview.length ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      <span>{selectedBatchIds.length === pendingItReview.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                  )}
                </div>

                {/* Batch Action Bar */}
                {selectedBatchIds.length > 0 && canAssignTickets && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {selectedBatchIds.length} item(s) selected
                    </span>
                    <button
                      onClick={() => setShowBatchModal(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Batch Assign ({selectedBatchIds.length})</span>
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {pendingItReview.map((cr) => {
                    const isSelected = selectedCr?.id === cr.id;
                    const isBatchChecked = selectedBatchIds.includes(cr.id);
                    const sla = calculateSlaStatus(cr);
                    const risk = cr.riskAssessment;

                    return (
                      <div
                        key={cr.id}
                        onClick={() => setSelectedCrId(cr.id)}
                        className={`p-4 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                          isSelected
                            ? 'bg-blue-50/40 border-blue-500 shadow-xs ring-1 ring-blue-500'
                            : 'bg-white border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {canAssignTickets && (
                              <button
                                onClick={(e) => toggleBatchSelect(cr.id, e)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                              >
                                {isBatchChecked ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300" />
                                )}
                              </button>
                            )}
                            <span className="font-mono font-bold text-blue-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {cr.id}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${getSlaBadgeClass(sla.slaStatus)}`}>
                              {sla.slaStatus === 'SLA Breached' ? 'OVERDUE' : `${sla.hoursRemaining}h SLA`}
                            </span>
                            <span
                              className={`font-semibold px-2 py-0.5 rounded text-[10px] border ${
                                cr.priority === 'Critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                  : cr.priority === 'High'
                                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
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

                        <div className="text-slate-500 text-[11px] flex justify-between pt-1 border-t border-slate-100">
                          <span>Dept: {cr.departmentName}</span>
                          <span>Type: {cr.requestType}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Assignment Panel */}
              {selectedCr && (
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-6">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                          {selectedCr.id}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                          selectedCr.priority === 'Critical'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                            : selectedCr.priority === 'High'
                            ? 'bg-orange-50 text-orange-800 border-orange-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          Priority: {selectedCr.priority}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-2">{selectedCr.title}</h2>
                    </div>
                    <div className="flex items-center space-x-2">
                      {onItDirectModify && (
                        <button
                          type="button"
                          onClick={() => setShowDirectModifyModal(true)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 flex items-center space-x-1 transition-colors cursor-pointer"
                          title="Reclassify category or adjust priority without approval flow"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Direct Modify</span>
                        </button>
                      )}
                      <button
                        onClick={() => onRequestClick(selectedCr.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-slate-200 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
                      >
                        Audit Details
                      </button>
                    </div>
                  </div>

                  {/* Priority Change Reason Note if present */}
                  {selectedCr.priorityChangeReason && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs flex items-start gap-2.5">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-semibold text-amber-950 flex items-center gap-1.5 flex-wrap">
                          <span>IT Priority Note:</span>
                          <span className="font-normal text-amber-900">"{selectedCr.priorityChangeReason}"</span>
                          {selectedCr.priorityChangedBy && (
                            <span className="text-[10px] text-amber-700">({selectedCr.priorityChangedBy})</span>
                          )}
                        </div>
                        <p className="text-[10px] text-amber-800">
                          Applied directly by IT Operations without approval flow.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                    <p className="text-slate-700">
                      <strong>Current Behavior:</strong> {selectedCr.currentBehaviorDescription}
                    </p>
                    <p className="text-slate-700">
                      <strong>Requested Change:</strong> {selectedCr.requestedChangeDescription}
                    </p>
                    <p className="text-slate-700">
                      <strong>HOD Justification:</strong> {selectedCr.businessJustification}
                    </p>
                  </div>

                  {/* Developer Assignment Form (IT Admin and System Admin Only) */}
                  {canAssignTickets ? (
                    <div className="border-t border-slate-200 pt-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <span>Assign IT Staff & Target Deadline</span>
                      </h3>

                      {/* System Admin Workload Scoring & Capacity Table */}
                      <StaffWorkloadTable
                        staffList={developers}
                        changeRequests={changeRequests}
                        selectedStaffId={selectedDevId}
                        onSelectStaff={(devId) => {
                          setSelectedDevId(devId);
                          setErrorMsg('');
                        }}
                        title="Staff Workload & Capacity Scoring (System Admin)"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Select IT Staff / Assignee <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={selectedDevId}
                            onChange={(e) => setSelectedDevId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                          >
                            {developers.map((dev) => (
                              <option key={dev.id} value={dev.id}>
                                {dev.fullName} ({dev.role || 'Staff'} - {dev.departmentName || 'IT'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Target Completion Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          IT Technical Instructions / Notes
                        </label>
                        <textarea
                          rows={2}
                          value={assignComments}
                          onChange={(e) => setAssignComments(e.target.value)}
                          placeholder="e.g. Please coordinate with database team for table index updates..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none"
                        />
                      </div>

                      {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={handleAssignSubmit}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Assign Now</span>
                        </button>

                        {onSendBackToRequester && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReturnModal(true);
                              setErrorMsg('');
                            }}
                            className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-700" />
                            <span>Request Clarification</span>
                          </button>
                        )}

                        {onRejectCase && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectionReason('');
                              setRejectionError('');
                              setShowRejectModal(true);
                            }}
                            className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            title="Reject ticket and close as Closed (Rejected)"
                          >
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>Reject Ticket</span>
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        💡 <strong>Direct Workflow Note:</strong> Since this case has already been approved by the Department HOD, returning to the requester for technical details will bypass HOD re-approval upon resubmission. The full transaction trail remains visible to the HOD for audit compliance.
                      </p>
                    </div>
                  ) : (
                    <div className="border-t border-slate-200 pt-5 space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">Assignment Status:</span>
                          <span className="font-bold text-slate-900">
                            {selectedCr.assignedDeveloperName ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Assigned to {selectedCr.assignedDeveloperName}
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Pending IT Admin Assignment
                              </span>
                            )}
                          </span>
                        </div>
                        {selectedCr.targetCompletionDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Target Date:</span>
                            <span className="font-medium text-slate-800">{formatDisplayDate(selectedCr.targetCompletionDate)}</span>
                          </div>
                        )}
                      </div>

                      {onSendBackToRequester && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowReturnModal(true);
                              setErrorMsg('');
                            }}
                            className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-700" />
                            <span>Request Clarification from Requester</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modal for IT Admin Sending Back to Requester */}
          {showReturnModal && selectedCr && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                    <RotateCcw className="w-4.5 h-4.5 text-amber-600" />
                    <span>Return to Requester for Clarification</span>
                  </div>
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
                  <p className="font-semibold text-amber-900">CR Reference: {selectedCr.id} — {selectedCr.title}</p>
                  <p className="text-[11px] text-amber-800">
                    Target Requester: <strong>{selectedCr.requesterName}</strong> ({selectedCr.requesterEmail}) • Dept: {selectedCr.departmentName}
                  </p>
                  <p className="text-[11px] text-amber-900/90 pt-1 border-t border-amber-200/80">
                    ℹ️ <strong>Workflow Notice:</strong> Department HOD approval was already granted. When the requester replies with the requested details, the case will return directly to IT Admin queue without needing HOD re-approval. The HOD will receive a carbon-copy audit log entry.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clarification / Additional Details Required <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={returnComments}
                    onChange={(e) => {
                      setReturnComments(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Specify the missing technical specifications, error screenshots, sample data files, or business rules needed from the requester..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  {errorMsg && <p className="text-xs text-rose-500 mt-1">{errorMsg}</p>}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReturnSubmit}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Requester (HOD CC'd)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: UAT & Verification */}
      {activeTab === 'verification' && (
        <>
          {pendingVerification.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-base font-bold text-slate-800">No Releases Awaiting Verification</h2>
              <p className="text-xs max-w-md mx-auto">
                All developer-completed requests have been verified and closed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerification.map((cr) => (
                <div
                  key={cr.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {cr.id}
                      </span>
                      <span className="text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                        Pending IT Release Verification
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Developer: <strong className="text-slate-800">{cr.assignedDeveloperName}</strong>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{cr.title}</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      <strong>Developer Implementation & Testing Notes:</strong> {cr.implementationNotes || 'None'}
                    </p>
                  </div>

                  {/* Code / Database Modifications (Before vs After Comparison) */}
                  {(cr.beforeChangeDetails || cr.afterChangeDetails || cr.hasCodeOrDatabaseChanges) && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                          <Database className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Code & Database Implementation Changes (Before vs After)</span>
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-900 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                          Technical Diff
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
                          <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-slate-800 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {cr.beforeChangeDetails || 'No baseline code / DB details recorded.'}
                          </div>
                        </div>

                        {/* Box 2: After Changes */}
                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-950 text-[11px]">
                            <span className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                              <span>2. After Changes (New Code / DB Migration)</span>
                            </span>
                            <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded font-mono">AFTER</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-800 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {cr.afterChangeDetails || 'No modified code / DB details recorded.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                    <label className="block font-semibold text-slate-700">
                      IT Verification & Release Sign-Off Comments <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={verifyComments}
                      onChange={(e) => {
                        setVerifyComments(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="Detail release verification results or reason for sending back..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none bg-white text-slate-900"
                    />
                  </div>

                  {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setSelectedCrId(cr.id);
                        handleVerifySubmit(true);
                      }}
                      className="flex-1 min-w-[200px] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer"
                    >
                      Verify Sign-Off & Close Request (Completed)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCrId(cr.id);
                        handleVerifySubmit(false);
                      }}
                      className="flex-1 min-w-[200px] py-2.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-300 hover:border-amber-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Return to 'In Progress' for Rework
                    </button>
                    {onRejectCase && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCrId(cr.id);
                          setRejectionReason('');
                          setRejectionError('');
                          setShowRejectModal(true);
                        }}
                        className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                        title="Permanently reject ticket and close as Closed (Rejected)"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Reject Ticket</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: Master Data */}
      {activeTab === 'masterdata' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">PCS System Master Data Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registered modules and lead software developers configured in the PCS suite.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {mockModules.map((mod) => (
              <div key={mod.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono text-blue-600 font-bold">
                  <span>{mod.id}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-sans">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{mod.name}</h3>
                <p className="text-slate-600 text-[11px]">{mod.description}</p>
                <div className="text-slate-500 pt-2 border-t border-slate-200">
                  Lead Developer: <strong className="text-slate-800">{mod.leadDeveloper}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Developer Assignment Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-indigo-950 font-bold text-sm">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Batch Assign {selectedBatchIds.length} Request(s)</span>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Select target developer and completion deadline for all {selectedBatchIds.length} selected change requests:
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
              {selectedBatchIds.map((id) => (
                <span key={id} className="font-mono text-[11px] font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                  {id}
                </span>
              ))}
            </div>

            {/* Staff Workload Scoring Table for Batch Assignment */}
            <StaffWorkloadTable
              staffList={developers}
              changeRequests={changeRequests}
              selectedStaffId={batchDevId}
              onSelectStaff={(devId) => setBatchDevId(devId)}
              title="Staff Workload & Capacity Scoring"
            />

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assign IT Staff / Developer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={batchDevId}
                  onChange={(e) => setBatchDevId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white"
                >
                  {developers.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.fullName} ({dev.role || 'Staff'} - {dev.departmentName || 'IT'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Completion Deadline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={batchTargetDate}
                  onChange={(e) => setBatchTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBatchAssign}
                className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Confirm Batch Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Rejection Modal (IT Admin, System Admin, IT Staff) */}
      {showRejectModal && selectedCr && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-rose-950 font-bold text-sm">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Case / Ticket ({currentUser.role})</span>
              </div>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setRejectionError('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 space-y-1">
              <p className="font-semibold text-rose-950">CR: {selectedCr.id} — {selectedCr.title}</p>
              <p className="text-[11px] text-rose-800">
                Requester: <strong>{selectedCr.requesterName}</strong> ({selectedCr.departmentName})
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
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setRejectionError('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    setRejectionError('Please provide a mandatory justification reason for rejecting this ticket.');
                    return;
                  }
                  if (onRejectCase) {
                    onRejectCase(selectedCr.id, rejectionReason.trim());
                  }
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setRejectionError('');
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirm & Reject Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IT Direct Modify Modal */}
      {showDirectModifyModal && selectedCr && onItDirectModify && (
        <ItDirectModifyModal
          isOpen={showDirectModifyModal}
          onClose={() => setShowDirectModifyModal(false)}
          changeRequest={selectedCr}
          currentUser={currentUser}
          developers={developers}
          changeRequests={changeRequests}
          onSave={(payload) => {
            onItDirectModify(payload);
            setShowDirectModifyModal(false);
          }}
        />
      )}
    </div>
  );
};
