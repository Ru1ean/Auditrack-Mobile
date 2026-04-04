import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { removeToken, usersAPI } from '../components/connect';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getLoggedInUser();
      setUser(response.user || response);
    } catch (err) {
      console.log('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await removeToken();
      await AsyncStorage.removeItem('user');
      router.replace('/login');
    } catch (err) {
      console.log('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  const getApprovalStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return styles.approved;
      case 'pending':
        return styles.pending;
      case 'denied':
        return styles.denied;
      default:
        return styles.pending;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>
            {user?.first_name?.charAt(0)}
            {user?.last_name?.charAt(0)}
          </Text>
        </View>
        <Text style={styles.userName}>
          {user?.first_name} {user?.last_name}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Account Status</Text>
        <View style={[styles.statusBadge, getApprovalStatusStyle(user?.approval_status)]}>
          <Text style={styles.statusValue}>{user?.approval_status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <InfoRow label="First Name" value={user?.first_name} />
        <InfoRow label="Last Name" value={user?.last_name} />
        <InfoRow label="Email" value={user?.email} />
        <InfoRow label="Contact" value={user?.contact_number || 'Not provided'} />
        <InfoRow label="Office" value={user?.office || 'Not assigned'} />
        <InfoRow label="Role" value={user?.role || 'User'} />
        <InfoRow label="Member Since" value={formatDate(user?.created_at)} />
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
          <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const formatDate = (input: any) => {
  if (!input) return 'N/A';
  let dateString = input;
  if (typeof input === 'object') {
    dateString = input.CreatedAt || input.created_at || input.createdAt || input.date || input.EventDate || input.event_date || '';
  }
  try {
    const date = new Date(String(dateString));
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  } catch (e) {
    return 'N/A';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statusCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  approved: {
    backgroundColor: '#d1fae5',
  },
  pending: {
    backgroundColor: '#fef3c7',
  },
  denied: {
    backgroundColor: '#fee2e2',
  },
  infoSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500',
  },
  actionSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  actionButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButtonText: {
    color: '#dc2626',
  },
});
