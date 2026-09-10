import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  FileText,
  UserCheck,
  Code2,
  CheckCircle2,
  Clock,
  Send,
  Mail,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Info,
  AlertCircle,
  GitCommit,
  Layers,
  Briefcase,
  Calendar,
  ChevronRight,
  FileCheck,
  Inbox,
  UserPlus,
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';

interface HowToUseViewProps {
  currentUser: UserProfile;
  onNavigateTab: (tab: string) => void;
  onCreateNewRequest: () => void;
}

export const HowToUseView: React.FC<HowToUseViewProps> = ({
  currentUser,
  onNavigateTab,
  onCreateNewRequest,
}) => {
  const isHod = currentUser.role === 'Department HOD';
  const [activeSection, setActiveSection] = useState<'overview' | 'requester' | 'hod' | 'lifecycle' | 'email'>(
    isHod ? 'hod' : 'requester'
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 lg:p-8 border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              
             
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              IT OPS System User Guide & Workflow Manual
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Comprehensive reference for submitters, department heads, and approvers covering request submission,
              departmental authorization, IT assignment, and automated email notification.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
           
          </div>
        </div>

        {/* Section Tabs */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'System Overview' },
            { id: 'requester', label: 'Requester Guide' },
            { id: 'hod', label: 'HOD Approver Guide' },
            { id: 'lifecycle', label: 'Approval Lifecycle Flow' },
            { id: 'email', label: 'Email Notification Flow' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: SYSTEM OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">1. Submitter (Requester)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Employees initiate change requests, providing technical descriptions, priority ratings, and justification. Automated tracking keeps submitters informed.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <UserCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">2. Department HOD</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Heads of Department review change impact, business relevance, and budget. They hold approval, rejection, and temporary delegation authority.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">3. IT Admin</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                IT assesses technical feasibility, assigns developers to execute tasks, conducts verification, and releases the final changes into production.
              </p>
            </div>
          </div>

          {/* Quick Summary of Role Access */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Info className="w-4 h-4 text-slate-600" />
              <span>Role-Based Access</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">User Role</th>
                    <th className="p-3">Primary Functions</th>
                    <th className="p-3">Data Scope</th>
                    <th className="p-3">Approval Rights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">Requester</td>
                    <td className="p-3 text-slate-600">Draft & submit change requests, track progress, respond to requests for clarification.</td>
                    <td className="p-3 font-mono text-slate-600">Own Submissions</td>
                    <td className="p-3 text-slate-400">None</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">Department HOD / Acting HOD</td>
                    <td className="p-3 text-slate-600">Review departmental requests, approve or reject with comments, delegate authority.</td>
                    <td className="p-3 font-mono text-slate-600">Department Scoped</td>
                    <td className="p-3 font-semibold text-slate-800">Department Level</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">IT Admin / System Admin</td>
                    <td className="p-3 text-slate-600">Technical feasibility triage, developer assignment, system configuration, final release.</td>
                    <td className="p-3 font-mono text-slate-600">Organization Wide</td>
                    <td className="p-3 font-semibold text-slate-800">Final Release & IT Gate</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">IT Helpdesk</td>
                    <td className="p-3 text-slate-600">Frontline IT triage, request review & clarification, ticket routing, user assistance, and notification tracking.</td>
                    <td className="p-3 font-mono text-slate-600">Organization Wide</td>
                    <td className="p-3 text-slate-400">Triage & Support</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">Software Developer</td>
                    <td className="p-3 text-slate-600">Implement code & database changes, update task board status, submit for verification.</td>
                    <td className="p-3 font-mono text-slate-600">Assigned Tasks</td>
                    <td className="p-3 text-slate-400">None</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: REQUESTER GUIDE */}
      {activeSection === 'requester' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Requester Operating Guide</h2>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Initiating a New Change Request</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Click the <strong>"New Request"</strong> button located in the sidebar navigation or top banner. Select your Target Application, Category, Priority, and outline the business rationale clearly.
                </p>
                <div className="pl-7 pt-1 flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">Title & Description</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">Business Impact</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">Urgency / Priority</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">Supporting Documents</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Automated Routing to Department HOD</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Upon submission, your request automatically enters the <strong>"Pending HOD Approval"</strong> state. The system identifies your registered department and immediately routes the request to your Department HOD's approval queue.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Tracking Progress in "My Requests"</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Navigate to the <strong>"My Requests"</strong> tab to view real-time status badges, assigned IT engineers, estimated completion dates, and approval decision timestamps.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">4</span>
                  <span>Handling Returned Requests</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  If an HOD or IT Admin requests clarification, you will receive an automated email notice. You can edit the form directly to attach additional documentation or clarify specifications.
                </p>
              </div>
            </div>
          </div>

          {/* Priority Levels Reference */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Request Priority & SLA Reference Table</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Critical</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-white rounded">24h SLA</span>
                </div>
                <p className="text-slate-600 text-[11px]">System-wide outage, regulatory block, severe security risk.</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>High</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-700 text-white rounded">3 Days</span>
                </div>
                <p className="text-slate-600 text-[11px]">Core departmental workflow obstruction with no workaround.</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Medium</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-600 text-white rounded">7 Days</span>
                </div>
                <p className="text-slate-600 text-[11px]">Standard process optimization or feature enhancement.</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Low</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-500 text-white rounded">14 Days</span>
                </div>
                <p className="text-slate-600 text-[11px]">Minor UI adjustments, cosmetic corrections, or non-urgent queries.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: HOD APPROVER GUIDE */}
      {activeSection === 'hod' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <UserCheck className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Department Head (HOD) Approval Guide</h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              As a Department Head, you serve as the first organizational gatekeeper. You ensure that all IT requests submitted by your team are operationally justified, prioritized accurately, and aligned with departmental objectives.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-slate-700" />
                  <span>Reviewing Requests in the HOD Queue</span>
                </h4>
                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Navigate to <strong>"HOD Approval Queue"</strong> from the sidebar.</li>
                  <li>Click on any request to view detailed specifications, attached documents, and submitter profile.</li>
                  <li>Verify that business requirements are well-defined before granting authorization.</li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-700" />
                  <span>Temporary Delegation of Authority</span>
                </h4>
                <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>When on leave or business travel, establish an <strong>Acting Approver</strong>.</li>
                  <li>Set start and expiration dates; the system automatically transfers and revokes approval permissions.</li>
                  <li>All actions executed by the delegate remain fully auditable in the system logs.</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900">HOD Decision Actions & Outcomes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                  <span className="font-bold text-slate-900 block">✓ Endorse & Approve</span>
                  <p className="text-slate-600 text-[11px]">
                    Advances case to <code>Pending IT Admin Review</code>. IT triage team is instantly notified by email.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                  <span className="font-bold text-slate-900 block">✕ Reject Request</span>
                  <p className="text-slate-600 text-[11px]">
                    Requires entering a formal rejection rationale. Case closes as <code>Closed (Rejected)</code>.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                  <span className="font-bold text-slate-900 block">↩ Return for Clarification</span>
                  <p className="text-slate-600 text-[11px]">
                    Returns case to Requester with feedback comments for required modifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: APPROVAL LIFECYCLE FLOW */}
      {activeSection === 'lifecycle' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">End-to-End Change Request Lifecycle Flow</h2>
              <p className="text-xs text-slate-500 mt-0.5">Sequential lifecycle stages enforced across the enterprise</p>
            </div>

            {/* Visual Process Flow Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 01</span>
                  <FileText className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Submission</h4>
                <p className="text-[11px] text-slate-600">Requester submits request with scope & urgency.</p>
                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                  Status: Pending HOD Approval
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 02</span>
                  <UserCheck className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">HOD Approval</h4>
                <p className="text-[11px] text-slate-600">Department HOD validates business justification.</p>
                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                  Status: Pending IT Admin Review
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 03</span>
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">IT Assessment</h4>
                <p className="text-[11px] text-slate-600">IT Admin verifies feasibility and assigns Engineer.</p>
                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                  Status: In Progress
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 04</span>
                  <Code2 className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Implementation</h4>
                <p className="text-[11px] text-slate-600">Developer builds, captures diffs, and tests.</p>
                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                  Status: Pending Verification
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 05</span>
                  <CheckCircle2 className="w-4 h-4 text-slate-700" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Release & Close</h4>
                <p className="text-[11px] text-slate-600">IT Admin confirms release and closes ticket.</p>
                <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                  Status: Closed (Completed)
                </div>
              </div>
            </div>

            {/* Rejection / Send-back branches */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
              <span className="font-bold text-slate-900 block">Exception & Clarification Handling:</span>
              <p className="text-slate-600 leading-relaxed">
                • <strong>HOD / IT Clarification:</strong> At Stage 02 or 03, approvers can return the request to the Requester. The status resets to Draft/Pending Clarification, notifying the submitter.<br />
                • <strong>Rejection Gate:</strong> At Stage 02 or Stage 03, an authorized approver can reject the request by submitting mandatory comments. The ticket transitions immediately to <code>Closed (Rejected)</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: EMAIL NOTIFICATION FLOW */}
      {activeSection === 'email' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Mail className="w-5 h-5 text-slate-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Automated Email Notification Flow</h2>
                            </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The platform executes automated email triggers at every key stage of the request lifecycle to guarantee audit transparency and eliminate communication delays.
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-800 font-bold border-b border-slate-200">
                    <th className="p-3">Trigger Event</th>
                    <th className="p-3">Primary Recipient</th>
                    <th className="p-3">Email Subject Pattern</th>
                    <th className="p-3">Automated Payload & Action Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">New Request Created</td>
                    <td className="p-3 text-slate-700">Department HOD & Requester</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Action Required: New Request #CR-...</td>
                    <td className="p-3 text-slate-600">Dispatches submission summary to requester; sends direct authorization link to HOD.</td>
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">HOD Endorsement / Approval</td>
                    <td className="p-3 text-slate-700">IT Admin Triage Team & Requester</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Approved by HOD: Ready for IT Review</td>
                    <td className="p-3 text-slate-600">Notifies submitter of endorsement; alerts IT Admin to evaluate technical feasibility.</td>
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">HOD Rejection</td>
                    <td className="p-3 text-slate-700">Requester</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Request Rejected: #CR-...</td>
                    <td className="p-3 text-slate-600">Delivers formal HOD rejection justification reason and closes case in log.</td>
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">Developer Assignment</td>
                    <td className="p-3 text-slate-700">Assigned Software Engineer & Requester</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Task Assigned: #CR-... Assigned to Developer</td>
                    <td className="p-3 text-slate-600">Notifies engineer of assigned task; updates requester with assigned developer details.</td>
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">Developer Status Progression</td>
                    <td className="p-3 text-slate-700">IT Admin & Requester</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Status Update: In Testing / Review</td>
                    <td className="p-3 text-slate-600">Logs milestone transition across Task Board stages.</td>
                  </tr>

                  <tr className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-slate-900">Case Closure & Completion</td>
                    <td className="p-3 text-slate-700">Requester & Department HOD</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">[IT-OPS] Change Completed & Deployed: #CR-...</td>
                    <td className="p-3 text-slate-600">Provides resolution summary, release notes, and final closure confirmation.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
