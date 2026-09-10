import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  Wrench,
  AlertTriangle,
  Calendar,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  Filter,
  CheckCheck,
  Megaphone,
  Settings,
  Clock,
  User,
  ExternalLink,
  Layers,
  Info,
  RefreshCw
} from 'lucide-react';
import { ReleaseNote, ReleaseNoteItem, UserProfile } from '../types';
import { api } from '../services/api';

interface WhatsNewViewProps {
  currentUser: UserProfile;
  onNavigateToAdminReleases?: () => void;
  onRefreshUnreadCount?: () => void;
}

export const WhatsNewView: React.FC<WhatsNewViewProps> = ({
  currentUser,
  onNavigateToAdminReleases,
  onRefreshUnreadCount,
}) => {
  const [releases, setReleases] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const isAdmin = currentUser.role === 'System Admin' || currentUser.role === 'IT Admin';

  const loadReleases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReleaseNotes({
        userId: currentUser.id,
        includeDrafts: false, // End users, HODs, IT members only see published
        actorRole: currentUser.role,
      });

      if (res.success && res.data) {
        setReleases(res.data);
        // Automatically expand the latest release by default
        if (res.data.length > 0) {
          setExpandedReleaseIds(new Set([res.data[0].id]));
          // If latest release is unread, automatically mark as read
          if (!res.data[0].isRead) {
            handleMarkAsRead(res.data[0].id);
          }
        }
      } else {
        setError(res.error || 'Failed to load release notes.');
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

  const handleMarkAsRead = async (releaseId: string) => {
    try {
      await api.markReleaseNoteAsRead(releaseId, currentUser.id);
      setReleases((prev) =>
        prev.map((r) => (r.id === releaseId ? { ...r, isRead: true } : r))
      );
      if (onRefreshUnreadCount) {
        onRefreshUnreadCount();
      }
    } catch (err) {
      console.warn('[Release Read Notice]', err);
    }
  };

  const toggleExpand = (releaseId: string) => {
    setExpandedReleaseIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyExpanded = next.has(releaseId);
      if (isCurrentlyExpanded) {
        next.delete(releaseId);
      } else {
        next.add(releaseId);
        // Mark as read when opened/expanded
        const rel = releases.find((r) => r.id === releaseId);
        if (rel && !rel.isRead) {
          handleMarkAsRead(releaseId);
        }
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(filteredReleases.map((r) => r.id));
    setExpandedReleaseIds(allIds);
    // Mark all currently filtered as read
    filteredReleases.forEach((r) => {
      if (!r.isRead) handleMarkAsRead(r.id);
    });
  };

  const collapseAll = () => {
    setExpandedReleaseIds(new Set());
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const unreadList = releases.filter((r) => !r.isRead);
      for (const r of unreadList) {
        await api.markReleaseNoteAsRead(r.id, currentUser.id);
      }
      setReleases((prev) => prev.map((r) => ({ ...r, isRead: true })));
      if (onRefreshUnreadCount) {
        onRefreshUnreadCount();
      }
    } catch (err) {
      console.warn('[Mark All Read Error]', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Derive distinct release years for history filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    releases.forEach((r) => {
      if (r.releaseDate) {
        const year = r.releaseDate.substring(0, 4);
        if (year) years.add(year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [releases]);

  // Filtered releases by search and year
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (selectedYear !== 'ALL') {
        if (!r.releaseDate?.startsWith(selectedYear)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesVersion = r.version.toLowerCase().includes(q);
        const matchesSummary = (r.summary || '').toLowerCase().includes(q);
        const matchesItems = (r.items || []).some((item) =>
          item.description.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesVersion && !matchesSummary && !matchesItems) {
          return false;
        }
      }
      return true;
    });
  }, [releases, selectedYear, searchQuery]);

  const unreadCount = useMemo(() => {
    return releases.filter((r) => !r.isRead).length;
  }, [releases]);

  // Group items of a release by type
  const groupItemsByType = (items: ReleaseNoteItem[] = []) => {
    const whatsNew = items.filter((i) => i.type === "What's New");
    const improvements = items.filter((i) => i.type === 'Improvements');
    const bugFixes = items.filter((i) => i.type === 'Bug Fixes');
    const notices = items.filter((i) => i.type === 'Important Notices');
    return { whatsNew, improvements, bugFixes, notices };
  };

  return (
    <div id="whats-new-view" className="space-y-10 pb-24 max-w-6xl mx-auto px-4 md:px-0">
      {/* Refined Header - High Contrast & Minimal */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-200 pb-10">
        <div className="space-y-2">
          <div className="flex items-center space-x-2.5 text-slate-400">
            
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            What's New <span className="text-slate-300 font-light">&</span> System Logs
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Official technical documentation for system upgrades, security enhancements, and feature deployments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-releases"
              type="text"
              placeholder="Search release history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
          
          <button
            onClick={loadReleases}
            className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Actions & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedYear('ALL')}
            className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${
              selectedYear === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
            }`}
          >
            Cumulative Archive
          </button>
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${
                selectedYear === year
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
              }`}
            >
              FY {year}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center space-x-2 border border-blue-100"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Acknowledge All Updates</span>
            </button>
          )}
          <button
            onClick={expandedReleaseIds.size === filteredReleases.length ? collapseAll : expandAll}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center space-x-2 border border-slate-200"
          >
            {expandedReleaseIds.size === filteredReleases.length ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{expandedReleaseIds.size === filteredReleases.length ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>
      </div>

      {/* Main Content - Professional Timeline */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="w-6 h-6 text-slate-300 animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Records</p>
        </div>
      ) : filteredReleases.length === 0 ? (
        <div className="py-32 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Archive matches zero results</h3>
          <p className="text-sm text-slate-500 mt-1">Adjust search parameters or select a different fiscal year.</p>
        </div>
      ) : (
        <div className="relative pl-8 md:pl-16 space-y-16 before:absolute before:left-[11px] md:before:left-[15px] before:top-4 before:bottom-4 before:w-[1px] before:bg-slate-200">
          {filteredReleases.map((release, idx) => {
            const isExpanded = expandedReleaseIds.has(release.id);
            const isLatest = idx === 0;
            const { whatsNew, improvements, bugFixes, notices } = groupItemsByType(release.items);

            return (
              <div key={release.id} className="relative group transition-opacity duration-500">
                {/* Timeline Node */}
                <div className={`absolute -left-[31px] md:-left-[43px] top-1.5 w-6 h-6 rounded-full border-4 border-white z-10 transition-all ${
                  isLatest ? 'bg-blue-600 ring-4 ring-blue-50' : 'bg-slate-200 group-hover:bg-slate-400'
                }`} />

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Sidebar Metadata */}
                  <div className="md:w-40 shrink-0 space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-black text-slate-900 font-mono tracking-tighter">
                        v{release.version}
                      </span>
                      {isLatest && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{release.releaseDate}</span>
                      </div>
                      {!release.isRead && (
                        <div className="flex items-center space-x-2 text-[11px] font-black text-blue-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span>UNREAD</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feature Content */}
                  <div className="flex-1 space-y-6">
                    <div 
                      className="cursor-pointer group/title"
                      onClick={() => toggleExpand(release.id)}
                    >
                      <div className="flex items-start justify-between">
                        <h2 className="text-2xl font-black text-slate-900 leading-tight group-hover/title:text-blue-600 transition-colors">
                          {release.title}
                        </h2>
                        <div className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-slate-900 text-white' : 'text-slate-300 group-hover/title:text-slate-900'}`}>
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                      <p className="text-[15px] text-slate-600 leading-relaxed mt-2 max-w-3xl">
                        {release.summary}
                      </p>
                    </div>

                    {isExpanded && (
                      <div className="pt-8 space-y-10 animate-fadeIn">
                        {/* Section Rendering Utility */}
                        {[
                          { title: "Strategic Features", items: whatsNew, icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50" },
                          { title: "System Enhancements", items: improvements, icon: TrendingUp, color: "text-slate-600", bg: "bg-slate-100" },
                          { title: "Service Corrections", items: bugFixes, icon: Wrench, color: "text-slate-600", bg: "bg-slate-100" },
                        ].map((sec) => sec.items.length > 0 && (
                          <div key={sec.title} className="space-y-5">
                            <div className="flex items-center space-x-2">
                              <sec.icon className={`w-4 h-4 ${sec.color}`} />
                              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{sec.title}</h3>
                            </div>
                            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4">
                              {sec.items.map((item) => (
                                <li key={item.id} className="flex items-start space-x-3 group/item">
                                  <div className="mt-2 w-1 h-1 rounded-full bg-slate-300 group-hover/item:bg-blue-600 transition-colors" />
                                  <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}

                        {/* Critical Notices */}
                        {notices.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center space-x-2 text-slate-900">
                              <AlertTriangle className="w-4 h-4" />
                              <h3 className="text-xs font-black uppercase tracking-widest">Operational Directives</h3>
                            </div>
                            <ul className="space-y-3">
                              {notices.map((item) => (
                                <li key={item.id} className="flex items-start space-x-3 text-sm text-slate-700 font-medium">
                                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0" />
                                  <span>{item.description}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Footer Signature */}
                        <div className="pt-8 mt-10 border-t border-slate-100 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <div className="flex items-center space-x-2">
                            <User className="w-3.5 h-3.5" />
                            <span>Authorized by <span className="text-slate-600">{release.createdByName || 'System Administrator'}</span></span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Tag className="w-3.5 h-3.5" />
                            <span>Audit Stamp: <span className="text-slate-600 font-mono tracking-normal">{release.id}</span></span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-emerald-600 ml-auto">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PRODUCTION VERIFIED</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Quick Action */}
      {isAdmin && onNavigateToAdminReleases && !loading && (
        <div className="mt-20 p-10 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden group border border-slate-800 shadow-2xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 blur-[120px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-125" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">Governance & Release Control</h3>
              <p className="text-sm text-slate-400 max-w-md">Access the centralized console to authorize new releases or modify existing operational audit logs.</p>
            </div>
            <button
              onClick={onNavigateToAdminReleases}
              className="px-8 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all active:scale-95 flex items-center space-x-3 shadow-xl cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Access Management Interface</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
