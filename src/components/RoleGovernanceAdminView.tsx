import React, { useState, useEffect } from 'react';
import { CustomRoleDefinition, UserProfile, UserRole } from '../types';
import { baselineCustomRoles } from '../data/db';
import { api } from '../services/api';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Users,
  Mail,
  GitBranch,
  Lock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Info,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Database,
  Layers,
  ArrowRight,
  UserCheck,
  Code2,
  Kanban,
  FileText,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

interface RoleGovernanceAdminViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  onRoleCreatedOrUpdated?: (role: CustomRoleDefinition) => void;
}

export const RoleGovernanceAdminView: React.FC<RoleGovernanceAdminViewProps> = ({
  currentUser,
  users,
  onRoleCreatedOrUpdated,
}) => {
  const [roles, setRoles] = useState<CustomRoleDefinition[]>(baselineCustomRoles);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleDefinition | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [archetype, setArchetype] = useState<CustomRoleDefinition['archetype']>('Custom');
  const [description, setDescription] = useState('');
  
  // Permissions Form State
  const [permissions, setPermissions] = useState<CustomRoleDefinition['permissions']>({
    canViewMyRequests: true,
    canViewHodQueue: false,
    canViewItAdminWorkspace: false,
    canViewDeveloperBoard: false,
    canViewClosedCases: false,
    canViewReports: true,
    canViewAdminHub: false,
    canViewEmailHub: false,
    canViewDeviceOut: false,
    canApproveHodStage: false,
    canTriageAndAssignDevs: false,
    canReturnToRequester: false,
    canDirectModifyCatalog: false,
    canVerifyRelease: false,
    canReopenCases: false,
    canManageUsers: false,
  });

  // Workflow Routing Form State
  const [workflowRouting, setWorkflowRouting] = useState<CustomRoleDefinition['workflowRouting']>({
    receivesHodReview: false,
    receivesItAdminReview: false,
    canBeAssignedAsDeveloper: false,
    receivesCriticalEscalations: false,
  });

  // Email Subscriptions Form State
  const [emailSubscriptions, setEmailSubscriptions] = useState<CustomRoleDefinition['emailSubscriptions']>({
    notifyNewSubmissions: false,
    notifyClarificationReplies: true,
    notifyStatusTransitions: true,
    notifyReleaseVerifications: false,
    notifyUserRegistrations: false,
    notifyDelegations: false,
  });

  // Load custom roles from PostgreSQL API on mount
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomRoles();
      if (res.success && res.data && res.data.length > 0) {
        setRoles(res.data);
      } else {
        // Fallback to baseline roles with live user count calculation
        const mapped = baselineCustomRoles.map((r) => ({
          ...r,
          userCount: users.filter((u) => u.role === r.roleName).length,
        }));
        setRoles(mapped);
      }
    } catch (err) {
      console.warn('[Custom Roles Load Notice]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [users]);

  // Archetype Presets
  const applyArchetypePreset = (selectedArchetype: CustomRoleDefinition['archetype']) => {
    setArchetype(selectedArchetype);
    switch (selectedArchetype) {
      case 'Requester':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: false,
          canViewItAdminWorkspace: false,
          canViewDeveloperBoard: false,
          canViewClosedCases: false,
          canViewReports: false,
          canViewAdminHub: false,
          canViewEmailHub: false,
          canViewDeviceOut: false,
          canApproveHodStage: false,
          canTriageAndAssignDevs: false,
          canReturnToRequester: false,
          canDirectModifyCatalog: false,
          canVerifyRelease: false,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: false,
          receivesItAdminReview: false,
          canBeAssignedAsDeveloper: false,
          receivesCriticalEscalations: false,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: true,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: false,
          notifyDelegations: false,
        });
        break;

      case 'Department HOD':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: true,
          canViewItAdminWorkspace: false,
          canViewDeveloperBoard: false,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: false,
          canViewEmailHub: false,
          canViewDeviceOut: false,
          canApproveHodStage: true,
          canTriageAndAssignDevs: false,
          canReturnToRequester: true,
          canDirectModifyCatalog: false,
          canVerifyRelease: false,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: true,
          receivesItAdminReview: false,
          canBeAssignedAsDeveloper: false,
          receivesCriticalEscalations: false,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: true,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: false,
          notifyDelegations: true,
        });
        break;

      case 'IT Helpdesk':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: false,
          canViewItAdminWorkspace: true,
          canViewDeveloperBoard: true,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: false,
          canViewEmailHub: true,
          canViewDeviceOut: true,
          canApproveHodStage: false,
          canTriageAndAssignDevs: true,
          canReturnToRequester: true,
          canDirectModifyCatalog: true,
          canVerifyRelease: true,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: false,
          receivesItAdminReview: true,
          canBeAssignedAsDeveloper: false,
          receivesCriticalEscalations: true,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: true,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: true,
          notifyDelegations: true,
        });
        break;

      case 'IT Admin':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: false,
          canViewItAdminWorkspace: true,
          canViewDeveloperBoard: true,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: false,
          canViewEmailHub: true,
          canViewDeviceOut: true,
          canApproveHodStage: false,
          canTriageAndAssignDevs: true,
          canReturnToRequester: true,
          canDirectModifyCatalog: true,
          canVerifyRelease: true,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: false,
          receivesItAdminReview: true,
          canBeAssignedAsDeveloper: true,
          receivesCriticalEscalations: true,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: true,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: true,
          notifyDelegations: true,
        });
        break;

      case 'Software Developer':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: false,
          canViewItAdminWorkspace: false,
          canViewDeveloperBoard: true,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: false,
          canViewEmailHub: false,
          canViewDeviceOut: false,
          canApproveHodStage: false,
          canTriageAndAssignDevs: false,
          canReturnToRequester: true,
          canDirectModifyCatalog: false,
          canVerifyRelease: false,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: false,
          receivesItAdminReview: false,
          canBeAssignedAsDeveloper: true,
          receivesCriticalEscalations: false,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: false,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: false,
          notifyDelegations: false,
        });
        break;

      case 'System Admin':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: true,
          canViewItAdminWorkspace: true,
          canViewDeveloperBoard: true,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: true,
          canViewEmailHub: true,
          canViewDeviceOut: true,
          canApproveHodStage: true,
          canTriageAndAssignDevs: true,
          canReturnToRequester: true,
          canDirectModifyCatalog: true,
          canVerifyRelease: true,
          canReopenCases: true,
          canManageUsers: true,
        });
        setWorkflowRouting({
          receivesHodReview: true,
          receivesItAdminReview: true,
          canBeAssignedAsDeveloper: true,
          receivesCriticalEscalations: true,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: true,
          notifyClarificationReplies: true,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: true,
          notifyUserRegistrations: true,
          notifyDelegations: true,
        });
        break;

      case 'Auditor':
        setPermissions({
          canViewMyRequests: true,
          canViewHodQueue: true,
          canViewItAdminWorkspace: true,
          canViewDeveloperBoard: true,
          canViewClosedCases: true,
          canViewReports: true,
          canViewAdminHub: false,
          canViewEmailHub: true,
          canViewDeviceOut: false,
          canApproveHodStage: false,
          canTriageAndAssignDevs: false,
          canReturnToRequester: false,
          canDirectModifyCatalog: false,
          canVerifyRelease: false,
          canReopenCases: false,
          canManageUsers: false,
        });
        setWorkflowRouting({
          receivesHodReview: false,
          receivesItAdminReview: false,
          canBeAssignedAsDeveloper: false,
          receivesCriticalEscalations: false,
        });
        setEmailSubscriptions({
          notifyNewSubmissions: false,
          notifyClarificationReplies: false,
          notifyStatusTransitions: true,
          notifyReleaseVerifications: false,
          notifyUserRegistrations: false,
          notifyDelegations: false,
        });
        break;

      default:
        // Keep custom state
        break;
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setRoleName('');
    setArchetype('Custom');
    setDescription('');
    applyArchetypePreset('Requester');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (role: CustomRoleDefinition) => {
    setEditingRole(role);
    setRoleName(role.roleName);
    setArchetype(role.archetype);
    setDescription(role.description || '');
    setPermissions({
      canViewDeviceOut: false,
      ...(role.permissions || {}),
    });
    setWorkflowRouting(role.workflowRouting);
    setEmailSubscriptions(role.emailSubscriptions);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setErrorMessage('Role Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload: Partial<CustomRoleDefinition> = {
      roleName: roleName.trim(),
      archetype,
      description: description.trim(),
      permissions,
      workflowRouting,
      emailSubscriptions,
    };

    try {
      if (editingRole) {
        // Update existing role
        const res = await api.updateCustomRole(editingRole.id, payload);
        if (!res.success) {
          throw new Error(res.message || 'Failed to update role in database.');
        }
        setSuccessMessage(`✓ Role "${roleName}" permissions and routing matrix successfully updated.`);
        if (res.data && onRoleCreatedOrUpdated) onRoleCreatedOrUpdated(res.data);
      } else {
        // Create new role
        const res = await api.createCustomRole(payload);
        if (!res.success) {
          throw new Error(res.message || 'Failed to create new role in database.');
        }
        setSuccessMessage(`✓ Custom Role "${roleName}" successfully created and synced to governance engine.`);
        if (res.data && onRoleCreatedOrUpdated) onRoleCreatedOrUpdated(res.data);
      }

      setIsModalOpen(false);
      await fetchRoles();
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (role: CustomRoleDefinition) => {
    if (role.isSystemRole) {
      alert(`Role "${role.roleName}" is a core system role and cannot be deleted.`);
      return;
    }

    const assignedCount = users.filter((u) => u.role === role.roleName).length;
    if (assignedCount > 0) {
      alert(`Cannot delete role "${role.roleName}" because ${assignedCount} user(s) are currently assigned to it. Please reassign those users to a different role first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete the custom role "${role.roleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await api.deleteCustomRole(role.id);
      if (!res.success) {
        throw new Error(res.message || 'Failed to delete role.');
      }
      setSuccessMessage(`✓ Custom Role "${role.roleName}" successfully deleted.`);
      await fetchRoles();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Filter roles
  const filteredRoles = roles.filter((r) => {
    const matchesSearch =
      r.roleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.archetype.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'SYSTEM') return r.isSystemRole;
    if (filterType === 'CUSTOM') return !r.isSystemRole;
    return true;
  });

  const totalRolesCount = roles.length;
  const systemRolesCount = roles.filter((r) => r.isSystemRole).length;
  const customRolesCount = roles.filter((r) => !r.isSystemRole).length;
  const totalAssignedUsers = users.length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Custom Role Builder & Automated Governance Matrix
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define organizational roles, configure view access controls, automated workflow routing rules, and email trigger subscriptions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 self-start sm:self-auto">
            <button
              onClick={fetchRoles}
              disabled={loading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Refresh Roles from Database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Role</span>
            </button>
          </div>
        </div>

        {/* Success / Error Banners */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-900 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Roles</span>
              <span className="text-lg font-extrabold text-slate-900">{totalRolesCount}</span>
            </div>
            <Shield className="w-5 h-5 text-slate-400" />
          </div>

          <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-700 block">System Roles</span>
              <span className="text-lg font-extrabold text-blue-950">{systemRolesCount}</span>
            </div>
            <Lock className="w-5 h-5 text-blue-500" />
          </div>

          <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-purple-700 block">Custom Roles</span>
              <span className="text-lg font-extrabold text-purple-950">{customRolesCount}</span>
            </div>
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Active Users</span>
              <span className="text-lg font-extrabold text-emerald-950">{totalAssignedUsers}</span>
            </div>
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by role name, description, or archetype..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalRolesCount})
            </button>
            <button
              onClick={() => setFilterType('SYSTEM')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'SYSTEM' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              System Protected ({systemRolesCount})
            </button>
            <button
              onClick={() => setFilterType('CUSTOM')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'CUSTOM' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Roles ({customRolesCount})
            </button>
          </div>
        </div>

        {/* Roles Matrix Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {filteredRoles.map((role) => {
            const userCount = users.filter((u) => u.role === role.roleName).length;
            const p = role.permissions || {};
            const wr = role.workflowRouting || {};
            const em = role.emailSubscriptions || {};

            return (
              <div
                key={role.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 shadow-2xs ${
                  role.isSystemRole
                    ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    : 'bg-white border-purple-200/90 hover:border-purple-300 hover:shadow-xs'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{role.roleName}</span>
                        {role.isSystemRole ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full flex items-center space-x-1">
                            <Lock className="w-3 h-3" />
                            <span>System</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full flex items-center space-x-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Custom</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 block">
                        Archetype: <strong className="text-slate-700">{role.archetype}</strong>
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 shrink-0">
                      {userCount} User{userCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {role.description || 'No description provided for this role.'}
                  </p>
                </div>

                {/* Permissions Snapshot Tags */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Workspace Access & Views
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {p.canViewMyRequests && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium border border-blue-200">
                          My Requests
                        </span>
                      )}
                      {p.canViewHodQueue && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-medium border border-amber-200">
                          HOD Queue
                        </span>
                      )}
                      {p.canViewItAdminWorkspace && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium border border-indigo-200">
                          IT Workspace
                        </span>
                      )}
                      {p.canViewDeveloperBoard && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium border border-emerald-200">
                          Task Board
                        </span>
                      )}
                      {p.canViewClosedCases && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                          Closed
                        </span>
                      )}
                      {p.canViewAdminHub && (
                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-medium border border-rose-200">
                          Admin Hub
                        </span>
                      )}
                      {p.canViewEmailHub && (
                        <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-medium border border-sky-200">
                          Email Hub
                        </span>
                      )}
                      {p.canViewDeviceOut && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium border border-indigo-200">
                          Device Out
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Workflow & Email Tags */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[9px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                        <GitBranch className="w-3 h-3 text-slate-500" />
                        <span>Workflow Routing</span>
                      </span>
                      <div className="mt-1 space-y-0.5 text-[10px] text-slate-700">
                        <div>HOD Stage: <strong>{wr.receivesHodReview ? 'Yes' : 'No'}</strong></div>
                        <div>IT Stage: <strong>{wr.receivesItAdminReview ? 'Yes' : 'No'}</strong></div>
                        <div>Dev Assignable: <strong>{wr.canBeAssignedAsDeveloper ? 'Yes' : 'No'}</strong></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[9px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>Email Alerts</span>
                      </span>
                      <div className="mt-1 space-y-0.5 text-[10px] text-slate-700">
                        <div>New Tickets: <strong>{em.notifyNewSubmissions ? 'Active' : 'Off'}</strong></div>
                        <div>Clarifications: <strong>{em.notifyClarificationReplies ? 'Active' : 'Off'}</strong></div>
                        <div>Transitions: <strong>{em.notifyStatusTransitions ? 'Active' : 'Off'}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEditModal(role)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Configure Matrix</span>
                  </button>

                  {!role.isSystemRole && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Custom Role"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Creation / Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingRole ? `Configure Role: ${editingRole.roleName}` : 'Create New Custom Role'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Set permissions matrix, operational workflow routes, and automated email subscriptions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-semibold text-rose-900 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Role General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Role Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Senior IT Engineer, Compliance Officer"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Base Archetype / Template
                  </label>
                  <select
                    value={archetype}
                    onChange={(e) => applyArchetypePreset(e.target.value as CustomRoleDefinition['archetype'])}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Requester">Requester (Standard User)</option>
                    <option value="Department HOD">Department HOD (Approver)</option>
                    <option value="IT Helpdesk">IT Helpdesk (Support/Triage)</option>
                    <option value="IT Admin">IT Admin (Lead Operator)</option>
                    <option value="Software Developer">Software Developer (Engineer)</option>
                    <option value="System Admin">System Admin (Full Super Admin)</option>
                    <option value="Auditor">Auditor (Compliance/Read-Only)</option>
                    <option value="Custom">Custom Customization</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Role Purpose & Operational Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe the operational responsibilities and authority of users assigned to this role..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Section 1: Navigation & Workspace Access */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    1. Workspace & View Access Permissions
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewMyRequests}
                      onChange={(e) => setPermissions({ ...permissions, canViewMyRequests: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">My Requests</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewHodQueue}
                      onChange={(e) => setPermissions({ ...permissions, canViewHodQueue: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">HOD Approval Queue</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewItAdminWorkspace}
                      onChange={(e) => setPermissions({ ...permissions, canViewItAdminWorkspace: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">IT Admin Workspace</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewDeveloperBoard}
                      onChange={(e) => setPermissions({ ...permissions, canViewDeveloperBoard: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Task Board (Dev)</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewClosedCases}
                      onChange={(e) => setPermissions({ ...permissions, canViewClosedCases: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Closed Cases Archive</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewReports}
                      onChange={(e) => setPermissions({ ...permissions, canViewReports: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Reports & Export</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewAdminHub}
                      onChange={(e) => setPermissions({ ...permissions, canViewAdminHub: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">System Admin Hub</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewEmailHub}
                      onChange={(e) => setPermissions({ ...permissions, canViewEmailHub: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Email Notification Hub</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewDeviceOut}
                      onChange={(e) => setPermissions({ ...permissions, canViewDeviceOut: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Bring Device Out Management</span>
                  </label>
                </div>
              </div>

              {/* Section 2: Ticket Operational Actions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    2. Ticket Operational Authority & Governance
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canApproveHodStage}
                      onChange={(e) => setPermissions({ ...permissions, canApproveHodStage: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Approve HOD Stage</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canTriageAndAssignDevs}
                      onChange={(e) => setPermissions({ ...permissions, canTriageAndAssignDevs: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Triage & Assign Devs</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canReturnToRequester}
                      onChange={(e) => setPermissions({ ...permissions, canReturnToRequester: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Return for Clarification</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canDirectModifyCatalog}
                      onChange={(e) => setPermissions({ ...permissions, canDirectModifyCatalog: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Direct Modify Metadata</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canVerifyRelease}
                      onChange={(e) => setPermissions({ ...permissions, canVerifyRelease: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Verify Production Release</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canManageUsers}
                      onChange={(e) => setPermissions({ ...permissions, canManageUsers: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Manage User Accounts</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Workflow Routing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <GitBranch className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    3. Automated Workflow Routing Rules
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workflowRouting.receivesHodReview}
                      onChange={(e) => setWorkflowRouting({ ...workflowRouting, receivesHodReview: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-slate-900 block">Receives HOD Stage Review</span>
                      <span className="text-[10px] text-slate-500">Tickets route to this role during department approval stage</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workflowRouting.receivesItAdminReview}
                      onChange={(e) => setWorkflowRouting({ ...workflowRouting, receivesItAdminReview: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-slate-900 block">Receives IT Admin Review</span>
                      <span className="text-[10px] text-slate-500">Tickets route to this role during IT triage & review stage</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workflowRouting.canBeAssignedAsDeveloper}
                      onChange={(e) => setWorkflowRouting({ ...workflowRouting, canBeAssignedAsDeveloper: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-slate-900 block">Eligible Developer Assignee</span>
                      <span className="text-[10px] text-slate-500">Users in this role appear in developer assignment dropdowns</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workflowRouting.receivesCriticalEscalations}
                      onChange={(e) => setWorkflowRouting({ ...workflowRouting, receivesCriticalEscalations: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-slate-900 block">Critical Escalation Broadcast</span>
                      <span className="text-[10px] text-slate-500">Alerted immediately when high/critical tickets breach SLA</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 4: Automated Email Notifications */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Mail className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    4. Automated Email Notification Subscriptions
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyNewSubmissions}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyNewSubmissions: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">New Submissions</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyClarificationReplies}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyClarificationReplies: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Clarification Replies</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyStatusTransitions}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyStatusTransitions: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Status Transitions</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyReleaseVerifications}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyReleaseVerifications: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Release Verifications</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyUserRegistrations}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyUserRegistrations: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">New User Sign-ups</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSubscriptions.notifyDelegations}
                      onChange={(e) => setEmailSubscriptions({ ...emailSubscriptions, notifyDelegations: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-800">Approver Delegations</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Role Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
