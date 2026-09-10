import React, { useState, useMemo } from 'react';
import { UserProfile, ChangeRequest } from '../types';
import {
  calculateHistoricalWorkloadReport,
  WorkloadDateFilter,
  HistoricalStaffWorkloadReportItem,
  getPriorityWorkloadPoints,
} from '../utils/workloadScoring';
import { isItUserOrDepartment, getEligibleDevelopers } from '../utils/rbac';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Users,
  Briefcase,
  Layers,
  User,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface StaffWorkloadReportViewProps {
  staffList: UserProfile[];
  changeRequests: ChangeRequest[];
  currentUser?: UserProfile;
  individualOnly?: boolean;
}

export const StaffWorkloadReportView: React.FC<StaffWorkloadReportViewProps> = ({
  staffList,
  changeRequests,
  currentUser,
  individualOnly = false,
}) => {
  const [dateFilter, setDateFilter] = useState<WorkloadDateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedStaffIdForDrilldown, setSelectedStaffIdForDrilldown] = useState<string | null>(null);

  // Check if current user is admin
  const isSystemAdmin = currentUser?.role === 'System Admin' || currentUser?.role === 'IT Admin';
  // Strictly enforce individual-only view if individualOnly prop is true or user is not system admin
  const isStrictlyIndividual = individualOnly || !isSystemAdmin;

  // Selected staff filter for admin (allows admin to filter to specific staff or view all)
  const [adminStaffFilter, setAdminStaffFilter] = useState<string>('all');

  // Filter staff to include all IT Department personnel, IT Helpdesk, Developers, IT Admins, custom roles, and any staff with assignments
  const eligibleStaff = useMemo(() => {
    if (isStrictlyIndividual) {
      if (currentUser) {
        return [currentUser];
      }
      return [];
    }

    const staffMap = new Map<string, UserProfile>();

    // 1. Add all users who are eligible IT staff (by department, role, or custom role)
    const eligibleFromRbac = getEligibleDevelopers(staffList, []);
    eligibleFromRbac.forEach((s) => staffMap.set(s.id, s));

    // 2. Also check direct department or IT roles on staffList (e.g. IT Helpdesk, IT Support, IT Ops)
    staffList.forEach((u) => {
      if (isItUserOrDepartment(u)) {
        staffMap.set(u.id, u);
      }
    });

    // 3. Also include any user who has received a case assignment
    changeRequests.forEach((cr) => {
      if (cr.assignedDeveloperId && !staffMap.has(cr.assignedDeveloperId)) {
        const found = staffList.find((u) => u.id === cr.assignedDeveloperId);
        if (found) {
          staffMap.set(found.id, found);
        } else if (cr.assignedDeveloperName) {
          staffMap.set(cr.assignedDeveloperId, {
            id: cr.assignedDeveloperId,
            fullName: cr.assignedDeveloperName,
            email: `${cr.assignedDeveloperName.toLowerCase().replace(/\s+/g, '.')}@tanaka.com.my`,
            username: cr.assignedDeveloperName.toLowerCase().replace(/\s+/g, '.'),
            departmentId: 8,
            departmentName: 'IT',
            role: 'IT Staff',
          });
        }
      }
    });

    let list = Array.from(staffMap.values());
    if (adminStaffFilter !== 'all') {
      list = list.filter((u) => u.id === adminStaffFilter);
    }

    return list;
  }, [staffList, changeRequests, isStrictlyIndividual, currentUser, adminStaffFilter]);

  // Calculate historical workload report data
  const reportData = useMemo(() => {
    return calculateHistoricalWorkloadReport(
      eligibleStaff,
      changeRequests,
      dateFilter,
      customStartDate,
      customEndDate
    );
  }, [eligibleStaff, changeRequests, dateFilter, customStartDate, customEndDate]);

  // Individual staff item (when viewing in individual mode)
  const individualReportItem = useMemo(() => {
    if (reportData.length > 0) {
      return reportData[0];
    }
    if (currentUser) {
      return {
        user: currentUser,
        totalCasesAssigned: 0,
        criticalCasesCount: 0,
        highCasesCount: 0,
        mediumCasesCount: 0,
        lowCasesCount: 0,
        criticalPoints: 0,
        highPoints: 0,
        mediumPoints: 0,
        lowPoints: 0,
        totalWorkloadPoints: 0,
        assignedCases: [],
        isHighestWorkload: false,
      };
    }
    return null;
  }, [reportData, currentUser]);

  // Find the highest workload staff (only relevant in all-staff admin view)
  const highestWorkloadStaff = useMemo(() => {
    if (isStrictlyIndividual) return null;
    return reportData.find((item) => item.isHighestWorkload);
  }, [reportData, isStrictlyIndividual]);

  // Calculate max points for chart bar scaling
  const maxTotalPoints = useMemo(() => {
    if (reportData.length === 0) return 1;
    const max = Math.max(...reportData.map((item) => item.totalWorkloadPoints));
    return max > 0 ? max : 1;
  }, [reportData]);

  // Total summary metrics
  const totalCasesAssignedAcrossAll = useMemo(() => {
    return reportData.reduce((acc, curr) => acc + curr.totalCasesAssigned, 0);
  }, [reportData]);

  const totalPointsAcrossAll = useMemo(() => {
    return reportData.reduce((acc, curr) => acc + curr.totalWorkloadPoints, 0);
  }, [reportData]);

  // Active in-progress cases for individual view
  const activeCasesCount = useMemo(() => {
    if (!individualReportItem) return 0;
    return individualReportItem.assignedCases.filter(
      (c) => c.status !== 'Closed (Completed)' && c.status !== 'Closed (Rejected)'
    ).length;
  }, [individualReportItem]);

  const completedCasesCount = useMemo(() => {
    if (!individualReportItem) return 0;
    return individualReportItem.assignedCases.filter((c) => c.status === 'Closed (Completed)').length;
  }, [individualReportItem]);

  // Export to CSV
  const handleExportCSV = () => {
    if (isStrictlyIndividual && individualReportItem) {
      // Export single individual case details
      const headers = [
        'Staff Name',
        'Staff Email',
        'Case ID',
        'Case Title',
        'Priority',
        'Workload Points',
        'Status',
        'Requester',
        'Department',
        'Created Date',
        'Target Date',
      ];

      const rows = individualReportItem.assignedCases.map((cr) => {
        const points = getPriorityWorkloadPoints(cr.priority);
        return [
          `"${individualReportItem.user.fullName.replace(/"/g, '""')}"`,
          individualReportItem.user.email,
          cr.id,
          `"${cr.title.replace(/"/g, '""')}"`,
          cr.priority,
          points,
          cr.status,
          `"${cr.requesterName.replace(/"/g, '""')}"`,
          `"${cr.departmentName.replace(/"/g, '""')}"`,
          cr.createdAt || '',
          cr.targetCompletionDate || cr.requestedCompletionDate || '',
        ];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [
          `"Personal Workload Points Audit - ${individualReportItem.user.fullName}"`,
          `"Total Points: ${individualReportItem.totalWorkloadPoints} | Total Cases: ${individualReportItem.totalCasesAssigned}"`,
          `"Date Filter: ${dateFilter}"`,
          '',
          headers.join(','),
          ...rows.map((e) => e.join(',')),
        ].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `My_Workload_Points_${individualReportItem.user.fullName.replace(/\s+/g, '_')}_${dateFilter}_${
          new Date().toISOString().split('T')[0]
        }.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Admin All-Staff CSV Export
    const headers = [
      'Rank',
      'Staff Name',
      'Email',
      'Role',
      'Total Cases Assigned',
      'Critical Cases (4 pts)',
      'High Cases (3 pts)',
      'Medium Cases (2 pts)',
      'Low Cases (1 pt)',
      'Critical Points',
      'High Points',
      'Medium Points',
      'Low Points',
      'Total Workload Points',
      'Highest Workload',
      'Date Filter Applied',
    ];

    const rows = reportData.map((item, index) => [
      index + 1,
      `"${item.user.fullName.replace(/"/g, '""')}"`,
      item.user.email,
      item.user.role,
      item.totalCasesAssigned,
      item.criticalCasesCount,
      item.highCasesCount,
      item.mediumCasesCount,
      item.lowCasesCount,
      item.criticalPoints,
      item.highPoints,
      item.mediumPoints,
      item.lowPoints,
      item.totalWorkloadPoints,
      item.isHighestWorkload ? 'YES' : 'NO',
      dateFilter === 'custom'
        ? `Custom (${customStartDate || 'Start'} to ${customEndDate || 'End'})`
        : dateFilter,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Staff_Workload_Points_Report_${dateFilter}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card - Clean Corporate Style */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>
              {isStrictlyIndividual
                ? 'SLA Performance  and Points Reports'
                : 'Staff Workload Points Report'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3.5 py-2 rounded-lg border border-slate-300 shadow-xs text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <span>{isStrictlyIndividual ? 'Export My Cases (CSV)' : 'Export Report (CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar & Scoring Reference */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Date Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date Filter:</span>
            </span>

            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_30_days', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id as WorkloadDateFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

         
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-medium text-slate-600">Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-medium text-slate-600">End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white"
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INDIVIDUAL IT STAFF VIEW (When accessed by developer or strictly individual) */}
      {/* ========================================================================= */}
      {isStrictlyIndividual ? (
        <div className="space-y-6">
          {/* KPI Cards for Individual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Total Workload Points */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">My Total Workload Points</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-blue-600">
                    {individualReportItem ? individualReportItem.totalWorkloadPoints : 0}
                  </span>
                  <span className="text-slate-500 font-medium text-xs">points</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Accumulated in selected timeframe</p>
              </div>
            </div>

            {/* Total Cases Assigned */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">My Assigned Cases</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {individualReportItem ? individualReportItem.totalCasesAssigned : 0}
                  </span>
                  <span className="text-slate-500 font-medium text-xs">cases</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Total assigned in timeframe</p>
              </div>
            </div>

            {/* Active in-progress */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">Active In-Progress</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-600">{activeCasesCount}</span>
                  <span className="text-slate-500 font-medium text-xs">active cases</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Currently open on task board</p>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">Completed Cases</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900">{completedCasesCount}</span>
                  <span className="text-slate-500 font-medium text-xs">closed cases</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Successfully resolved</p>
              </div>
            </div>
          </div>

          {/* Individual Priority Breakdown Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Points Breakdown by Case Priority</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 rounded-lg bg-red-50/50 border border-red-200">
                <span className="text-red-700 font-semibold block text-[11px]">Critical Cases (4 pts)</span>
                <p className="text-lg font-bold text-red-800 mt-1">
                  {individualReportItem?.criticalCasesCount || 0}{' '}
                  <span className="text-xs font-normal text-red-600">
                    ({individualReportItem?.criticalPoints || 0} pts)
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-orange-50/50 border border-orange-200">
                <span className="text-orange-700 font-semibold block text-[11px]">High Cases (3 pts)</span>
                <p className="text-lg font-bold text-orange-800 mt-1">
                  {individualReportItem?.highCasesCount || 0}{' '}
                  <span className="text-xs font-normal text-orange-600">
                    ({individualReportItem?.highPoints || 0} pts)
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                <span className="text-amber-700 font-semibold block text-[11px]">Medium Cases (2 pts)</span>
                <p className="text-lg font-bold text-amber-800 mt-1">
                  {individualReportItem?.mediumCasesCount || 0}{' '}
                  <span className="text-xs font-normal text-amber-600">
                    ({individualReportItem?.mediumPoints || 0} pts)
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
                <span className="text-slate-700 font-semibold block text-[11px]">Low Cases (1 pt)</span>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {individualReportItem?.lowCasesCount || 0}{' '}
                  <span className="text-xs font-normal text-slate-600">
                    ({individualReportItem?.lowPoints || 0} pts)
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Individual Detailed Cases Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>My Assigned Cases Register</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed list of all cases assigned to you and their respective workload point values.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {individualReportItem?.assignedCases.length || 0} total cases
              </span>
            </div>

            {(!individualReportItem || individualReportItem.assignedCases.length === 0) ? (
              <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No change requests assigned to you in the selected date filter.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Case ID</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3 text-center">Workload Points</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Requester</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Target Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {individualReportItem.assignedCases.map((cr, idx) => {
                      const points = getPriorityWorkloadPoints(cr.priority);
                      return (
                        <tr
                          key={cr.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{cr.id}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs truncate">
                            {cr.title}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block font-medium px-2 py-0.5 rounded text-[10px] border ${
                                cr.priority === 'Critical'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : cr.priority === 'High'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : cr.priority === 'Medium'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {cr.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              +{points} {points === 1 ? 'pt' : 'pts'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{cr.status}</td>
                          <td className="py-2.5 px-3 text-slate-600">{cr.requesterName}</td>
                          <td className="py-2.5 px-3 text-slate-500">{cr.departmentName}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {cr.targetCompletionDate || cr.requestedCompletionDate || 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* ALL-STAFF ADMIN OVERVIEW (Visible strictly to System Admins & IT Admins)   */
        /* ========================================================================= */
        <>
          {/* KPI Cards - Clean Corporate Grayscale & Blue Accents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Highest Workload Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium text-xs">
                  Highest Workload Staff
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Rank #1
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 truncate">
                  {highestWorkloadStaff ? highestWorkloadStaff.user.fullName : 'None Assigned'}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold text-blue-600">
                    {highestWorkloadStaff ? highestWorkloadStaff.totalWorkloadPoints : 0}
                  </span>
                  <span className="text-slate-500 font-medium text-xs">points</span>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="text-slate-600 font-medium text-xs">
                    {highestWorkloadStaff ? highestWorkloadStaff.totalCasesAssigned : 0} cases
                  </span>
                </div>
              </div>
            </div>

            {/* Total Points Across Staff */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">Total Workload Points Awarded</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-slate-900">{totalPointsAcrossAll}</span>
                  <span className="text-slate-500 font-medium text-xs">total points</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Across all eligible staff members</p>
              </div>
            </div>

            {/* Total Cases Evaluated */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">Total Cases Evaluated</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-slate-900">{totalCasesAssignedAcrossAll}</span>
                  <span className="text-slate-500 font-medium text-xs">cases assigned</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Filtered by selected timeframe</p>
              </div>
            </div>

            {/* Staff Headcount */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <span className="text-slate-500 font-medium block">Active IT & Technical Staff</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-slate-900">{reportData.length}</span>
                  <span className="text-slate-500 font-medium text-xs">staff members</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">IT department & assigned personnel</p>
              </div>
            </div>
          </div>

          {/* SECTION 1: Visual Comparison Chart / Bars */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Workload Points Comparison</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Staff members ranked by total historical points received.
                </p>
              </div>

              {/* Clean Neutral Indicator */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded bg-blue-600" />
                <span>Total Points Fill</span>
              </div>
            </div>

            {/* Visual Bar List */}
            <div className="space-y-3 pt-1">
              {reportData.map((item, idx) => {
                const barWidthPercent =
                  maxTotalPoints > 0 ? (item.totalWorkloadPoints / maxTotalPoints) * 100 : 0;

                return (
                  <div
                    key={item.user.id}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      item.isHighestWorkload
                        ? 'bg-blue-50/20 border-blue-200 shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Name, Total Points, and Subtle Highest Workload Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs">{item.user.fullName}</span>
                        <span className="text-slate-300 font-mono text-[11px]">—</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {item.totalWorkloadPoints} {item.totalWorkloadPoints === 1 ? 'point' : 'points'}
                        </span>
                        <span className="text-slate-500 text-[11px]">({item.totalCasesAssigned} cases)</span>

                        {item.isHighestWorkload && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            Highest Workload
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedStaffIdForDrilldown(
                            selectedStaffIdForDrilldown === item.user.id ? null : item.user.id
                          )
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {selectedStaffIdForDrilldown === item.user.id ? 'Hide Cases' : 'View Cases'}
                        </span>
                        {selectedStaffIdForDrilldown === item.user.id ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Progress Bar - Single Clean Blue Fill on Light Gray Track */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(barWidthPercent, item.totalWorkloadPoints > 0 ? 2 : 0)}%`,
                        }}
                      />
                    </div>

                    {/* Priority Breakdown Badges */}
                    <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-600 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 font-medium">
                        Critical: {item.criticalCasesCount} ({item.criticalPoints} pts)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-medium">
                        High: {item.highCasesCount} ({item.highPoints} pts)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                        Medium: {item.mediumCasesCount} ({item.mediumPoints} pts)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                        Low: {item.lowCasesCount} ({item.lowPoints} pts)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Detailed Staff Workload Points Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Historical Workload Points Register (Sorted Highest to Lowest)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked from highest total accumulated points down to lowest.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Showing {reportData.length} staff records
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3 text-center">Total Cases</th>
                    <th className="p-3 text-center">
                      <span className="text-red-700 font-semibold">Critical</span>
                      <span className="block text-[9px] text-slate-400 font-normal">4 pts each</span>
                    </th>
                    <th className="p-3 text-center">
                      <span className="text-orange-700 font-semibold">High</span>
                      <span className="block text-[9px] text-slate-400 font-normal">3 pts each</span>
                    </th>
                    <th className="p-3 text-center">
                      <span className="text-amber-700 font-semibold">Medium</span>
                      <span className="block text-[9px] text-slate-400 font-normal">2 pts each</span>
                    </th>
                    <th className="p-3 text-center">
                      <span className="text-slate-600 font-semibold">Low</span>
                      <span className="block text-[9px] text-slate-400 font-normal">1 pt each</span>
                    </th>
                    <th className="p-3 text-center">
                      <span className="text-slate-900 font-bold">Total Workload Points</span>
                    </th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {reportData.map((item, index) => {
                    const isSelected = selectedStaffIdForDrilldown === item.user.id;

                    return (
                      <React.Fragment key={item.user.id}>
                        <tr
                          className={`transition-colors ${
                            item.isHighestWorkload
                              ? 'bg-blue-50/20 hover:bg-blue-50/30'
                              : index % 2 === 0
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50/40 hover:bg-slate-50'
                          }`}
                        >
                          {/* Rank */}
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200">
                              {index + 1}
                            </span>
                          </td>

                          {/* Staff Name & Subtle Highlight */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-medium text-[10px] shrink-0">
                                {item.user.fullName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 text-xs">
                                    {item.user.fullName}
                                  </span>
                                  {item.isHighestWorkload && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                      Highest Workload
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 text-[11px] block">
                                  {item.user.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Total Cases */}
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium text-xs border border-slate-200">
                              {item.totalCasesAssigned}
                            </span>
                          </td>

                          {/* Critical Cases */}
                          <td className="p-3 text-center">
                            <span className="font-semibold text-red-700 text-xs">
                              {item.criticalCasesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ({item.criticalPoints} pts)
                            </span>
                          </td>

                          {/* High Cases */}
                          <td className="p-3 text-center">
                            <span className="font-semibold text-orange-700 text-xs">
                              {item.highCasesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ({item.highPoints} pts)
                            </span>
                          </td>

                          {/* Medium Cases */}
                          <td className="p-3 text-center">
                            <span className="font-semibold text-amber-700 text-xs">
                              {item.mediumCasesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ({item.mediumPoints} pts)
                            </span>
                          </td>

                          {/* Low Cases */}
                          <td className="p-3 text-center">
                            <span className="font-semibold text-slate-600 text-xs">
                              {item.lowCasesCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ({item.lowPoints} pts)
                            </span>
                          </td>

                          {/* Total Workload Points */}
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200">
                              {item.totalWorkloadPoints} pts
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStaffIdForDrilldown(isSelected ? null : item.user.id)
                              }
                              className="px-2.5 py-1 rounded text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <span>{isSelected ? 'Close' : 'View Cases'}</span>
                              {isSelected ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Drilldown Sub-table for Assigned Cases */}
                        {isSelected && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center space-x-2">
                                    <Briefcase className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-slate-900 text-xs">
                                      Cases Assigned to {item.user.fullName} ({item.assignedCases.length}{' '}
                                      cases)
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500">
                                    Total:{' '}
                                    <strong className="text-slate-900 font-bold">
                                      {item.totalWorkloadPoints} points
                                    </strong>
                                  </span>
                                </div>

                                {item.assignedCases.length === 0 ? (
                                  <p className="text-xs text-slate-500 italic py-2">
                                    No change requests assigned to this staff member in the selected
                                    date range.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                                          <th className="py-2 px-2.5">Case ID</th>
                                          <th className="py-2 px-2.5">Title</th>
                                          <th className="py-2 px-2.5">Priority</th>
                                          <th className="py-2 px-2.5 text-center">Workload Points</th>
                                          <th className="py-2 px-2.5">Status</th>
                                          <th className="py-2 px-2.5">Requester</th>
                                          <th className="py-2 px-2.5">Target Date</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {item.assignedCases.map((cr) => {
                                          const points = getPriorityWorkloadPoints(cr.priority);
                                          return (
                                            <tr
                                              key={cr.id}
                                              className="hover:bg-slate-50 transition-colors"
                                            >
                                              <td className="py-2 px-2.5 font-mono font-semibold text-blue-600">
                                                {cr.id}
                                              </td>
                                              <td className="py-2 px-2.5 font-medium text-slate-900 max-w-xs truncate">
                                                {cr.title}
                                              </td>
                                              <td className="py-2 px-2.5">
                                                <span
                                                  className={`inline-block font-medium px-2 py-0.5 rounded text-[10px] border ${
                                                    cr.priority === 'Critical'
                                                      ? 'bg-red-50 text-red-700 border-red-200'
                                                      : cr.priority === 'High'
                                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                      : cr.priority === 'Medium'
                                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                                  }`}
                                                >
                                                  {cr.priority}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-semibold text-blue-700">
                                                +{points} {points === 1 ? 'pt' : 'pts'}
                                              </td>
                                              <td className="py-2 px-2.5 text-slate-700">{cr.status}</td>
                                              <td className="py-2 px-2.5 text-slate-600">
                                                {cr.requesterName}
                                              </td>
                                              <td className="py-2 px-2.5 text-slate-500 font-mono text-[11px]">
                                                {cr.targetCompletionDate ||
                                                  cr.requestedCompletionDate ||
                                                  'N/A'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
