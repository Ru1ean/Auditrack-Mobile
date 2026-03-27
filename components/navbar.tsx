import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from './api';

export default function Navbar() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const res = await api.get('/users/me');
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

  useEffect(() => {
    let timer: any;
    const fetchCounts = async () => {
      if (!currentUser || !currentUser.UserID) return;
      try {
        const res = await api.get(`/notifications/user/${currentUser.UserID}/counts`);
        if (res && res.success && res.data) setUnreadCount(res.data.unread || 0);
      } catch (e) {
        // ignore
      }
    };
    fetchCounts();
    if (currentUser && currentUser.UserID) timer = setInterval(fetchCounts, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  const toggleMenu = () => setMenuOpen((s) => !s);

  return (
    <View style={styles.navbar}>
      <Text style={styles.title}>Auditrack</Text>

      <View style={styles.rightRow}>
        {currentUser && <Text style={styles.userTextShort}>{currentUser.FirstName}</Text>}

        <TouchableOpacity onPress={toggleMenu} style={styles.burger} accessibilityLabel="Open menu">
          <View style={styles.bar} />
          <View style={[styles.bar, styles.barMiddle]} />
          <View style={styles.bar} />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <View style={styles.menu}>
          <TouchableOpacity onPress={() => { setMenuOpen(false); router.replace('/home'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/setup'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Setup</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/events'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Events</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/allc'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>ALLC</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/organizations'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Offices</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/officehead'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Office Personnel</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/users'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Users</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/audit-logs'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>Audit Logs</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity onPress={() => { setMenuOpen(false); router.push('/home/Profile'); }} style={styles.menuItem}>
            <Text style={styles.menuText}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
            <Text style={[styles.menuText, { color: '#d32f2f' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  burger: {
    width: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bar: {
    width: 22,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  barMiddle: {
    marginVertical: 4,
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuText: {
    color: '#e6f0ff',
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 6,
  },
  userTextShort: {
    color: '#fff',
    marginRight: 8,
  },
});
