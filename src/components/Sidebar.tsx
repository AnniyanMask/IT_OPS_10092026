import React, { useState, useEffect, useRef } from 'react';
import { UserRole, UserProfile, NotificationItem, TemporaryApproverDelegation, CustomRoleDefinition } from '../types';
import { getUserDelegationContext } from '../utils/delegationUtils';
import { hasRolePermission } from '../utils/rbac';
import { ItOpsLogo } from './ItOpsLogo';
import {
  LayoutDashboard,
  FileText,
  UserCheck,
  Code2,
  Kanban,
  Shield,
  BarChart3,
  PlusCircle,
  Bell,
  ChevronDown,
  Layers,
  X,
  Menu,
  Mail,
  KeyRound,
  LogOut,
  ChevronRight,
  Clock,
  Zap,
  Lock,
  Archive,
  HelpCircle,
  Laptop,
  Megaphone,
  Calendar,
} from 'lucide-react';

interface SidebarProps {
  currentUser: UserProfile;
  onLogout: () => void;
  activeAppTab: string;
  onAppTabChange: (tab: string) => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onRequestClick: (crId: string) => void;
  onOpenNotificationsModal?: () => void;
  pendingHodCount: number;
  pendingItCount: number;
  assignedDevCount: number;
  closedCasesCount?: number;
  onCreateNewRequest: () => void;
  onOpenSmtpConsole: () => void;
  emailCount: number;
  users?: UserProfile[];
  delegations?: TemporaryApproverDelegation[];
  customRoles?: CustomRoleDefinition[];
  unreadReleaseNotesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onLogout,
  activeAppTab,
  onAppTabChange,
  notifications,
  onMarkNotificationRead,
  onRequestClick,
  onOpenNotificationsModal,
  pendingHodCount,
  pendingItCount,
  assignedDevCount,
  closedCasesCount = 0,
  onCreateNewRequest,
  onOpenSmtpConsole,
  emailCount,
  users: propUsers,
  delegations = [],
  customRoles = [],
  unreadReleaseNotesCount = 0,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const notifMenuRef = useRef<HTMLDivElement>(null);

  const unreadNotifs = notifications.filter((n) => !n.read && n.userId === currentUser.id);

  // Evaluate temporary delegation status for current user
  const delegationCtx = getUserDelegationContext(currentUser, delegations);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get initials for user avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const isHodDirect = currentUser.role === 'Department HOD' || currentUser.role === 'System Admin';

  const hodLabel = delegationCtx.hasActiveDelegation
    ? `${delegationCtx.effectiveDepartmentName || 'Production'} Acting Approver Queue`
    : isHodDirect
    ? 'HOD Approval Queue'
    : 'HOD History (Read-Only)';

  const hodBadge = isHodDirect
    ? pendingHodCount > 0 ? pendingHodCount : undefined
    : delegationCtx.hasActiveDelegation
    ? pendingHodCount > 0 ? `${pendingHodCount} • Acting` : 'Acting'
    : 'Read-Only';

  const hodBadgeColor = isHodDirect
    ? 'bg-amber-500 text-white'
    : delegationCtx.hasActiveDelegation
    ? 'bg-amber-600 text-white font-bold'
    : 'bg-slate-700 text-slate-300 font-mono text-[9px]';

  // Dynamic capability checks from Custom Roles & Automated Governance Matrix
  const canViewHodQueue = isHodDirect || delegationCtx.canAccessHodQueue || hasRolePermission(currentUser.role, 'canViewHodQueue', customRoles);
  const canViewItAdminWorkspace = hasRolePermission(currentUser.role, 'canViewItAdminWorkspace', customRoles);
  const canViewDeveloperBoard = hasRolePermission(currentUser.role, 'canViewDeveloperBoard', customRoles);
  const canViewClosedCases = hasRolePermission(currentUser.role, 'canViewClosedCases', customRoles);
  const canViewReports = hasRolePermission(currentUser.role, 'canViewReports', customRoles);
  const canViewAdminHub = hasRolePermission(currentUser.role, 'canViewAdminHub', customRoles);
  const canViewEmailHub = hasRolePermission(currentUser.role, 'canViewEmailHub', customRoles);
  const canViewDeviceOut = hasRolePermission(currentUser.role, 'canViewDeviceOut', customRoles) || canViewAdminHub;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: 'myrequests',
      label: 'My Requests',
      icon: FileText,
      show: true,
    },
    {
      id: 'hod',
      label: hodLabel,
      icon: UserCheck,
      badge: hodBadge,
      badgeColor: hodBadgeColor,
      show: canViewHodQueue,
    },
    {
      id: 'itadmin',
      label: 'IT Admin Workspace',
      icon: Code2,
      badge: pendingItCount > 0 ? pendingItCount : undefined,
      badgeColor: 'bg-blue-500 text-white',
      show: canViewItAdminWorkspace,
    },
    {
      id: 'dev',
      label: 'Service Queue',
      icon: Kanban,
      badge: assignedDevCount > 0 ? assignedDevCount : undefined,
      badgeColor: 'bg-emerald-500 text-white',
      show: canViewDeveloperBoard,
    },
    {
      id: 'closed',
      label: 'Closed',
      icon: Archive,
      badge: closedCasesCount > 0 ? closedCasesCount : undefined,
      badgeColor: 'bg-slate-700 text-slate-200',
      show: canViewClosedCases,
    },
    {
      id: 'device-out',
      label: 'Bring Device Out',
      icon: Laptop,
      show: canViewDeviceOut,
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: BarChart3,
      show: canViewReports,
    },
    {
      id: 'whatsnew',
      label: "📢 What's New",
      icon: Megaphone,
      badge: unreadReleaseNotesCount > 0 ? unreadReleaseNotesCount : undefined,
      badgeColor: 'bg-amber-500 text-white font-extrabold',
      show: true,
    },
    {
      id: 'howtouse',
      label: 'How to use',
      icon: HelpCircle,
      show: true,
    },
    {
      id: 'admin',
      label: 'System Administration',
      icon: Shield,
      show: canViewAdminHub,
    },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-[#1e293b] text-white p-4 flex items-center justify-between border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-950/80 p-0.5 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <ItOpsLogo className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight leading-none">
              IT <span className="text-blue-500">OPS</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Management System</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {unreadNotifs.length > 0 && (
            <button
              onClick={() => {
                setMobileOpen(true);
                setShowNotifMenu(true);
              }}
              className="p-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center space-x-1"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{unreadNotifs.length}</span>
            </button>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 lg:z-30 w-64 h-screen bg-[#1e293b] text-white flex flex-col flex-shrink-0 border-r border-slate-800 transition-transform duration-200 ease-in-out select-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 p-1 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
              <ItOpsLogo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center space-x-1">
                <span>IT</span>
                <span className="text-blue-500">OPS</span>
                
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Ver: 1.0.22</p>
            </div>
          </div>

          {/* Quick Action Button for Mobile Drawer Close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Middle Section */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {/* New Request Action */}
          <div>
            <button
              onClick={() => {
                onCreateNewRequest();
                setMobileOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 active:scale-[0.98] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Request</span>
            </button>
          </div>

          {/* Nav Links Section */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </div>

            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeAppTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onAppTabChange(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                          isActive ? 'bg-white text-blue-700' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Email & SMTP Hub (Dynamic Governance Matrix Permission) */}
          {canViewEmailHub && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Email Communications
              </div>
              <button
                onClick={() => {
                  onOpenSmtpConsole();
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                  activeAppTab === 'emails'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-blue-200'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Mail className={`w-4 h-4 shrink-0 ${activeAppTab === 'emails' ? 'text-white' : 'text-sky-400'}`} />
                  <span className="font-semibold">Email & SMTP Hub</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeAppTab === 'emails'
                      ? 'bg-white text-blue-700'
                      : 'bg-sky-500/20 border border-sky-400/40 text-sky-300'
                  }`}
                >
                  {emailCount} sent
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Sticky Section: Notifications & User Profile with Logout */}
        <div className="p-3 border-t border-white/10 relative shrink-0 bg-slate-900/95 space-y-2">
          {/* Notifications Button */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => {
                if (onOpenNotificationsModal) {
                  onOpenNotificationsModal();
                  setMobileOpen(false);
                } else {
                  setShowNotifMenu(!showNotifMenu);
                }
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                unreadNotifs.length > 0
                  ? 'bg-blue-950/60 hover:bg-blue-900/70 border-blue-600/50 text-white'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Bell className={`w-4 h-4 shrink-0 ${unreadNotifs.length > 0 ? 'text-amber-400' : 'text-blue-400'}`} />
                <span className="font-semibold">Notifications</span>
              </div>
              {unreadNotifs.length > 0 ? (
                <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                  {unreadNotifs.length} new
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">0 unread</span>
              )}
            </button>

            {/* Notifications Popup Dialog (Opens Upward) */}
            {showNotifMenu && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-200">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-400" />
                    <span>Activity Notifications</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400 font-mono">{unreadNotifs.length} unread</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNotifMenu(false);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Close notifications"
                      aria-label="Close notifications"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">No notifications yet</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          onMarkNotificationRead(notif.id);
                          onRequestClick(notif.changeRequestId);
                          setShowNotifMenu(false);
                          setMobileOpen(false);
                        }}
                        className={`p-2.5 cursor-pointer hover:bg-slate-800/80 transition-colors ${
                          !notif.read ? 'bg-blue-950/40' : ''
                        }`}
                      >
                        <div className="font-semibold text-slate-100">{notif.title}</div>
                        <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{notif.message}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 pt-2 pb-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 text-[10px]">Click item to inspect</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifMenu(false)}
                    className="px-2.5 py-1 font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Card & Sign Out */}
          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2.5 shadow-sm">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white shadow shrink-0">
                {getInitials(currentUser.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate" title={currentUser.fullName}>
                  {currentUser.fullName}
                </p>
                <div className="flex items-center space-x-1 text-[10px]">
                  <span className="text-blue-400 font-semibold truncate">{currentUser.role}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 truncate">{currentUser.departmentName}</span>
                </div>
                {delegationCtx.hasActiveDelegation && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/60 font-semibold truncate">
                    <Zap className="w-2.5 h-2.5 shrink-0 text-amber-400 fill-amber-400" />
                    <span className="truncate">Acting HOD ({delegationCtx.effectiveDepartmentName})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Logout Button for ALL User Types */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onLogout();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-slate-700/70 hover:bg-rose-600/90 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-600/60 hover:border-rose-500 shadow-xs cursor-pointer group"
              title="Logout from session"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
