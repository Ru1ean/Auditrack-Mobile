import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getStoredUser,
  normalizeUser,
  notificationsAPI,
  removeToken,
  storeUser,
  usersAPI,
} from './connect';
import SmartUserAvatar from './SmartUserAvatar';

const META_REGEX = /\n?\[\[meta:(\{[\s\S]*\})\]\]$/;

export function parseMetaFromMessage(message?: string | null) {
  if (!message || typeof message !== 'string') return { cleanMessage: '', meta: null };
  const match = message.match(META_REGEX);
  if (!match) return { cleanMessage: message, meta: null };
  let meta: any = null;
  try {
    meta = JSON.parse(match[1]);
  } catch {
    meta = null;
  }
  const cleanMessage = message.replace(META_REGEX, '').trim();
  return { cleanMessage, meta };
}

export function getNotificationMeta(notification: any) {
  if (!notification) return {};
  if (notification.meta && typeof notification.meta === 'object') return notification.meta;
  const { meta } = parseMetaFromMessage(notification.message || notification.Message || '');
  return meta || {};
}

export function getDisplayMessage(notification: any) {
  if (!notification) return '';
  const { cleanMessage } = parseMetaFromMessage(notification.message || notification.Message || '');
  return cleanMessage || notification.message || notification.Message || '';
}

export function getCategoryStyle(type?: string, relatedTable?: string) {
  const table = String(relatedTable || '').toLowerCase();
  const notifType = String(type || '').toLowerCase();

  if (table.includes('requirement') || table.includes('compliance')) {
    return {
      icon: 'description' as const,
      bg: '#eff6ff',
      text: '#2563eb',
      border: '#dbeafe',
      badge: 'Requirement',
    };
  }
  if (table.includes('audit') || table.includes('schedule')) {
    return {
      icon: 'event' as const,
      bg: '#faf5ff',
      text: '#9333ea',
      border: '#f3e8ff',
      badge: 'Audit',
    };
  }
  if (table.includes('office')) {
    return {
      icon: 'business' as const,
      bg: '#ecfdf5',
      text: '#059669',
      border: '#d1fae5',
      badge: 'Office',
    };
  }
  if (table.includes('user') || table.includes('profile')) {
    return {
      icon: 'person' as const,
      bg: '#fffbeb',
      text: '#d97706',
      border: '#fef3c7',
      badge: 'Account',
    };
  }

  switch (notifType) {
    case 'warning':
    case 'urgent':
      return {
        icon: 'warning' as const,
        bg: '#fffbeb',
        text: '#d97706',
        border: '#fef3c7',
        badge: 'Notice',
      };
    case 'error':
      return {
        icon: 'error' as const,
        bg: '#fef2f2',
        text: '#dc2626',
        border: '#fee2e2',
        badge: 'Alert',
      };
    default:
      return {
        icon: 'notifications' as const,
        bg: '#eef2ff',
        text: '#4f46e5',
        border: '#e0e7ff',
        badge: 'System',
      };
  }
}

export function formatNotificationRelativeTime(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);

  // Modals matching Web Header.jsx
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);

  // Notification popup state matching Web notif.jsx
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifCounts, setNotifCounts] = useState({ total: 0, unread: 0, read: 0 });
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notifLoading, setNotifLoading] = useState(false);
  const [expandedNotifIds, setExpandedNotifIds] = useState<Record<number, boolean>>({});

  // Live clock timer matching Web Header.jsx
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadHeaderUserAndCounts = useCallback(async () => {
    try {
      let currentUser = await getStoredUser();
      if (currentUser) {
        setUser(currentUser);
      }
      try {
        const res = await usersAPI.getLoggedInUser();
        if (res?.success && res.user) {
          const normalized = normalizeUser(res.user);
          setUser(normalized);
          currentUser = normalized;
          await storeUser(normalized);
        }
      } catch {
        // fallback to stored user
      }

      const uid = Number(currentUser?.userid || currentUser?.UserID || currentUser?.id || 0);
      if (uid) {
        const countRes = await notificationsAPI.getNotificationCounts(uid);
        if (countRes?.success && countRes.data) {
          setUnreadCount(Number(countRes.data.unread || 0));
          setNotifCounts({
            total: Number(countRes.data.total || 0),
            unread: Number(countRes.data.unread || 0),
            read: Number(countRes.data.read || 0),
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadHeaderUserAndCounts();
    const interval = setInterval(loadHeaderUserAndCounts, 30000);
    return () => clearInterval(interval);
  }, [loadHeaderUserAndCounts, pathname]);

  const fetchPopupNotifications = useCallback(
    async (filterVal: 'all' | 'unread' | 'read' = notifFilter) => {
      const uid = Number(user?.userid || user?.UserID || user?.id || 0);
      if (!uid) return;
      setNotifLoading(true);
      try {
        const [notifRes, countRes] = await Promise.all([
          notificationsAPI.getUserNotifications(uid, filterVal),
          notificationsAPI.getNotificationCounts(uid),
        ]);
        if (notifRes?.success) {
          setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
        }
        if (countRes?.success && countRes.data) {
          setUnreadCount(Number(countRes.data.unread || 0));
          setNotifCounts({
            total: Number(countRes.data.total || 0),
            unread: Number(countRes.data.unread || 0),
            read: Number(countRes.data.read || 0),
          });
        }
      } catch {
        // ignore
      } finally {
        setNotifLoading(false);
      }
    },
    [notifFilter, user]
  );

  const handleOpenNotifPopup = () => {
    setShowNotifPopup(true);
    void fetchPopupNotifications(notifFilter);
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      const res = await notificationsAPI.markAsRead(notificationId);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => {
            const id = Number(n.notificationid ?? n.NotificationID ?? 0);
            return id === notificationId
              ? { ...n, isread: 1, IsRead: 1, readat: new Date().toISOString() }
              : n;
          })
        );
        const uid = Number(user?.userid || user?.UserID || user?.id || 0);
        if (uid) {
          const countRes = await notificationsAPI.getNotificationCounts(uid);
          if (countRes?.success && countRes.data) {
            setUnreadCount(Number(countRes.data.unread || 0));
            setNotifCounts({
              total: Number(countRes.data.total || 0),
              unread: Number(countRes.data.unread || 0),
              read: Number(countRes.data.read || 0),
            });
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    const uid = Number(user?.userid || user?.UserID || user?.id || 0);
    if (!uid) return;
    try {
      const res = await notificationsAPI.markAllAsRead(uid);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            isread: 1,
            IsRead: 1,
            readat: new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
        setNotifCounts((prev) => ({
          ...prev,
          unread: 0,
          read: prev.total,
        }));
      }
    } catch {
      // ignore
    }
  };

  const handleNavigateFromNotification = async (notification: any) => {
    const id = Number(notification?.notificationid ?? notification?.NotificationID ?? 0);
    const isRead = Boolean(notification?.isread || notification?.IsRead || notification?.readat);
    if (id && !isRead) {
      await handleMarkAsRead(id);
    }

    const meta = getNotificationMeta(notification);
    const relatedTable = String(
      notification?.relatedtable || notification?.RelatedTable || ''
    ).toLowerCase();

    setShowNotifPopup(false);

    if (
      meta?.targetPath === '/organization' ||
      relatedTable.includes('office')
    ) {
      router.push('/(tabs)/profile');
      return;
    }

    router.push('/(tabs)/requirements');
  };

  const handleLogout = async () => {
    setShowProfileDropdown(false);
    await removeToken();
    if (Platform.OS === 'web') {
      localStorage.removeItem('user');
    } else {
      await AsyncStorage.removeItem('user');
    }
    router.replace('/login');
  };

  // Match Web Header.jsx role & name formatting
  const fullName = user
    ? `${user.firstname || user.FirstName || ''} ${
        user.middleinitial || user.MiddleInitial ? `${user.middleinitial || user.MiddleInitial}. ` : ''
      }${user.lastname || user.LastName || ''}`.trim()
    : 'Loading...';

  const firstName = user?.firstname || user?.FirstName || 'User';

  const roleName =
    user?.RoleName ||
    user?.rolename ||
    (user?.roleid === 1
      ? 'Admin'
      : user?.roleid === 2
      ? 'Office Head'
      : user?.roleid === 3
      ? 'Staff'
      : user?.roleid === 4
      ? 'Auditor'
      : 'Office Head');

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.safeAreaNavbar} edges={['top']}>
      <View style={styles.headerContainer}>
        {/* Left: Brand & Greeting (Matches Web Header.jsx) */}
        <View style={styles.leftRow}>
          <Text style={styles.brandLabel}>AUDITRACK</Text>
          <Text style={styles.slashDivider}>/</Text>
          <Text style={styles.greetingText} numberOfLines={1}>
            Hello, <Text style={styles.greetingName}>{fullName}</Text>
          </Text>
          {user ? (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{roleName}</Text>
            </View>
          ) : null}
        </View>

        {/* Right: Date/Time Pill, Notification Bell, User Profile Button */}
        <View style={styles.rightRow}>
          {/* Live Date/Time Pill */}
          <View style={styles.dateTimePill}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.dateText}>{formattedDate}</Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.timeText}>{formattedTime}</Text>
          </View>

          {/* Notification Bell Button */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={handleOpenNotifPopup}
            activeOpacity={0.8}
          >
            <MaterialIcons name="notifications-none" size={20} color="#475569" />
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* User Profile Dropdown Trigger */}
          <TouchableOpacity
            style={[
              styles.profileTrigger,
              showProfileDropdown && styles.profileTriggerActive,
            ]}
            onPress={() => setShowProfileDropdown((prev) => !prev)}
            activeOpacity={0.85}
          >
            <SmartUserAvatar
              user={user}
              fullName={fullName}
              size={28}
              textSize={11}
              ring="#e2e8f0"
            />
            <Text style={styles.profileFirstName} numberOfLines={1}>
              {firstName}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={16}
              color="#94a3b8"
              style={showProfileDropdown ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Profile Dropdown Menu Modal (1:1 Match with Web Header.jsx) ─── */}
      <Modal
        visible={showProfileDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileDropdown(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setShowProfileDropdown(false)}
        >
          <Pressable style={styles.profileDropdownCard} onPress={(e) => e.stopPropagation()}>
            {/* User Identity Info Card */}
            <View style={styles.dropdownUserHeader}>
              <View style={styles.dropdownUserRow}>
                <SmartUserAvatar
                  user={user}
                  fullName={fullName}
                  size={40}
                  textSize={14}
                  ring="#ffffff"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.dropdownUserName} numberOfLines={1}>
                    {fullName}
                  </Text>
                  <Text style={styles.dropdownUserEmail} numberOfLines={1}>
                    {user?.Email || user?.email || 'No email set'}
                  </Text>
                  <View style={styles.dropdownRoleTag}>
                    <Text style={styles.dropdownRoleTagText}>{roleName}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.dropdownMenuSection}>
              <TouchableOpacity
                style={styles.dropdownMenuItem}
                onPress={() => {
                  setShowProfileDropdown(false);
                  router.push('/(tabs)/profile');
                }}
                activeOpacity={0.75}
              >
                <View style={styles.dropdownMenuIconBox}>
                  <MaterialIcons name="business" size={16} color="#64748b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownMenuTitle}>Programs &amp; Offices</Text>
                  <Text style={styles.dropdownMenuSub}>
                    View assigned compliance offices
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownMenuItem}
                onPress={() => {
                  setShowProfileDropdown(false);
                  router.push('/(tabs)/account');
                }}
                activeOpacity={0.75}
              >
                <View style={styles.dropdownMenuIconBox}>
                  <MaterialIcons name="person-outline" size={16} color="#64748b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownMenuTitle}>My Profile</Text>
                  <Text style={styles.dropdownMenuSub}>Account details &amp; password</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Sign Out */}
            <View style={styles.dropdownFooterSection}>
              <TouchableOpacity
                style={styles.dropdownSignOutItem}
                onPress={handleLogout}
                activeOpacity={0.75}
              >
                <View style={styles.dropdownSignOutIconBox}>
                  <MaterialIcons name="logout" size={16} color="#ef4444" />
                </View>
                <Text style={styles.dropdownSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Notification Popup Modal (1:1 Match with Web notif.jsx) ─── */}
      <Modal
        visible={showNotifPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifPopup(false)}
      >
        <Pressable
          style={styles.notifOverlay}
          onPress={() => setShowNotifPopup(false)}
        >
          <Pressable style={styles.notifModalCard} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.notifHeaderSection}>
              <View style={styles.notifTitleRow}>
                <View style={styles.notifTitleLeft}>
                  <View style={styles.notifBellBox}>
                    <MaterialIcons name="notifications-none" size={20} color="#4f46e5" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.notifHeaderTitle}>Notifications</Text>
                    {notifCounts.unread > 0 ? (
                      <View style={styles.newCountBadge}>
                        <Text style={styles.newCountBadgeText}>
                          {notifCounts.unread} new
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.notifHeaderActions}>
                  {notifCounts.unread > 0 ? (
                    <TouchableOpacity
                      style={styles.markAllReadBtn}
                      onPress={handleMarkAllAsRead}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="check" size={14} color="#4f46e5" />
                      <Text style={styles.markAllReadText}>Mark all read</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.notifCloseBtn}
                    onPress={() => setShowNotifPopup(false)}
                  >
                    <MaterialIcons name="close" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter Segmented Tabs */}
              <View style={styles.notifSegmentedBar}>
                {(
                  [
                    { key: 'all', label: 'All', count: notifCounts.total },
                    { key: 'unread', label: 'Unread', count: notifCounts.unread },
                    { key: 'read', label: 'Read', count: notifCounts.read },
                  ] as const
                ).map((tab) => {
                  const isActive = notifFilter === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.notifSegmentTab,
                        isActive && styles.notifSegmentTabActive,
                      ]}
                      onPress={() => {
                        setNotifFilter(tab.key);
                        void fetchPopupNotifications(tab.key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.notifSegmentLabel,
                          isActive && styles.notifSegmentLabelActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.notifSegmentCountPill,
                          isActive && styles.notifSegmentCountPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.notifSegmentCountText,
                            isActive && styles.notifSegmentCountTextActive,
                          ]}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Notification List Body */}
            <View style={{ flex: 1 }}>
              {notifLoading ? (
                <View style={styles.notifEmptyWrap}>
                  <ActivityIndicator size="large" color="#4f46e5" />
                  <Text style={styles.notifEmptySub}>Loading notifications...</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.notifEmptyWrap}>
                  <View style={styles.notifEmptyIconCircle}>
                    <MaterialIcons name="notifications-none" size={28} color="#94a3b8" />
                  </View>
                  <Text style={styles.notifEmptyTitle}>
                    {notifFilter === 'unread'
                      ? "You're all caught up!"
                      : notifFilter === 'read'
                      ? 'No read notifications'
                      : 'No notifications yet'}
                  </Text>
                  <Text style={styles.notifEmptySub}>
                    {notifFilter === 'unread'
                      ? 'You have no unread notifications at the moment.'
                      : 'Important updates about requirements, schedules, and compliance will appear here.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={(item, idx) =>
                    String(item.notificationid ?? item.NotificationID ?? idx)
                  }
                  renderItem={({ item }) => {
                    const id = Number(item.notificationid ?? item.NotificationID ?? 0);
                    const isRead = Boolean(item.isread || item.IsRead || item.readat);
                    const style = getCategoryStyle(
                      item.type || item.Type,
                      item.relatedtable || item.RelatedTable
                    );
                    const displayMessage = getDisplayMessage(item);
                    const isExpanded = Boolean(expandedNotifIds[id]);
                    const isLongMessage = displayMessage.length > 130;
                    const adminFirst = item.AdminFirstName || item.adminfirstname || '';
                    const adminLast = item.AdminLastName || item.adminlastname || '';

                    return (
                      <TouchableOpacity
                        style={[
                          styles.notifRowItem,
                          !isRead && styles.notifRowItemUnread,
                        ]}
                        onPress={() => {
                          if (!isRead && id) {
                            void handleMarkAsRead(id);
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        {!isRead ? <View style={styles.unreadLeftAccent} /> : null}

                        {/* Category Icon */}
                        <View
                          style={[
                            styles.notifCatIconBox,
                            {
                              backgroundColor: style.bg,
                              borderColor: style.border,
                            },
                          ]}
                        >
                          <MaterialIcons name={style.icon} size={18} color={style.text} />
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1 }}>
                          <View style={styles.notifItemTopRow}>
                            <Text
                              style={[
                                styles.notifItemTitle,
                                !isRead && styles.notifItemTitleUnread,
                              ]}
                            >
                              {item.title || item.Title || 'Notice'}
                            </Text>
                            <View style={styles.notifItemTimeRow}>
                              <Text style={styles.notifItemTimeText}>
                                {formatNotificationRelativeTime(
                                  item.createdat || item.CreatedAt
                                )}
                              </Text>
                              {!isRead ? <View style={styles.unreadBlueDot} /> : null}
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.notifItemMessage,
                              !isRead && styles.notifItemMessageUnread,
                            ]}
                            numberOfLines={isExpanded ? undefined : 2}
                          >
                            {displayMessage}
                          </Text>

                          {/* Meta Footer Row */}
                          <View style={styles.notifItemFooterRow}>
                            <View style={styles.notifItemMetaLeft}>
                              <View
                                style={[
                                  styles.notifCatBadge,
                                  {
                                    backgroundColor: style.bg,
                                    borderColor: style.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[styles.notifCatBadgeText, { color: style.text }]}
                                >
                                  {style.badge}
                                </Text>
                              </View>
                              {adminFirst ? (
                                <Text style={styles.notifSenderText}>
                                  • by{' '}
                                  <Text style={styles.notifSenderName}>
                                    {adminFirst} {adminLast}
                                  </Text>
                                </Text>
                              ) : null}
                            </View>

                            <View style={styles.notifItemActionsRight}>
                              {isLongMessage ? (
                                <TouchableOpacity
                                  onPress={() =>
                                    setExpandedNotifIds((prev) => ({
                                      ...prev,
                                      [id]: !prev[id],
                                    }))
                                  }
                                >
                                  <Text style={styles.seeMoreText}>
                                    {isExpanded ? 'See less' : 'See more'}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}

                              <TouchableOpacity
                                style={styles.viewDetailsBtn}
                                onPress={() => handleNavigateFromNotification(item)}
                              >
                                <Text style={styles.viewDetailsText}>View Details →</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>

            {/* Footer */}
            {notifications.length > 0 ? (
              <View style={styles.notifModalFooter}>
                <Text style={styles.notifFooterCount}>
                  Showing {notifications.length} notification
                  {notifications.length !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity onPress={() => setShowNotifPopup(false)}>
                  <Text style={styles.notifFooterCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaNavbar: {
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    height: 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  slashDivider: {
    fontSize: 12,
    color: '#cbd5e1',
    marginHorizontal: 5,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flexShrink: 1,
  },
  greetingName: {
    fontWeight: '700',
    color: '#0f172a',
  },
  rolePill: {
    marginLeft: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimePill: {
    display: Platform.OS === 'web' ? 'flex' : 'none',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileTriggerActive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  profileFirstName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 72,
  },
  // Profile Dropdown Modal
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 96 : 62,
    paddingRight: 12,
  },
  profileDropdownCard: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  dropdownUserHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownUserEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  dropdownRoleTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  dropdownRoleTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownMenuSection: {
    padding: 6,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  dropdownMenuIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownMenuSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  dropdownFooterSection: {
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dropdownSignOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  dropdownSignOutIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSignOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  // Notification Popup Modal (Matching Web notif.jsx)
  notifOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  notifModalCard: {
    width: '100%',
    maxWidth: 520,
    height: '80%',
    maxHeight: 620,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  notifHeaderSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notifTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBellBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  newCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  newCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  notifHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  markAllReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4f46e5',
  },
  notifCloseBtn: {
    padding: 6,
    borderRadius: 8,
  },
  notifSegmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  notifSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  notifSegmentTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  notifSegmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  notifSegmentLabelActive: {
    color: '#0f172a',
  },
  notifSegmentCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  notifSegmentCountPillActive: {
    backgroundColor: '#eef2ff',
  },
  notifSegmentCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  notifSegmentCountTextActive: {
    color: '#4f46e5',
  },
  notifEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  notifEmptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  notifEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  notifEmptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  notifRowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  notifRowItemUnread: {
    backgroundColor: 'rgba(238, 242, 255, 0.45)',
  },
  unreadLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: '#4f46e5',
  },
  notifCatIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 18,
  },
  notifItemTitleUnread: {
    fontWeight: '700',
    color: '#0f172a',
  },
  notifItemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifItemTimeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  unreadBlueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  notifItemMessage: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  notifItemMessageUnread: {
    color: '#334155',
  },
  notifItemFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  notifItemMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifCatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  notifCatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  notifSenderText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  notifSenderName: {
    fontWeight: '600',
    color: '#475569',
  },
  notifItemActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seeMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  viewDetailsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  notifModalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifFooterCount: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  notifFooterCloseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
