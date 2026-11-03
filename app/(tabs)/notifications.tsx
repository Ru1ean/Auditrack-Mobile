import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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

type Filter = 'all' | 'unread' | 'read';

export default function NotificationsScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
        setUnreadCount(Number(res.data.unread || 0));
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

  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    const date = new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) return 'Recent';
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getNotificationTypeConfig = (type: any) => {
    const kind = String(type || 'info').toLowerCase();
    if (kind === 'success') return { color: '#059669', icon: 'check-circle' as const };
    if (kind === 'warning') return { color: '#d97706', icon: 'warning' as const };
    if (kind === 'error') return { color: '#dc2626', icon: 'error' as const };
    return { color: '#2563eb', icon: 'notifications' as const };
  };

  const resolveNotificationRoute = (item: any) => {
    const table = String(item?.relatedtable || item?.RelatedTable || '').toLowerCase();
    if (table.includes('requirement') || table.includes('evidence') || table.includes('comment') || table.includes('area')) {
      return '/(tabs)/requirements';
    }
    if (table.includes('office')) {
      return '/(tabs)/profile';
    }
    return '/(tabs)/requirements';
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
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
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const userId = Number(currentUser?.userid || 0);
    if (!userId) return;
    try {
      await notificationsAPI.markAllAsRead(userId);
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isread: 1,
          IsRead: 1,
          readat: new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotificationPress = async (item: any) => {
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
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Audit activity & review alerts</Text>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <MaterialIcons name="done-all" size={14} color="#2563eb" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ─── Filter Tabs ─── */}
      <View style={styles.filterRow}>
        {(['all', 'unread', 'read'] as const).map((item) => {
          const active = filter === item;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => {
                setFilter(item);
                setLoading(true);
                void loadData(item);
              }}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item === 'all'
                  ? 'All Alerts'
                  : item === 'unread'
                  ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ''}`
                  : 'Read'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Notifications List ─── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) =>
            String(item.notificationid || item.NotificationID || index)
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="notifications-none" size={48} color="#64748b" />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'You have caught up with all audit alerts.'
                  : 'You do not have any notifications yet.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const notifId = Number(item.notificationid ?? item.NotificationID ?? 0);
            const isRead = Boolean(item.isread || item.IsRead || item.readat);
            const title = item.title || item.Title || 'Notice';
            const message = item.message || item.Message || '';
            const createdAt = item.createdat || item.CreatedAt;
            const typeConfig = getNotificationTypeConfig(item.type || item.Type);

            return (
              <TouchableOpacity
                style={[styles.notifCard, !isRead && styles.notifCardUnread]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.notifIconBox,
                    { backgroundColor: `${typeConfig.color}15` },
                  ]}
                >
                  <MaterialIcons
                    name={typeConfig.icon}
                    size={20}
                    color={typeConfig.color}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.notifTopRow}>
                    <Text
                      style={[
                        styles.notifTitle,
                        !isRead && { color: '#0f172a', fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text style={styles.notifTime}>
                      {formatNotificationTime(createdAt)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.notifMessage,
                      !isRead && { color: '#1e293b' },
                    ]}
                    numberOfLines={3}
                  >
                    {message}
                  </Text>
                </View>

                {!isRead ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 38,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notifCardUnread: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  notifIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    marginRight: 6,
  },
  notifTime: {
    fontSize: 10,
    color: '#64748b',
  },
  notifMessage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 17,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2563eb',
    marginLeft: 6,
    marginTop: 4,
  },
});
