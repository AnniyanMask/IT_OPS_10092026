import React, { useState, useMemo } from 'react';
import { UserProfile, ChangeRequest, RequestStatus, CustomRoleDefinition } from '../types';
import { calculateRiskScore, getRiskBadgeClass } from '../utils/slaAndRisk';
import { getPriorityWorkloadPoints } from '../utils/workloadScoring';
import { formatDisplayDate } from '../utils/timezone';
import { hasRolePermission, getEligibleDevelopers } from '../utils/rbac';
import { ItDirectModifyModal, ItDirectModifyPayload } from './ItDirectModifyModal';
import { StaffWorkloadReportView } from './StaffWorkloadReportView';
import { mockUsers } from '../data/db';
import {
  Kanban,
  Clock,
  CheckCircle2,
  Paperclip,
  Code2,
  FileCode,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Send,
  X,
  XCircle,
  Database,
  ShieldAlert,
  Edit3,
  RotateCcw,
  HelpCircle,
  Sliders,
  Zap,
  BarChart3,
  Award,
  Layers,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Sparkles,
  Terminal,
  FileDiff,
  GitCommit,
} from 'lucide-react';

interface DeveloperKanbanViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  users?: UserProfile[];
  customRoles?: CustomRoleDefinition[];
  onUpdateDevStatus: (
    crId: string,
    newStatus: RequestStatus,
    techNotes: string,
    updatedRisk?: any,
    beforeChangeDetails?: string,
    afterChangeDetails?: string,
    hasCodeOrDatabaseChanges?: boolean
  ) => void;
  onSendBackToRequester?: (crId: string, comments: string) => void;
  onItDirectModify?: (payload: ItDirectModifyPayload) => void;
  onRejectCase?: (crId: string, rejectionReason: string) => void;
  onRequestClick: (crId: string) => void;
}

export const DeveloperKanbanView: React.FC<DeveloperKanbanViewProps> = ({
  currentUser,
  changeRequests,
  users,
  customRoles = [],
  onUpdateDevStatus,
  onSendBackToRequester,
  onItDirectModify,
  onRejectCase,
  onRequestClick,
}) => {
  const [selectedCr, setSelectedCr] = useState<ChangeRequest | null>(null);
  const [targetStatus, setTargetStatus] = useState<RequestStatus>('In Progress');
  const [techNotes, setTechNotes] = useState('');
  const [hasCodeOrDatabaseChanges, setHasCodeOrDatabaseChanges] = useState(true);
  const [beforeChangeDetails, setBeforeChangeDetails] = useState('');
  const [afterChangeDetails, setAfterChangeDetails] = useState('');
  const [notesError, setNotesError] = useState('');
  const [schemaChangeRequired, setSchemaChangeRequired] = useState(false);
  const [downtimeRequired, setDowntimeRequired] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isModalFullscreen, setIsModalFullscreen] = useState(true);
  const [copiedBefore, setCopiedBefore] = useState(false);
  const [copiedAfter, setCopiedAfter] = useState(false);

  // Rejection Modal State (Developer / IT Staff)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectCr, setRejectCr] = useState<ChangeRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Direct Modify Modal State
  const [showDirectModifyModal, setShowDirectModifyModal] = useState(false);
  const [directModifyCr, setDirectModifyCr] = useState<ChangeRequest | null>(null);

  // Clarification Modal State
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [clarificationCr, setClarificationCr] = useState<ChangeRequest | null>(null);
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [clarificationError, setClarificationError] = useState('');

  // Individual Workload Points Modal State
  const [showMyPointsModal, setShowMyPointsModal] = useState(false);

  // Dynamic developer list derived from live system users & Custom Roles Matrix
  const developers = useMemo(() => {
    const source = users && users.length > 0 ? users : mockUsers;
    const eligible = getEligibleDevelopers(source, customRoles);
    if (eligible.length > 0) return eligible;
    return source.filter((u) => u.role === 'Software Developer' || u.role === 'IT Admin');
  }, [users, customRoles]);

  // Filter active tasks assigned to dev or view all if IT Admin (exclude Closed cases)
  const canViewAllDevTasks = hasRolePermission(currentUser.role, 'canTriageAndAssignDevs', customRoles) || currentUser.role === 'System Admin';
  const devRequests = changeRequests.filter((cr) => {
    // Exclude closed cases from Dev Task Board
    if (cr.status === 'Closed (Completed)' || cr.status === 'Closed (Rejected)') return false;
    if (canViewAllDevTasks) return cr.assignedDeveloperId !== undefined;
    return cr.assignedDeveloperId === currentUser.id;
  });

  // Calculate personal workload metrics for the current IT staff member
  const allMyAssignedCases = useMemo(() => {
    return changeRequests.filter((cr) => cr.assignedDeveloperId === currentUser.id);
  }, [changeRequests, currentUser.id]);

  const myTotalHistoricalPoints = useMemo(() => {
    return allMyAssignedCases.reduce((acc, cr) => acc + getPriorityWorkloadPoints(cr.priority), 0);
  }, [allMyAssignedCases]);

  const myActiveAssignedCases = useMemo(() => {
    return allMyAssignedCases.filter(
      (cr) => cr.status !== 'Closed (Completed)' && cr.status !== 'Closed (Rejected)'
    );
  }, [allMyAssignedCases]);

  const myActivePoints = useMemo(() => {
    return myActiveAssignedCases.reduce((acc, cr) => acc + getPriorityWorkloadPoints(cr.priority), 0);
  }, [myActiveAssignedCases]);

  const columns: { label: string; status: RequestStatus; color: string; badge: string }[] = [
    { label: 'Assigned / In Progress', status: 'In Progress', color: 'border-blue-500 bg-blue-50/30', badge: 'bg-blue-100 text-blue-800' },
    { label: 'Ready for UAT / IT Verification', status: 'Pending IT Verification', color: 'border-amber-500 bg-amber-50/30', badge: 'bg-amber-100 text-amber-800' },
  ];

  const handleOpenUpdateModal = (cr: ChangeRequest, nextStatus: RequestStatus) => {
    setSelectedCr(cr);
    setTargetStatus(nextStatus);
    setTechNotes(cr.implementationNotes || '');
    setHasCodeOrDatabaseChanges(
      cr.hasCodeOrDatabaseChanges !== undefined
        ? cr.hasCodeOrDatabaseChanges
        : cr.riskAssessment?.schemaChangeRequired || Boolean(cr.beforeChangeDetails || cr.afterChangeDetails) || true
    );
    setBeforeChangeDetails(cr.beforeChangeDetails || '');
    setAfterChangeDetails(cr.afterChangeDetails || '');
    setSchemaChangeRequired(cr.riskAssessment?.schemaChangeRequired || false);
    setDowntimeRequired(cr.riskAssessment?.downtimeRequired || false);
    setNotesError('');
    setShowModal(true);
  };

  const handleOpenClarification = (cr: ChangeRequest) => {
    setClarificationCr(cr);
    setClarificationNotes('');
    setClarificationError('');
    setShowClarificationModal(true);
  };

  const handleSubmitClarification = () => {
    if (!clarificationCr) return;
    if (!clarificationNotes.trim()) {
      setClarificationError('Please provide details on what technical specifications or clarification is required.');
      return;
    }

    if (onSendBackToRequester) {
      onSendBackToRequester(clarificationCr.id, clarificationNotes);
    }
    setShowClarificationModal(false);
    setClarificationCr(null);
    setClarificationNotes('');
  };

  const currentRisk = selectedCr
    ? calculateRiskScore({
        affectedModulesCount: (selectedCr.affectedModules || []).length,
        priority: selectedCr.priority,
        downtimeRequired,
        schemaChangeRequired,
        requestType: selectedCr.requestType,
      })
    : null;

  const handleSaveStatus = () => {
    if (!selectedCr) return;
    
    if (hasCodeOrDatabaseChanges) {
      if (!beforeChangeDetails.trim() || !afterChangeDetails.trim()) {
        setNotesError('Please complete both Before and After change details for code or database modifications.');
        return;
      }
    }

    if (!techNotes.trim() && !beforeChangeDetails.trim() && !afterChangeDetails.trim()) {
      setNotesError('Please provide technical implementation & testing notes.');
      return;
    }

    onUpdateDevStatus(
      selectedCr.id,
      targetStatus,
      techNotes.trim(),
      currentRisk || selectedCr.riskAssessment,
      beforeChangeDetails.trim(),
      afterChangeDetails.trim(),
      hasCodeOrDatabaseChanges
    );
    setShowModal(false);
    setSelectedCr(null);
    setTechNotes('');
    setBeforeChangeDetails('');
    setAfterChangeDetails('');
    setNotesError('');
  };

  return (
    <div className="space-y-6">
      {/* Individual Workload Points Summary Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">My Workload Points & Queue</h2>
              
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Active Workload:{' '}
              <strong className="text-slate-900 font-bold">{myActivePoints} / 10 pts</strong> ({myActiveAssignedCases.length} active cases)
              <span className="text-slate-300 mx-2">•</span>
              Total Historical Points:{' '}
              <strong className="text-blue-700 font-bold">{myTotalHistoricalPoints} pts</strong> ({allMyAssignedCases.length} total cases)
            </p>
          </div>
        </div>

        
              </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {columns.map((col) => {
          const colItems = devRequests.filter((cr) => cr.status === col.status);

          return (
            <div
              key={col.status}
              className={`rounded-2xl border-t-4 border ${col.color} p-4 space-y-4 bg-white/80 shadow-sm flex flex-col h-full min-h-[500px]`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h2 className="font-bold text-sm text-slate-800">{col.label}</h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${col.badge}`}>
                  {colItems.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No requests in {col.label}
                  </div>
                ) : (
                  colItems.map((cr) => (
                    <div
                      key={cr.id}
                      className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          onClick={() => onRequestClick(cr.id)}
                          className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 cursor-pointer hover:underline"
                        >
                          {cr.id}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
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
                        </div>
                      )}

                      <h3
                        onClick={() => onRequestClick(cr.id)}
                        className="font-bold text-slate-900 text-xs hover:text-blue-600 cursor-pointer line-clamp-2"
                      >
                        {cr.title}
                      </h3>

                      <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2 rounded border border-slate-200/70">
                        <div>Requester: {cr.requesterName}</div>
                        <div>Target: {cr.targetCompletionDate ? formatDisplayDate(cr.targetCompletionDate) : 'Not set'}</div>
                        {cr.assignedDeveloperName && (
                          <div className="text-slate-700 font-medium">Dev: {cr.assignedDeveloperName}</div>
                        )}
                      </div>

                      {/* Technical Scope Assessment Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cr.riskAssessment?.schemaChangeRequired && (
                          <span className="flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Database className="w-3 h-3 mr-1 text-amber-600" />
                            Production DB Schema Change
                          </span>
                        )}
                        {cr.riskAssessment?.downtimeRequired && (
                          <span className="flex items-center text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 mr-1 text-rose-600" />
                            System Downtime
                          </span>
                        )}
                        {cr.riskAssessment && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getRiskBadgeClass(cr.riskAssessment.riskLevel)}`}>
                            {cr.riskAssessment.riskLevel} Risk ({cr.riskAssessment.riskScore}/100)
                          </span>
                        )}
                      </div>

                      {cr.implementationNotes && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                          <strong>Tech Notes:</strong> {cr.implementationNotes}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => onRequestClick(cr.id)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Details
                          </button>

                          {onItDirectModify && (
                            <button
                              onClick={() => {
                                setDirectModifyCr(cr);
                                setShowDirectModifyModal(true);
                              }}
                              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center space-x-0.5 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200/80"
                              title="Direct modify priority, category, or developer assignment"
                            >
                              <Sliders className="w-2.5 h-2.5" />
                              <span>Modify</span>
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleOpenUpdateModal(cr, cr.status)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Assess Scope / Notes</span>
                        </button>

                        {onSendBackToRequester && cr.status !== 'Closed (Completed)' && (
                          <button
                            onClick={() => handleOpenClarification(cr)}
                            className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center space-x-1 transition-colors"
                            title="Return to requester for additional technical details or clarification"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Request Details</span>
                          </button>
                        )}

                        {onRejectCase && cr.status !== 'Closed (Completed)' && (
                          <button
                            onClick={() => {
                              setRejectCr(cr);
                              setRejectionReason('');
                              setRejectionError('');
                              setShowRejectModal(true);
                            }}
                            className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 flex items-center space-x-1 transition-colors cursor-pointer"
                            title="Reject this ticket (records rejection reasons in audit trail)"
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Reject Ticket</span>
                          </button>
                        )}

                        {cr.status === 'In Progress' && (
                          <button
                            onClick={() => handleOpenUpdateModal(cr, 'Pending IT Verification')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-sm flex items-center space-x-1"
                          >
                            <span>Mark Complete</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {cr.status === 'Pending IT Verification' && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
                            Awaiting IT Verifier
                          </span>
                        )}

                        {cr.status === 'Closed (Completed)' && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Released</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Update & Technical Assessment Modal - Fullscreen Developer Studio */}
      {showModal && selectedCr && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 transition-all duration-200">
          <div
            className={`bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              isModalFullscreen
                ? 'w-full h-full max-w-[98vw] max-h-[96vh]'
                : 'w-full max-w-5xl max-h-[90vh]'
            }`}
          >
            {/* Studio Top Header Bar */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                      {selectedCr.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCr.priority === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : selectedCr.priority === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {selectedCr.priority} Priority
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Requester: <strong className="text-slate-200">{selectedCr.requesterName}</strong> ({selectedCr.departmentName})
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5 truncate max-w-2xl">
                    {selectedCr.title}
                  </h3>
                </div>
              </div>

              {/* Status Selector & Controls */}
              <div className="flex items-center space-x-2.5 ml-auto">
                <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1 space-x-2">
                  <span className="text-[11px] text-slate-300 font-medium">Target Status:</span>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as RequestStatus)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-600 text-white bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="In Progress">In Progress (Active Work)</option>
                    <option value="Pending IT Verification">Pending IT Verification (Ready for UAT)</option>
                    <option value="Closed (Completed)">Closed (Completed)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalFullscreen(!isModalFullscreen)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title={isModalFullscreen ? 'Minimize window' : 'Full-screen mode'}
                >
                  {isModalFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Studio Scrollable Workspace Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-100/60">
              {/* Section 1: Production Impact & Scope Assessment Ribbon */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Technical Scope & Production Impact Assessment</h4>
                      <p className="text-[11px] text-slate-500">
                        Declare whether changes touch production databases or require downtime window.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-wrap">
                    {currentRisk && (
                      <span className={`px-3 py-1 rounded-full font-bold text-xs ${getRiskBadgeClass(currentRisk.riskLevel)}`}>
                        Risk Impact: {currentRisk.riskLevel} ({currentRisk.riskScore}/100)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    schemaChangeRequired
                      ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={schemaChangeRequired}
                      onChange={(e) => setSchemaChangeRequired(e.target.checked)}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Requires Production Schema / Data Changes</span>
                      </span>
                      <p className="text-slate-500 text-[11px] leading-tight">
                        Requires running migration scripts, ALTER statements, or data modification on production PostgreSQL database.
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    downtimeRequired
                      ? 'bg-amber-50/70 border-amber-300 text-amber-950 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={downtimeRequired}
                      onChange={(e) => setDowntimeRequired(e.target.checked)}
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Requires System Downtime Maintenance Window</span>
                      </span>
                      <p className="text-slate-500 text-[11px] leading-tight">
                        Requires off-hours maintenance window and planned service interruption for deployment.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 2: Full Screen Side-by-Side Code Diff Workspace */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
                      <FileDiff className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Source Code & Database Modifications (Before vs After Diff)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Technical audit trail capturing baseline original state vs patched implementation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setHasCodeOrDatabaseChanges(true)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                        hasCodeOrDatabaseChanges
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Yes (Provide Before & After)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasCodeOrDatabaseChanges(false)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        !hasCodeOrDatabaseChanges
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>No (Operational / Config Only)</span>
                    </button>
                  </div>
                </div>

                {hasCodeOrDatabaseChanges ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left Box: Before Changes (Original Code / DB State) */}
                    <div className="flex flex-col rounded-xl border-2 border-rose-200/90 bg-rose-50/30 overflow-hidden shadow-xs">
                      {/* Sub-Header */}
                      <div className="bg-rose-100/70 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                          <span className="text-xs font-bold text-rose-950">
                            1. Details Before Changes (Original Code / DB State)
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-rose-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                            [-] BEFORE
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setBeforeChangeDetails(
                                `-- Baseline SQL Query / Procedure\nSELECT id, code, amount, status\nFROM account_ledgers\nWHERE status = 'ACTIVE';\n-- Original bug/behavior: Missing index and lack of currency conversion check.`
                              );
                              setNotesError('');
                            }}
                            className="px-2 py-0.5 bg-white/80 hover:bg-white text-rose-800 border border-rose-300 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            + Insert SQL Template
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(beforeChangeDetails);
                              setCopiedBefore(true);
                              setTimeout(() => setCopiedBefore(false), 2000);
                            }}
                            disabled={!beforeChangeDetails}
                            className="p-1 bg-white/80 hover:bg-white text-rose-800 border border-rose-300 rounded text-[10px] transition-colors cursor-pointer disabled:opacity-40"
                            title="Copy code"
                          >
                            {copiedBefore ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {beforeChangeDetails && (
                            <button
                              type="button"
                              onClick={() => setBeforeChangeDetails('')}
                              className="px-1.5 py-0.5 bg-white/80 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Code Area */}
                      <div className="p-3 flex-1 flex flex-col">
                        <textarea
                          rows={isModalFullscreen ? 11 : 7}
                          value={beforeChangeDetails}
                          onChange={(e) => {
                            setBeforeChangeDetails(e.target.value);
                            setNotesError('');
                          }}
                          placeholder={`// Paste original code block, controller logic, or baseline database query...\n// Example:\nfunction calculateDiscount(price, userTier) {\n  return price * 0.10; // Hardcoded 10% regardless of tier\n}`}
                          className="w-full flex-1 p-3 text-xs font-mono rounded-lg border border-rose-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 placeholder:font-sans placeholder:text-slate-400 resize-y leading-relaxed shadow-inner"
                        />
                        <div className="flex items-center justify-between text-[10px] text-rose-800 pt-2 px-1 font-mono">
                          <span>Lines: {beforeChangeDetails.split('\n').filter(Boolean).length || 0}</span>
                          <span>{beforeChangeDetails.length} characters</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Box: After Changes (New Code / DB Migration) */}
                    <div className="flex flex-col rounded-xl border-2 border-emerald-200/90 bg-emerald-50/30 overflow-hidden shadow-xs">
                      {/* Sub-Header */}
                      <div className="bg-emerald-100/70 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-950">
                            2. Details After Changes (New Code / DB Migration)
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                            [+] AFTER
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setAfterChangeDetails(
                                `-- Patched SQL Migration & Stored Procedure\nALTER TABLE account_ledgers ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4) DEFAULT 1.0000;\nCREATE INDEX IF NOT EXISTS idx_ledgers_status ON account_ledgers(status);\n\nSELECT id, code, (amount * exchange_rate) AS converted_amount, status\nFROM account_ledgers\nWHERE status = 'ACTIVE';`
                              );
                              setNotesError('');
                            }}
                            className="px-2 py-0.5 bg-white/80 hover:bg-white text-emerald-800 border border-emerald-300 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            + Insert Migration Template
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(afterChangeDetails);
                              setCopiedAfter(true);
                              setTimeout(() => setCopiedAfter(false), 2000);
                            }}
                            disabled={!afterChangeDetails}
                            className="p-1 bg-white/80 hover:bg-white text-emerald-800 border border-emerald-300 rounded text-[10px] transition-colors cursor-pointer disabled:opacity-40"
                            title="Copy code"
                          >
                            {copiedAfter ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {afterChangeDetails && (
                            <button
                              type="button"
                              onClick={() => setAfterChangeDetails('')}
                              className="px-1.5 py-0.5 bg-white/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Code Area */}
                      <div className="p-3 flex-1 flex flex-col">
                        <textarea
                          rows={isModalFullscreen ? 11 : 7}
                          value={afterChangeDetails}
                          onChange={(e) => {
                            setAfterChangeDetails(e.target.value);
                            setNotesError('');
                          }}
                          placeholder={`// Paste updated implementation, patch function, or migration SQL script...\n// Example:\nfunction calculateDiscount(price, userTier) {\n  const rates = { PLATINUM: 0.25, GOLD: 0.15, SILVER: 0.10 };\n  return price * (rates[userTier] || 0.05);\n}`}
                          className="w-full flex-1 p-3 text-xs font-mono rounded-lg border border-emerald-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:font-sans placeholder:text-slate-400 resize-y leading-relaxed shadow-inner"
                        />
                        <div className="flex items-center justify-between text-[10px] text-emerald-800 pt-2 px-1 font-mono">
                          <span>Lines: {afterChangeDetails.split('\n').filter(Boolean).length || 0}</span>
                          <span>{afterChangeDetails.length} characters</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-center space-x-3">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-semibold text-slate-900">Operational / Configuration Change Mode</p>
                      <p className="text-slate-500 text-[11px]">
                        No source code or database changes were made. Code before/after diffs are bypassed.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Implementation & Testing Summary Notes */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <GitCommit className="w-4 h-4 text-indigo-600" />
                    <span>Developer Technical Implementation & Testing Notes</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Test cases • Regression verification • Commit / PR references
                  </span>
                </div>

                <textarea
                  rows={isModalFullscreen ? 4 : 3}
                  value={techNotes}
                  onChange={(e) => {
                    setTechNotes(e.target.value);
                    setNotesError('');
                  }}
                  placeholder="Detail overall technical summary, test cases performed, regression tests, commit references, migration script names, and release sign-off checklist..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />

                {/* Quick Helper Presets */}
                <div className="flex items-center space-x-2 flex-wrap text-[11px] pt-1">
                  <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
                    Quick Append:
                  </span>
                  {[
                    '[x] Unit Tests Passed',
                    '[x] Regression Verified',
                    '[x] Staging Deployed',
                    '[x] Rollback Plan Verified',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTechNotes((prev) => (prev ? `${prev}\n${preset}` : preset));
                        setNotesError('');
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {notesError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{notesError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Studio Sticky Footer Action Bar */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 shrink-0">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span>Action:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Advance to {targetStatus}
                </span>
               
              </div>

              <div className="flex items-center space-x-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Assessment & Update Workflow</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer Return to Requester for Clarification Modal */}
      {showClarificationModal && clarificationCr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <RotateCcw className="w-4.5 h-4.5 text-amber-600" />
                <span>Request Clarification from Requester</span>
              </div>
              <button
                onClick={() => {
                  setShowClarificationModal(false);
                  setClarificationCr(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
              <p className="font-semibold text-amber-900">CR Reference: {clarificationCr.id} — {clarificationCr.title}</p>
              <p className="text-[11px] text-amber-800">
                Requester: <strong>{clarificationCr.requesterName}</strong> ({clarificationCr.requesterEmail}) • Dept: {clarificationCr.departmentName}
              </p>
              <p className="text-[11px] text-amber-900/90 pt-1 border-t border-amber-200/80">
                💡 <strong>Direct Workflow:</strong> As HOD approval was already granted, the requester's resubmission will bypass HOD re-approval and route directly back to your active Kanban workbench as In Progress. HOD and IT Admin will receive carbon-copy audit notifications.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Developer Questions / Missing Details Required <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={clarificationNotes}
                onChange={(e) => {
                  setClarificationNotes(e.target.value);
                  setClarificationError('');
                }}
                placeholder="Explain what technical details, sample data files, reproduction steps, or edge cases are needed from the requester..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {clarificationError && <p className="text-xs text-rose-500 mt-1">{clarificationError}</p>}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowClarificationModal(false);
                  setClarificationCr(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitClarification}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IT Direct Modify Modal */}
      {showDirectModifyModal && directModifyCr && onItDirectModify && (
        <ItDirectModifyModal
          isOpen={showDirectModifyModal}
          onClose={() => {
            setShowDirectModifyModal(false);
            setDirectModifyCr(null);
          }}
          changeRequest={directModifyCr}
          currentUser={currentUser}
          developers={developers}
          changeRequests={changeRequests}
          onSave={(payload) => {
            onItDirectModify(payload);
            setShowDirectModifyModal(false);
            setDirectModifyCr(null);
          }}
        />
      )}

      {/* Rejection Modal for Developer / IT Staff */}
      {showRejectModal && rejectCr && (
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
                  setRejectCr(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 space-y-1">
              <p className="font-semibold text-rose-950">CR: {rejectCr.id} — {rejectCr.title}</p>
              <p className="text-[11px] text-rose-800">
                Requester: <strong>{rejectCr.requesterName}</strong> ({rejectCr.departmentName})
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
                  setRejectCr(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    setRejectionError('Please provide a mandatory justification reason for rejecting this case.');
                    return;
                  }
                  if (onRejectCase) {
                    onRejectCase(rejectCr.id, rejectionReason.trim());
                  }
                  setShowRejectModal(false);
                  setRejectCr(null);
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

      {/* Individual Workload Points & Details Modal */}
      {showMyPointsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    My Workload Points & Assignment Details
                  </h2>
                  <p className="text-xs text-slate-500">
                    Individual breakdown for {currentUser.fullName} ({currentUser.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMyPointsModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              <StaffWorkloadReportView
                staffList={[currentUser]}
                changeRequests={changeRequests}
                currentUser={currentUser}
                individualOnly={true}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMyPointsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
