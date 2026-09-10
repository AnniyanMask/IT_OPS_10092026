import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  X,
  Clock,
  ExternalLink,
  CheckCheck,
  Search,
  Filter,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { NotificationItem, UserProfile } from '../types';
import { formatDisplayDateTime } from '../utils/timezone';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  currentUser: UserProfile;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRequestClick: (crId: string) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkRead,
  onMarkAllRead,
  onRequestClick,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Filter notifications relevant to current user
  const userNotifications = notifications.filter(
    (n) => n.userId === currentUser.id || !n.userId || n.userId === 'all'
  );

  const unreadCount = userNotifications.filter((n) => !n.read).length;
  const readCount = userNotifications.filter((n) => n.read).length;

  const filteredNotifications = userNotifications.filter((n) => {
    // Filter status
    if (activeFilter === 'unread' && n.read) return false;
    if (activeFilter === 'read' && !n.read) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchMsg = n.message.toLowerCase().includes(q);
      const matchCr = n.changeRequestId ? n.changeRequestId.toLowerCase().includes(q) : false;
      return matchTitle || matchMsg || matchCr;
    }

    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Notification Center</h2>
                {unreadCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Activity alerts, workflow updates, and system messages for {currentUser.fullName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close notification center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Filters & Mark All Read */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All ({userNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeFilter === 'unread'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('read')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'read'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Read ({readCount})
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No notifications found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchTerm
                  ? 'No notifications match your search query.'
                  : activeFilter === 'unread'
                  ? 'You are all caught up! No unread notifications.'
                  : 'You do not have any notifications recorded at this time.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`pt-3 first:pt-0 p-3.5 rounded-xl transition-all border ${
                  !notif.read
                    ? 'bg-blue-50/60 border-blue-200/80 shadow-2xs'
                    : 'bg-white border-slate-200/70 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        !notif.read ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          {notif.title}
                        </h4>
                        {!notif.read && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                            New
                          </span>
                        )}
                      </div>

                      {/* Full Message Text without truncation */}
                      <p className="text-xs text-slate-700 leading-relaxed break-words whitespace-pre-line">
                        {notif.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDisplayDateTime(notif.createdAt)}</span>
                        </div>

                        {notif.changeRequestId && (
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400">Request:</span>
                            <span className="font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                              {notif.changeRequestId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {notif.changeRequestId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!notif.read) {
                            onMarkRead(notif.id);
                          }
                          onRequestClick(notif.changeRequestId!);
                          onClose();
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>View Request</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notif.id)}
                        className="text-xs text-slate-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Showing {filteredNotifications.length} of {userNotifications.length} notifications</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
