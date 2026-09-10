import { ChangeRequest, UserProfile, PriorityLevel } from '../types';

export interface StaffWorkloadInfo {
  user: UserProfile;
  activeCasesCount: number;
  usedPoints: number;
  maxCapacity: number;
  remainingCapacity: number;
  status: 'Available' | 'Moderate' | 'Busy' | 'Full';
  isRecommended: boolean;
  activeCases: ChangeRequest[];
}

/**
 * Priority Workload Points:
 * Critical = 4 points
 * High = 3 points
 * Medium = 2 points
 * Low = 1 point
 */
export function getPriorityWorkloadPoints(priority?: PriorityLevel | string): number {
  switch (priority) {
    case 'Critical':
      return 4;
    case 'High':
      return 3;
    case 'Medium':
      return 2;
    case 'Low':
      return 1;
    default:
      return 1;
  }
}

/**
 * Checks if a change request is currently active.
 * Closed, Resolved and Cancelled cases do not count.
 */
export function isChangeRequestActive(cr: ChangeRequest): boolean {
  if (!cr || !cr.status) return false;
  const s = cr.status.toLowerCase();
  if (
    s.includes('closed') ||
    s.includes('resolved') ||
    s.includes('cancelled') ||
    s.includes('canceled') ||
    s === 'draft'
  ) {
    return false;
  }
  return true;
}

/**
 * Workload status classification based on used points:
 * 0–4 used = Available
 * 5–7 used = Moderate
 * 8–9 used = Busy
 * 10+ used = Full
 */
export function getWorkloadStatus(usedPoints: number): 'Available' | 'Moderate' | 'Busy' | 'Full' {
  if (usedPoints <= 4) return 'Available';
  if (usedPoints <= 7) return 'Moderate';
  if (usedPoints <= 9) return 'Busy';
  return 'Full';
}

/**
 * Calculates workload metrics for each staff member across all change requests.
 * Maximum workload capacity per staff member is 10 points.
 * Highlights the staff member with the highest remaining capacity as Recommended.
 */
export function calculateStaffWorkloads(
  staffList: UserProfile[],
  changeRequests: ChangeRequest[]
): StaffWorkloadInfo[] {
  const MAX_CAPACITY = 10;

  const rawWorkloads = staffList.map((staff) => {
    // Find all active cases assigned to this staff member
    const activeCases = changeRequests.filter((cr) => {
      const isAssigned =
        cr.assignedDeveloperId === staff.id ||
        (cr.assignedDeveloperName && cr.assignedDeveloperName.toLowerCase() === staff.fullName.toLowerCase());
      return isAssigned && isChangeRequestActive(cr);
    });

    const usedPoints = activeCases.reduce((total, cr) => {
      return total + getPriorityWorkloadPoints(cr.priority);
    }, 0);

    const remainingCapacity = MAX_CAPACITY - usedPoints;
    const status = getWorkloadStatus(usedPoints);

    return {
      user: staff,
      activeCasesCount: activeCases.length,
      usedPoints,
      maxCapacity: MAX_CAPACITY,
      remainingCapacity,
      status,
      isRecommended: false,
      activeCases,
    };
  });

  // Determine recommendation: staff member with highest remaining capacity (most available)
  if (rawWorkloads.length > 0) {
    let maxRemaining = -Infinity;
    rawWorkloads.forEach((w) => {
      if (w.remainingCapacity > maxRemaining) {
        maxRemaining = w.remainingCapacity;
      }
    });

    // Mark the staff member(s) with max remaining capacity
    let firstFound = false;
    rawWorkloads.forEach((w) => {
      if (w.remainingCapacity === maxRemaining && !firstFound) {
        w.isRecommended = true;
        firstFound = true;
      }
    });
  }

  return rawWorkloads;
}

export type WorkloadDateFilter = 'today' | 'this_week' | 'this_month' | 'last_30_days' | 'custom' | 'all';

export interface HistoricalStaffWorkloadReportItem {
  user: UserProfile;
  totalCasesAssigned: number;
  criticalCasesCount: number;
  highCasesCount: number;
  mediumCasesCount: number;
  lowCasesCount: number;
  criticalPoints: number;
  highPoints: number;
  mediumPoints: number;
  lowPoints: number;
  totalWorkloadPoints: number;
  isHighestWorkload: boolean;
  assignedCases: ChangeRequest[];
}

/**
 * Parses any date string from a ChangeRequest into a valid Date object.
 */
export function parseCaseDate(cr: ChangeRequest): Date {
  const raw = cr.createdAt || cr.requestedCompletionDate || '';
  if (!raw) return new Date();
  const cleanStr = raw.replace(' ', 'T');
  const d = new Date(cleanStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Checks if a change request falls within a selected date filter.
 */
export function isCaseInDateRange(
  cr: ChangeRequest,
  filter: WorkloadDateFilter,
  customStartDate?: string,
  customEndDate?: string
): boolean {
  if (filter === 'all') return true;

  const caseDate = parseCaseDate(cr);
  const now = new Date();

  switch (filter) {
    case 'today': {
      return (
        caseDate.getFullYear() === now.getFullYear() &&
        caseDate.getMonth() === now.getMonth() &&
        caseDate.getDate() === now.getDate()
      );
    }
    case 'this_week': {
      // Current week (e.g. past 7 days or since Monday of current week)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      oneWeekAgo.setHours(0, 0, 0, 0);
      return caseDate >= oneWeekAgo;
    }
    case 'this_month': {
      return (
        caseDate.getFullYear() === now.getFullYear() &&
        caseDate.getMonth() === now.getMonth()
      );
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return caseDate >= thirtyDaysAgo;
    }
    case 'custom': {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        if (caseDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/**
 * Calculates historical workload points received by each staff member.
 * Attributes cases to their assigned staff member without double-counting.
 * Sorts from highest total points to lowest total points.
 * Highlights the staff member with the highest points as Highest Workload.
 */
export function calculateHistoricalWorkloadReport(
  staffList: UserProfile[],
  changeRequests: ChangeRequest[],
  dateFilter: WorkloadDateFilter = 'all',
  customStartDate?: string,
  customEndDate?: string
): HistoricalStaffWorkloadReportItem[] {
  // Filter cases by date range
  const filteredCases = changeRequests.filter((cr) =>
    isCaseInDateRange(cr, dateFilter, customStartDate, customEndDate)
  );

  const reportItems: HistoricalStaffWorkloadReportItem[] = staffList.map((staff) => {
    // Find all cases assigned to this staff member within the date window
    // (A case is attributed to its assigned developer once, ensuring no double counting)
    const assignedCases = filteredCases.filter((cr) => {
      if (!cr.assignedDeveloperId && !cr.assignedDeveloperName) return false;
      return (
        cr.assignedDeveloperId === staff.id ||
        (cr.assignedDeveloperName && cr.assignedDeveloperName.toLowerCase() === staff.fullName.toLowerCase())
      );
    });

    let criticalCasesCount = 0;
    let highCasesCount = 0;
    let mediumCasesCount = 0;
    let lowCasesCount = 0;

    assignedCases.forEach((cr) => {
      switch (cr.priority) {
        case 'Critical':
          criticalCasesCount += 1;
          break;
        case 'High':
          highCasesCount += 1;
          break;
        case 'Medium':
          mediumCasesCount += 1;
          break;
        case 'Low':
        default:
          lowCasesCount += 1;
          break;
      }
    });

    const criticalPoints = criticalCasesCount * 4;
    const highPoints = highCasesCount * 3;
    const mediumPoints = mediumCasesCount * 2;
    const lowPoints = lowCasesCount * 1;
    const totalWorkloadPoints = criticalPoints + highPoints + mediumPoints + lowPoints;

    return {
      user: staff,
      totalCasesAssigned: assignedCases.length,
      criticalCasesCount,
      highCasesCount,
      mediumCasesCount,
      lowCasesCount,
      criticalPoints,
      highPoints,
      mediumPoints,
      lowPoints,
      totalWorkloadPoints,
      isHighestWorkload: false,
      assignedCases,
    };
  });

  // Sort staff from highest total points to lowest total points
  reportItems.sort((a, b) => {
    if (b.totalWorkloadPoints !== a.totalWorkloadPoints) {
      return b.totalWorkloadPoints - a.totalWorkloadPoints;
    }
    return b.totalCasesAssigned - a.totalCasesAssigned;
  });

  // Highlight the staff member with the highest points as Highest Workload
  if (reportItems.length > 0) {
    const maxPoints = Math.max(...reportItems.map((item) => item.totalWorkloadPoints));
    if (maxPoints > 0) {
      reportItems.forEach((item) => {
        if (item.totalWorkloadPoints === maxPoints) {
          item.isHighestWorkload = true;
        }
      });
    }
  }

  return reportItems;
}

