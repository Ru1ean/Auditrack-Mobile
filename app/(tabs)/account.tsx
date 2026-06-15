import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usersAPI } from '../../components/connect';

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const nextUser = res?.user || res;
      setUser(nextUser);
      if (nextUser) {
        await AsyncStorage.setItem('user', JSON.stringify(nextUser));
      }
    } catch {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  const displayName = [user?.FirstName, user?.LastName].filter(Boolean).join(' ') || user?.email || 'User';
  const roleName = user?.RoleName || user?.role_name || user?.role || 'User';
  const initials = String(user?.FirstName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email || user?.Email || ''}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleName}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.actionBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.logoutBtn]} onPress={handleLogout}>
          <Text style={[styles.actionBtnText, styles.logoutText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0891b2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
  },
  roleBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
  },
  roleText: {
    color: '#0e7490',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  logoutBtn: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  logoutText: {
    color: '#dc2626',
  },
});
