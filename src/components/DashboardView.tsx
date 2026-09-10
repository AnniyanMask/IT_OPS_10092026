import React from 'react';
import { UserProfile, ChangeRequest, TemporaryApproverDelegation } from '../types';
import { getUserDelegationContext } from '../utils/delegationUtils';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Code,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Zap,
  Lock,
  Edit,
} from 'lucide-react';

interface DashboardViewProps {
  currentUser: UserProfile;
  changeRequests: ChangeRequest[];
  onNavigateTab: (tab: string) => void;
  onRequestClick: (crId: string) => void;
  onEditRequest?: (cr: ChangeRequest) => void;
  onCreateNewRequest: () => void;
  delegations?: TemporaryApproverDelegation[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  changeRequests,
  onNavigateTab,
  onRequestClick,
  onEditRequest,
  onCreateNewRequest,
  delegations = [],
}) => {
  const delegationCtx = getUserDelegationContext(currentUser, delegations);

  // Compute KPI metrics
  const totalRequests = changeRequests.length;
  
  const myRequests = changeRequests.filter((cr) => {
    return (
      Boolean(cr.requesterId && currentUser.id && cr.requesterId.toLowerCase() === currentUser.id.toLowerCase()) ||
      Boolean(cr.requesterEmail && currentUser.email && cr.requesterEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
      Boolean(cr.requesterName && currentUser.fullName && cr.requesterName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase())
    );
  });
  
  const effectiveDeptId = delegationCtx.effectiveDepartmentId || currentUser.departmentId;

  const pendingHodQueue = changeRequests.filter(
    (cr) => cr.departmentId === effectiveDeptId && cr.status === 'Pending HOD Approval'
  );

  const pendingItQueue = changeRequests.filter((cr) => cr.status === 'Pending IT Admin Review');

  const assignedToDev = changeRequests.filter(
    (cr) => cr.assignedDeveloperId === currentUser.id && cr.status === 'In Progress'
  );

  const pendingItVerification = changeRequests.filter((cr) => cr.status === 'Pending IT Verification');

  const closedCompleted = changeRequests.filter((cr) => cr.status === 'Closed (Completed)');

  const criticalOpen = changeRequests.filter(
    (cr) => cr.priority === 'Critical' && cr.status !== 'Closed (Completed)' && cr.status !== 'Closed (Rejected)'
  );

  // Status breakdown totals
  const statusCounts = {
    Draft: changeRequests.filter((cr) => cr.status === 'Draft').length,
    'Pending HOD Approval': changeRequests.filter((cr) => cr.status === 'Pending HOD Approval').length,
    'Pending IT Admin Review': changeRequests.filter((cr) => cr.status === 'Pending IT Admin Review').length,
    'In Progress': changeRequests.filter((cr) => cr.status === 'In Progress').length,
    'Pending IT Verification': changeRequests.filter((cr) => cr.status === 'Pending IT Verification').length,
    'Closed (Completed)': closedCompleted.length,
    'Returned / Rejected': changeRequests.filter(
      (cr) => cr.status === 'Returned to Requester' || cr.status === 'Closed (Rejected)'
    ).length,
  };

  // Helper for status pill dots
  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Closed (Completed)':
        return 'dot-green';
      case 'In Progress':
        return 'dot-orange';
      case 'Pending IT Verification':
        return 'dot-purple';
      case 'Pending IT Admin Review':
      case 'Pending HOD Approval':
        return 'dot-blue';
      case 'Closed (Rejected)':
      case 'Returned to Requester':
        return 'dot-red';
      default:
        return 'dot-amber';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'badge-critical';
      case 'High':
        return 'badge-high';
      case 'Medium':
        return 'badge-medium';
      default:
        return 'badge-low';
    }
  };

  return (
    <div className="space-y-6">
      {/* Sleek Welcome Banner Card */}
      {currentUser.role !== 'Software Developer' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {currentUser.role !== 'Requester' && (
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                  Role: {currentUser.role}
                </span>
                <span className="text-xs text-slate-500">• {currentUser.departmentName}</span>
              </div>
            )}
            
            <p className="text-xs text-slate-600 max-w-2xl">
              {currentUser.role === 'Requester' &&
                'Submit new feature requests or bug fixes for the PCS software suite and track their approval progress in real time.'}
              {currentUser.role === 'Department HOD' &&
                `You have ${pendingHodQueue.length} change request(s) awaiting your HOD Departmental Approval.`}
              {currentUser.role === 'IT Admin' &&
                `Review HOD-approved CRs, assign developers, manage PCS system master data, and conduct final release verifications.`}
              
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(currentUser.role === 'Department HOD' || delegationCtx.hasActiveDelegation) && pendingHodQueue.length > 0 && (
              <button
                onClick={() => onNavigateTab('hod')}
                className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all animate-pulse"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  {delegationCtx.hasActiveDelegation ? 'Acting HOD Queue' : 'Review HOD Queue'} ({pendingHodQueue.length})
                </span>
              </button>
            )}

            {delegationCtx.hasExpiredDelegation && !delegationCtx.hasActiveDelegation && (
              <button
                onClick={() => onNavigateTab('hod')}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>HOD History (Read-Only)</span>
              </button>
            )}

            {currentUser.role === 'IT Admin' && pendingItQueue.length > 0 && (
              <button
                onClick={() => onNavigateTab('itadmin')}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all"
              >
                <Code className="w-3.5 h-3.5" />
                <span>IT Queue ({pendingItQueue.length})</span>
              </button>
            )}

            {currentUser.role === 'IT Admin' && (
              <button
                onClick={() => onNavigateTab('dev')}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Task Board</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid (Dynamic KPI metrics calculated from change requests state) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat Card 1 */}
        <div className="stat-card">
          <div className="stat-label">Awaiting My Action</div>
          <div className="stat-value text-amber-600">
            {currentUser.role === 'Department HOD'
              ? pendingHodQueue.length
              : currentUser.role === 'IT Admin'
              ? pendingItQueue.length + pendingItVerification.length
              : currentUser.role === 'Software Developer'
              ? assignedToDev.length
              : myRequests.filter((r) => r.status === 'Returned to Requester').length}
          </div>
          <div className="text-[11px] font-medium text-rose-600 mt-1">
            {criticalOpen.length > 0 ? `${criticalOpen.length} Critical Priority` : 'Requires Action / Scope Review'}
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="stat-card">
          <div className="stat-label">In Implementation</div>
          <div className="stat-value text-blue-600">
            {statusCounts['In Progress']}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active Developer Workbenches
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="stat-card">
          <div className="stat-label">Ready for UAT / Verification</div>
          <div className="stat-value text-purple-600">
            {pendingItVerification.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Awaiting Release Verification
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="stat-card">
          <div className="stat-label">Total System Volume</div>
          <div className="stat-value text-slate-900">{totalRequests}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {closedCompleted.length} Completed & Verified
          </div>
        </div>
      </div>

      {/* Active Change Requests Register Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Active Requests</span>
            </h2>
            
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => onNavigateTab('myrequests')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 shrink-0"
            >
              <span>View All Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                <th className="p-3.5">Request ID</th>
                <th className="p-3.5">Summary & Module</th>
                <th className="p-3.5">Requester</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {changeRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2.5">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-slate-800">No IT Request Found</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        
                      </p>
                      
                    </div>
                  </td>
                </tr>
              ) : (
                changeRequests.map((cr) => (
                  <tr
                    key={cr.id}
                    onClick={() => onRequestClick(cr.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-blue-600 font-mono whitespace-nowrap">
                      {cr.id}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 line-clamp-1">{cr.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {(cr.affectedModules || []).join(', ') || 'PCS Core'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800">{cr.requesterName}</div>
                      <div className="text-[11px] text-slate-500">{cr.departmentName}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPriorityBadgeClass(cr.priority)}`}>
                        {cr.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="status-pill whitespace-nowrap">
                        <span className={`status-dot ${getStatusDot(cr.status)}`} />
                        <span>{cr.status}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                      {cr.status === 'Returned to Requester' && onEditRequest && (cr.requesterId === currentUser.id || currentUser.role === 'Requester' || currentUser.role === 'System Admin') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRequest(cr);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Provide Details</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestClick(cr.id);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

