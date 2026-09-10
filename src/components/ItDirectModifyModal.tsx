import React, { useState } from 'react';
import { ChangeRequest, UserProfile, PriorityLevel, TicketCategory, TicketIssueType } from '../types';
import { MASTER_CATEGORIES, MASTER_SERVICES, MASTER_APPLICATIONS_ASSETS, MASTER_ISSUE_TYPES } from '../data/serviceCatalog';
import { StaffWorkloadTable } from './StaffWorkloadTable';
import {
  X,
  Sliders,
  AlertTriangle,
  Send,
  UserCheck,
  Tag,
  Zap,
  Calendar,
  Layers,
  FileText,
  ShieldAlert,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';

export interface ItDirectModifyPayload {
  crId: string;
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

interface ItDirectModifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeRequest: ChangeRequest;
  currentUser: UserProfile;
  developers: UserProfile[];
  changeRequests?: ChangeRequest[];
  onSave: (payload: ItDirectModifyPayload) => void;
}

export const ItDirectModifyModal: React.FC<ItDirectModifyModalProps> = ({
  isOpen,
  onClose,
  changeRequest,
  currentUser,
  developers,
  changeRequests = [],
  onSave,
}) => {
  // Classification states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    changeRequest.categoryId ||
      MASTER_CATEGORIES.find((c) => c.name === changeRequest.category)?.id ||
      MASTER_CATEGORIES[0].id
  );

  const activeCategory = MASTER_CATEGORIES.find((c) => c.id === selectedCategoryId) || MASTER_CATEGORIES[0];
  const availableServices = MASTER_SERVICES.filter((s) => s.categoryId === activeCategory.id);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    changeRequest.serviceId ||
      availableServices.find((s) => s.name === changeRequest.subcategory)?.id ||
      availableServices[0]?.id ||
      ''
  );

  const activeService = availableServices.find((s) => s.id === selectedServiceId) || availableServices[0];
  const availableApplications = MASTER_APPLICATIONS_ASSETS.filter((a) =>
    a.serviceId ? a.serviceId === selectedServiceId : true
  );

  const [selectedAppAssetId, setSelectedAppAssetId] = useState<string>(
    changeRequest.applicationAssetId ||
      availableApplications.find((a) => a.name === changeRequest.applicationName)?.id ||
      availableApplications[0]?.id ||
      ''
  );

  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState<string>(
    changeRequest.issueTypeId ||
      MASTER_ISSUE_TYPES.find((i) => i.name === changeRequest.issueType)?.id ||
      MASTER_ISSUE_TYPES[0].id
  );

  // Priority state
  const [priority, setPriority] = useState<PriorityLevel>(changeRequest.priority);
  const [priorityChangeReason, setPriorityChangeReason] = useState<string>(
    changeRequest.priorityChangeReason || ''
  );

  // Developer assignment state
  const canAssignTickets = currentUser.role === 'IT Admin' || currentUser.role === 'System Admin';

  const [assignedDevId, setAssignedDevId] = useState<string>(
    changeRequest.assignedDeveloperId || ''
  );
  const [targetDate, setTargetDate] = useState<string>(
    changeRequest.targetCompletionDate ||
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Technical remarks
  const [comments, setComments] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const isPriorityChanged = priority !== changeRequest.priority;
  const isCategoryChanged =
    activeCategory.name !== changeRequest.category ||
    (activeService && activeService.name !== changeRequest.subcategory);
  const isDevChanged = assignedDevId !== (changeRequest.assignedDeveloperId || '');

  const handleCategoryChange = (newCatId: string) => {
    setSelectedCategoryId(newCatId);
    const newCat = MASTER_CATEGORIES.find((c) => c.id === newCatId);
    const newServices = MASTER_SERVICES.filter((s) => s.categoryId === newCatId);
    if (newServices.length > 0) {
      setSelectedServiceId(newServices[0].id);
      const newApps = MASTER_APPLICATIONS_ASSETS.filter((a) =>
        a.serviceId ? a.serviceId === newServices[0].id : true
      );
      setSelectedAppAssetId(newApps[0]?.id || '');
    } else {
      setSelectedServiceId('');
      setSelectedAppAssetId('');
    }
  };

  const handleServiceChange = (newSrvId: string) => {
    setSelectedServiceId(newSrvId);
    const newApps = MASTER_APPLICATIONS_ASSETS.filter((a) =>
      a.serviceId ? a.serviceId === newSrvId : true
    );
    setSelectedAppAssetId(newApps[0]?.id || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Priority Change Reason requirement
    if (isPriorityChanged && !priorityChangeReason.trim()) {
      setErrorMsg('A detailed reason is required when changing ticket priority.');
      return;
    }

    const assignedDev = developers.find((d) => d.id === assignedDevId);
    const activeApp = availableApplications.find((a) => a.id === selectedAppAssetId);
    const activeIssueType = MASTER_ISSUE_TYPES.find((i) => i.id === selectedIssueTypeId);

    onSave({
      crId: changeRequest.id,
      categoryId: activeCategory.id,
      categoryName: activeCategory.name,
      category: activeCategory.name,
      serviceId: activeService?.id,
      serviceName: activeService?.name,
      subcategory: activeService?.name,
      applicationAssetId: activeApp?.id,
      applicationAssetName: activeApp?.name,
      applicationName: activeApp?.name,
      issueTypeId: activeIssueType?.id,
      issueTypeName: activeIssueType?.name,
      issueType: activeIssueType?.name,
      priority,
      priorityChangeReason: isPriorityChanged ? priorityChangeReason.trim() : changeRequest.priorityChangeReason,
      assignedDeveloperId: canAssignTickets ? (assignedDevId ? assignedDevId : undefined) : changeRequest.assignedDeveloperId,
      assignedDeveloperName: canAssignTickets ? (assignedDev ? assignedDev.fullName : undefined) : changeRequest.assignedDeveloperName,
      targetCompletionDate: canAssignTickets ? targetDate : changeRequest.targetCompletionDate,
      comments: comments.trim(),
    });

    onClose();
  };

  const priorityColors: Record<PriorityLevel, { bg: string; text: string; border: string; active: string }> = {
    Low: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', active: 'bg-slate-700 text-white ring-2 ring-slate-400' },
    Medium: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', active: 'bg-blue-600 text-white ring-2 ring-blue-400' },
    High: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', active: 'bg-orange-600 text-white ring-2 ring-orange-400' },
    Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', active: 'bg-rose-600 text-white ring-2 ring-rose-400' },
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/40 text-indigo-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                  {changeRequest.id}
                </span>
                <span className="text-xs text-indigo-300 font-bold">IT Operations Direct Modify</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 line-clamp-1">{changeRequest.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Direct Action Banner (No Approval Required) */}
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-3 flex items-start space-x-2.5 text-xs text-indigo-950 shrink-0">
          <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-indigo-900">Direct IT Action (No Approval Flow Required):</span>
            <p className="text-[11px] text-indigo-800 mt-0.5">
              Updates made here will take effect immediately on the ticket. The requester ({changeRequest.requesterName}) and department HOD will be automatically notified via SMTP email along with your specified priority change reason.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Priority Change & Mandatory Reason */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>Ticket Priority Level</span>
              </label>
              {isPriorityChanged && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Priority Changed ({changeRequest.priority} ➔ {priority})
                </span>
              )}
            </div>

            {/* Priority Button Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Low', 'Medium', 'High', 'Critical'] as PriorityLevel[]).map((pLevel) => {
                const isSelected = priority === pLevel;
                const style = priorityColors[pLevel];

                return (
                  <button
                    key={pLevel}
                    type="button"
                    onClick={() => {
                      setPriority(pLevel);
                      setErrorMsg('');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      isSelected
                        ? style.active
                        : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                    }`}
                  >
                    <span>{pLevel}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500">
              {priority === 'Critical' && '⚡ Critical (24h SLA): System-wide outage, regulatory block, severe security risk.'}
              {priority === 'High' && '📌 High (3 Days SLA): Core departmental workflow obstruction with no workaround.'}
              {priority === 'Medium' && '📋 Medium (7 Days SLA): Standard process optimization or feature enhancement.'}
              {priority === 'Low' && '💡 Low (14 Days SLA): Minor UI adjustments, cosmetic corrections, or non-urgent queries.'}
            </p>

            {/* Mandatory Reason for Priority Change */}
            <div className="pt-2">
              <label className="block font-semibold text-slate-800 text-xs mb-1">
                Reason for Priority Change {isPriorityChanged && <span className="text-rose-500 font-bold">* (Mandatory for Audit Trail)</span>}
              </label>
              <textarea
                rows={2}
                value={priorityChangeReason}
                onChange={(e) => {
                  setPriorityChangeReason(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={
                  isPriorityChanged
                    ? 'Explain why this priority was elevated or de-escalated (e.g. Line-stop impact, temporary workaround in place, critical business closing deadline)...'
                    : 'Optional IT priority justification notes...'
                }
                className={`w-full px-3 py-2 text-xs rounded-xl border text-slate-900 focus:outline-none ${
                  isPriorityChanged && !priorityChangeReason.trim()
                    ? 'border-rose-400 bg-rose-50/40 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 bg-white focus:ring-2 focus:ring-indigo-100'
                }`}
              />
             
            </div>
          </div>

          {/* Section 2: Case Category & Classification */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Service Catalog Classification</span>
              </label>
              {isCategoryChanged && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  Classification Adjusted
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category (Level 1) */}
              <div>
                <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                  1. Category (Tier 1) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs"
                >
                  {MASTER_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory / Service (Level 2) */}
              <div>
                <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                  2. Service / Subcategory (Tier 2) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs"
                >
                  {availableServices.length === 0 ? (
                    <option value="">No subcategories available</option>
                  ) : (
                    availableServices.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Application / Asset (Level 3) */}
              <div>
                <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                  3. Application / Asset (Tier 3)
                </label>
                <select
                  value={selectedAppAssetId}
                  onChange={(e) => setSelectedAppAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs"
                >
                  <option value="">(None / General)</option>
                  {availableApplications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Type */}
              <div>
                <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                  4. Issue Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedIssueTypeId}
                  onChange={(e) => setSelectedIssueTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs"
                >
                  {MASTER_ISSUE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Developer Assignment & Target Completion (IT Admin and System Admin Only) */}
          {canAssignTickets && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Developer Assignment & Target Date</span>
                </label>
                {isDevChanged && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Assignee Updated
                  </span>
                )}
              </div>

              {/* System Admin Workload Scoring & Capacity */}
              <StaffWorkloadTable
                staffList={developers}
                changeRequests={changeRequests}
                selectedStaffId={assignedDevId}
                onSelectStaff={(devId) => setAssignedDevId(devId)}
                title="Staff Workload & Capacity Scoring"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                    Assigned IT Staff / Developer
                  </label>
                  <select
                    value={assignedDevId}
                    onChange={(e) => setAssignedDevId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs"
                  >
                    <option value="">(Unassigned - Pending IT Queue)</option>
                    {developers.map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.fullName} ({dev.role || 'Staff'} - {dev.departmentName || 'IT'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                    Target Completion Deadline
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Technical Remarks */}
          <div>
            <label className="block font-semibold text-slate-800 text-xs mb-1">
              IT Technical Notes / Implementation Directives (Optional)
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any internal engineering notes, root-cause triage findings, or coordination instructions..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Apply Changes & Auto-Notify Requester</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
