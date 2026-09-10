import React, { useState } from 'react';
import { UserProfile, ChangeRequest } from '../types';
import { calculateSlaStatus, getSlaBadgeClass } from '../utils/slaAndRisk';
import { formatDisplayDate } from '../utils/timezone';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Archive,
  Calendar,
  Layers,
  User,
  Clock,
  ShieldAlert,
  FileCheck,
  RotateCcw,
  X
} from 'lucide-react';

interface ClosedCasesViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  onReopenCase?: (crId: string, reopenComments: string) => void;
  onRequestClick: (crId: string) => void;
}

export const ClosedCasesView: React.FC<ClosedCasesViewProps> = ({
  currentUser,
  changeRequests,
  onReopenCase,
  onRequestClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubStatus, setSelectedSubStatus] = useState<'All' | 'Closed (Completed)' | 'Closed (Rejected)'>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [selectedCrForReopen, setSelectedCrForReopen] = useState<ChangeRequest | null>(null);
  const [reopenRemarks, setReopenRemarks] = useState('');

  // Closed cases: Closed (Completed) and Closed (Rejected)
  const closedRequests = changeRequests.filter((cr) => {
    const isClosed = cr.status === 'Closed (Completed)' || cr.status === 'Closed (Rejected)';
    if (!isClosed) return false;

    const matchesSearch =
      cr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cr.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cr.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cr.assignedDeveloperName && cr.assignedDeveloperName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSubStatus =
      selectedSubStatus === 'All' || cr.status === selectedSubStatus;

    const matchesCategory =
      selectedCategoryFilter === 'All' || cr.category === selectedCategoryFilter;

    return matchesSearch && matchesSubStatus && matchesCategory;
  });

  const completedCount = changeRequests.filter((cr) => cr.status === 'Closed (Completed)').length;
  const rejectedCount = changeRequests.filter((cr) => cr.status === 'Closed (Rejected)').length;

  const categories = Array.from(
    new Set(
      changeRequests
        .filter((cr) => (cr.status === 'Closed (Completed)' || cr.status === 'Closed (Rejected)') && cr.category)
        .map((cr) => cr.category as string)
    )
  );

  const handleConfirmReopen = () => {
    if (selectedCrForReopen && onReopenCase) {
      onReopenCase(selectedCrForReopen.id, reopenRemarks);
      setSelectedCrForReopen(null);
      setReopenRemarks('');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Closed Cases</span>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{completedCount + rejectedCount}</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Archive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Closed & Completed</span>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">{completedCount}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Closed & Rejected</span>
            <div className="text-2xl font-bold text-rose-700 mt-0.5">{rejectedCount}</div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, title, requester, or developer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-900"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto flex-wrap">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={selectedSubStatus}
                onChange={(e) => setSelectedSubStatus(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-white font-medium focus:outline-none"
              >
                <option value="All">All Closed ({completedCount + rejectedCount})</option>
                <option value="Closed (Completed)">Closed (Completed) ({completedCount})</option>
                <option value="Closed (Rejected)">Closed (Rejected) ({rejectedCount})</option>
              </select>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">Category:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-white font-medium focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Closed Cases Register */}
      {closedRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-semibold text-sm">No closed cases found</p>
          <p className="text-xs max-w-sm mx-auto text-slate-400">
            No closed or completed change requests match the specified search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">CR ID</th>
                  <th className="py-3 px-4">Title & Classification</th>
                  <th className="py-3 px-4">Requester & Dept</th>
                  <th className="py-3 px-4">Assigned to</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Closed Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedRequests.map((cr) => {
                  const isCompleted = cr.status === 'Closed (Completed)';
                  const sla = calculateSlaStatus(cr);

                  return (
                    <tr key={cr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        <button
                          onClick={() => onRequestClick(cr.id)}
                          className="hover:underline cursor-pointer"
                        >
                          {cr.id}
                        </button>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div
                          onClick={() => onRequestClick(cr.id)}
                          className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-1"
                        >
                          {cr.title}
                        </div>
                        {cr.category && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <span className="font-medium text-slate-600">{cr.category}</span>
                            {cr.subcategory && <span>• {cr.subcategory}</span>}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{cr.requesterName}</div>
                        <div className="text-[10px] text-slate-400">{cr.departmentName}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {cr.assignedDeveloperName ? (
                          <span className="font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                            {cr.assignedDeveloperName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            cr.priority === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : cr.priority === 'High'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cr.priority}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{cr.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500 font-medium">
                        {formatDisplayDate(cr.actualCompletionDate || cr.updatedAt)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {currentUser.role === 'System Admin' && !isCompleted && onReopenCase && (
                            <button
                              onClick={() => {
                                setSelectedCrForReopen(cr);
                                setReopenRemarks('');
                              }}
                              className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                              title={`Reopen and automatically assign back to ${cr.rejectedByName || 'original rejector'}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reopen Case</span>
                            </button>
                          )}
                          <button
                            onClick={() => onRequestClick(cr.id)}
                            className="inline-flex items-center space-x-1 text-slate-600 hover:text-blue-600 font-semibold text-xs px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Admin Quick Reopen Modal */}
      {selectedCrForReopen && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-indigo-950 font-bold text-sm">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <span>Reopen Rejected Case (System Admin)</span>
              </div>
              <button
                onClick={() => setSelectedCrForReopen(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 space-y-2">
              <div className="font-semibold text-indigo-950">CR: {selectedCrForReopen.id} — {selectedCrForReopen.title}</div>
              <div className="text-[11px] text-indigo-900 bg-white/70 p-2 rounded-lg border border-indigo-100 space-y-0.5">
                <div><strong>Rejected By:</strong> {selectedCrForReopen.rejectedByName || 'Staff'} ({selectedCrForReopen.rejectedByRole || 'IT Staff'})</div>
                <div><strong>Rejection Reason:</strong> "{selectedCrForReopen.rejectionReason || 'No reason recorded'}"</div>
              </div>
              <div className="text-[11px] text-indigo-900 pt-1 border-t border-indigo-200">
                🔄 <strong>Automatic Route:</strong> This case will be reopened and automatically returned to <strong>{selectedCrForReopen.rejectedByName || 'the person who rejected it'}</strong> ({selectedCrForReopen.rejectedByRole || 'Staff'}) into their active queue.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Admin Reopen Remarks / Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={reopenRemarks}
                onChange={(e) => setReopenRemarks(e.target.value)}
                placeholder="Enter instructions for the assigned person regarding why this ticket is being reopened..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedCrForReopen(null)}
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
    </div>
  );
};
