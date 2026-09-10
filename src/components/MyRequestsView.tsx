import React, { useState } from 'react';
import { UserProfile, ChangeRequest, RequestStatus } from '../types';
import { calculateSlaStatus, getSlaBadgeClass, getRiskBadgeClass, getChaseStageInfo } from '../utils/slaAndRisk';
import { formatDisplayDateTime, formatDisplayDate } from '../utils/timezone';
import {
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Eye,
  Edit,
  Plus,
  Layers,
  ArrowRight,
  Bookmark,
  ShieldAlert,
  Timer,
  Zap,
  PauseCircle,
  BellRing,
  MessageSquareReply,
  HelpCircle,
} from 'lucide-react';

interface MyRequestsViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  onRequestClick: (crId: string) => void;
  onEditRequest: (cr: ChangeRequest) => void;
  onCreateNewRequest: () => void;
}

export const MyRequestsView: React.FC<MyRequestsViewProps> = ({
  currentUser,
  changeRequests,
  onRequestClick,
  onEditRequest,
  onCreateNewRequest,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [presetFilter, setPresetFilter] = useState<'all' | 'action_required' | 'overdue' | 'critical'>('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('All');

  // Filter requests owned by user or relevant to user
  const userRequests = changeRequests.filter((cr) => {
    const matchesOwner =
      Boolean(cr.requesterId && currentUser.id && cr.requesterId.toLowerCase() === currentUser.id.toLowerCase()) ||
      Boolean(cr.requesterEmail && currentUser.email && cr.requesterEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
      Boolean(cr.requesterName && currentUser.fullName && cr.requesterName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase());
    const matchesSearch =
      cr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cr.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatusFilter === 'All' || cr.status === selectedStatusFilter;
    const matchesModule =
      selectedModuleFilter === 'All' || (Array.isArray(cr.affectedModules) && cr.affectedModules.includes(selectedModuleFilter));

    const sla = calculateSlaStatus(cr);
    let matchesPreset = true;
    if (presetFilter === 'action_required') {
      matchesPreset = cr.status === 'Draft' || cr.status === 'Returned to Requester';
    } else if (presetFilter === 'overdue') {
      matchesPreset = sla.slaStatus === 'SLA Breached' || sla.slaStatus === 'Nearing Breach';
    } else if (presetFilter === 'critical') {
      matchesPreset = cr.priority === 'Critical';
    }

    return matchesOwner && matchesSearch && matchesStatus && matchesModule && matchesPreset;
  });

  const getWorkflowStep = (cr: ChangeRequest) => {
    switch (cr.status) {
      case 'Draft':
        return 0;
      case 'Pending HOD Approval':
        return 1;
      case 'Pending IT Admin Review':
        return 2;
      case 'In Progress':
        return 3;
      case 'Pending IT Verification':
        return 4;
      case 'Closed (Completed)':
        return 5;
      case 'Closed (Rejected)':
        return -1;
      case 'Returned to Requester':
        // If developer was already assigned (e.g. Alex Chen), it is at Developer/Implementation stage
        if (cr.assignedDeveloperId) return 3;
        // If HOD already approved or returned by IT Admin, it is at IT Admin stage
        if (cr.hodApprovedAt || cr.hodApprovedBy || cr.returnedByRole === 'IT Admin') return 2;
        // Otherwise, returned by HOD before approval
        return 1;
      default:
        return 1;
    }
  };

  const steps = [
    'Draft',
    'HOD Review',
    'IT Admin',
    'In Progress',
    'Verification',
    'Completed',
  ];

  // Outstanding requests waiting specifically for user's clarification
  const pendingClarificationRequests = changeRequests.filter((cr) => {
    const isOwner =
      Boolean(cr.requesterId && currentUser.id && cr.requesterId.toLowerCase() === currentUser.id.toLowerCase()) ||
      Boolean(cr.requesterEmail && currentUser.email && cr.requesterEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
      Boolean(cr.requesterName && currentUser.fullName && cr.requesterName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase());
    return isOwner && cr.status === 'Returned to Requester';
  });

  return (
    <div className="space-y-6">
      {/* ⚠️ Prominent Action Required Banner for Requester */}
      {pendingClarificationRequests.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-5 shadow-sm space-y-3.5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <h2 className="text-sm font-bold text-amber-950">
                  Action Required: {pendingClarificationRequests.length} Request{pendingClarificationRequests.length > 1 ? 's' : ''} Awaiting Your Clarification
                </h2>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg flex items-center gap-1.5">
                <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>SLA Clock Paused</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-amber-900 leading-relaxed">
            The IT Department / HOD has requested additional technical details or clarification. <strong>The resolution SLA timer is paused</strong> while waiting for your response. Please provide the requested information to resume progress:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingClarificationRequests.map((cr) => {
              const sla = calculateSlaStatus(cr);
              const chase = getChaseStageInfo(sla.chaseStage);
              const latestReturn = (cr.approvalHistory || []).find(
                (h) => h.toStatus === 'Returned to Requester' || h.decision === 'Returned for Clarification' || h.decision === 'Sent Back'
              );

              return (
                <div
                  key={cr.id}
                  className="bg-white rounded-xl border border-amber-200/90 p-3.5 shadow-xs flex flex-col justify-between space-y-3 hover:border-amber-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {cr.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${chase.colorClass} flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${chase.dotColor}`}></span>
                          <span>{chase.shortBadge}</span>
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-amber-900/80">
                        Waiting: <strong>{sla.daysWaitingOnRequester ?? 0}d {((sla.hoursWaitingOnRequester ?? 0) % 24)}h</strong>
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{cr.title}</h3>

                    {latestReturn?.comments && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-950 font-medium line-clamp-2">
                        <span className="font-bold text-amber-900">Requested by {latestReturn.actorName}: </span>
                        "{latestReturn.comments}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-100/80">
                    <button
                      type="button"
                      onClick={() => onRequestClick(cr.id)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Request</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditRequest(cr)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      <span>⚡ Provide Clarification</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Request ID, Title, or Module..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-900"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 font-medium">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending HOD Approval">Pending HOD Approval</option>
              <option value="Returned to Requester">Returned to Requester</option>
              <option value="Pending IT Admin Review">Pending IT Admin Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending IT Verification">Pending IT Verification</option>
              <option value="Closed (Completed)">Closed (Completed)</option>
              <option value="Closed (Rejected)">Closed (Rejected)</option>
            </select>
          </div>
        </div>

        {/* Quick View Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center space-x-1">
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Quick Views:</span>
          </span>

          <button
            onClick={() => setPresetFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              presetFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80'
            }`}
          >
            All Requests
          </button>

          <button
            onClick={() => setPresetFilter('action_required')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              presetFilter === 'action_required'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-200'
            }`}
          >
            Pending My Action
          </button>

          <button
            onClick={() => setPresetFilter('critical')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              presetFilter === 'critical'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-900 hover:border-rose-200'
            }`}
          >
            Critical (HOD Skipped)
          </button>

          <button
            onClick={() => setPresetFilter('overdue')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              presetFilter === 'overdue'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-900 hover:border-rose-200'
            }`}
          >
            Overdue / SLA Risk
          </button>
        </div>
      </div>

      {/* Request List */}
      {userRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-semibold text-sm text-slate-800">No IT Request Found</p>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            
          </p>
          <button
            onClick={onCreateNewRequest}
            className="mt-2 inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <span>Create Your First Request</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {userRequests.map((cr) => {
            const currentStepIdx = getWorkflowStep(cr);
            const sla = calculateSlaStatus(cr);
            const risk = cr.riskAssessment;
            const isHodSkipped = cr.hodApprovalSkipped || (cr.priority === 'Critical' && cr.status !== 'Draft');

            return (
              <div
                key={cr.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {cr.id}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        cr.priority === 'Critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                          : cr.priority === 'High'
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {cr.priority}
                    </span>

                    {/* HOD Approval Skipped Tag */}
                    {isHodSkipped && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-slate-500" />
                        <span>HOD approval skipped</span>
                      </span>
                    )}

                    <span className="text-xs text-slate-500 font-normal">• {cr.requestType}</span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${getSlaBadgeClass(sla.slaStatus)}`}>
                      {sla.slaStatus === 'SLA Paused' ? (
                        <>
                          <PauseCircle className="w-3 h-3 text-amber-700" />
                          <span>SLA PAUSED (Waiting on You)</span>
                        </>
                      ) : sla.slaStatus === 'SLA Breached' ? (
                        'OVERDUE'
                      ) : sla.slaStatus === 'Nearing Breach' ? (
                        'NEARING BREACH'
                      ) : (
                        'ON TRACK'
                      )}
                    </span>

                    {sla.slaStatus === 'SLA Paused' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getChaseStageInfo(sla.chaseStage).colorClass}`}>
                        {getChaseStageInfo(sla.chaseStage).shortBadge}
                      </span>
                    )}

                    {risk && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getRiskBadgeClass(risk.riskLevel)}`}>
                        {risk.riskLevel} Risk
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                        cr.status === 'Closed (Completed)'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : cr.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : cr.status === 'Returned to Requester'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : cr.status === 'Pending IT Verification'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {cr.status}
                    </span>

                    {(cr.status === 'Draft' || cr.status === 'Returned to Requester') && (
                      <button
                        onClick={() => onEditRequest(cr)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50/60 rounded-lg transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      onClick={() => onRequestClick(cr.id)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Audit Details</span>
                    </button>
                  </div>
                </div>

                {/* Title and Clean Hierarchy Classification Path */}
                <div>
                  {cr.category && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs flex-wrap">
                      <span className="font-semibold text-slate-500 text-[11px]">Classification:</span>
                      <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                        {cr.category}
                      </span>
                      {cr.subcategory && (
                        <>
                          <span className="text-slate-400 text-[11px]">/</span>
                          <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            {cr.subcategory}
                          </span>
                        </>
                      )}
                      {cr.applicationName && cr.applicationName !== 'N/A' && (
                        <>
                          <span className="text-slate-400 text-[11px]">/</span>
                          <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            {cr.applicationName}
                          </span>
                        </>
                      )}
                      {cr.issueType && (
                        <>
                          <span className="text-slate-400 text-[11px]">/</span>
                          <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            {cr.issueType}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  <h3
                    onClick={() => onRequestClick(cr.id)}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                  >
                    {cr.title}
                  </h3>
                </div>

                {/* IT Priority Change Reason Note if modified by IT */}
                {cr.priorityChangeReason && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-amber-950 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>IT Priority Note:</span>
                        <span className="font-normal text-amber-900">"{cr.priorityChangeReason}"</span>
                        {cr.priorityChangedBy && (
                          <span className="text-[10px] text-amber-700">({cr.priorityChangedBy})</span>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-800">
                        Adjusted directly by IT Operations. No approval action needed from you.
                      </p>
                    </div>
                  </div>
                )}

                {/* IT Return Notice banner if applicable */}
                {cr.status === 'Returned to Requester' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-amber-950">
                        {cr.returnedByRole === 'IT Admin' || cr.returnedByRole === 'Software Developer' || cr.itClarificationRequested
                          ? `IT Staff (${cr.returnedByRole || 'IT'}${cr.assignedDeveloperName ? ` - ${cr.assignedDeveloperName}` : ''}) Requested Additional Details`
                          : 'Returned by Department HOD for Revision'}
                      </div>
                      <p className="text-amber-900 text-[11px]">
                        {cr.returnedByRole === 'IT Admin' || cr.returnedByRole === 'Software Developer' || cr.itClarificationRequested
                          ? cr.assignedDeveloperName
                            ? ``
                            : `Click "Edit" above to supply the requested technical details or attachments. As HOD approval was already granted, submitting your updates will return the ticket directly to IT Admin (without requiring HOD approval again).`
                          : 'Please review comments in Audit Details, update the necessary information, and resubmit for HOD approval.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Visual State Machine Workflow Tracker */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Approval & Implementation Lifecycle
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {steps.map((stepLabel, idx) => {
                      const isPast = currentStepIdx > idx;
                      const isCurrent = currentStepIdx === idx;
                      const isRejected = cr.status === 'Closed (Rejected)' && idx === 1;
                      const isHodStepSkipped = isHodSkipped && idx === 1;

                      let barColor = 'bg-slate-200';
                      let stepDisplayText = stepLabel;

                      if (isRejected) {
                        barColor = 'bg-rose-500';
                      } else if (isHodStepSkipped) {
                        barColor = 'bg-slate-300';
                        stepDisplayText = 'HOD Skipped';
                      } else if (isCurrent) {
                        barColor = 'bg-blue-600';
                      } else if (isPast) {
                        barColor = 'bg-emerald-500';
                      }

                      return (
                        <div key={idx} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                          />
                          <p
                            className={`text-[10px] font-medium truncate ${
                              isHodStepSkipped
                                ? 'text-slate-500 font-semibold'
                                : isCurrent
                                ? 'text-blue-700 font-bold'
                                : isPast
                                ? 'text-slate-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {stepDisplayText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div>Submitted: <strong className="text-slate-700 font-medium">{formatDisplayDateTime(cr.createdAt)}</strong></div>
                  {cr.assignedDeveloperName && (
                    <div>
                      Assigned Developer:{' '}
                      <strong className="text-slate-800 font-semibold">{cr.assignedDeveloperName}</strong>
                    </div>
                  )}
                  {cr.targetCompletionDate && (
                    <div>
                      Target Date:{' '}
                      <strong className="text-slate-800 font-semibold">{formatDisplayDate(cr.targetCompletionDate)}</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

