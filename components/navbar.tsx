import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from './connect';

const DRAWER_WIDTH = 280;
const { width } = Dimensions.get('window');

export default function Navbar() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [drawerAnim] = useState(new Animated.Value(-DRAWER_WIDTH));
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const res = await connect.get('/user/me');
        if (res && res.success) setCurrentUser(res.user);
        else {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) setCurrentUser(JSON.parse(userStr));
        }
      } catch (e) {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) setCurrentUser(JSON.parse(userStr));
      }
    };
    fetchUser();
  }, []);

  const fetchNotificationCounts = async () => {
    if (!currentUser || !currentUser.UserID) return;
    try {
      const res = await connect.get(`/notifications/user/${currentUser.UserID}/counts`);
      if (res && res.success && res.data) setUnreadCount(Number(res.data.unread || 0));
    } catch {
      // ignore
    }
  };

  const fetchNotifications = async (filter: 'all' | 'unread' | 'read' = notificationFilter) => {
    if (!currentUser || !currentUser.UserID) return;
    try {
      setNotificationsLoading(true);
      const res = await connect.get(`/notifications/user/${currentUser.UserID}?filter=${filter}`);
      if (res && res.success) {
        setNotifications(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    fetchNotificationCounts();
    if (currentUser && currentUser.UserID) timer = setInterval(fetchNotificationCounts, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications(notificationFilter);
    }
  }, [showNotifications, notificationFilter]);

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

  const markAsRead = async (notificationId: number) => {
    try {
      await connect.put(`/notifications/${notificationId}/read`, {});
      setNotifications((prev) => prev.map((item) => (
        Number(item.NotificationID) === Number(notificationId)
          ? { ...item, IsRead: 1, ReadAt: new Date().toISOString() }
          : item
      )));
      fetchNotificationCounts();
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser?.UserID) return;
    try {
      await connect.put(`/notifications/user/${currentUser.UserID}/read-all`, {});
      setNotifications((prev) => prev.map((item) => ({ ...item, IsRead: 1, ReadAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
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

  const handleNotificationPress = async (item: any) => {
    const notificationId = Number(item?.NotificationID || 0);
    if (notificationId && !item?.IsRead) {
      await markAsRead(notificationId);
    }

    const route = resolveNotificationRoute(item);
    if (route) {
      setShowNotifications(false);
      router.push(route as any);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
    Animated.timing(drawerAnim, {
      toValue: menuOpen ? -DRAWER_WIDTH : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    setMenuOpen(false);
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const navigate = (route: string) => {
    closeMenu();
    router.push(route as any);
  };

  return (
    <>
      <SafeAreaView style={styles.safeAreaNavbar} edges={['top']}>
        <View style={styles.navbar}>
          <TouchableOpacity onPress={toggleMenu} style={styles.burger} accessibilityLabel="Open menu">
            <View style={styles.bar} />
            <View style={[styles.bar, styles.barMiddle]} />
            <View style={styles.bar} />
          </TouchableOpacity>

          <Text style={styles.title}>Auditrack</Text>

          <View style={styles.spacer} />

          <TouchableOpacity
            onPress={() => setShowNotifications(true)}
            style={styles.notificationBtn}
            accessibilityLabel="Open notifications"
          >
            <Text style={styles.notificationBtnIcon}>N</Text>
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {menuOpen && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeMenu} />
      )}

      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: drawerAnim }],
          },
        ]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Auditrack</Text>
          <TouchableOpacity onPress={closeMenu} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.drawerContent}>
          {/* ANALYZE Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ANALYZE</Text>
            <TouchableOpacity onPress={() => navigate('/(tabs)')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>📊 Dashboard</Text>
            </TouchableOpacity>
          </View>

          {/* MANAGEMENT Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MANAGEMENT</Text>
            <TouchableOpacity onPress={() => navigate('/(tabs)/events')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>📅 Events</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate('/(tabs)/requirements')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>📋 Standards</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate('/(tabs)/profile')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>🏢 Offices</Text>
            </TouchableOpacity>
          </View>

          {/* USERS Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>USERS</Text>
            <TouchableOpacity onPress={() => navigate('/(tabs)/office-personnel')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>👤 Office Personnel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate('/(tabs)/explore')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>👥 Users</Text>
            </TouchableOpacity>
          </View>

          {/* LOGS Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOGS</Text>
            <TouchableOpacity onPress={() => navigate('/(tabs)')} style={styles.drawerMenuItem}>
              <Text style={styles.drawerMenuText}>📝 Audit Logs</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.drawerFooter}>
          <TouchableOpacity style={styles.userProfileButton}>
            <View style={styles.userAvatarCircle}>
              <Text style={styles.userAvatarText}>
                {currentUser?.FirstName?.charAt(0).toUpperCase() || 'A'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {currentUser?.FirstName} {currentUser?.LastName}
              </Text>
              <Text style={styles.userRole}>View Profile</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable style={styles.notificationsOverlay} onPress={() => setShowNotifications(false)}>
          <Pressable style={styles.notificationsCard} onPress={() => {}}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={styles.markAllReadBtn}>
                  <Text style={styles.markAllReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterRow}>
              {(['all', 'unread', 'read'] as const).map((item) => {
                const active = notificationFilter === item;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setNotificationFilter(item)}
                    style={[styles.filterBtn, active && styles.filterBtnActive]}
                  >
                    <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {notificationsLoading ? (
              <View style={styles.notificationsLoadingWrap}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.notificationsLoadingText}>Loading...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.notificationsEmptyWrap}>
                <Text style={styles.notificationsEmptyText}>No notifications found.</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item?.NotificationID || Math.random())}
                style={styles.notificationsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isRead = Boolean(item?.IsRead);
                  return (
                    <TouchableOpacity
                      style={[styles.notificationItem, !isRead && styles.notificationItemUnread]}
                      onPress={() => handleNotificationPress(item)}
                    >
                      <View style={[styles.notificationTypeDot, { backgroundColor: getNotificationTypeColor(item?.Type) }]} />
                      <View style={styles.notificationItemBody}>
                        <View style={styles.notificationItemTopRow}>
                          <Text style={styles.notificationItemTitle} numberOfLines={1}>{item?.Title || 'Notification'}</Text>
                          {!isRead && <View style={styles.notificationUnreadDot} />}
                        </View>
                        <Text style={styles.notificationItemMessage} numberOfLines={2}>{item?.Message || ''}</Text>
                        <Text style={styles.notificationItemTime}>{formatNotificationTime(item?.CreatedAt)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeAreaNavbar: {
    backgroundColor: '#1e293b',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  title: {
    color: '#0891b2',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  spacer: {
    flex: 1,
  },
  notificationBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBtnIcon: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '800',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 10,
  },
  burger: {
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 24,
    height: 2.5,
    backgroundColor: '#0891b2',
    borderRadius: 1.25,
  },
  barMiddle: {
    marginVertical: 5,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0f172a',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    flexDirection: 'column',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  drawerTitle: {
    color: '#0891b2',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 24,
    fontWeight: 'bold',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  drawerMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  drawerMenuText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  drawerFooter: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  userProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  userAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  userRole: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  notificationsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 70,
    paddingHorizontal: 10,
  },
  notificationsCard: {
    width: '100%',
    maxWidth: 410,
    maxHeight: 560,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  notificationsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationsTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  markAllReadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  markAllReadText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  filterBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  notificationsLoadingWrap: {
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notificationsLoadingText: {
    color: '#64748b',
    fontSize: 12,
  },
  notificationsEmptyWrap: {
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsEmptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  notificationsList: {
    maxHeight: 430,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  notificationItemUnread: {
    backgroundColor: '#f8fbff',
  },
  notificationTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  notificationItemBody: {
    flex: 1,
  },
  notificationItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  notificationItemTitle: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  notificationUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2563eb',
  },
  notificationItemMessage: {
    marginTop: 2,
    color: '#475569',
    fontSize: 11,
    lineHeight: 15,
  },
  notificationItemTime: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
});
