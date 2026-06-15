import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { connect } from '../../components/connect';

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
      const res = await connect.get('/user/me');
      if (res?.success) {
        setCurrentUser(res.user);
        return res.user;
      }
    } catch {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        return user;
      }
    }
    return null;
  }, []);

  const fetchCounts = useCallback(async (userId: number) => {
    try {
      const res = await connect.get(`/notifications/user/${userId}/counts`);
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
        const res = await connect.get(`/notifications/user/${userId}?filter=${nextFilter}`);
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
      const userId = Number(user?.UserID || user?.id || 0);
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
    void loadData();
  }, [filter]);

  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getNotificationTypeColor = (type: any) => {
    const kind = String(type || 'info').toLowerCase();
    if (kind === 'success') return '#16a34a';
    if (kind === 'warning') return '#ea580c';
    if (kind === 'error') return '#dc2626';
    if (kind === 'announcement') return '#7c3aed';
    return '#2563eb';
  };

  const resolveNotificationRoute = (item: any) => {
    const table = String(item?.RelatedTable || '').toLowerCase();
    if (table.includes('event')) return '/(tabs)/events';
    if (table.includes('requirement')) return '/(tabs)/requirements';
    if (table.includes('office_head') || table.includes('office_personnel')) return '/(tabs)/office-personnel';
    if (table.includes('offices')) return '/(tabs)/profile';
    if (table.includes('users_role') || table.includes('user')) return '/(tabs)/explore';
    return '';
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await connect.put(`/notifications/${notificationId}/read`, {});
      setNotifications((prev) =>
        prev.map((item) =>
          Number(item.NotificationID) === Number(notificationId)
            ? { ...item, IsRead: 1, ReadAt: new Date().toISOString() }
            : item
        )
      );
      if (currentUser?.UserID) {
        await fetchCounts(Number(currentUser.UserID));
      }
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const userId = Number(currentUser?.UserID || 0);
    if (!userId) return;
    try {
      await connect.put(`/notifications/user/${userId}/read-all`, {});
      setNotifications((prev) => prev.map((item) => ({ ...item, IsRead: 1, ReadAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotificationPress = async (item: any) => {
    const notificationId = Number(item?.NotificationID || 0);
    if (notificationId && !item?.IsRead) {
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
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'unread', 'read'] as const).map((item) => {
          const active = filter === item;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => {
                setFilter(item);
                setLoading(true);
              }}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#0891b2" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>No notifications found.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item?.NotificationID || Math.random())}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isRead = Boolean(item?.IsRead);
            return (
              <TouchableOpacity
                style={[styles.notificationItem, !isRead && styles.notificationItemUnread]}
                onPress={() => void handleNotificationPress(item)}
              >
                <View style={[styles.typeDot, { backgroundColor: getNotificationTypeColor(item?.Type) }]} />
                <View style={styles.itemBody}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item?.Title || 'Notification'}
                    </Text>
                    {!isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemMessage} numberOfLines={2}>
                    {item?.Message || ''}
                  </Text>
                  <Text style={styles.itemTime}>{formatNotificationTime(item?.CreatedAt)}</Text>
                </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
  },
  markAllText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    borderColor: '#0891b2',
    backgroundColor: '#ecfeff',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterBtnTextActive: {
    color: '#0e7490',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  notificationItemUnread: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0891b2',
  },
  itemMessage: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  itemTime: {
    marginTop: 6,
    fontSize: 11,
    color: '#94a3b8',
  },
});
