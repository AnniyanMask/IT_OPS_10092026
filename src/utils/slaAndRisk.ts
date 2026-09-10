import { ChangeRequest, PriorityLevel } from '../types';

export interface SlaInfo {
  slaStatus: 'On Track' | 'Nearing Breach' | 'SLA Breached' | 'SLA Paused';
  hoursElapsed: number;
  hoursRemaining: number;
  targetHours: number;
  stageName: string;
  isPaused?: boolean;
  pausedReason?: string;
  chaseStage?: 0 | 1 | 2 | 3;
  daysWaitingOnRequester?: number;
  hoursWaitingOnRequester?: number;
  isAutoClosureEligible?: boolean;
}

export interface RiskInfo {
  riskScore: number; // 0 to 100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Severe';
  downtimeRequired: boolean;
  schemaChangeRequired: boolean;
}

/**
 * Returns descriptive info, recommended action, and urgency for the 3-Stage Chase Policy.
 */
export function getChaseStageInfo(stage: number = 0) {
  switch (stage) {
    case 1:
      return {
        stage: 1,
        title: 'Stage 1: Friendly Clarification Reminder',
        shortBadge: 'Chase Stage 1 (Day 2+)',
        colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500',
        description: 'Case has been waiting on requester details for 2+ days. Initial gentle reminder sent or due.',
        suggestedAction: 'Send gentle reminder email & in-app prompt',
      };
    case 2:
      return {
        stage: 2,
        title: 'Stage 2: Urgent Follow-Up Notice',
        shortBadge: 'Chase Stage 2 (Day 4+)',
        colorClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
        dotColor: 'bg-amber-500',
        description: 'Case has been inactive for 4+ days. Work is blocked pending user specifications.',
        suggestedAction: 'Send urgent follow-up notification to requester',
      };
    case 3:
      return {
        stage: 3,
        title: 'Stage 3: Final 48-Hour Notice Before Auto-Close',
        shortBadge: 'Stage 3: Final Notice (Day 7+)',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
        dotColor: 'bg-rose-600',
        description: 'Case has been inactive for 7+ days. Final 48h warning before auto-withdrawal.',
        suggestedAction: 'Send final withdrawal warning / Auto-close eligible',
      };
    default:
      return {
        stage: 0,
        title: 'Awaiting User Response',
        shortBadge: 'Waiting on User',
        colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotColor: 'bg-slate-400',
        description: 'Recently returned for technical details / clarification.',
        suggestedAction: 'Awaiting requester reply',
      };
  }
}

/**
 * Computes how many total hours a change request has spent in clarification states across its history.
 */
export function calculateTotalPausedClarificationHours(cr: ChangeRequest): number {
  if (typeof cr.totalSlaPausedHours === 'number' && cr.totalSlaPausedHours > 0) {
    return cr.totalSlaPausedHours;
  }

  if (!cr.approvalHistory || cr.approvalHistory.length === 0) {
    return 0;
  }

  let totalMs = 0;
  let pauseStart: number | null = null;

  // Walk through history in chronological order
  const sortedHistory = [...cr.approvalHistory].sort(
    (a, b) => new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime()
  );

  for (const entry of sortedHistory) {
    const entryTime = new Date(entry.actionDate).getTime();
    if (isNaN(entryTime)) continue;

    if (entry.toStatus === 'Returned to Requester' || entry.decision === 'Returned for Clarification' || entry.decision === 'Sent Back') {
      if (pauseStart === null) {
        pauseStart = entryTime;
      }
    } else if (pauseStart !== null && (entry.fromStatus === 'Returned to Requester' || entry.decision === 'Submitted' || entry.decision === 'Resubmitted to IT')) {
      totalMs += Math.max(0, entryTime - pauseStart);
      pauseStart = null;
    }
  }

  // If currently in Returned to Requester, add ongoing duration
  if (pauseStart !== null && cr.status === 'Returned to Requester') {
    const now = new Date().getTime();
    totalMs += Math.max(0, now - pauseStart);
  }

  return Math.floor(totalMs / (1000 * 60 * 60));
}

/**
 * Calculates how long the case has been continuously waiting on requester in the current clarification cycle.
 */
export function getCurrentClarificationDuration(cr: ChangeRequest): { hours: number; days: number; stage: 0 | 1 | 2 | 3 } {
  if (cr.status !== 'Returned to Requester') {
    return { hours: 0, days: 0, stage: 0 };
  }

  // Find the latest returned action date
  let returnedTime: number | null = null;
  if (cr.approvalHistory && cr.approvalHistory.length > 0) {
    for (let i = cr.approvalHistory.length - 1; i >= 0; i--) {
      const entry = cr.approvalHistory[i];
      if (
        entry.toStatus === 'Returned to Requester' ||
        entry.decision === 'Returned for Clarification' ||
        entry.decision === 'Sent Back'
      ) {
        const t = new Date(entry.actionDate).getTime();
        if (!isNaN(t)) {
          returnedTime = t;
          break;
        }
      }
    }
  }

  if (!returnedTime) {
    returnedTime = new Date(cr.updatedAt || cr.createdAt).getTime();
  }

  const now = new Date().getTime();
  const diffMs = Math.max(0, now - (isNaN(returnedTime) ? now : returnedTime));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  // 3-Stage Chase Policy rule:
  // Days < 2 -> Stage 0 (Recent)
  // Days >= 2 & < 4 -> Stage 1 (Friendly reminder)
  // Days >= 4 & < 7 -> Stage 2 (Urgent follow-up)
  // Days >= 7 -> Stage 3 (Final 48h warning before auto-close)
  let stage: 0 | 1 | 2 | 3 = 0;
  if (days >= 7 || (cr.reminderCount && cr.reminderCount >= 3)) {
    stage = 3;
  } else if (days >= 4 || (cr.reminderCount && cr.reminderCount >= 2)) {
    stage = 2;
  } else if (days >= 2 || (cr.reminderCount && cr.reminderCount >= 1)) {
    stage = 1;
  }

  return { hours, days, stage };
}

/**
 * Standard Enterprise Priority & SLA Reference Configuration:
 * - Critical: 24h SLA | System-wide outage, regulatory block, severe security risk.
 * - High: 3 Days (72h) | Core departmental workflow obstruction with no workaround.
 * - Medium: 7 Days (168h) | Standard process optimization or feature enhancement.
 * - Low: 14 Days (336h) | Minor UI adjustments, cosmetic corrections, or non-urgent queries.
 */
export const PRIORITY_SLA_CONFIG = {
  Critical: {
    hours: 24,
    slaLabel: '24h SLA',
    turnaround: '24 Hours',
    description: 'System-wide outage, regulatory block, severe security risk.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
  },
  High: {
    hours: 72,
    slaLabel: '3 Days',
    turnaround: '3 Days (72 Hours)',
    description: 'Core departmental workflow obstruction with no workaround.',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
  },
  Medium: {
    hours: 168,
    slaLabel: '7 Days',
    turnaround: '7 Days (168 Hours)',
    description: 'Standard process optimization or feature enhancement.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
  },
  Low: {
    hours: 336,
    slaLabel: '14 Days',
    turnaround: '14 Days (336 Hours)',
    description: 'Minor UI adjustments, cosmetic corrections, or non-urgent queries.',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-normal',
  },
} as const;

export function getPrioritySlaHours(priority?: PriorityLevel | string): number {
  switch (priority) {
    case 'Critical':
      return 24;
    case 'High':
      return 72; // 3 Days
    case 'Medium':
      return 168; // 7 Days
    case 'Low':
      return 336; // 14 Days
    default:
      return 168; // Default 7 Days
  }
}

/**
 * Calculates real-time SLA status based on request creation/stage timestamp and priority.
 */
export function calculateSlaStatus(cr: ChangeRequest): SlaInfo {
  // Target hours aligned with priority SLA
  const totalResolutionSla = cr.slaTargetHours || getPrioritySlaHours(cr.priority);

  // 1. Check if Case is currently Waiting on Requester (SLA Clock Paused)
  if (cr.status === 'Returned to Requester') {
    const clarification = getCurrentClarificationDuration(cr);
    const totalPaused = calculateTotalPausedClarificationHours(cr);

    return {
      slaStatus: 'SLA Paused',
      hoursElapsed: totalPaused,
      hoursRemaining: totalResolutionSla,
      targetHours: totalResolutionSla,
      stageName: 'Waiting on Requester',
      isPaused: true,
      pausedReason: 'SLA Clock Paused (Awaiting Requester Details)',
      chaseStage: clarification.stage,
      daysWaitingOnRequester: clarification.days,
      hoursWaitingOnRequester: clarification.hours,
      isAutoClosureEligible: clarification.days >= 7 || (cr.reminderCount ?? 0) >= 3,
    };
  }

  let targetHours = totalResolutionSla;
  let stageName = 'Resolution';

  if (cr.status === 'Pending HOD Approval') {
    targetHours = cr.priority === 'Critical' ? 4 : cr.priority === 'High' ? 24 : 48;
    stageName = 'HOD Approval';
  } else if (cr.status === 'Pending IT Admin Review') {
    targetHours = cr.priority === 'Critical' ? 4 : 24; // IT Review target
    stageName = 'IT Review';
  } else if (cr.status === 'In Progress') {
    // In Progress development SLA aligned with priority total SLA
    targetHours = totalResolutionSla;
    stageName = 'Development';
  } else if (cr.status === 'Pending IT Verification') {
    targetHours = cr.priority === 'Critical' ? 4 : 24;
    stageName = 'Verification';
  } else if (cr.status === 'Closed (Completed)' || cr.status === 'Closed (Rejected)') {
    return {
      slaStatus: 'On Track',
      hoursElapsed: 0,
      hoursRemaining: 0,
      targetHours: totalResolutionSla,
      stageName: 'Completed',
    };
  }

  // Parse creation or latest update timestamp
  const createdTime = new Date(cr.createdAt).getTime();
  const now = new Date().getTime();
  
  // Gross elapsed hours calculation
  let grossHoursElapsed = Math.floor((now - (isNaN(createdTime) ? now : createdTime)) / (1000 * 60 * 60));
  if (grossHoursElapsed < 0) grossHoursElapsed = 0;

  // Deduct historical paused clarification time so IT team is not penalized for time the requester spent replying
  const pausedClarificationHours = calculateTotalPausedClarificationHours(cr);
  let hoursElapsed = Math.max(0, grossHoursElapsed - pausedClarificationHours);

  // Modulate elapsed hours for mock simulation realism
  if (cr.id === 'IT OPS-CR-2026-00003') hoursElapsed = 54; // Breached mock example
  if (cr.id === 'IT OPS-CR-2026-00002') hoursElapsed = 20; // Nearing breach mock example

  const hoursRemaining = targetHours - hoursElapsed;

  let slaStatus: 'On Track' | 'Nearing Breach' | 'SLA Breached' | 'SLA Paused' = 'On Track';
  if (hoursRemaining <= 0) {
    slaStatus = 'SLA Breached';
  } else if (hoursRemaining <= Math.max(6, Math.round(targetHours * 0.25))) {
    slaStatus = 'Nearing Breach';
  }

  return {
    slaStatus,
    hoursElapsed,
    hoursRemaining: Math.max(0, hoursRemaining),
    targetHours,
    stageName,
    isPaused: false,
  };
}

/**
 * Calculates dynamic risk score (0-100) and risk level based on scope parameters.
 */
export function calculateRiskScore(params: {
  affectedModulesCount: number;
  priority: PriorityLevel;
  downtimeRequired: boolean;
  schemaChangeRequired: boolean;
  requestType?: string;
}): RiskInfo {
  let score = 15; // Base risk score

  // Module weight
  score += Math.min(params.affectedModulesCount * 15, 30);

  // Priority weight
  if (params.priority === 'Critical') score += 25;
  else if (params.priority === 'High') score += 15;
  else if (params.priority === 'Medium') score += 5;

  // Technical impact flags
  if (params.downtimeRequired) score += 20;
  if (params.schemaChangeRequired) score += 15;

  // Request Type impact
  if (params.requestType === 'Data Amendment') score += 10;

  score = Math.min(score, 100);

  let riskLevel: 'Low' | 'Medium' | 'High' | 'Severe' = 'Low';
  if (score >= 75) riskLevel = 'Severe';
  else if (score >= 55) riskLevel = 'High';
  else if (score >= 35) riskLevel = 'Medium';

  return {
    riskScore: score,
    riskLevel,
    downtimeRequired: !!params.downtimeRequired,
    schemaChangeRequired: !!params.schemaChangeRequired,
  };
}

export function getSlaBadgeClass(status: 'On Track' | 'Nearing Breach' | 'SLA Breached' | 'SLA Paused') {
  switch (status) {
    case 'SLA Paused':
      return 'bg-amber-50 text-amber-900 border border-amber-300 font-bold';
    case 'SLA Breached':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
    case 'Nearing Breach':
      return 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200 font-medium';
  }
}

export function getRiskBadgeClass(level: 'Low' | 'Medium' | 'High' | 'Severe') {
  switch (level) {
    case 'Severe':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
    case 'High':
      return 'bg-orange-50 text-orange-800 border border-orange-200 font-semibold';
    case 'Medium':
      return 'bg-slate-100 text-slate-700 border border-slate-200 font-medium';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200 font-normal';
  }
}
