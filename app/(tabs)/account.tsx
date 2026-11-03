import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SmartUserAvatar from '../../components/SmartUserAvatar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  areasAPI,
  getProfilePicUrl,
  getStoredUser,
  normalizeUser,
  personnelAssignmentsAPI,
  removeToken,
  storeUser,
  usersAPI,
} from '../../components/connect';

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Auditor specific assigned areas
  const [auditorAreas, setAuditorAreas] = useState<any[]>([]);
  // Personnel specific assignments
  const [personnelScope, setPersonnelScope] = useState<any | null>(null);

  // Change Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const nextUser = res?.user ? normalizeUser(res.user) : null;
      if (nextUser) {
        setUser(nextUser);
        await storeUser(nextUser);

        const uid = Number(nextUser.userid);
        if (nextUser.isAuditor && uid) {
          areasAPI
            .getAuditorAssignments(uid)
            .then((arRes: any) => {
              const list = Array.isArray(arRes?.assignments)
                ? arRes.assignments
                : Array.isArray(arRes?.data)
                ? arRes.data
                : [];
              setAuditorAreas(list);
            })
            .catch(() => {});
        } else if (nextUser.isPersonnel && uid) {
          personnelAssignmentsAPI
            .getMyAssignments()
            .then((pRes: any) => {
              if (pRes?.success) setPersonnelScope(pRes);
            })
            .catch(() => {});
        }

        return nextUser;
      }
    } catch {
      const stored = await getStoredUser();
      if (stored) {
        setUser(stored);
        return stored;
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await loadUser();
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadUser]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await removeToken();
          if (Platform.OS === 'web') {
            localStorage.removeItem('user');
          } else {
            await AsyncStorage.removeItem('user');
          }
          router.replace('/login');
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    setUpdatingPassword(true);
    setPasswordError('');

    try {
      const res = await usersAPI.changePassword({
        currentPassword,
        newPassword,
      });

      if (res?.success) {
        Alert.alert('Success', 'Password has been updated successfully.');
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordError(res?.message || 'Failed to update password.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  const handlePickProfilePhoto = async () => {
    if (uploadingPhoto) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      const uid = user?.userid || user?.id;
      if (!uid) {
        Alert.alert('Error', 'User ID not found. Please log in again.');
        return;
      }

      setUploadingPhoto(true);
      const updateRes = await usersAPI.uploadProfilePic(
        uid,
        asset.uri,
        asset.name,
        asset.mimeType || 'image/jpeg'
      );

      if (updateRes && (updateRes.success || updateRes.user)) {
        await loadUser();
        Alert.alert('Photo Updated', 'Your profile photo has been updated successfully.');
      } else {
        Alert.alert('Upload Failed', updateRes?.message || 'Could not update profile photo.');
      }
    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      Alert.alert('Error', err?.message || 'Failed to update profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const isAuditor = Boolean(user?.isAuditor);
  const fullName =
    `${user?.firstname || user?.FirstName || ''} ${user?.lastname || user?.LastName || ''}`.trim() ||
    user?.Email ||
    user?.email ||
    'Compliance User';

  const initial = (fullName.charAt(0) || 'U').toUpperCase();
  const avatarUrl = getProfilePicUrl(user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Profile Summary Card ─── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={handlePickProfilePhoto}
            activeOpacity={0.85}
          >
            <SmartUserAvatar
              user={user}
              fullName={fullName}
              size={78}
              textSize={26}
              ring={isAuditor ? '#93c5fd' : '#e2e8f0'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarEditBadge}
            onPress={handlePickProfilePhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.8}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name="camera-alt" size={13} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{user?.Email || user?.email || ''}</Text>

        <View
          style={[
            styles.roleBadge,
            isAuditor ? styles.roleBadgeAuditor : styles.roleBadgePersonnel,
          ]}
        >
          <MaterialIcons
            name={isAuditor ? 'verified-user' : 'badge'}
            size={14}
            color={isAuditor ? '#38bdf8' : '#34d399'}
          />
          <Text
            style={[
              styles.roleText,
              isAuditor ? styles.roleTextAuditor : styles.roleTextPersonnel,
            ]}
          >
            {isAuditor ? 'External Auditor' : 'Office Personnel'}
          </Text>
        </View>
      </View>

      {/* ─── Assigned Scope Section ─── */}
      {isAuditor ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ASSIGNED AUDIT SCOPE</Text>
          {auditorAreas.length === 0 ? (
            <View style={styles.scopeEmptyCard}>
              <MaterialIcons name="assignment-late" size={24} color="#64748b" />
              <Text style={styles.scopeEmptyText}>
                No audit areas assigned yet. Contact institutional administration.
              </Text>
            </View>
          ) : (
            auditorAreas.map((area, idx) => (
              <View key={`area-scope-${idx}`} style={styles.scopeItemCard}>
                <View style={styles.scopeCodeBadge}>
                  <Text style={styles.scopeCodeText}>
                    {area.areacode || area.AreaCode || 'AREA'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.scopeName}>
                    {area.areaname || area.AreaName || 'Assigned Area'}
                  </Text>
                  <Text style={styles.scopeMeta}>
                    {area.eventname || area.EventName || 'Accreditation Event'}
                  </Text>
                </View>
                <MaterialIcons name="verified" size={18} color="#2563eb" />
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PERSONNEL ASSIGNMENTS</Text>
          <View style={styles.scopeStatsRow}>
            <View style={styles.scopeStatBox}>
              <Text style={styles.scopeStatNumber}>
                {(personnelScope?.assignedRequirementIds || []).length}
              </Text>
              <Text style={styles.scopeStatLabel}>Standards</Text>
            </View>
            <View style={styles.scopeStatBox}>
              <Text style={styles.scopeStatNumber}>
                {(personnelScope?.assignedCriteriaIds || []).length}
              </Text>
              <Text style={styles.scopeStatLabel}>Sub Areas</Text>
            </View>
            <View style={styles.scopeStatBox}>
              <Text style={styles.scopeStatNumber}>
                {(personnelScope?.assignedAreaIds || []).length}
              </Text>
              <Text style={styles.scopeStatLabel}>Areas</Text>
            </View>
          </View>
        </View>
      )}

      {/* ─── Account Actions ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.8}
        >
          <View style={styles.actionIconBox}>
            <MaterialIcons name="person-outline" size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.actionItemTitle}>Edit Profile Information</Text>
            <Text style={styles.actionItemSub}>Update name and details</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => setShowPasswordModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.actionIconBox}>
            <MaterialIcons name="lock-outline" size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.actionItemTitle}>Change Password</Text>
            <Text style={styles.actionItemSub}>Update login credentials</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* ─── Sign Out Button ─── */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <MaterialIcons name="logout" size={18} color="#dc2626" />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      {/* ─── Change Password Modal ─── */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSub}>
              Ensure your new password contains at least 6 characters.
            </Text>

            {passwordError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Enter current password"
              placeholderTextColor="#64748b"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Enter new password"
              placeholderTextColor="#64748b"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Re-enter new password"
              placeholderTextColor="#64748b"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPasswordError('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  avatarAuditor: {
    backgroundColor: '#1d4ed8',
    borderColor: '#93c5fd',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  roleBadgeAuditor: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  roleBadgePersonnel: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  roleTextAuditor: {
    color: '#1d4ed8',
  },
  roleTextPersonnel: {
    color: '#059669',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingLeft: 4,
  },
  scopeEmptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scopeEmptyText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  scopeItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  scopeCodeBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scopeCodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  scopeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  scopeMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  scopeStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeStatBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  scopeStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  scopeStatLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 3,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 10,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 11,
    color: '#dc2626',
    marginLeft: 6,
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSaveBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
});
