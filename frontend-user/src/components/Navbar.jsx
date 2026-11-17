import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Shield,
  Bell,
  CheckCircle2,
  Clock,
  Wrench,
  Trash2,
  CheckCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  onMessageListener,
} from '../services/notificationService';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef(null);

  // Fetch notifications from API
  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetchUserNotifications();
      if (res && res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[Navbar] Failed to load notifications:', err.message);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Foreground FCM listener
    const unsubscribeFCM = onMessageListener((payload) => {
      loadNotifications();
    });

    // Listen to custom DOM event
    const handleCustomNotif = () => loadNotifications();
    window.addEventListener('civic:notification_received', handleCustomNotif);

    // Poll periodically every 45s if user is logged in
    const interval = setInterval(loadNotifications, 45000);

    return () => {
      unsubscribeFCM();
      window.removeEventListener('civic:notification_received', handleCustomNotif);
      clearInterval(interval);
    };
  }, [currentUser]);

  // Close drawer on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await markNotificationAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notif._id ? { ...item, read: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('[Navbar] Error marking notification read:', err);
    } finally {
      setIsOpen(false);
      navigate('/my-complaints', {
        state: { highlightId: notif.complaintId || notif.complaint_id },
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Navbar] Error marking all notifications read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('[Navbar] Error clearing all notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getNotifIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('resolved') || t.includes('fixed')) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
    if (t.includes('working') || t.includes('progress') || t.includes('assigned')) {
      return <Wrench className="w-5 h-5 text-blue-600" />;
    }
    return <Clock className="w-5 h-5 text-amber-600" />;
  };

  return (
    <nav className="bg-white border-b border-gray-200 fixed w-full top-0 z-30 flex items-center justify-between px-4 h-16 shadow-sm">
      {/* Left side: Menu & Brand */}
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 mr-2 text-gray-500 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div
          className="flex items-center cursor-pointer select-none"
          onClick={() => navigate('/')}
        >
          <img
            src="/logo.png"
            alt="Civic Logo"
            className="w-9 h-9 rounded-xl object-contain mr-2.5 shadow-sm border border-gray-100"
          />
          <div>
            <span className="font-extrabold text-xl text-gray-900 tracking-tight leading-none block">
              Civic
            </span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block leading-none mt-0.5">
              Citizen Portal
            </span>
          </div>
        </div>

        {/* Desktop Quick Link to Resolved Issues Archive */}
        <div className="hidden md:flex items-center ml-6 gap-1">
          <button
            type="button"
            onClick={() => navigate('/resolved-issues')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Resolved Archive</span>
          </button>
        </div>
      </div>

      {/* Right side: In-App Notification Bell + Smart User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3" ref={drawerRef}>
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors relative"
            title="Notifications"
            aria-label="Open notifications drawer"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Slide-over / Dropdown Notifications Drawer */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Drawer Header */}
              <div className="px-4 py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <>
                      <button
                        onClick={handleMarkAllRead}
                        disabled={loading || unreadCount === 0}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleClearAll}
                        disabled={loading}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                        title="Clear all notifications"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification Items List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2.5">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">No notifications yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      You will receive push updates whenever your complaints are updated.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 hover:bg-blue-50/50 ${
                        !notif.read ? 'bg-blue-50/20' : 'bg-white'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5 p-1.5 rounded-xl bg-gray-100/80">
                        {getNotifIcon(notif.title)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`text-xs font-semibold truncate ${!notif.read ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {formatTimeAgo(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer with view all action */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/my-complaints');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
                >
                  View My Complaints
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Profile Avatar */}
        <button
          onClick={() => navigate('/profile')}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform hover:scale-105"
          title="User Profile"
          aria-label="Go to profile"
        >
          <UserAvatar user={currentUser} size="w-9 h-9 text-xs" />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
