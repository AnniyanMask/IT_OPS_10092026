import React, { useState } from 'react';
import { UserProfile, Department, TemporaryApproverDelegation, DelegationReason } from '../types';
import { mockDepartments } from '../data/db';
import {
  UserCheck,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  X,
  Plus,
  CheckCircle2,
  Info,
  User,
  Mail,
  Building2,
  FileText
} from 'lucide-react';

interface DelegationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  departmentUsers: UserProfile[];
  onSaveDelegation: (data: {
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
  }) => void;
}

export const DelegationManagementModal: React.FC<DelegationManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  departmentUsers,
  onSaveDelegation,
}) => {
  const todayStr = '2026-08-22';
  
  // Calculate default 7-day end date
  const defaultEndDate = '2026-08-29';

  const [delegateUserId, setDelegateUserId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [reason, setReason] = useState<DelegationReason>('Annual Leave');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  // Filter department members from same department (excluding the current HOD)
  const eligibleCandidates = departmentUsers.filter(
    (u) => u.departmentId === currentUser.departmentId && u.id !== currentUser.id
  );

  const selectedCandidate = eligibleCandidates.find((u) => u.id === delegateUserId);

  const handleApplyPresetDays = (days: number) => {
    // 2026-08-22 base
    const start = new Date(startDate || todayStr);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    setEndDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!delegateUserId) {
      setErrorMsg('Please select an eligible team member from your department to assign as Acting Approver.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMsg('Please specify both the authorization Start Date and End Date.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('The End Date must be greater than or equal to the Start Date.');
      return;
    }

    const finalReason = (reason === 'Other' && customReason.trim() ? customReason.trim() : reason) as DelegationReason;

    const candidate = eligibleCandidates.find((u) => u.id === delegateUserId);
    if (!candidate) {
      setErrorMsg('Selected candidate is not a registered member of this department.');
      return;
    }

    onSaveDelegation({
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      hodUserId: currentUser.id,
      hodName: currentUser.fullName,
      hodEmail: currentUser.email,
      delegateUserId: candidate.id,
      delegateName: candidate.fullName,
      delegateEmail: candidate.email,
      delegateRole: candidate.role,
      startDate: `${startDate} 00:00:00`,
      endDate: `${endDate} 23:59:59`,
      reason: finalReason,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-amber-950 text-white p-6 border-b border-amber-700/50 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
               
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Assign Temporary Approver
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Grant acting HOD approval powers to a same-department colleague during leave, business travel, or transition handover.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Department Information Banner */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Authorized Department Scope</span>
                <p className="text-xs font-bold text-slate-900">
                  {currentUser.departmentName} (Dept #{currentUser.departmentId})
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Granting HOD</span>
              <p className="text-xs font-bold text-slate-900">{currentUser.fullName}</p>
            </div>
          </div>

          {/* Step 1: Select Candidate from Same Department */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">
              1. Select Acting Approver (Same Department Team Member) <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500">
              Only verified members assigned to the <strong>{currentUser.departmentName}</strong> department are eligible for approval delegation.
            </p>

            {eligibleCandidates.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                No secondary staff members found in this department. Please contact IT Administration to register departmental requesters first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {eligibleCandidates.map((candidate) => {
                  const isSelected = delegateUserId === candidate.id;
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => setDelegateUserId(candidate.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                        isSelected
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {candidate.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">{candidate.fullName}</p>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{candidate.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                            @{candidate.username || 'user'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">{candidate.role}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Delegation Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">
              2. Reason for Temporary Handover <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'Annual Leave', label: '🏖️ Annual Leave' },
                { id: 'Medical Leave / Emergency', label: '🏥 Medical Leave' },
                { id: 'Business Travel / Duty Outstation', label: '✈️ Business Travel' },
                { id: 'Resignation / Transition Handover', label: '🔄 Transition / Resignation' },
                { id: 'Special Assignment', label: '🎯 Special Assignment' },
                { id: 'Other', label: '📝 Other Reason' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReason(item.id as DelegationReason)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    reason === item.id
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Specify delegation reason..."
                className="w-full mt-2 px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            )}
          </div>

          {/* Step 3: Authorization Time Frame */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                3. Authorization Time Frame (Window of Authority) <span className="text-rose-500">*</span>
              </label>
              
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <button
                type="button"
                onClick={() => handleApplyPresetDays(3)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
              >
                +3 Days (Short Leave)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetDays(7)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors cursor-pointer"
              >
                +1 Week (Standard)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetDays(14)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
              >
                +2 Weeks (Fortnight)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetDays(30)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
              >
                +30 Days (Handover)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Start Date (Effective From 00:00)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  End Date (Authority Expires at 23:59)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Timeframe Notice Box */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950 flex items-start space-x-2 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Automatic Lifecycle Enforcement:</strong> During this window ({startDate} to {endDate}), the temporary approver can access the HOD Approval Queue and make formal decisions (Approve/Reject/Send Back). 
                Once the end date passes, the system automatically transitions them to <strong>Read-Only History</strong> mode (they retain access to view change requests and logs, but cannot execute approval actions).
              </div>
            </div>
          </div>

          {/* Step 4: Handover Instructions & Audit Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">
              4. Handover Instructions & Audit Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Alice Morgan is authorized to approve standard PCS change requests under RM5,000. Escalations should be held until 30th Aug."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          {/* Modal Actions */}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!delegateUserId}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer ${
                !delegateUserId
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Confirm & Assign Temporary Approver</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
