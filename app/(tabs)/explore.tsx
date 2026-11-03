import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { BASE_URL, getProfilePicUrl, usersAPI } from '../../components/connect';
import SmartUserAvatar from '../../components/SmartUserAvatar';

const APPROVAL_FILTER_OPTIONS = [
  { value: 'all', label: 'All Personnel' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'denied', label: 'Denied' },
];

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'officehead', label: 'Office Head' },
];

const UPLOADS_BASE_URL = BASE_URL.replace(/\/api\/?$/, '');

const normalizeRoleKey = (value: any) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getUserId = (person: any) => String(person?.UserID || person?.user_id || person?.id || Math.random());

const getFullName = (person: any) => {
  const first = person?.FirstName || person?.first_name || '';
  const middle = person?.MiddleInitial || person?.middle_initial;
  const last = person?.LastName || person?.last_name || '';
  return `${first}${middle ? ` ${middle}.` : ''} ${last}`.trim() || 'Unknown User';
};

const getRoleLabel = (person: any) => {
  if (person?.RoleName) return person.RoleName;
  if (person?.role_name) return person.role_name;
  if (person?.RoleID === 1 || person?.role_id === 1) return 'Admin';
  if (person?.RoleID === 3 || person?.role_id === 3) return 'Office Head';
  return 'User';
};

const getRoleKey = (person: any) => normalizeRoleKey(getRoleLabel(person));

const getApprovalValue = (person: any) => String(person?.approval_status || person?.ApprovalStatus || 'pending').toLowerCase();

const getApprovalLabel = (person: any) => {
  const status = getApprovalValue(person);
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getAssignedOffices = (person: any) => {
  if (Array.isArray(person?.AssignedOffices)) return person.AssignedOffices;
  if (Array.isArray(person?.assigned_offices)) return person.assigned_offices;
  if (Array.isArray(person?.Offices)) return person.Offices;
  return [];
};

const getAvatarUri = (person: any) => {
  if (person?.TempPreview) return String(person.TempPreview);
  return getProfilePicUrl(person) || '';
};

const getInitials = (person: any) => {
  const first = String(person?.FirstName || person?.first_name || 'U').trim();
  const last = String(person?.LastName || person?.last_name || '').trim();
  return `${first.charAt(0)}${last.charAt(0) || ''}`.toUpperCase();
};

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [newApprovalStatus, setNewApprovalStatus] = useState('pending');
  const [newRoleID, setNewRoleID] = useState(2);
  const [updating, setUpdating] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await usersAPI.getAllUsers();
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.users)
          ? response.users
          : Array.isArray(response?.data)
            ? response.data
            : [];
      setUsers(list);
    } catch (error) {
      console.log('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadUsers();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const openUserEditModal = (person: any) => {
    const currentRole = Number(person?.RoleID || person?.role_id || 2);
    setSelectedUser(person);
    setNewApprovalStatus(getApprovalValue(person));
    setNewRoleID(currentRole === 1 ? 1 : 2);
    setShowUserEditModal(true);
  };

  const closeUserEditModal = () => {
    if (updating) return;
    setShowUserEditModal(false);
    setSelectedUser(null);
  };

  const saveUserUpdates = async () => {
    if (!selectedUser) return;

    const userId = String(selectedUser?.UserID || selectedUser?.user_id || selectedUser?.id || '');
    if (!userId) {
      Alert.alert('Error', 'Unable to update this user. Missing user ID.');
      return;
    }

    const currentApproval = getApprovalValue(selectedUser);
    const currentRole = Number(selectedUser?.RoleID || selectedUser?.role_id || 2);
    const normalizedCurrentRole = currentRole === 1 ? 1 : 2;

    const statusChanged = newApprovalStatus !== currentApproval;
    const roleChanged = newRoleID !== normalizedCurrentRole;

    if (!statusChanged && !roleChanged) {
      closeUserEditModal();
      return;
    }

    try {
      setUpdating(true);

      if (statusChanged) {
        await usersAPI.updateApprovalStatus(userId, newApprovalStatus);
      }

      if (roleChanged) {
        await usersAPI.updateUserRole(userId, newRoleID);
      }

      Alert.alert('Success', 'User updated successfully.');
      closeUserEditModal();
      loadUsers();
    } catch (error: any) {
      Alert.alert('Update failed', error?.message || 'Unable to update user.');
    } finally {
      setUpdating(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((person) => {
        const fullName = getFullName(person).toLowerCase();
        const email = String(person?.Email || person?.email || '').toLowerCase();
        const role = getRoleLabel(person).toLowerCase();
        return fullName.includes(q) || email.includes(q) || role.includes(q);
      });
    }

    if (approvalFilter !== 'all') {
      result = result.filter((person) => getApprovalValue(person) === approvalFilter);
    }

    if (roleFilter !== 'all') {
      result = result.filter((person) => getRoleKey(person) === roleFilter);
    }

    return [...result].sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
  }, [users, searchTerm, approvalFilter, roleFilter]);

  const renderUserCard = ({ item }: { item: any }) => {
    const fullName = getFullName(item);
    const email = String(item?.Email || item?.email || '-');
    const offices = getAssignedOffices(item);
    const roleLabel = getRoleLabel(item);
    const approvalLabel = getApprovalLabel(item);
    const avatarUri = getAvatarUri(item);

    return (
      <TouchableOpacity activeOpacity={0.9} style={styles.userCard}>
        <View style={styles.userLeft}>
          <SmartUserAvatar
            user={item}
            src={avatarUri}
            fullName={fullName}
            size={34}
            textSize={12}
            ring="#e2e8f0"
          />

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {email}
            </Text>
            <Text style={styles.userOffice} numberOfLines={1}>
              Office: {offices.length > 0 ? offices.join(', ') : 'Unassigned'}
            </Text>
          </View>
        </View>

        <View style={styles.userRight}>
          <View style={[styles.badge, getRoleBadgeStyle(item)]}>
            <Text style={[styles.badgeText, getRoleBadgeTextStyle(item)]}>{roleLabel}</Text>
          </View>
          <View style={[styles.badge, getApprovalBadgeStyle(item)]}>
            <Text style={[styles.badgeText, getApprovalBadgeTextStyle(item)]}>{approvalLabel}</Text>
          </View>
          <TouchableOpacity style={styles.moreBtn} onPress={() => openUserEditModal(item)}>
            <Text style={styles.moreBtnText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.container} onPress={() => {
      setShowApprovalDropdown(false);
      setShowRoleDropdown(false);
    }}>
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Users</Text>
        <Text style={styles.pageSubtitle}>Manage user approvals and account roles.</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search users, role, or email..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />

          <View style={styles.filterWrap}>
            <View style={styles.dropdownWrap}>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => {
                  setShowRoleDropdown(false);
                  setShowApprovalDropdown((prev) => !prev);
                }}
              >
                <Text style={styles.filterBtnText} numberOfLines={1}>
                  {APPROVAL_FILTER_OPTIONS.find((opt) => opt.value === approvalFilter)?.label || 'All Personnel'}
                </Text>
                <Text style={styles.filterArrow}>⌄</Text>
              </TouchableOpacity>

              {showApprovalDropdown && (
                <View style={styles.dropdownMenu}>
                  {APPROVAL_FILTER_OPTIONS.map((option) => {
                    const active = approvalFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        onPress={() => {
                          setApprovalFilter(option.value);
                          setShowApprovalDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.dropdownWrap}>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => {
                  setShowApprovalDropdown(false);
                  setShowRoleDropdown((prev) => !prev);
                }}
              >
                <Text style={styles.filterBtnText} numberOfLines={1}>
                  {ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter)?.label || 'All Roles'}
                </Text>
                <Text style={styles.filterArrow}>⌄</Text>
              </TouchableOpacity>

              {showRoleDropdown && (
                <View style={styles.dropdownMenu}>
                  {ROLE_FILTER_OPTIONS.map((option) => {
                    const active = roleFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        onPress={() => {
                          setRoleFilter(option.value);
                          setShowRoleDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {filteredUsers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptySub}>Try changing your search or filter selection.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => getUserId(item)}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Modal
        transparent
        visible={showUserEditModal}
        animationType="fade"
        onRequestClose={closeUserEditModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeUserEditModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Update Approval Status</Text>

            <View style={styles.modalUserInfoWrap}>
              <Text style={styles.modalInfoText} numberOfLines={1}>
                <Text style={styles.modalInfoLabel}>User: </Text>
                {selectedUser ? getFullName(selectedUser) : '-'}
              </Text>
              <Text style={styles.modalInfoText} numberOfLines={1}>
                <Text style={styles.modalInfoLabel}>Email: </Text>
                {selectedUser ? String(selectedUser?.Email || selectedUser?.email || '-') : '-'}
              </Text>
            </View>

            <Text style={styles.modalFieldLabel}>User Role</Text>
            <View style={styles.modalChoiceRow}>
              {[{ id: 2, label: 'User' }, { id: 1, label: 'Admin' }].map((role) => {
                const active = newRoleID === role.id;
                return (
                  <TouchableOpacity
                    key={role.id}
                    style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                    onPress={() => setNewRoleID(role.id)}
                  >
                    <Text style={[styles.modalChoiceBtnText, active && styles.modalChoiceBtnTextActive]}>{role.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalFieldLabel}>Approval Status</Text>
            <View style={styles.modalChoiceRowWrap}>
              {['pending', 'approved', 'denied'].map((status) => {
                const active = newApprovalStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.modalChoiceBtn, active && styles.modalChoiceBtnActive]}
                    onPress={() => setNewApprovalStatus(status)}
                  >
                    <Text style={[styles.modalChoiceBtnText, active && styles.modalChoiceBtnTextActive]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalCancelBtn]}
                onPress={closeUserEditModal}
                disabled={updating}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalSaveBtn, updating && styles.modalSaveBtnDisabled]}
                onPress={saveUserUpdates}
                disabled={updating}
              >
                <Text style={styles.modalSaveBtnText}>{updating ? 'Updating...' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

function getRoleBadgeStyle(person: any) {
  const role = getRoleKey(person);
  if (role === 'admin') return styles.badgeRoleAdmin;
  if (role === 'officehead') return styles.badgeRoleOfficeHead;
  return styles.badgeRoleUser;
}

function getRoleBadgeTextStyle(person: any) {
  const role = getRoleKey(person);
  if (role === 'admin') return styles.badgeRoleAdminText;
  if (role === 'officehead') return styles.badgeRoleOfficeHeadText;
  return styles.badgeRoleUserText;
}

function getApprovalBadgeStyle(person: any) {
  const status = getApprovalValue(person);
  if (status === 'approved') return styles.badgeApproved;
  if (status === 'denied') return styles.badgeDenied;
  return styles.badgePending;
}

function getApprovalBadgeTextStyle(person: any) {
  const status = getApprovalValue(person);
  if (status === 'approved') return styles.badgeApprovedText;
  if (status === 'denied') return styles.badgeDeniedText;
  return styles.badgePendingText;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eceef1',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eceef1',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  headerBlock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    zIndex: 1000,
    elevation: 1000,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: -2,
  },
  searchRow: {
    gap: 6,
  },
  searchInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#1e293b',
    fontSize: 11,
  },
  filterWrap: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 1001,
    elevation: 1001,
  },
  dropdownWrap: {
    position: 'relative',
    flex: 1,
    zIndex: 1002,
    elevation: 1002,
  },
  filterBtn: {
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    gap: 8,
  },
  filterBtnText: {
    flex: 1,
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
  },
  filterArrow: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 13,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 34,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 99999,
    elevation: 99999,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#f1f5f9',
  },
  dropdownItemText: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 10,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 18,
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8dee6',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 9,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatarShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#cbe4df',
    backgroundColor: '#d6f0ec',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  userEmail: {
    color: '#475569',
    fontSize: 10,
    marginTop: 1,
  },
  userOffice: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  badgeRoleAdmin: {
    backgroundColor: '#f3e8ff',
    borderColor: '#e9d5ff',
  },
  badgeRoleAdminText: {
    color: '#7e22ce',
  },
  badgeRoleOfficeHead: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  badgeRoleOfficeHeadText: {
    color: '#15803d',
  },
  badgeRoleUser: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
  },
  badgeRoleUserText: {
    color: '#1d4ed8',
  },
  badgeApproved: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  badgeApprovedText: {
    color: '#15803d',
  },
  badgePending: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde68a',
  },
  badgePendingText: {
    color: '#a16207',
  },
  badgeDenied: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  badgeDeniedText: {
    color: '#b91c1c',
  },
  moreBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnText: {
    color: '#1f2937',
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748b',
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalUserInfoWrap: {
    marginBottom: 12,
    gap: 4,
  },
  modalInfoText: {
    color: '#475569',
    fontSize: 12,
  },
  modalInfoLabel: {
    fontWeight: '700',
    color: '#334155',
  },
  modalFieldLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  modalChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modalChoiceRowWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modalChoiceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  modalChoiceBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  modalChoiceBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  modalChoiceBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalCancelBtn: {
    backgroundColor: '#e2e8f0',
  },
  modalCancelBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  modalSaveBtn: {
    backgroundColor: '#2563eb',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  modalSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
