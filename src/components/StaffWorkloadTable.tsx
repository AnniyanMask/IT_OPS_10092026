import React from 'react';
import { UserProfile, ChangeRequest } from '../types';
import { calculateStaffWorkloads, StaffWorkloadInfo } from '../utils/workloadScoring';
import { Sparkles, Check, AlertCircle, Info, ShieldCheck } from 'lucide-react';

interface StaffWorkloadTableProps {
  staffList: UserProfile[];
  changeRequests: ChangeRequest[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  title?: string;
  showPointReference?: boolean;
}

export const StaffWorkloadTable: React.FC<StaffWorkloadTableProps> = ({
  staffList,
  changeRequests,
  selectedStaffId,
  onSelectStaff,
  title = 'System Admin Staff Workload & Capacity Scoring',
  showPointReference = true,
}) => {
  const workloads: StaffWorkloadInfo[] = calculateStaffWorkloads(staffList, changeRequests);
  const recommendedStaff = workloads.find((w) => w.isRecommended);

  const getStatusBadge = (status: StaffWorkloadInfo['status']) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Available
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
            Moderate
          </span>
        );
      case 'Busy':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Busy
          </span>
        );
      case 'Full':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 font-bold">
            Full
          </span>
        );
      default:
        return null;
    }
  };

  const getProgressColor = (usedPoints: number) => {
    if (usedPoints <= 4) return 'bg-emerald-500';
    if (usedPoints <= 7) return 'bg-sky-500';
    if (usedPoints <= 9) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
      {/* Header & Recommendation Highlight */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-bold text-slate-800 text-xs">{title}</span>
        </div>

        {recommendedStaff && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Recommended:{' '}
              <strong className="font-bold text-blue-900">{recommendedStaff.user.fullName}</strong> (
              {recommendedStaff.remainingCapacity} remaining)
            </span>
          </div>
        )}
      </div>

      {/* Workload Scoring Table: Staff Name | Active Cases | Used Points / 10 | Remaining | Status */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
              <th className="py-2 px-3">Staff Name</th>
              <th className="py-2 px-3 text-center">Active Cases</th>
              <th className="py-2 px-3 text-center">Used Points / 10</th>
              <th className="py-2 px-3 text-center">Remaining</th>
              <th className="py-2 px-3 text-center">Status</th>
              <th className="py-2 px-3 text-right">Select</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workloads.map((item) => {
              const isSelected = selectedStaffId === item.user.id;
              const percentUsed = Math.min(100, Math.max(0, (item.usedPoints / item.maxCapacity) * 100));

              return (
                <tr
                  key={item.user.id}
                  onClick={() => onSelectStaff(item.user.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-medium'
                      : item.isRecommended
                      ? 'bg-slate-50/50 hover:bg-slate-100/80'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Staff Name, Role & Recommendation Badge */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {item.user.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900 font-semibold text-xs">{item.user.fullName}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {item.user.role || 'IT Staff'}
                          </span>
                          {item.user.departmentName && (
                            <span className="text-[10px] text-slate-400">
                              ({item.user.departmentName})
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px] block">{item.user.email}</span>
                      </div>
                      {item.isRecommended && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-bold shadow-xs">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Recommended
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Active Cases */}
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                    {item.activeCasesCount} {item.activeCasesCount === 1 ? 'case' : 'cases'}
                  </td>

                  {/* Used Points / 10 with visual progress */}
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold text-slate-800 text-xs">
                        {item.usedPoints} / {item.maxCapacity}
                      </span>
                      <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getProgressColor(item.usedPoints)}`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Remaining Capacity */}
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`font-bold text-xs ${
                        item.remainingCapacity >= 5
                          ? 'text-emerald-700'
                          : item.remainingCapacity >= 1
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {item.remainingCapacity}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-0.5">pts</span>
                  </td>

                  {/* Status: Available | Moderate | Busy | Full */}
                  <td className="py-2.5 px-3 text-center">{getStatusBadge(item.status)}</td>

                  {/* Select button / radio */}
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStaff(item.user.id);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3 h-3" />
                          Selected
                        </>
                      ) : (
                        'Select'
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Point Scoring Reference & System Admin Override Note */}
      {showPointReference && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-600">Scoring:</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">Critical = 4 pts</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium">High = 3 pts</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium">Medium = 2 pts</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Low = 1 pt</span>
            <span className="text-slate-400">|</span>
            <span>Max = 10 pts</span>
          </div>

          <div className="flex items-center gap-1 text-slate-500 italic">
            <Info className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Admin manual selection (recommendation can be overridden)</span>
          </div>
        </div>
      )}
    </div>
  );
};
