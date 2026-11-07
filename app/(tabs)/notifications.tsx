import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getStoredUser,
  normalizeUser,
  notificationsAPI,
  usersAPI,
} from '../../components/connect';
import {
  formatNotificationRelativeTime,
  getCategoryStyle,
  getDisplayMessage,
  getNotificationMeta,
} from '../../components/navbar';

type Filter = 'all' | 'unread' | 'read';

export default function NotificationsScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, unread: 0, read: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedNotifIds, setExpandedNotifIds] = useState<Record<number, boolean>>({});

  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const user = res?.user ? normalizeUser(res.user) : null;
      if (user) {
        setCurrentUser(user);
        return user;
      }
    } catch {
      const stored = await getStoredUser();
      if (stored) {
        setCurrentUser(stored);
        return stored;
      }
    }
    return null;
  }, []);

  const fetchCounts = useCallback(async (userId: number) => {
    try {
      const res = await notificationsAPI.getNotificationCounts(userId);
      if (res?.success && res.data) {
        setCounts({
          total: Number(res.data.total || 0),
          unread: Number(res.data.unread || 0),
          read: Number(res.data.read || 0),
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(
    async (userId: number, nextFilter: Filter = filter) => {
      try {
        const res = await notificationsAPI.getUserNotifications(userId, nextFilter);
        if (res?.success) {
          setNotifications(Array.isArray(res.data) ? res.data : []);
        } else {
          setNotifications([]);
        }
      } catch {
        setNotifications([]);
      }
    },
    [filter]
  );

  const loadData = useCallback(
    async (nextFilter: Filter = filter) => {
      const user = currentUser || (await loadUser());
      const userId = Number(user?.userid || user?.UserID || user?.id || 0);
      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await Promise.all([fetchCounts(userId), fetchNotifications(userId, nextFilter)]);
      setLoading(false);
      setRefreshing(false);
    },
    [currentUser, filter, fetchCounts, fetchNotifications, loadUser]
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await loadData();
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadData]);

  const resolveNotificationRoute = (item: any) => {
    const meta = getNotificationMeta(item);
    const table = String(item?.relatedtable || item?.RelatedTable || '').toLowerCase();
    if (meta?.targetPath === '/organization' || table.includes('office')) {
      return '/(tabs)/profile';
    }
    return '/(tabs)/requirements';
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const res = await notificationsAPI.markAsRead(notificationId);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((item) => {
            const id = Number(item.notificationid ?? item.NotificationID ?? 0);
            return id === notificationId
              ? { ...item, isread: 1, IsRead: 1, readat: new Date().toISOString() }
              : item;
          })
        );
        const uid = Number(currentUser?.userid || 0);
        if (uid) {
          await fetchCounts(uid);
        }
      }
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const userId = Number(currentUser?.userid || 0);
    if (!userId) return;
    try {
      const res = await notificationsAPI.markAllAsRead(userId);
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((item) => ({
            ...item,
            isread: 1,
            IsRead: 1,
            readat: new Date().toISOString(),
          }))
        );
        setCounts((prev) => ({
          ...prev,
          unread: 0,
          read: prev.total,
        }));
      }
    } catch {
      // ignore
    }
  };

  const handleViewDetails = async (item: any) => {
    const notificationId = Number(item?.notificationid ?? item?.NotificationID ?? 0);
    const isRead = Boolean(item?.isread || item?.IsRead || item?.readat);
    if (notificationId && !isRead) {
      await markAsRead(notificationId);
    }

    const route = resolveNotificationRoute(item);
    if (route) {
      router.push(route as any);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(filter);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        {/* ─── Header (1:1 Match with Web notif.jsx) ─── */}
        <View style={styles.headerSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <View style={styles.bellBox}>
                <MaterialIcons name="notifications-none" size={20} color="#4f46e5" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.title}>Notifications</Text>
                {counts.unread > 0 ? (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>{counts.unread} new</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {counts.unread > 0 ? (
              <TouchableOpacity
                onPress={markAllAsRead}
                style={styles.markAllBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check" size={14} color="#4f46e5" />
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ─── Segmented Filter Tabs (All / Unread / Read) ─── */}
          <View style={styles.segmentedBar}>
            {(
              [
                { key: 'all', label: 'All', count: counts.total },
                { key: 'unread', label: 'Unread', count: counts.unread },
                { key: 'read', label: 'Read', count: counts.read },
              ] as const
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    setFilter(tab.key);
                    setLoading(true);
                    void loadData(tab.key);
                  }}
                  style={[styles.segmentTab, active && styles.segmentTabActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.segmentCountPill,
                      active && styles.segmentCountPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentCountText,
                        active && styles.segmentCountTextActive,
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

        {/* ─── Notifications List ─── */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item, index) =>
              String(item.notificationid || item.NotificationID || index)
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4f46e5"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <MaterialIcons name="notifications-none" size={28} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>
                  {filter === 'unread'
                    ? "You're all caught up!"
                    : filter === 'read'
                    ? 'No read notifications'
                    : 'No notifications yet'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {filter === 'unread'
                    ? 'You have no unread notifications at the moment.'
                    : 'Important updates about requirements, schedules, and compliance will appear here.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const notifId = Number(item.notificationid ?? item.NotificationID ?? 0);
              const isRead = Boolean(item.isread || item.IsRead || item.readat);
              const title = item.title || item.Title || 'Notice';
              const displayMessage = getDisplayMessage(item);
              const createdAt = item.createdat || item.CreatedAt;
              const style = getCategoryStyle(
                item.type || item.Type,
                item.relatedtable || item.RelatedTable
              );
              const isExpanded = Boolean(expandedNotifIds[notifId]);
              const isLongMessage = displayMessage.length > 130;
              const adminFirst = item.AdminFirstName || item.adminfirstname || '';
              const adminLast = item.AdminLastName || item.adminlastname || '';

              return (
                <TouchableOpacity
                  style={[styles.notifRow, !isRead && styles.notifRowUnread]}
                  onPress={() => {
                    if (!isRead && notifId) {
                      void markAsRead(notifId);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  {!isRead ? <View style={styles.unreadLeftAccent} /> : null}

                  {/* Category Icon */}
                  <View
                    style={[
                      styles.notifIconBox,
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
                    <View style={styles.notifTopRow}>
                      <Text
                        style={[
                          styles.notifTitle,
                          !isRead && styles.notifTitleUnread,
                        ]}
                      >
                        {title}
                      </Text>
                      <View style={styles.notifTimeWrap}>
                        <Text style={styles.notifTime}>
                          {formatNotificationRelativeTime(createdAt)}
                        </Text>
                        {!isRead ? <View style={styles.unreadDot} /> : null}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.notifMessage,
                        !isRead && styles.notifMessageUnread,
                      ]}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {displayMessage}
                    </Text>

                    {/* Meta & Action Row */}
                    <View style={styles.notifFooterRow}>
                      <View style={styles.notifMetaLeft}>
                        <View
                          style={[
                            styles.catBadge,
                            {
                              backgroundColor: style.bg,
                              borderColor: style.border,
                            },
                          ]}
                        >
                          <Text style={[styles.catBadgeText, { color: style.text }]}>
                            {style.badge}
                          </Text>
                        </View>
                        {adminFirst ? (
                          <Text style={styles.senderText}>
                            • by{' '}
                            <Text style={styles.senderName}>
                              {adminFirst} {adminLast}
                            </Text>
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.notifActionsRight}>
                        {isLongMessage ? (
                          <TouchableOpacity
                            onPress={() =>
                              setExpandedNotifIds((prev) => ({
                                ...prev,
                                [notifId]: !prev[notifId],
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
                          onPress={() => handleViewDetails(item)}
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

        {/* Footer */}
        {notifications.length > 0 ? (
          <View style={styles.footerBar}>
            <Text style={styles.footerCountText}>
              Showing {notifications.length} notification
              {notifications.length !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
  },
  cardWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentLabelActive: {
    color: '#0f172a',
  },
  segmentCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  segmentCountPillActive: {
    backgroundColor: '#eef2ff',
  },
  segmentCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  segmentCountTextActive: {
    color: '#4f46e5',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  emptyIconCircle: {
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 18,
  },
  notifRow: {
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
  notifRowUnread: {
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
  notifIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  notifTitleUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  notifTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  notifMessage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  notifMessageUnread: {
    color: '#334155',
  },
  notifFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  notifMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  senderText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  senderName: {
    fontWeight: '600',
    color: '#475569',
  },
  notifActionsRight: {
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
  footerBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  footerCountText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
});
