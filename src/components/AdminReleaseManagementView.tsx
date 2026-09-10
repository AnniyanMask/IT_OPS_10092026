import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Globe,
  FileText,
  Calendar,
  Tag,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Wrench,
  Info,
  X,
  Clock,
  Send,
  Save,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { ReleaseNote, ReleaseNoteItem, ReleaseItemType, ReleaseStatus, UserProfile } from '../types';
import { api } from '../services/api';

interface AdminReleaseManagementViewProps {
  currentUser: UserProfile;
  onRequestViewWhatsNew?: () => void;
}

export const AdminReleaseManagementView: React.FC<AdminReleaseManagementViewProps> = ({
  currentUser,
  onRequestViewWhatsNew,
}) => {
  const [releases, setReleases] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Draft' | 'Published'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State: Create / Edit
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);

  // Form Fields
  const [formVersion, setFormVersion] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formReleaseDate, setFormReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSummary, setFormSummary] = useState('');
  const [formStatus, setFormStatus] = useState<ReleaseStatus>('Draft');
  const [formAudience, setFormAudience] = useState<string>('All Users'); // Audience defaults to All Users

  // Sub-items by section
  const [formItems, setFormItems] = useState<{ id?: string; type: ReleaseItemType; description: string; sortOrder: number }[]>([]);

  // Individual item inputs for the 4 sections
  const [newItemText, setNewItemText] = useState<{ [key in ReleaseItemType]?: string }>({});

  // Preview Modal
  const [previewRelease, setPreviewRelease] = useState<ReleaseNote | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadReleases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReleaseNotes({
        userId: currentUser.id,
        includeDrafts: true, // Admin can view drafts and published
        actorRole: currentUser.role,
      });

      if (res.success && res.data) {
        setReleases(res.data);
      } else {
        setError(res.error || 'Failed to load release notes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, [currentUser.id]);

  // Reset and open editor for Create
  const handleOpenCreateModal = () => {
    setEditingReleaseId(null);
    setFormVersion('');
    setFormTitle('');
    setFormReleaseDate(new Date().toISOString().split('T')[0]);
    setFormSummary('');
    setFormStatus('Draft');
    setFormAudience('All Users');
    setFormItems([]);
    setNewItemText({});
    setShowEditorModal(true);
  };

  // Open editor for Edit
  const handleOpenEditModal = (release: ReleaseNote) => {
    setEditingReleaseId(release.id);
    setFormVersion(release.version);
    setFormTitle(release.title);
    setFormReleaseDate(release.releaseDate);
    setFormSummary(release.summary || '');
    setFormStatus(release.status);
    setFormAudience('All Users');
    setFormItems(
      (release.items || []).map((item, idx) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        sortOrder: item.sortOrder || idx + 1,
      }))
    );
    setNewItemText({});
    setShowEditorModal(true);
  };

  // Add Item to a specific section in the form
  const handleAddItem = (type: ReleaseItemType) => {
    const text = (newItemText[type] || '').trim();
    if (!text) return;

    setFormItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        description: text,
        sortOrder: prev.length + 1,
      },
    ]);

    setNewItemText((prev) => ({ ...prev, [type]: '' }));
  };

  // Remove Item from form
  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save Draft or Publish from modal
  const handleSaveRelease = async (targetStatus?: ReleaseStatus) => {
    const statusToSave = targetStatus || formStatus;
    if (!formVersion.trim()) {
      alert('Please enter a version string (e.g., v2.6.0).');
      return;
    }
    if (!formTitle.trim()) {
      alert('Please enter a release title.');
      return;
    }
    if (!formReleaseDate) {
      alert('Please select a release date.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingReleaseId) {
        const res = await api.updateReleaseNote(editingReleaseId, {
          version: formVersion.trim(),
          title: formTitle.trim(),
          releaseDate: formReleaseDate,
          summary: formSummary.trim(),
          status: statusToSave,
          items: formItems,
          actorUserId: currentUser.id,
          actorRole: currentUser.role,
          actorName: currentUser.fullName,
        });

        if (res.success) {
          setActionSuccessMsg(`Release "${formVersion}" updated successfully as ${statusToSave}.`);
          setShowEditorModal(false);
          await loadReleases();
        } else {
          alert(res.error || 'Failed to update release note.');
        }
      } else {
        const res = await api.createReleaseNote({
          version: formVersion.trim(),
          title: formTitle.trim(),
          releaseDate: formReleaseDate,
          summary: formSummary.trim(),
          status: statusToSave,
          items: formItems,
          actorUserId: currentUser.id,
          actorRole: currentUser.role,
          actorName: currentUser.fullName,
        });

        if (res.success) {
          setActionSuccessMsg(`Release "${formVersion}" created successfully as ${statusToSave}.`);
          setShowEditorModal(false);
          await loadReleases();
        } else {
          alert(res.error || 'Failed to create release note.');
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Quick toggle Publish / Unpublish directly from table
  const handleTogglePublish = async (release: ReleaseNote) => {
    const nextStatus: ReleaseStatus = release.status === 'Published' ? 'Draft' : 'Published';
    const confirmMsg =
      nextStatus === 'Published'
        ? `Publish release ${release.version}? This will make it immediately visible to all end users, HODs, and IT staff.`
        : `Unpublish release ${release.version}? It will be returned to Draft mode and hidden from non-admin users.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.publishReleaseNote(release.id, {
        status: nextStatus,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        actorName: currentUser.fullName,
      });

      if (res.success) {
        setActionSuccessMsg(`Release ${release.version} is now ${nextStatus}.`);
        await loadReleases();
      } else {
        alert(res.error || 'Failed to update status.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Delete Release
  const handleDeleteRelease = async (release: ReleaseNote) => {
    if (!window.confirm(`Are you sure you want to permanently delete release note "${release.version} - ${release.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await api.deleteReleaseNote(release.id, currentUser.role);
      if (res.success) {
        setActionSuccessMsg(`Release ${release.version} deleted.`);
        await loadReleases();
      } else {
        alert(res.error || 'Failed to delete release note.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Open Preview from modal state
  const handleOpenModalPreview = () => {
    const previewObj: ReleaseNote = {
      id: editingReleaseId || 'preview-temp',
      version: formVersion || 'v0.0.0',
      title: formTitle || 'Untitled Release',
      releaseDate: formReleaseDate,
      summary: formSummary,
      status: formStatus,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: new Date().toISOString(),
      items: formItems.map((item, idx) => ({
        id: item.id || `preview-item-${idx}`,
        type: item.type,
        description: item.description,
        sortOrder: item.sortOrder,
      })),
      isRead: false,
    };
    setPreviewRelease(previewObj);
  };

  // Filtered list
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesVersion = r.version.toLowerCase().includes(q);
        const matchesSummary = (r.summary || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesVersion && !matchesSummary) return false;
      }
      return true;
    });
  }, [releases, statusFilter, searchQuery]);

  // Section item definitions
  const itemSections: { type: ReleaseItemType; title: string; icon: React.FC<{ className?: string }>; colorClass: string }[] = [
    { type: "What's New", title: "What's New", icon: Sparkles, colorClass: "text-emerald-700 bg-emerald-100" },
    { type: "Improvements", title: "Improvements", icon: TrendingUp, colorClass: "text-blue-700 bg-blue-100" },
    { type: "Bug Fixes", title: "Bug Fixes", icon: Wrench, colorClass: "text-amber-700 bg-amber-100" },
    { type: "Important Notices", title: "Important Notices", icon: AlertTriangle, colorClass: "text-rose-700 bg-rose-100" },
  ];

  return (
    <div id="admin-release-management-view" className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-600/20 shrink-0">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Release Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  Admin Console
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                Draft, preview, publish, and manage system release announcements visible to End Users, HODs, and IT staff.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onRequestViewWhatsNew && (
              <button
                onClick={onRequestViewWhatsNew}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>View User Feed</span>
              </button>
            )}

            <button
              id="btn-create-new-release"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Release</span>
            </button>
          </div>
        </div>

        {/* Action success alert banner */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search release version, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </span>

            {(['ALL', 'Published', 'Draft'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Release History Table / Cards */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading release records...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-700">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="text-sm font-bold">{error}</p>
          <button
            onClick={loadReleases}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-500 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : filteredReleases.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No release notes found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No releases match "${searchQuery}".`
              : 'Click "Create Release" above to author your first system release announcement.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Release History & Status</span>
            <span>Total: {filteredReleases.length} Release(s)</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredReleases.map((release) => {
              const isPublished = release.status === 'Published';
              return (
                <div
                  key={release.id}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      <Tag className="w-3 h-3 mr-1 text-blue-500" />
                      {release.version}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm md:text-base font-bold text-slate-900 truncate">
                          {release.title}
                        </h3>

                        {isPublished ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" />
                            Draft
                          </span>
                        )}

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <Users className="w-3 h-3 mr-1 text-slate-400" />
                          Audience: All Users
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Release Date: {release.releaseDate}</span>
                        </span>

                        {release.publishedAt && (
                          <span className="flex items-center space-x-1 text-emerald-700">
                            <Globe className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Published on {new Date(release.publishedAt).toLocaleDateString()}</span>
                          </span>
                        )}

                        <span className="flex items-center space-x-1 text-slate-400">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{(release.items || []).length} change items</span>
                        </span>
                      </div>

                      {release.summary && (
                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-1">
                          {release.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => setPreviewRelease(release)}
                      title="Preview release as seen by users"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(release)}
                      title="Edit release details"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-blue-700 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleTogglePublish(release)}
                      title={isPublished ? 'Unpublish to Draft' : 'Publish to All Users'}
                      className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isPublished
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteRelease(release)}
                      title="Delete release note"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    {editingReleaseId ? 'Edit Release Note' : 'Create New Release Note'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Define release version, summary, changes, and publish status.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditorModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Primary Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Version */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Version <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. v2.6.0"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {/* Release Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Release Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formReleaseDate}
                    onChange={(e) => setFormReleaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ReleaseStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="Draft">Draft (Admin Only)</option>
                    <option value="Published">Published (All Users)</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Interactive Service Catalog & Thermal Label Designer"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Audience (Defaults to All Users) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Target Audience</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                    Default: All Users
                  </span>
                </label>
                <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold">{formAudience}</span>
                  <span className="text-slate-400 text-[11px]">(End Users, HODs, IT Helpdesk, Developers & Admins)</span>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Executive Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide a concise summary explaining the purpose and key highlights of this release..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Section Item Builders: What's New, Improvements, Bug Fixes, Important Notices */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Release Item Details
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add bullet points under each category. Items will be formatted neatly in the user-facing release notes.
                  </p>
                </div>

                {itemSections.map((sec) => {
                  const SecIcon = sec.icon;
                  const secItems = formItems.filter((i) => i.type === sec.type);
                  return (
                    <div key={sec.type} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${sec.colorClass}`}>
                            <SecIcon className="w-3 h-3" />
                          </div>
                          <span className="text-xs font-bold text-slate-800">{sec.title}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                            {secItems.length}
                          </span>
                        </div>
                      </div>

                      {/* Existing items for this section */}
                      {secItems.length > 0 && (
                        <div className="space-y-1.5 pl-1">
                          {secItems.map((item) => {
                            const globalIdx = formItems.indexOf(item);
                            return (
                              <div
                                key={item.id || globalIdx}
                                className="flex items-start justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                              >
                                <span className="leading-relaxed flex-1 mr-2">• {item.description}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(globalIdx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0 mt-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add new item input */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder={`Add a new ${sec.title.toLowerCase()} item...`}
                          value={newItemText[sec.type] || ''}
                          onChange={(e) =>
                            setNewItemText((prev) => ({ ...prev, [sec.type]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItem(sec.type);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddItem(sec.type)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all cursor-pointer shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleOpenModalPreview}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Preview Layout</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveRelease('Draft')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveRelease('Published')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer shadow-md shadow-amber-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Publishing...' : 'Publish'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewRelease && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold">Release Note Preview (End User View)</span>
              </div>
              <button
                onClick={() => setPreviewRelease(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-start space-x-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  <Tag className="w-3 h-3 mr-1 text-blue-500" />
                  {previewRelease.version}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{previewRelease.title}</h2>
                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{previewRelease.releaseDate}</span>
                    </span>
                    <span className="text-emerald-700 font-semibold">• Audience: All Users</span>
                  </div>
                </div>
              </div>

              {previewRelease.summary && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  <span className="font-bold block text-slate-800 mb-1">Summary:</span>
                  {previewRelease.summary}
                </div>
              )}

              {/* Sections */}
              {itemSections.map((sec) => {
                const SecIcon = sec.icon;
                const items = (previewRelease.items || []).filter((i) => i.type === sec.type);
                if (items.length === 0) return null;
                return (
                  <div key={sec.type} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${sec.colorClass}`}>
                        <SecIcon className="w-3 h-3" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{sec.title}</h4>
                    </div>
                    <ul className="space-y-1.5 pl-7">
                      {items.map((it, idx) => (
                        <li key={idx} className="text-xs text-slate-700 flex items-start space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                          <span>{it.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewRelease(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
