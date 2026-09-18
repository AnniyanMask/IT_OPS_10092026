import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChangeRequest, UserProfile, TemporaryApproverDelegation, SystemTurnaroundMetrics } from '../types';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Layers,
  UserCheck,
  ShieldAlert,
  Search,
  Filter,
  Info,
  XCircle,
  Calendar,
  Building,
  User,
  ShieldCheck,
  AlertCircle,
  Lock,
  RefreshCw,
  Database,
  Activity,
  LayoutDashboard
} from 'lucide-react';
import { StaffWorkloadReportView } from './StaffWorkloadReportView';
import { AnalyticalManagementDashboard } from './AnalyticalManagementDashboard';
import { ManagementDashboard } from './ManagementDashboard';
import { formatDisplayDateTime, formatDisplayDate } from '../utils/timezone';

interface ReportsViewProps {
  changeRequests: ChangeRequest[];
  currentUser?: UserProfile;
  users?: UserProfile[];
  delegations?: TemporaryApproverDelegation[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  changeRequests,
  currentUser,
  users,
  delegations: propsDelegations,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'executive' | 'sla' | 'service' | 'attention' | 'audit' | 'delegations' | 'workload' | 'it-staff'>('executive');
  
  // Backend SLA Turnaround Live Metrics State
  const [slaMetrics, setSlaMetrics] = useState<SystemTurnaroundMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Fetch Live Metrics from Backend PostgreSQL API
  const fetchLiveMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', currentUser.id);
      if (currentUser?.role) params.set('role', currentUser.role);
      if (currentUser?.departmentId !== undefined) params.set('departmentId', String(currentUser.departmentId));
      const response = await fetch(`/api/reports/turnaround-metrics?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        setSlaMetrics(data.data);
        setLastFetchedAt(new Date().toLocaleTimeString());
      } else {
        throw new Error(data.message || 'Failed to calculate turnaround metrics');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn('[ReportsView] Backend metrics fetch fallback:', errorMsg);
      setMetricsError(errorMsg);
      
      // Compute fallback from local changeRequests data
      const evaluatedHOD: number[] = [];
      const evaluatedDev: number[] = [];
      let compliantHodCount = 0;
      let compliantDevCount = 0;

      changeRequests.forEach((cr) => {
        // HOD Clearance calculation
        let approvedAt: Date | null = cr.hodApprovedAt ? new Date(cr.hodApprovedAt) : null;
        if (!approvedAt && cr.approvalHistory && cr.approvalHistory.length > 0) {
          const h = cr.approvalHistory.find((item) =>
            ['Approved', 'Endorsed', 'Approved by HOD', 'Approved by Delegate'].includes(item.decision)
          );
          if (h?.actionDate) approvedAt = new Date(h.actionDate);
        }
        if (approvedAt && cr.createdAt) {
          const cDate = new Date(cr.createdAt);
          const hours = (approvedAt.getTime() - cDate.getTime()) / (1000 * 3600);
          if (hours >= 0) {
            evaluatedHOD.push(hours);
            if (hours <= 48) compliantHodCount++;
          }
        }

        // Dev Cycle calculation
        let devStart: Date | null = null;
        let devEnd: Date | null = cr.actualCompletionDate ? new Date(cr.actualCompletionDate) : null;
        if (cr.approvalHistory && cr.approvalHistory.length > 0) {
          const s = cr.approvalHistory.find((item) => item.toStatus === 'In Progress' || item.decision === 'Assigned Developer');
          if (s?.actionDate) devStart = new Date(s.actionDate);
          if (!devEnd) {
            const e = cr.approvalHistory.find((item) => ['Pending IT Verification', 'Closed (Completed)'].includes(item.toStatus));
            if (e?.actionDate) devEnd = new Date(e.actionDate);
          }
        }
        if (!devStart && cr.hodApprovedAt) devStart = new Date(cr.hodApprovedAt);
        if (!devStart && cr.createdAt) devStart = new Date(cr.createdAt);
        if (!devEnd && (cr.status === 'Closed (Completed)' || cr.status === 'Pending IT Verification')) {
          devEnd = cr.updatedAt ? new Date(cr.updatedAt) : new Date();
        }
        if (devStart && devEnd) {
          const hours = (devEnd.getTime() - devStart.getTime()) / (1000 * 3600);
          if (hours >= 0) {
            evaluatedDev.push(hours);
            const targetHours = cr.slaTargetHours || 168;
            if (hours <= targetHours) compliantDevCount++;
          }
        }
      });

      const avgHodDays = evaluatedHOD.length > 0 ? Number(((evaluatedHOD.reduce((a, b) => a + b, 0) / evaluatedHOD.length) / 24).toFixed(1)) : 0.0;
      const hodSlaPercent = evaluatedHOD.length > 0 ? Number(((compliantHodCount / evaluatedHOD.length) * 100).toFixed(1)) : 100.0;

      const avgDevDays = evaluatedDev.length > 0 ? Number(((evaluatedDev.reduce((a, b) => a + b, 0) / evaluatedDev.length) / 24).toFixed(1)) : 0.0;
      const devSlaPercent = evaluatedDev.length > 0 ? Number(((compliantDevCount / evaluatedDev.length) * 100).toFixed(1)) : 100.0;

      const completed = changeRequests.filter((cr) => cr.status === 'Closed (Completed)').length;
      const rejected = changeRequests.filter((cr) => cr.status === 'Closed (Rejected)').length;

      setSlaMetrics({
        avgHodClearanceDays: avgHodDays,
        hodClearanceDisplay: evaluatedHOD.length > 0 ? `${avgHodDays} Days` : '0.0 Days',
        hodSlaCompliancePercent: hodSlaPercent,
        hodSlaComplianceDisplay: evaluatedHOD.length > 0 ? `${hodSlaPercent}% SLA Compliance (< 2 Days)` : '100% SLA Compliance (< 2 Days)',
        hodEvaluatedCount: evaluatedHOD.length,
        avgItDevCycleDays: avgDevDays,
        itDevCycleDisplay: evaluatedDev.length > 0 ? `${avgDevDays} Days` : '0.0 Days',
        itDevSlaCompliancePercent: devSlaPercent,
        itDevSlaComplianceDisplay: evaluatedDev.length > 0 ? `${devSlaPercent}% within target SLA release window` : 'Within target release window',
        itEvaluatedCount: evaluatedDev.length,
        totalClosedCases: completed,
        completedCount: completed,
        rejectedCount: rejected,
        totalCases: changeRequests.length,
        verificationRatePercent: 100,
        verificationDisplay: '100% verified by IT Admin',
        priorityDistribution: { Critical: 0, High: 0, Medium: 0, Low: 0 },
        statusDistribution: {},
        avgOverallResolutionDays: Number((avgHodDays + avgDevDays).toFixed(1)),
        calculatedAt: new Date().toISOString(),
        source: 'fallback_computed',
      });
      setLastFetchedAt(new Date().toLocaleTimeString());
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [changeRequests, currentUser]);

  // Fetch on mount or when tab is active
  useEffect(() => {
    fetchLiveMetrics();
  }, [fetchLiveMetrics]);
  
  // Delegation Audit Filtering State
  const [delegationSearch, setDelegationSearch] = useState('');
  const [delegationStatusFilter, setDelegationStatusFilter] = useState<'ALL' | 'REVOKED' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [delegationDeptFilter, setDelegationDeptFilter] = useState<string>('ALL');

  // CR Audit Filtering State
  const [crSearch, setCrSearch] = useState('');
  const [crPriorityFilter, setCrPriorityFilter] = useState<string>('ALL');
  const [crStatusFilter, setCrStatusFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');

  // Date Filtering State
  const [dateFilter, setDateFilter] = useState<'ALL_TIME' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM'>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const rawDelegations = propsDelegations || [];

  // Helper for Date Filtering
  const isRequestInPeriod = (crDateStr: string) => {
    if (dateFilter === 'ALL_TIME') return true;
    const crDate = new Date(crDateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'TODAY':
        return crDate >= startOfToday;
      case 'THIS_WEEK': {
        const sunday = new Date(startOfToday);
        sunday.setDate(startOfToday.getDate() - startOfToday.getDay());
        return crDate >= sunday;
      }
      case 'THIS_MONTH':
        return crDate.getMonth() === now.getMonth() && crDate.getFullYear() === now.getFullYear();
      case 'LAST_30_DAYS': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return crDate >= thirtyDaysAgo;
      }
      case 'CUSTOM': {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return crDate >= start && crDate <= end;
      }
      default:
        return true;
    }
  };

  const isSystemAdmin = currentUser?.role === 'System Admin' || currentUser?.role === 'IT Admin';
  const isItStaff =
    isSystemAdmin ||
    currentUser?.role === 'Software Developer' ||
    currentUser?.departmentName === 'IT' ||
    currentUser?.departmentId === 8;

  const userDeptId = currentUser?.departmentId;
  const userDeptName = currentUser?.departmentName;

  // DEPARTMENT-LEVEL ISOLATION:
  // Non-admin users (HODs, Requesters, Department Staff) can ONLY see their own department's delegation records.
  // System Admins and IT Admins have enterprise-wide audit clearance to view all or filter by department.
  const scopedDelegations = useMemo(() => {
    if (isSystemAdmin) {
      return rawDelegations;
    }
    return rawDelegations.filter((d) => {
      if (userDeptId && d.departmentId === userDeptId) return true;
      if (userDeptName && d.departmentName && d.departmentName.toLowerCase() === userDeptName.toLowerCase()) return true;
      return false;
    });
  }, [rawDelegations, isSystemAdmin, userDeptId, userDeptName]);

  // Export CR SLA Audit to CSV
  const exportCrToCSV = () => {
    const headers = [
      'Request ID',
      'Title',
      'Requester',
      'Department',
      'Type',
      'Priority',
      'Status',
      'Assigned Dev',
      'Created Date',
      'Target Date',
    ];

    const rows = changeRequests.map((cr) => [
      cr.id,
      `"${cr.title.replace(/"/g, '""')}"`,
      cr.requesterName,
      cr.departmentName,
      cr.requestType,
      cr.priority,
      cr.status,
      cr.assignedDeveloperName || 'Unassigned',
      cr.createdAt,
      cr.requestedCompletionDate,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IT_OPS_Change_Requests_SLA_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Delegations & Revocations Audit to CSV (Department Isolated)
  const exportDelegationsToCSV = () => {
    const headers = [
      'Delegation ID',
      'Department',
      'HOD Name',
      'HOD Email',
      'Temporary Approver Name',
      'Temporary Approver Email',
      'Delegate Role',
      'Start Date',
      'End Date',
      'Reason',
      'Status',
      'Revoked Date',
      'Revoked By',
      'Revocation Reason',
      'Created Date',
      'Created By',
      'Notes',
    ];

    const rows = filteredDelegations.map((d) => [
      d.id,
      `"${(d.departmentName || '').replace(/"/g, '""')}"`,
      `"${(d.hodName || '').replace(/"/g, '""')}"`,
      d.hodEmail || '',
      `"${(d.delegateName || '').replace(/"/g, '""')}"`,
      d.delegateEmail || '',
      d.delegateRole || 'Requester',
      d.startDate || '',
      d.endDate || '',
      `"${(d.reason || '').replace(/"/g, '""')}"`,
      d.status,
      d.revokedAt || 'N/A',
      `"${(d.revokedBy || 'N/A').replace(/"/g, '""')}"`,
      `"${(d.revocationReason || 'N/A').replace(/"/g, '""')}"`,
      d.createdAt || '',
      `"${(d.createdBy || '').replace(/"/g, '""')}"`,
      `"${(d.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const fileNamePrefix = isSystemAdmin
      ? delegationDeptFilter !== 'ALL'
        ? `IT_OPS_${delegationDeptFilter.replace(/\s+/g, '_')}_Delegations_Audit_`
        : 'IT_OPS_All_Departments_Delegations_Audit_'
      : `IT_OPS_${(userDeptName || 'Department').replace(/\s+/g, '_')}_Delegations_Audit_`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${fileNamePrefix}${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Executive Summary & Management Attention Calculations
  const executiveMetrics = useMemo(() => {
    const total = changeRequests.length;
    const completed = changeRequests.filter(cr => cr.status === 'Closed (Completed)').length;
    const rejected = changeRequests.filter(cr => cr.status === 'Closed (Rejected)').length;
    const closed = completed + rejected;
    const open = total - closed;
    
    // High/Critical Open
    const highCriticalOpen = changeRequests.filter(cr => 
      (cr.priority === 'Critical' || cr.priority === 'High') && 
      !['Closed (Completed)', 'Closed (Rejected)', 'Draft'].includes(cr.status)
    );

    // SLA Breaches (Closed cases that exceeded target)
    const slaBreaches = changeRequests.filter(cr => {
      if (cr.status !== 'Closed (Completed)' || !cr.actualCompletionDate || !cr.createdAt) return false;
      const actual = (new Date(cr.actualCompletionDate).getTime() - new Date(cr.createdAt).getTime()) / (1000 * 3600);
      return actual > (cr.slaTargetHours || 168);
    });

    // Aging Open (Older than 14 days)
    const agingOpen = changeRequests.filter(cr => {
      if (['Closed (Completed)', 'Closed (Rejected)', 'Draft'].includes(cr.status)) return false;
      const age = (new Date().getTime() - new Date(cr.createdAt).getTime()) / (1000 * 3600 * 24);
      return age > 14;
    });

    // Pending HOD > 48h
    const pendingHODOverdue = changeRequests.filter(cr => {
      if (cr.status !== 'Pending HOD Approval' || !cr.createdAt) return false;
      const age = (new Date().getTime() - new Date(cr.createdAt).getTime()) / (1000 * 3600);
      return age > 48;
    });

    return {
      total,
      completed,
      open,
      highCriticalOpen,
      slaBreaches: slaBreaches.length,
      slaBreachedItems: slaBreaches,
      agingOpen,
      pendingHODOverdue,
      overallSlaPercent: slaMetrics?.itDevSlaCompliancePercent || 0
    };
  }, [changeRequests, slaMetrics]);

  // 2. SLA by Priority Matrix
  const slaByPriority = useMemo(() => {
    const priorities = ['Critical', 'High', 'Medium', 'Low'];
    return priorities.map(p => {
      const pRequests = changeRequests.filter(cr => cr.priority === p && cr.status === 'Closed (Completed)');
      const total = pRequests.length;
      const withinSla = pRequests.filter(cr => {
        const actual = (new Date(cr.actualCompletionDate!).getTime() - new Date(cr.createdAt).getTime()) / (1000 * 3600);
        return actual <= (cr.slaTargetHours || 168);
      }).length;
      const breached = total - withinSla;
      const compliance = total > 0 ? (withinSla / total) * 100 : 100;
      
      return { priority: p, total, withinSla, breached, compliance };
    });
  }, [changeRequests]);

  // 3. Service Performance Grouping
  const servicePerformance = useMemo(() => {
    const byDept: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    changeRequests.forEach(cr => {
      byDept[cr.departmentName] = (byDept[cr.departmentName] || 0) + 1;
      byType[cr.requestType] = (byType[cr.requestType] || 0) + 1;
    });

    return {
      byDept: Object.entries(byDept).sort((a, b) => b[1] - a[1]),
      byType: Object.entries(byType).sort((a, b) => b[1] - a[1])
    };
  }, [changeRequests]);

  // 4. IT Staff Performance Matrix Calculations
  const itStaffPerformance = useMemo(() => {
    const staffStats: Record<string, any> = {};
    const now = new Date().getTime();

    // Apply period filter first
    const periodRequests = changeRequests.filter(cr => isRequestInPeriod(cr.createdAt));

    periodRequests.forEach(cr => {
      const staffName = cr.itAssignedDeveloperName || 'Unassigned';
      if (!staffStats[staffName]) {
        staffStats[staffName] = {
          name: staffName,
          assigned: 0,
          completed: 0,
          withinSla: 0,
          breached: 0,
          totalResolutionHours: 0,
          open: 0,
          overdue: 0,
          highCriticalOpen: 0,
          totalPoints: 0
        };
      }

      const stats = staffStats[staffName];
      stats.assigned++;
      stats.totalPoints += (cr.workloadPoints || 0);

      const isCompleted = cr.status === 'Closed (Completed)';
      const isOpen = !['Closed (Completed)', 'Closed (Rejected)', 'Draft'].includes(cr.status);

      if (isCompleted && cr.actualCompletionDate && cr.createdAt) {
        stats.completed++;
        const actualHours = (new Date(cr.actualCompletionDate).getTime() - new Date(cr.createdAt).getTime()) / (1000 * 3600);
        const targetHours = cr.slaTargetHours || 168;
        
        stats.totalResolutionHours += actualHours;
        if (actualHours <= targetHours) {
          stats.withinSla++;
        } else {
          stats.breached++;
        }
      }

      if (isOpen) {
        stats.open++;
        if (cr.priority === 'Critical' || cr.priority === 'High') {
          stats.highCriticalOpen++;
        }
        
        // Overdue check for open cases
        if (cr.createdAt) {
          const ageHours = (now - new Date(cr.createdAt).getTime()) / (1000 * 3600);
          if (ageHours > (cr.slaTargetHours || 168)) {
            stats.overdue++;
          }
        }
      }
    });

    const totalWorkloadPoints = Object.values(staffStats).reduce((sum, s: any) => sum + s.totalPoints, 0);

    return Object.values(staffStats)
      .map((s: any) => ({
        ...s,
        compliancePercent: s.completed > 0 ? (s.withinSla / s.completed) * 100 : 100,
        avgResolutionDays: s.completed > 0 ? (s.totalResolutionHours / s.completed) / 24 : 0,
        workloadPercent: totalWorkloadPoints > 0 ? (s.totalPoints / totalWorkloadPoints) * 100 : 0
      }))
      .filter(s => s.name !== 'Unassigned') // Explicitly exclude unassigned as per rules
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [changeRequests, dateFilter, customStartDate, customEndDate]);

  // Department-isolated Delegation counts
  const totalDelegationsCount = scopedDelegations.length;
  const activeDelegationsCount = scopedDelegations.filter((d) => d.status === 'Active').length;
  const revokedDelegationsCount = scopedDelegations.filter((d) => d.status === 'Revoked').length;
  const expiredDelegationsCount = scopedDelegations.filter((d) => d.status === 'Expired').length;

  // Filtered Delegations (Operating strictly within authorized department scope)
  const filteredDelegations = useMemo(() => {
    return scopedDelegations.filter((d) => {
      // Status filter
      if (delegationStatusFilter === 'REVOKED' && d.status !== 'Revoked') return false;
      if (delegationStatusFilter === 'ACTIVE' && d.status !== 'Active') return false;
      if (delegationStatusFilter === 'EXPIRED' && d.status !== 'Expired') return false;

      // Department filter (Only accessible to System Admins)
      if (isSystemAdmin && delegationDeptFilter !== 'ALL' && d.departmentName !== delegationDeptFilter) return false;

      // Search query
      if (delegationSearch.trim()) {
        const q = delegationSearch.toLowerCase();
        const matchId = d.id.toLowerCase().includes(q);
        const matchDept = (d.departmentName || '').toLowerCase().includes(q);
        const matchHod = (d.hodName || '').toLowerCase().includes(q);
        const matchDelegate = (d.delegateName || '').toLowerCase().includes(q);
        const matchReason = (d.reason || '').toLowerCase().includes(q);
        const matchRevokedBy = (d.revokedBy || '').toLowerCase().includes(q);
        const matchRevocationReason = (d.revocationReason || '').toLowerCase().includes(q);
        return matchId || matchDept || matchHod || matchDelegate || matchReason || matchRevokedBy || matchRevocationReason;
      }

      return true;
    });
  }, [scopedDelegations, delegationStatusFilter, delegationDeptFilter, delegationSearch, isSystemAdmin]);

  // Unique departments for delegation filter (Admin only)
  const delegationDepartments = useMemo(() => {
    if (!isSystemAdmin) return [];
    const depts = new Set<string>();
    rawDelegations.forEach((d) => {
      if (d.departmentName) depts.add(d.departmentName);
    });
    return Array.from(depts).sort();
  }, [rawDelegations, isSystemAdmin]);

  // Filtered Change Requests
  const filteredChangeRequests = useMemo(() => {
    return changeRequests.filter((cr) => {
      if (crPriorityFilter !== 'ALL' && cr.priority !== crPriorityFilter) return false;
      if (crStatusFilter !== 'ALL' && cr.status !== crStatusFilter) return false;
      if (crSearch.trim()) {
        const q = crSearch.toLowerCase();
        return (
          cr.id.toLowerCase().includes(q) ||
          cr.title.toLowerCase().includes(q) ||
          cr.requesterName.toLowerCase().includes(q) ||
          cr.departmentName.toLowerCase().includes(q) ||
          cr.requestType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [changeRequests, crPriorityFilter, crStatusFilter, crSearch]);

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-medium gap-1 mb-8">
        {[
          { id: 'executive', label: 'Executive Summary', icon: LayoutDashboard, color: 'indigo' },
          { id: 'sla', label: 'SLA Performance', icon: ShieldCheck, color: 'emerald' },
          { id: 'service', label: 'Service Performance', icon: BarChart3, color: 'blue' },
          { id: 'attention', label: 'Management Attention', icon: AlertCircle, color: 'rose' },
          { id: 'audit', label: 'Audit Register', icon: FileSpreadsheet, color: 'slate' },
          { id: 'it-staff', label: 'IT Staff Performance', icon: User, color: 'indigo' },
          { id: 'delegations', label: 'Delegation Audit', icon: UserCheck, color: 'slate' },
          { id: 'workload', label: 'IT Workload', icon: Award, color: 'slate' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveReportTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
              activeReportTab === tab.id
                ? `bg-white text-${tab.color}-700 font-bold shadow-sm border border-slate-200`
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeReportTab === tab.id ? `text-${tab.color}-600` : ''}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: EXECUTIVE SUMMARY */}
      {activeReportTab === 'executive' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Executive Summary</h2>
              <p className="text-xs text-slate-500">High-level operational health and service performance indicators.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated: {lastFetchedAt || 'Just now'}</span>
            </div>
          </div>

          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Demand</p>
              <h3 className="text-3xl font-black text-slate-900">{executiveMetrics.total}</h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">All-time request volume</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLA Compliance</p>
              <h3 className={`text-3xl font-black ${executiveMetrics.overallSlaPercent >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {executiveMetrics.overallSlaPercent}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Resolution within target hours</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLA Breaches</p>
              <h3 className={`text-3xl font-black ${executiveMetrics.slaBreaches > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {executiveMetrics.slaBreaches}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Cases over target threshold</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Open</p>
              <h3 className={`text-3xl font-black ${executiveMetrics.highCriticalOpen.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {executiveMetrics.highCriticalOpen.length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Priority management attention</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Service Health Overview
              </h4>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Active Pipeline</span>
                  <span className="text-sm font-black text-slate-900">{executiveMetrics.open} Requests</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Average Resolution Time</span>
                  <span className="text-sm font-black text-slate-900">{slaMetrics?.avgOverallResolutionDays || 0} Days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">HOD Approval / Clearance SLA</span>
                  <span className="text-sm font-black text-emerald-600">{slaMetrics?.hodSlaCompliancePercent || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">IT Fulfilment / Resolution SLA</span>
                  <span className="text-sm font-black text-blue-600">{slaMetrics?.itDevSlaCompliancePercent || 0}%</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10">
                 <ShieldAlert className="w-24 h-24 text-rose-500" />
               </div>
               <h4 className="text-sm font-bold text-white mb-6">Critical Risk Exposure</h4>
               <div className="space-y-4">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Aging Requests (&gt;14 Days)</p>
                   <p className="text-xl font-black text-white">{executiveMetrics.agingOpen.length}</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">HOD Approval Stalled (&gt;48h)</p>
                   <p className="text-xl font-black text-white">{executiveMetrics.pendingHODOverdue.length}</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SLA PERFORMANCE */}
      {activeReportTab === 'sla' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div>
            <h2 className="text-xl font-bold text-slate-900">SLA Performance</h2>
            <p className="text-xs text-slate-500">Detailed adherence to service level agreements across priorities.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-8 py-4 border-b border-slate-100">Service Priority</th>
                  <th className="px-6 py-4 border-b border-slate-100 text-center">Total Volume</th>
                  <th className="px-6 py-4 border-b border-slate-100 text-center">Within SLA</th>
                  <th className="px-6 py-4 border-b border-slate-100 text-center">Breached</th>
                  <th className="px-8 py-4 border-b border-slate-100 text-right">Compliance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {slaByPriority.map((row) => (
                  <tr key={row.priority} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          row.priority === 'Critical' ? 'bg-rose-500' :
                          row.priority === 'High' ? 'bg-orange-500' :
                          row.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'
                        }`} />
                        <span className="text-sm font-bold text-slate-900">{row.priority}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-medium text-slate-500">{row.total}</td>
                    <td className="px-6 py-5 text-center text-sm font-bold text-emerald-600">{row.withinSla}</td>
                    <td className="px-6 py-5 text-center text-sm font-bold text-rose-500">{row.breached}</td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-sm font-black ${row.compliance >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {row.compliance.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">HOD Approval / Clearance SLA</p>
              <div className="flex items-end gap-4">
                <h3 className="text-3xl font-black text-slate-900">{slaMetrics?.hodSlaCompliancePercent || 0}%</h3>
                <span className="text-xs text-slate-400 mb-1 font-bold">Target: &lt; 48 Hours</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">IT Fulfilment / Resolution SLA</p>
              <div className="flex items-end gap-4">
                <h3 className="text-3xl font-black text-slate-900">{slaMetrics?.itDevSlaCompliancePercent || 0}%</h3>
                <span className="text-xs text-slate-400 mb-1 font-bold">Target: Priority-Based</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SERVICE PERFORMANCE */}
      {activeReportTab === 'service' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Service Performance</h2>
            <p className="text-xs text-slate-500">Workload distribution and demand volume trends.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" />
                Requests by Department
              </h4>
              <div className="space-y-4">
                {servicePerformance.byDept.slice(0, 6).map(([dept, count]) => (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-600 uppercase tracking-tight">{dept}</span>
                      <span className="text-slate-900">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full" 
                        style={{ width: `${(count / executiveMetrics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Requests by Service Type
              </h4>
              <div className="space-y-4">
                {servicePerformance.byType.slice(0, 6).map(([type, count]) => (
                  <div key={type} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-600 uppercase tracking-tight">{type}</span>
                      <span className="text-slate-900">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full" 
                        style={{ width: `${(count / executiveMetrics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: MANAGEMENT ATTENTION */}
      {activeReportTab === 'attention' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div>
            <h2 className="text-xl font-bold text-slate-900 text-rose-600">Management Attention</h2>
            <p className="text-xs text-slate-500">Actionable operational exceptions and overdue critical tasks.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                Stalled HOD Approvals (&gt;48h)
              </h4>
              <div className="space-y-3">
                {executiveMetrics.pendingHODOverdue.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                    <p className="text-xs text-slate-400 font-bold">No approvals currently stalled beyond 48h.</p>
                  </div>
                ) : (
                  executiveMetrics.pendingHODOverdue.map(cr => (
                    <div key={cr.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm border-l-4 border-l-rose-500">
                       <div className="flex justify-between items-start mb-1">
                         <span className="text-[10px] font-black text-rose-600">{cr.id}</span>
                         <span className="text-[10px] font-bold text-slate-400">{formatDisplayDate(cr.createdAt)}</span>
                       </div>
                       <p className="text-sm font-bold text-slate-900 line-clamp-1">{cr.title}</p>
                       <p className="text-[10px] text-slate-500 mt-1">Requester: {cr.requesterName} ({cr.departmentName})</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Priority Open Exceptions (High/Critical)
              </h4>
              <div className="space-y-3">
                {executiveMetrics.highCriticalOpen.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                    <p className="text-xs text-slate-400 font-bold">No high-priority tasks pending.</p>
                  </div>
                ) : (
                  executiveMetrics.highCriticalOpen.map(cr => (
                    <div key={cr.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm border-l-4 border-l-amber-500">
                       <div className="flex justify-between items-start mb-1">
                         <span className="text-[10px] font-black text-amber-600">{cr.id}</span>
                         <span className="text-[10px] font-bold text-slate-400">{cr.priority}</span>
                       </div>
                       <p className="text-sm font-bold text-slate-900 line-clamp-1">{cr.title}</p>
                       <p className="text-[10px] text-slate-500 mt-1">Status: {cr.status}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: AUDIT REGISTER */}
      {activeReportTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black mb-1">Full System Audit Register</h2>
              <p className="text-xs text-slate-400">Complete historical record of all change requests and service transactions.</p>
            </div>
            <button
              onClick={exportCrToCSV}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg text-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Audit to CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
             <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={crSearch}
                    onChange={(e) => setCrSearch(e.target.value)}
                    placeholder="Search by CR ID, Title, Requester, Dept..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                   <select 
                     value={crPriorityFilter} 
                     onChange={(e) => setCrPriorityFilter(e.target.value)}
                     className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-bold"
                   >
                     <option value="ALL">All Priorities</option>
                     <option value="Critical">Critical</option>
                     <option value="High">High</option>
                     <option value="Medium">Medium</option>
                     <option value="Low">Low</option>
                   </select>
                   <select 
                     value={crStatusFilter} 
                     onChange={(e) => setCrStatusFilter(e.target.value)}
                     className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-bold"
                   >
                     <option value="ALL">All Statuses</option>
                     <option value="Pending HOD Approval">Pending HOD</option>
                     <option value="In Progress">In Progress</option>
                     <option value="Closed (Completed)">Completed</option>
                     <option value="Closed (Rejected)">Rejected</option>
                   </select>
                </div>
             </div>

             <div className="overflow-x-auto border border-slate-100 rounded-2xl">
               <table className="w-full text-left text-[11px] border-collapse">
                 <thead>
                   <tr className="bg-slate-50 text-slate-400 uppercase font-black tracking-widest border-b border-slate-100">
                     <th className="px-4 py-4">CR Number</th>
                     <th className="px-4 py-4">Title</th>
                     <th className="px-4 py-4">Requester</th>
                     <th className="px-4 py-4">Department</th>
                     <th className="px-4 py-4">Priority</th>
                     <th className="px-4 py-4">Status</th>
                     <th className="px-4 py-4 text-right">Target Date</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {filteredChangeRequests.map(cr => (
                     <tr key={cr.id} className="hover:bg-slate-50/80 transition-colors">
                       <td className="px-4 py-3 font-bold text-indigo-600">{cr.id}</td>
                       <td className="px-4 py-3 font-bold text-slate-900 line-clamp-1 max-w-xs">{cr.title}</td>
                       <td className="px-4 py-3 font-medium text-slate-600">{cr.requesterName}</td>
                       <td className="px-4 py-3 font-medium text-slate-600">{cr.departmentName}</td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                           cr.priority === 'Critical' ? 'bg-rose-100 text-rose-700' :
                           cr.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                           'bg-slate-100 text-slate-600'
                         }`}>
                           {cr.priority}
                         </span>
                       </td>
                       <td className="px-4 py-3">
                         <span className="font-bold text-slate-500">{cr.status}</span>
                       </td>
                       <td className="px-4 py-3 text-right font-mono text-slate-400">
                         {formatDisplayDate(cr.requestedCompletionDate)}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* SECTION 6: IT STAFF PERFORMANCE */}
      {activeReportTab === 'it-staff' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black mb-1">SLA Performance by IT Staff</h2>
              <p className="text-xs text-slate-400">Individual performance metrics and workload distribution matrix.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Average SLA</p>
                <p className="text-xl font-black text-emerald-400">{executiveMetrics.overallSlaPercent}%</p>
              </div>
            </div>
          </div>

          {/* IT Staff Visual Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assigned</p>
                <User className="w-4 h-4 text-indigo-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900">
                {itStaffPerformance.reduce((sum, s) => sum + s.assigned, 0)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Cases across all IT staff</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall SLA %</p>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-emerald-600">
                {itStaffPerformance.length > 0 
                  ? (itStaffPerformance.reduce((sum, s) => sum + s.withinSla, 0) / 
                     Math.max(1, itStaffPerformance.reduce((sum, s) => sum + s.completed, 0)) * 100).toFixed(1)
                  : '100.0'}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">IT fulfillment compliance</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Breached</p>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="text-3xl font-black text-rose-600">
                {itStaffPerformance.reduce((sum, s) => sum + s.breached, 0)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Resolved over target hours</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Overdue</p>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-3xl font-black text-amber-600">
                {itStaffPerformance.reduce((sum, s) => sum + s.overdue, 0)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Open cases past target SLA</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex flex-col lg:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={crSearch}
                  onChange={(e) => setCrSearch(e.target.value)}
                  placeholder="Search staff performance..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              
              {/* Date Filters Control */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="text-xs bg-transparent border-none focus:ring-0 font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="ALL_TIME">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="THIS_WEEK">This Week</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="CUSTOM">Custom Range</option>
                  </select>
                </div>

                {dateFilter === 'CUSTOM' && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                    <input 
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <span className="text-[10px] font-black text-slate-300">TO</span>
                    <input 
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                )}

                <div className="h-6 w-px bg-slate-200 hidden lg:block mx-1" />

                <select 
                  value={staffFilter} 
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-bold"
                >
                  <option value="ALL">All Staff</option>
                  {itStaffPerformance.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-black tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">IT Staff Name</th>
                    <th className="px-4 py-4 text-center">Assigned</th>
                    <th className="px-4 py-4 text-center">Completed</th>
                    <th className="px-4 py-4 text-center">Within SLA</th>
                    <th className="px-4 py-4 text-center">Breached</th>
                    <th className="px-4 py-4 text-center">SLA %</th>
                    <th className="px-4 py-4 text-center">Avg Res (Days)</th>
                    <th className="px-4 py-4 text-center">Open</th>
                    <th className="px-4 py-4 text-center">Overdue</th>
                    <th className="px-4 py-4 text-right">Workload %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {itStaffPerformance
                    .filter(s => staffFilter === 'ALL' || s.name === staffFilter)
                    .filter(s => s.name.toLowerCase().includes(crSearch.toLowerCase()))
                    .map(staff => (
                    <tr key={staff.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                            {staff.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-bold text-slate-900">{staff.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-600">{staff.assigned}</td>
                      <td className="px-4 py-4 text-center font-bold text-emerald-600">{staff.completed}</td>
                      <td className="px-4 py-4 text-center font-bold text-emerald-500">{staff.withinSla}</td>
                      <td className="px-4 py-4 text-center font-bold text-rose-500">{staff.breached}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          staff.compliancePercent >= 90 ? 'bg-emerald-100 text-emerald-700' :
                          staff.compliancePercent >= 70 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {staff.compliancePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-bold text-slate-500">
                        {staff.avgResolutionDays.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-indigo-600">{staff.open}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-black ${staff.overdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {staff.overdue}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] font-bold text-slate-500">{staff.workloadPercent.toFixed(1)}%</span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full" 
                              style={{ width: `${staff.workloadPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: DELEGATION AUDIT */}
      {activeReportTab === 'delegations' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 border border-slate-700 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
               
                
                
              </div>
              <h1 className="text-2xl font-bold">
                Temporary Approver & Delegation Audit
                {!isSystemAdmin && userDeptName && (
                  <span className="text-slate-300 font-normal text-lg ml-2">({userDeptName} Department)</span>
                )}
              </h1>
             
            </div>

            <button
              onClick={exportDelegationsToCSV}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md text-xs transition-all shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {isSystemAdmin
                  ? 'Export All Delegations to CSV'
                  : `Export ${userDeptName || 'Department'} Audit to CSV`}
              </span>
            </button>
          </div>

          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-500 font-semibold block">
                {isSystemAdmin ? 'Total Delegations Granted' : 'Department Delegations Granted'}
              </span>
              <p className="text-2xl font-extrabold text-slate-900">{totalDelegationsCount}</p>
              <span className="text-slate-500 text-[11px]">
                {isSystemAdmin ? 'All-time recorded authorizations' : `Recorded for ${userDeptName || 'department'}`}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-500 font-semibold block">Currently Active Delegations</span>
              <p className="text-2xl font-extrabold text-emerald-600">{activeDelegationsCount}</p>
              <span className="text-emerald-700 text-[11px] font-medium">Valid acting approver window</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-500 font-semibold block">Revoked by HOD (Early Revocation)</span>
              <p className="text-2xl font-extrabold text-rose-600">{revokedDelegationsCount}</p>
              <span className="text-rose-700 text-[11px] font-medium">Manually revoked prior to expiry</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-slate-500 font-semibold block">Completed / Expired</span>
              <p className="text-2xl font-extrabold text-slate-600">{expiredDelegationsCount}</p>
              <span className="text-slate-500 text-[11px]">Natural conclusion of authorization</span>
            </div>
          </div>

          {/* Main Audit Register Card (List Info Only) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <span>
                    Delegation & Revocation Register (List Info Only)
                    {!isSystemAdmin && userDeptName && ` - ${userDeptName}`}
                  </span>
                </h2>
               
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setDelegationStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    delegationStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({totalDelegationsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDelegationStatusFilter('REVOKED')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    delegationStatusFilter === 'REVOKED'
                      ? 'bg-rose-50 text-rose-700 shadow-xs border border-rose-200 font-bold'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Revoked ({revokedDelegationsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDelegationStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    delegationStatusFilter === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-200 font-bold'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Active ({activeDelegationsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDelegationStatusFilter('EXPIRED')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    delegationStatusFilter === 'EXPIRED'
                      ? 'bg-slate-200 text-slate-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expired ({expiredDelegationsCount})
                </button>
              </div>
            </div>

            {/* Search and Dropdown Filter Row */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={delegationSearch}
                  onChange={(e) => setDelegationSearch(e.target.value)}
                  placeholder={
                    isSystemAdmin
                      ? 'Search by Delegation ID, Department, HOD, Temporary Approver, or Revocation Reason...'
                      : `Search within ${userDeptName || 'Department'} delegations by ID, HOD, Temporary Approver...`
                  }
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white text-slate-900"
                />
                {delegationSearch && (
                  <button
                    onClick={() => setDelegationSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Admin Department Filter Dropdown vs Non-Admin Department Badge */}
              {isSystemAdmin ? (
                delegationDepartments.length > 0 && (
                  <div className="w-full sm:w-60 shrink-0">
                    <select
                      value={delegationDeptFilter}
                      onChange={(e) => setDelegationDeptFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-900 font-medium cursor-pointer"
                    >
                      <option value="ALL">All Departments (Enterprise)</option>
                      {delegationDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold shrink-0">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  <span>{userDeptName || 'Department'}</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Restricted)</span>
                </div>
              )}
            </div>

            {/* Delegations List Table (Info Only) */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Delegation ID</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Delegating HOD</th>
                    <th className="p-3">Temporary Approver (Delegate)</th>
                    <th className="p-3">Authorized Period</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Reason & Notes</th>
                    <th className="p-3">Revocation / Lifecycle Audit Details (Info Only)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDelegations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <UserCheck className="w-8 h-8 text-slate-400" />
                          <p className="font-semibold text-slate-700">
                            {scopedDelegations.length === 0
                              ? `No delegation or revocation records found for ${userDeptName || 'your department'}.`
                              : 'No delegation records match your criteria.'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {scopedDelegations.length === 0
                              ? ''
                              : 'Try adjusting your search terms or filter selection.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDelegations.map((del) => {
                      const isRevoked = del.status === 'Revoked';
                      const isActive = del.status === 'Active';
                      const isExpired = del.status === 'Expired';

                      return (
                        <tr
                          key={del.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isRevoked ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          {/* Delegation ID */}
                          <td className="p-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                            {del.id}
                          </td>

                          {/* Department */}
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{del.departmentName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Dept #{del.departmentId}</span>
                          </td>

                          {/* Delegating HOD */}
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{del.hodName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{del.hodEmail}</span>
                          </td>

                          {/* Temporary Approver (Delegate) */}
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{del.delegateName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{del.delegateEmail}</span>
                            {del.delegateRole && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                                {del.delegateRole}
                              </span>
                            )}
                          </td>

                          {/* Authorized Window */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="text-slate-800 font-medium block">
                                {formatDisplayDate(del.startDate)} → {formatDisplayDate(del.endDate)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Created: {formatDisplayDateTime(del.createdAt)}
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 whitespace-nowrap">
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                <span>Revoked by HOD</span>
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                <span>Active</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                <span>Expired</span>
                              </span>
                            )}
                          </td>

                          {/* Reason & Notes */}
                          <td className="p-3 max-w-xs">
                            <span className="font-semibold text-slate-800 block">{del.reason}</span>
                            {del.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5 italic line-clamp-2">
                                "{del.notes}"
                              </p>
                            )}
                          </td>

                          {/* Revocation & Lifecycle Details (Info Only) */}
                          <td className="p-3 min-w-[240px]">
                            {isRevoked ? (
                              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] space-y-1 text-rose-950">
                                <div className="flex items-center gap-1 font-bold text-rose-800">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Revoked On: {del.revokedAt || 'Recorded'}</span>
                                </div>
                                <div>
                                  <span className="text-rose-700 font-semibold">Revoked By: </span>
                                  <span>{del.revokedBy || del.hodName}</span>
                                </div>
                                <div>
                                  <span className="text-rose-700 font-semibold">Reason: </span>
                                  <span>{del.revocationReason || 'HOD resumed office / authority revoked manually'}</span>
                                </div>
                                <div className="text-[10px] text-rose-600 font-medium">
                                  ✓ Authority returned to primary HOD
                                </div>
                              </div>
                            ) : isActive ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-900 space-y-0.5">
                                <div className="font-semibold flex items-center gap-1 text-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Acting Authority In Effect</span>
                                </div>
                                <div className="text-[10px] text-emerald-700">
                                  Expires automatically on {del.endDate.split(' ')[0]} 23:59. HOD can revoke at any time.
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] text-slate-600">
                                <span>Completed natural tenure on {del.endDate.split(' ')[0]}.</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

           
          </div>
        </div>
      )}

      {/* SECTION 7: IT WORKLOAD */}
      {activeReportTab === 'workload' && isItStaff && (
        <div className="animate-in fade-in duration-500">
           <StaffWorkloadReportView
            staffList={users || []}
            changeRequests={changeRequests}
            currentUser={currentUser}
            individualOnly={!isSystemAdmin}
          />
        </div>
      )}
    </div>
  );
};
