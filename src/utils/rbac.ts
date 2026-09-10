import { CustomRoleDefinition, UserRole, UserProfile } from '../types';

/**
 * Standard default fallback permissions if dynamic roles are not loaded
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<CustomRoleDefinition['permissions']>> = {
  'IT Admin': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: true,
    canViewHodQueue: true,
    canViewDeveloperBoard: true,
    canViewClosedCases: true,
    canViewReports: true,
    canViewAdminHub: true,
    canViewEmailHub: true,
    canViewDeviceOut: true,
    canTriageAndAssignDevs: true,
    canDirectModifyCatalog: true,
    canApproveHodStage: true,
    canVerifyRelease: true,
    canReopenCases: true,
    canReturnToRequester: true,
    canManageUsers: true,
  },
  'System Admin': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: true,
    canViewHodQueue: true,
    canViewDeveloperBoard: true,
    canViewClosedCases: true,
    canViewReports: true,
    canViewAdminHub: true,
    canViewEmailHub: true,
    canViewDeviceOut: true,
    canTriageAndAssignDevs: true,
    canDirectModifyCatalog: true,
    canApproveHodStage: true,
    canVerifyRelease: true,
    canReopenCases: true,
    canReturnToRequester: true,
    canManageUsers: true,
  },
  'IT Helpdesk': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: true,
    canViewHodQueue: false,
    canViewDeveloperBoard: false,
    canViewClosedCases: true,
    canViewReports: false,
    canViewAdminHub: false,
    canViewEmailHub: false,
    canViewDeviceOut: true,
    canTriageAndAssignDevs: true,
    canDirectModifyCatalog: false,
    canApproveHodStage: false,
    canVerifyRelease: false,
    canReopenCases: true,
    canReturnToRequester: true,
    canManageUsers: false,
  },
  'Head of Department (HOD)': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: false,
    canViewHodQueue: true,
    canViewDeveloperBoard: false,
    canViewClosedCases: true,
    canViewReports: true,
    canViewAdminHub: false,
    canViewEmailHub: false,
    canViewDeviceOut: false,
    canTriageAndAssignDevs: false,
    canDirectModifyCatalog: false,
    canApproveHodStage: true,
    canVerifyRelease: false,
    canReopenCases: false,
    canReturnToRequester: true,
    canManageUsers: false,
  },
  'Software Developer': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: false,
    canViewHodQueue: false,
    canViewDeveloperBoard: true,
    canViewClosedCases: true,
    canViewReports: false,
    canViewAdminHub: false,
    canViewEmailHub: false,
    canViewDeviceOut: false,
    canTriageAndAssignDevs: false,
    canDirectModifyCatalog: false,
    canApproveHodStage: false,
    canVerifyRelease: false,
    canReopenCases: false,
    canReturnToRequester: false,
    canManageUsers: false,
  },
  'Requester': {
    canViewMyRequests: true,
    canViewItAdminWorkspace: false,
    canViewHodQueue: false,
    canViewDeveloperBoard: false,
    canViewClosedCases: true,
    canViewReports: false,
    canViewAdminHub: false,
    canViewEmailHub: false,
    canViewDeviceOut: false,
    canTriageAndAssignDevs: false,
    canDirectModifyCatalog: false,
    canApproveHodStage: false,
    canVerifyRelease: false,
    canReopenCases: false,
    canReturnToRequester: false,
    canManageUsers: false,
  },
};

/**
 * Checks if a given user role has a specific capability permission
 */
export function hasRolePermission(
  roleName: UserRole | string | undefined,
  permKey: keyof CustomRoleDefinition['permissions'],
  customRoles: CustomRoleDefinition[] = []
): boolean {
  if (!roleName) return false;
  
  // Look in custom dynamic roles first
  const matchedRole = customRoles.find(
    (r) => r.roleName.trim().toLowerCase() === roleName.trim().toLowerCase()
  );
  if (matchedRole && matchedRole.permissions && typeof matchedRole.permissions[permKey] === 'boolean') {
    return matchedRole.permissions[permKey];
  }

  // Fallback to static defaults
  const fallback = DEFAULT_ROLE_PERMISSIONS[roleName];
  if (fallback && typeof fallback[permKey] === 'boolean') {
    return fallback[permKey] as boolean;
  }

  // Requester default
  return false;
}

/**
 * Checks if a given user role has a specific workflow routing rule
 */
export function matchesWorkflowRouting(
  roleName: UserRole | string | undefined,
  routingKey: keyof CustomRoleDefinition['workflowRouting'],
  customRoles: CustomRoleDefinition[] = []
): boolean {
  if (!roleName) return false;

  const matchedRole = customRoles.find(
    (r) => r.roleName.trim().toLowerCase() === roleName.trim().toLowerCase()
  );
  if (matchedRole && matchedRole.workflowRouting && typeof matchedRole.workflowRouting[routingKey] === 'boolean') {
    return matchedRole.workflowRouting[routingKey];
  }

  // Fallback defaults
  if (routingKey === 'canBeAssignedAsDeveloper') {
    const roleLower = roleName.trim().toLowerCase();
    return (
      roleLower === 'software developer' ||
      roleLower === 'it admin' ||
      roleLower === 'it helpdesk' ||
      roleLower === 'system admin' ||
      roleLower.includes('developer') ||
      roleLower.includes('helpdesk') ||
      roleLower.includes('it ') ||
      roleLower.includes('engineer') ||
      roleLower.includes('specialist')
    );
  }
  if (routingKey === 'receivesHodReview') {
    return roleName === 'Head of Department (HOD)';
  }
  if (routingKey === 'receivesItAdminReview') {
    return roleName === 'IT Admin' || roleName === 'IT Helpdesk' || roleName === 'System Admin';
  }
  if (routingKey === 'receivesCriticalEscalations') {
    return roleName === 'IT Admin' || roleName === 'System Admin' || roleName === 'IT Helpdesk';
  }

  return false;
}

/**
 * Checks if a given user belongs to the IT department or holds an IT/technical operational role.
 * Ensures ANY user/position registered under the IT department (or custom IT roles) is recognized.
 */
export function isItUserOrDepartment(
  user: UserProfile | null | undefined,
  customRoles: CustomRoleDefinition[] = []
): boolean {
  if (!user) return false;

  // 1. Department Check: Any user registered under IT department (by ID 8 or department name)
  const deptName = (user.departmentName || '').trim().toLowerCase();
  if (
    deptName === 'it' ||
    deptName === 'information technology' ||
    deptName.includes('information tech') ||
    deptName.startsWith('it') ||
    user.departmentId === 8
  ) {
    return true;
  }

  // 2. Standard IT Roles check
  const roleLower = (user.role || '').trim().toLowerCase();
  const standardItRoles = [
    'software developer',
    'it admin',
    'system admin',
    'it helpdesk',
    'it support',
    'developer',
    'it engineer',
    'it specialist',
    'qa engineer',
    'database administrator',
    'network engineer',
  ];
  if (standardItRoles.includes(roleLower)) {
    return true;
  }

  // 3. Custom Role Routing or Permissions
  if (matchesWorkflowRouting(user.role, 'canBeAssignedAsDeveloper', customRoles)) {
    return true;
  }

  const matchedCustomRole = customRoles.find(
    (r) => r.roleName.trim().toLowerCase() === roleLower
  );
  if (matchedCustomRole) {
    if (matchedCustomRole.workflowRouting?.canBeAssignedAsDeveloper) return true;
    if (
      matchedCustomRole.permissions?.canViewItAdminWorkspace ||
      matchedCustomRole.permissions?.canViewDeveloperBoard ||
      matchedCustomRole.permissions?.canTriageAndAssignDevs ||
      matchedCustomRole.permissions?.canVerifyRelease
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a given user role is subscribed to an automated email event
 */
export function hasEmailSubscription(
  roleName: UserRole | string | undefined,
  subKey: keyof CustomRoleDefinition['emailSubscriptions'],
  customRoles: CustomRoleDefinition[] = []
): boolean {
  if (!roleName) return false;

  const matchedRole = customRoles.find(
    (r) => r.roleName.trim().toLowerCase() === roleName.trim().toLowerCase()
  );
  if (matchedRole && matchedRole.emailSubscriptions && typeof matchedRole.emailSubscriptions[subKey] === 'boolean') {
    return matchedRole.emailSubscriptions[subKey];
  }

  // Default fallback subscriptions
  if (subKey === 'notifyNewSubmissions') {
    return roleName === 'IT Admin' || roleName === 'Head of Department (HOD)' || roleName === 'IT Helpdesk' || roleName === 'System Admin';
  }
  if (subKey === 'notifyStatusTransitions') {
    return true; // All roles typically get status notifications for tickets they are part of
  }
  if (subKey === 'notifyClarificationReplies') {
    return true;
  }
  if (subKey === 'notifyReleaseVerifications') {
    return roleName === 'IT Admin' || roleName === 'Software Developer' || roleName === 'System Admin' || roleName === 'IT Helpdesk';
  }
  if (subKey === 'notifyUserRegistrations') {
    return roleName === 'IT Admin' || roleName === 'System Admin';
  }
  if (subKey === 'notifyDelegations') {
    return roleName === 'Head of Department (HOD)' || roleName === 'IT Admin' || roleName === 'System Admin';
  }

  return false;
}

/**
 * Returns all active users who are eligible to be assigned as Developers/Assignees in IT Queue & Workload.
 * Accurately includes ANY user/position registered under the IT department, IT Helpdesk, 
 * Software Developers, System Admins, and all customized IT roles.
 */
export function getEligibleDevelopers(
  users: UserProfile[],
  customRoles: CustomRoleDefinition[] = []
): UserProfile[] {
  return users.filter((u) => {
    // Exclude suspended or pending approval users
    if (u.status && u.status !== 'Active') {
      return false;
    }
    return isItUserOrDepartment(u, customRoles);
  });
}
