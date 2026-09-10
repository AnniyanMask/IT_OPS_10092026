import { TemporaryApproverDelegation, UserProfile } from '../types';

/**
 * Checks if a delegation record is currently within its valid time frame and not revoked.
 */
export function isDelegationActive(delegation: TemporaryApproverDelegation, currentDate = new Date()): boolean {
  if (delegation.status === 'Revoked') return false;

  const now = currentDate.getTime();
  
  // Format check: startDate can be 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'
  const start = new Date(delegation.startDate).getTime();
  // For end date if only date is provided, treat as 23:59:59 of that day
  let end = new Date(delegation.endDate).getTime();
  if (delegation.endDate.length === 10) {
    const endOfDay = new Date(`${delegation.endDate}T23:59:59`);
    end = endOfDay.getTime();
  }

  return now >= start && now <= end;
}

/**
 * Returns calculated status ('Active', 'Expired', or 'Revoked') based on time frame
 */
export function getDelegationCurrentStatus(
  delegation: TemporaryApproverDelegation,
  currentDate = new Date()
): 'Active' | 'Expired' | 'Revoked' {
  if (delegation.status === 'Revoked') return 'Revoked';
  if (isDelegationActive(delegation, currentDate)) return 'Active';
  
  const now = currentDate.getTime();
  const start = new Date(delegation.startDate).getTime();
  if (now < start) {
    // Scheduled future
    return 'Active';
  }
  return 'Expired';
}

export interface UserDelegationContext {
  isHod: boolean;
  hasActiveDelegation: boolean;
  activeDelegation?: TemporaryApproverDelegation;
  hasExpiredDelegation: boolean;
  expiredDelegations: TemporaryApproverDelegation[];
  canAccessHodQueue: boolean;
  canExecuteApproval: boolean;
  isReadOnly: boolean;
  effectiveDepartmentId: number;
  effectiveDepartmentName: string;
  delegatedByHodName?: string;
  delegatedByHodEmail?: string;
}

/**
 * Evaluates whether a user has active or expired HOD delegations and what permissions they hold.
 */
export function getUserDelegationContext(
  user: UserProfile,
  delegations: TemporaryApproverDelegation[],
  currentDate = new Date()
): UserDelegationContext {
  const isHod = user.role === 'Department HOD';
  const isSysAdmin = user.role === 'System Admin';

  if (isHod || isSysAdmin) {
    return {
      isHod: true,
      hasActiveDelegation: false,
      hasExpiredDelegation: false,
      expiredDelegations: [],
      canAccessHodQueue: true,
      canExecuteApproval: true,
      isReadOnly: false,
      effectiveDepartmentId: user.departmentId,
      effectiveDepartmentName: user.departmentName,
    };
  }

  // Find delegations assigned to this user
  const userDelegations = delegations.filter((d) => d.delegateUserId === user.id);
  
  // Find any active delegation for current time
  const activeDelegation = userDelegations.find((d) => isDelegationActive(d, currentDate));

  // Find expired delegations (past time frame and not revoked)
  const expiredDelegations = userDelegations.filter(
    (d) => d.status !== 'Revoked' && !isDelegationActive(d, currentDate) && new Date(d.endDate).getTime() < currentDate.getTime()
  );

  if (activeDelegation) {
    return {
      isHod: false,
      hasActiveDelegation: true,
      activeDelegation,
      hasExpiredDelegation: expiredDelegations.length > 0,
      expiredDelegations,
      canAccessHodQueue: true,
      canExecuteApproval: true,
      isReadOnly: false,
      effectiveDepartmentId: activeDelegation.departmentId,
      effectiveDepartmentName: activeDelegation.departmentName,
      delegatedByHodName: activeDelegation.hodName,
      delegatedByHodEmail: activeDelegation.hodEmail,
    };
  }

  if (expiredDelegations.length > 0) {
    const mostRecentExpired = expiredDelegations[0];
    return {
      isHod: false,
      hasActiveDelegation: false,
      hasExpiredDelegation: true,
      expiredDelegations,
      canAccessHodQueue: true,
      canExecuteApproval: false,
      isReadOnly: true,
      effectiveDepartmentId: mostRecentExpired.departmentId,
      effectiveDepartmentName: mostRecentExpired.departmentName,
      delegatedByHodName: mostRecentExpired.hodName,
      delegatedByHodEmail: mostRecentExpired.hodEmail,
    };
  }

  return {
    isHod: false,
    hasActiveDelegation: false,
    hasExpiredDelegation: false,
    expiredDelegations: [],
    canAccessHodQueue: false,
    canExecuteApproval: false,
    isReadOnly: false,
    effectiveDepartmentId: user.departmentId,
    effectiveDepartmentName: user.departmentName,
  };
}

/**
 * Returns human-readable days/hours remaining in a delegation window.
 */
export function getDaysRemainingInDelegation(delegation: TemporaryApproverDelegation, currentDate = new Date()): string {
  let end = new Date(delegation.endDate).getTime();
  if (delegation.endDate.length === 10) {
    end = new Date(`${delegation.endDate}T23:59:59`).getTime();
  }
  const now = currentDate.getTime();
  const diffMs = end - now;

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h remaining` : `${diffDays} day(s) remaining`;
  }

  return `${diffHours} hour(s) remaining`;
}

