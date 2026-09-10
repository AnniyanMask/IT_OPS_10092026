import React, { useState, useEffect } from 'react';
import {
  Laptop,
  HardDrive,
  Usb,
  Database,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  Calendar,
  User,
  Shield,
  AlertCircle,
  Check,
  RotateCcw,
  Eye,
  FileText,
  Tag,
  ArrowRight,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { DeviceOutRequest, UserProfile, DeviceOutApproval } from '../types';
import { api } from '../services/api';
import { DeviceOutStickerModal } from './DeviceOutStickerModal';

interface DeviceOutViewProps {
  currentUser: UserProfile;
  onOpenCreateModal?: () => void;
}

export const DeviceOutView: React.FC<DeviceOutViewProps> = ({ currentUser, onOpenCreateModal }) => {
  const [requests, setRequests] = useState<DeviceOutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<DeviceOutRequest | null>(null);
  const [stickerModalRequest, setStickerModalRequest] = useState<DeviceOutRequest | null>(null);

  // Action modals
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [actionTargetReq, setActionTargetReq] = useState<DeviceOutRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Request modal state (if created directly from this view)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    serviceName: 'Laptop',
    assetName: '',
    serialNumber: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    vpnRequired: false,
    businessPurpose: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const isItStaff = [
    'it staff',
    'it helpdesk',
    'it admin',
    'system admin',
    'software developer',
    'admin'
  ].includes((currentUser.role || '').toLowerCase());

  useEffect(() => {
    loadRequests();
  }, [currentUser.id]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDeviceOutRequests({
        userId: currentUser.id,
        role: currentUser.role,
        departmentId: currentUser.departmentId,
      });
      if (res.success && res.data) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error('Failed to load device out requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!actionTargetReq) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const res = await api.approveDeviceOutRequest(actionTargetReq.id, {
        approvedBy: currentUser.id,
        approvedByName: currentUser.name,
        approverRole: currentUser.role,
        comments: approvalComments,
      });
      if (res.success) {
        setSuccessToast(`Request ${actionTargetReq.requestId} has been approved.`);
        setActionType(null);
        setActionTargetReq(null);
        setApprovalComments('');
        await loadRequests();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setActionError(res.error || 'Failed to approve request.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error approving request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!actionTargetReq) return;
    if (!rejectionReason.trim()) {
      setActionError('Rejection reason is mandatory.');
      return;
    }
    setActionSubmitting(true);
    setActionError(null);
    try {
      const res = await api.rejectDeviceOutRequest(actionTargetReq.id, {
        rejectedBy: currentUser.id,
        rejectedByName: currentUser.name,
        approverRole: currentUser.role,
        rejectionReason: rejectionReason.trim(),
      });
      if (res.success) {
        setSuccessToast(`Request ${actionTargetReq.requestId} has been rejected.`);
        setActionType(null);
        setActionTargetReq(null);
        setRejectionReason('');
        await loadRequests();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setActionError(res.error || 'Failed to reject request.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error rejecting request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!actionTargetReq) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const res = await api.returnDeviceOutRequest(actionTargetReq.id, {
        returnedBy: currentUser.id,
        returnedByName: currentUser.name,
        approverRole: currentUser.role,
        remarks: returnRemarks,
      });
      if (res.success) {
        setSuccessToast(`Device for request ${actionTargetReq.requestId} marked as Returned/Closed.`);
        setActionType(null);
        setActionTargetReq(null);
        setReturnRemarks('');
        await loadRequests();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setActionError(res.error || 'Failed to process device return.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error returning device.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Business rule: To Date cannot be earlier than From Date
    if (new Date(createForm.toDate) < new Date(createForm.fromDate)) {
      setCreateError('To Date cannot be earlier than From Date.');
      return;
    }

    if (!createForm.assetName.trim()) {
      setCreateError('Please specify the Asset / Device name or serial number.');
      return;
    }

    if (!createForm.businessPurpose.trim()) {
      setCreateError('Business purpose is required.');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const res = await api.createDeviceOutRequest({
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        departmentId: currentUser.departmentId,
        departmentName: currentUser.departmentName || currentUser.department,
        serviceName: createForm.serviceName,
        assetName: createForm.assetName,
        serialNumber: createForm.serialNumber,
        fromDate: createForm.fromDate,
        toDate: createForm.toDate,
        vpnRequired: createForm.vpnRequired,
        businessPurpose: createForm.businessPurpose,
      });

      if (res.success && res.data) {
        setSuccessToast(`Bring Device Out request ${res.data.requestId} submitted successfully.`);
        setShowCreateModal(false);
        setCreateForm({
          serviceName: 'Laptop',
          assetName: '',
          serialNumber: '',
          fromDate: new Date().toISOString().split('T')[0],
          toDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          vpnRequired: false,
          businessPurpose: '',
        });
        await loadRequests();
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setCreateError(res.error || 'Failed to submit request.');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error submitting request.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Filter list
  const filteredRequests = requests.filter((req) => {
    const matchesQuery =
      req.requestId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requesterName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.assetName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.serviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || req.approvalStatus?.toLowerCase() === statusFilter.toLowerCase();

    const matchesService =
      serviceFilter === 'all' || req.serviceName?.toLowerCase() === serviceFilter.toLowerCase();

    return matchesQuery && matchesStatus && matchesService;
  });

  const getServiceIcon = (service: string) => {
    switch (service?.toLowerCase()) {
      case 'laptop':
        return <Laptop className="w-4 h-4 text-blue-600" />;
      case 'thumbdrive':
        return <Usb className="w-4 h-4 text-amber-600" />;
      case 'external hard disk':
        return <HardDrive className="w-4 h-4 text-emerald-600" />;
      default:
        return <Database className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'Returned/Closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            Returned/Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Approval
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-900">
            Dismiss
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Bring Device Out Management
              </h1>
              <p className="text-xs text-slate-500">
                Security gate clearance & SATO CL4NX sticker issuance for company equipment
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Device Out Request
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Request ID, requester, asset name, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned/closed">Returned/Closed</option>
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Devices</option>
            <option value="laptop">Laptop</option>
            <option value="thumbdrive">Thumbdrive</option>
            <option value="external hard disk">External Hard Disk</option>
            <option value="application asset">Application Asset</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Loading Bring Device Out requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Laptop className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No Bring Device Out requests match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Device / Asset</th>
                  <th className="py-3 px-4">Requestor</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">VPN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Prints</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRequests.map((req) => {
                  const isApproved = req.approvalStatus === 'Approved';
                  const isReturnedOrClosed = req.approvalStatus === 'Returned/Closed';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {req.requestId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-md">
                            {getServiceIcon(req.serviceName)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{req.assetName}</div>
                            <div className="text-[11px] text-slate-500">
                              {req.serviceName} {req.serialNumber ? `• S/N: ${req.serialNumber}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{req.requesterName}</div>
                        <div className="text-[11px] text-slate-500">{req.departmentName || 'General'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800">
                          {req.fromDate ? new Date(req.fromDate).toLocaleDateString('en-GB') : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          to {req.toDate ? new Date(req.toDate).toLocaleDateString('en-GB') : '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.vpnRequired ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Not Required</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(req.approvalStatus)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {req.printCount || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Sticker Button (Only for APPROVED and NOT Returned/Closed) */}
                          {isApproved && !isReturnedOrClosed && (
                            <button
                              onClick={() => setStickerModalRequest(req)}
                              title="Print SATO CL4NX thermal sticker"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-2xs transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Sticker</span>
                            </button>
                          )}

                          {/* IT Staff Approval buttons */}
                          {isItStaff && req.approvalStatus === 'Pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setActionTargetReq(req);
                                  setActionType('approve');
                                }}
                                title="Approve Request"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActionTargetReq(req);
                                  setActionType('reject');
                                }}
                                title="Reject Request"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-md transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {/* Return Device button (Once Approved, IT can mark as returned) */}
                          {isItStaff && isApproved && !isReturnedOrClosed && (
                            <button
                              onClick={() => {
                                setActionTargetReq(req);
                                setActionType('return');
                              }}
                              title="Mark equipment as Returned to IT"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-md border border-slate-300 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                              <span>Return</span>
                            </button>
                          )}

                          {/* View details */}
                          <button
                            onClick={() => setSelectedRequest(req)}
                            title="View full request audit details"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SATO CL4NX Sticker Print Modal */}
      {stickerModalRequest && (
        <DeviceOutStickerModal
          request={stickerModalRequest}
          currentUser={currentUser}
          onClose={() => setStickerModalRequest(null)}
          onPrintSuccess={() => {
            loadRequests();
          }}
        />
      )}

      {/* Approval / Rejection / Return Action Modal */}
      {actionType && actionTargetReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {actionType === 'approve'
                  ? 'Approve Bring Device Out'
                  : actionType === 'reject'
                  ? 'Reject Bring Device Out'
                  : 'Mark Equipment as Returned'}
              </h3>
              <span className="font-mono text-xs font-bold text-blue-600">
                {actionTargetReq.requestId}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800">
                  {actionTargetReq.assetName} ({actionTargetReq.serviceName})
                </div>
                <div className="text-slate-500">
                  Requestor: {actionTargetReq.requesterName} • {actionTargetReq.departmentName}
                </div>
                <div className="text-slate-500">
                  Period: {actionTargetReq.fromDate} to {actionTargetReq.toDate}
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionType === 'approve' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Approval Comments (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    placeholder="e.g. Device inspected. Approved for off-site customer deployment."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Approver user ID (<strong>{currentUser.id}</strong>) and timestamp will be committed to the audit trail.
                  </p>
                </div>
              )}

              {actionType === 'reject' && (
                <div>
                  <label className="text-xs font-semibold text-rose-700 block mb-1">
                    Rejection Reason (Mandatory)*
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Incomplete security clearance. Business justification not aligned with policy."
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-md focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              )}

              {actionType === 'return' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Return Inspection Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    placeholder="e.g. Hardware returned in intact condition. Sticker voided."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This locks the request and prevents future sticker reprints.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setActionType(null);
                  setActionTargetReq(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>

              {actionType === 'approve' && (
                <button
                  onClick={handleApprove}
                  disabled={actionSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs disabled:opacity-50"
                >
                  {actionSubmitting ? 'Approving...' : 'Confirm Approval'}
                </button>
              )}

              {actionType === 'reject' && (
                <button
                  onClick={handleReject}
                  disabled={actionSubmitting || !rejectionReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs disabled:opacity-50"
                >
                  {actionSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              )}

              {actionType === 'return' && (
                <button
                  onClick={handleReturn}
                  disabled={actionSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-2xs disabled:opacity-50"
                >
                  {actionSubmitting ? 'Processing...' : 'Confirm Device Return'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  New Bring Device Out Request
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Device / Service Type*
                </label>
                <select
                  value={createForm.serviceName}
                  onChange={(e) => setCreateForm({ ...createForm, serviceName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Laptop">Laptop (Requires IT Approval)</option>
                  <option value="Thumbdrive">Thumbdrive</option>
                  <option value="External Hard Disk">External Hard Disk</option>
                  <option value="Application Asset">Application Asset</option>
                </select>
                {createForm.serviceName === 'Laptop' && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Laptops mandatory rule: Requires IT Staff review & formal approval.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Asset / Device Model*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell Latitude 5430, Kingston DataTraveler 64GB"
                  value={createForm.assetName}
                  onChange={(e) => setCreateForm({ ...createForm, assetName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Serial Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8F7K2L3, SN-998811"
                  value={createForm.serialNumber}
                  onChange={(e) => setCreateForm({ ...createForm, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    From Date*
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.fromDate}
                    onChange={(e) => setCreateForm({ ...createForm, fromDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    To Date*
                  </label>
                  <input
                    type="date"
                    required
                    min={createForm.fromDate}
                    value={createForm.toDate}
                    onChange={(e) => setCreateForm({ ...createForm, toDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="vpnRequiredCheckbox"
                  checked={createForm.vpnRequired}
                  onChange={(e) => setCreateForm({ ...createForm, vpnRequired: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="vpnRequiredCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  VPN Required: Remote access to corporate Tanaka networks is required
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Business Purpose*
                </label>
                <textarea
                  required
                  rows={3}
                  value={createForm.businessPurpose}
                  onChange={(e) => setCreateForm({ ...createForm, businessPurpose: e.target.value })}
                  placeholder="Describe why the device needs to leave the premises (e.g. client site demonstration, off-site audit, remote work)."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs disabled:opacity-50"
                >
                  {isSubmittingNew ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Audit Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Request Details & Audit History
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 block">Request ID</span>
                  <span className="font-mono font-bold text-blue-700">{selectedRequest.requestId}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Approval Status</span>
                  {getStatusBadge(selectedRequest.approvalStatus)}
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Requestor</span>
                  <span className="font-semibold text-slate-900">{selectedRequest.requesterName}</span> ({selectedRequest.departmentName})
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Device / Asset</span>
                  <span className="font-semibold text-slate-900">{selectedRequest.assetName}</span> ({selectedRequest.serviceName})
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Duration</span>
                  <span>{selectedRequest.fromDate} to {selectedRequest.toDate}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">VPN Required</span>
                  <span>{selectedRequest.vpnRequired ? 'Yes (Required)' : 'No'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  Business Purpose
                </span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">
                  {selectedRequest.businessPurpose}
                </p>
              </div>

              {/* Approval Audit Trail */}
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Approval History
                </span>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-semibold text-slate-800">Submitted</span>
                      <p className="text-[11px] text-slate-500">By {selectedRequest.requesterName}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString('en-GB') : '-'}
                    </span>
                  </div>

                  {selectedRequest.approvedBy && (
                    <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-semibold text-emerald-800">Approved by IT</span>
                        <p className="text-[11px] text-slate-500">
                          Approver: <strong>{selectedRequest.approvedByName || selectedRequest.approvedBy}</strong> ({selectedRequest.approvedBy})
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {selectedRequest.approvedAt ? new Date(selectedRequest.approvedAt).toLocaleString('en-GB') : '-'}
                      </span>
                    </div>
                  )}

                  {selectedRequest.rejectionReason && (
                    <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-semibold text-rose-800">Rejected by IT</span>
                        <p className="text-[11px] text-rose-700">
                          Reason: {selectedRequest.rejectionReason}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {selectedRequest.approvedAt ? new Date(selectedRequest.approvedAt).toLocaleString('en-GB') : '-'}
                      </span>
                    </div>
                  )}

                  {selectedRequest.returnedAt && (
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">Returned & Closed</span>
                        <p className="text-[11px] text-slate-500">
                          Received by: <strong>{selectedRequest.returnedByName || selectedRequest.returnedBy}</strong>
                          {selectedRequest.returnRemarks ? ` • ${selectedRequest.returnRemarks}` : ''}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(selectedRequest.returnedAt).toLocaleString('en-GB')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Close
              </button>

              {selectedRequest.approvalStatus === 'Approved' && selectedRequest.approvalStatus !== 'Returned/Closed' && (
                <button
                  onClick={() => {
                    setStickerModalRequest(selectedRequest);
                    setSelectedRequest(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                  Print SATO Sticker
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
