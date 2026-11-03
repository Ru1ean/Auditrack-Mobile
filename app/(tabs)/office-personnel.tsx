import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { BASE_URL, eventsAPI, getProfilePicUrl, officeHeadsAPI, officesAPI, usersAPI } from '../../components/connect';
import SmartUserAvatar from '../../components/SmartUserAvatar';

const PERSONNEL_FILTER_OPTIONS = [
  { value: 'all', label: 'All Personnel' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
];

const UPLOADS_BASE_URL = BASE_URL.replace(/\/api\/?$/, '');

const toId = (value: any) => String(value ?? '');

const fullName = (person: any) => {
  const first = person?.FirstName || person?.first_name || '';
  const middle = person?.MiddleInitial || person?.middle_initial;
  const last = person?.LastName || person?.last_name || '';
  return `${first}${middle ? ` ${middle}.` : ''} ${last}`.trim() || 'Unknown User';
};

const initials = (person: any) => {
  const name = fullName(person).split(' ').filter(Boolean);
  const first = name[0]?.charAt(0) || 'U';
  const last = name[name.length - 1]?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
};

const avatarUri = (person: any) => {
  return getProfilePicUrl(person) || '';
};

const formatDate = (rawDate: any) => {
  if (!rawDate) return 'N/A';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const normalizeHeadResponse = (response: any) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeOfficeResponse = (response: any) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeUserResponse = (response: any) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.users)) return response.users;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const officeHasHead = (office: any, headId: any) => {
  const normalized = Number(headId);
  if (Number.isNaN(normalized)) return false;

  if (Number(office?.head_id) === normalized || Number(office?.HeadID) === normalized) return true;

  if (Array.isArray(office?.head_ids) && office.head_ids.some((id: any) => Number(id) === normalized)) return true;
  if (Array.isArray(office?.HeadIDs) && office.HeadIDs.some((id: any) => Number(id) === normalized)) return true;

  if (Array.isArray(office?.heads)) {
    return office.heads.some((head: any) => Number(head?.HeadID || head?.head_id) === normalized);
  }

  return false;
};

export default function OfficePersonnelScreen() {
  const [officeHeads, setOfficeHeads] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [personnelFilter, setPersonnelFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedHeadIds, setSelectedHeadIds] = useState<Set<number>>(new Set());

  const [menuHeadId, setMenuHeadId] = useState<number | null>(null);
  const [detailsHead, setDetailsHead] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [eventNameById, setEventNameById] = useState<Record<number, string>>({});

  const [editHead, setEditHead] = useState<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    Position: '',
  });

  const [addVisible, setAddVisible] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addPosition, setAddPosition] = useState('');
  const [showAddUserPicker, setShowAddUserPicker] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState('');

  const [saving, setSaving] = useState(false);

  async function loadAllData() {
    setLoading(true);
    try {
      const [headsRes, officesRes, usersRes, meRes] = await Promise.all([
        officeHeadsAPI.getAllHeads(),
        officesAPI.getAll(),
        usersAPI.getAllUsers(),
        usersAPI.getLoggedInUser().catch(() => null),
      ]);

      setOfficeHeads(normalizeHeadResponse(headsRes));
      setOffices(normalizeOfficeResponse(officesRes));
      setUsers(normalizeUserResponse(usersRes));
      setCurrentUser(meRes?.user || meRes || null);
    } catch (error) {
      console.log('Failed to load office personnel:', error);
      setOfficeHeads([]);
      setOffices([]);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadAllData();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const isAdmin = currentUser?.RoleID === 1 || String(currentUser?.RoleName || '').toLowerCase() === 'admin';

  const headOfficeMap = useMemo(() => {
    const map = new Map<number, any[]>();
    officeHeads.forEach((head) => {
      const assigned = offices.filter((office) => officeHasHead(office, head.HeadID));
      map.set(Number(head.HeadID), assigned);
    });
    return map;
  }, [officeHeads, offices]);

  const filteredHeads = useMemo(() => {
    let list = officeHeads;

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter((person) => {
        const name = fullName(person).toLowerCase();
        const role = String(person?.Position || '').toLowerCase();
        const email = String(person?.Email || person?.ContactInfo || '').toLowerCase();
        return name.includes(query) || role.includes(query) || email.includes(query);
      });
    }

    if (personnelFilter !== 'all') {
      list = list.filter((person) => {
        const assigned = (headOfficeMap.get(Number(person.HeadID)) || []).length > 0;
        return personnelFilter === 'assigned' ? assigned : !assigned;
      });
    }

    return [...list].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [officeHeads, searchTerm, personnelFilter, headOfficeMap]);

  const availableUsersForAdd = useMemo(() => {
    const headUserIds = new Set(officeHeads.map((head) => Number(head.UserID)));
    return users
      .filter((user) => {
        const userId = Number(user.UserID || user.user_id || user.id);
        if (headUserIds.has(userId)) return false;

        const roleId = Number(user?.RoleID ?? user?.role_id ?? 0);
        const roleName = String(user?.RoleName || user?.role_name || '').toLowerCase();
        const isAdminUser = roleId === 1 || roleName === 'admin';
        if (isAdminUser) return false;

        const isRegularUser = roleId ? roleId === 2 : roleName === '' || roleName === 'user';
        if (!isRegularUser) return false;

        const approvalStatus = String(user?.approval_status || user?.ApprovalStatus || '').toLowerCase();
        return approvalStatus === 'approved';
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, officeHeads]);

  const filteredAvailableUsersForAdd = useMemo(() => {
    const query = addUserSearch.trim().toLowerCase();
    if (!query) return availableUsersForAdd;

    return availableUsersForAdd.filter((user) => {
      const name = fullName(user).toLowerCase();
      const email = String(user?.Email || user?.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [availableUsersForAdd, addUserSearch]);

  const selectedUserForAdd = useMemo(() => {
    if (!addUserId) return null;
    return users.find((user) => String(user?.UserID || user?.user_id || user?.id) === addUserId) || null;
  }, [addUserId, users]);

  const detailAssignedOffices = useMemo(() => {
    if (!detailsHead) return [];
    return headOfficeMap.get(Number(detailsHead.HeadID)) || [];
  }, [detailsHead, headOfficeMap]);

  const getOfficeEventId = (office: any) => {
    const raw = office?.EventID ?? office?.event_id ?? office?.eventId;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const getOfficeEventLabel = (office: any) => {
    const directName = office?.EventName || office?.event_name || office?.eventName;
    if (directName) return String(directName);

    const eventId = getOfficeEventId(office);
    if (eventId && eventNameById[eventId]) return eventNameById[eventId];

    return 'Unknown Event';
  };

  const missingDetailEventIds = useMemo(() => {
    const ids = new Set<number>();
    detailAssignedOffices.forEach((office) => {
      if (office?.EventName || office?.event_name || office?.eventName) return;
      const eventId = getOfficeEventId(office);
      if (eventId && !eventNameById[eventId]) ids.add(eventId);
    });
    return Array.from(ids);
  }, [detailAssignedOffices, eventNameById]);

  useEffect(() => {
    if (!detailsVisible || missingDetailEventIds.length === 0) return;

    let cancelled = false;

    const fetchEventNames = async () => {
      try {
        const response = await eventsAPI.getAllEvents();
        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

        const map: Record<number, string> = {};
        list.forEach((event: any) => {
          const id = Number(event?.EventID ?? event?.event_id ?? event?.id);
          const name = event?.EventName || event?.event_name || event?.eventName;
          if (Number.isInteger(id) && name) {
            map[id] = String(name);
          }
        });

        if (!cancelled) {
          setEventNameById((prev) => ({ ...prev, ...map }));
        }
      } catch (error) {
        console.log('Failed to load event names for personnel details:', error);
      }
    };

    fetchEventNames();

    return () => {
      cancelled = true;
    };
  }, [detailsVisible, missingDetailEventIds]);

  const groupedDetailOffices = useMemo(() => {
    const map = new Map<string, any[]>();

    detailAssignedOffices.forEach((office) => {
      const eventLabel = getOfficeEventLabel(office);
      if (!map.has(eventLabel)) map.set(eventLabel, []);
      map.get(eventLabel)?.push(office);
    });

    return Array.from(map.entries())
      .map(([eventLabel, officeItems]) => ({
        eventLabel,
        officeItems: [...officeItems].sort((a, b) => {
          const nameA = String(a?.OfficeName || a?.office_name || '').toLowerCase();
          const nameB = String(b?.OfficeName || b?.office_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        }),
      }))
      .sort((a, b) => {
        if (a.eventLabel === 'Unknown Event') return 1;
        if (b.eventLabel === 'Unknown Event') return -1;
        return a.eventLabel.localeCompare(b.eventLabel);
      });
  }, [detailAssignedOffices, eventNameById]);

  const toggleSelectedHead = (headId: number) => {
    setSelectedHeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(headId)) next.delete(headId);
      else next.add(headId);
      return next;
    });
  };

  const clearTransientUi = () => {
    setShowFilterDropdown(false);
    setShowAddUserPicker(false);
    setMenuHeadId(null);
  };

  const toggleDeleteMode = () => {
    setDeleteMode((prev) => {
      if (prev) {
        setSelectedHeadIds(new Set());
      }
      return !prev;
    });
    clearTransientUi();
  };

  const handleDeleteSelected = async () => {
    if (!selectedHeadIds.size) {
      Alert.alert('No selection', 'Select at least one office personnel.');
      return;
    }

    Alert.alert(
      'Delete personnel',
      `Delete ${selectedHeadIds.size} selected personnel?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = Array.from(selectedHeadIds).map((id) => String(id));
              const res = await officeHeadsAPI.deleteHeads(ids);
              if (res?.success !== false) {
                setDeleteMode(false);
                setSelectedHeadIds(new Set());
                loadAllData();
              } else {
                Alert.alert('Delete failed', res?.message || 'Unable to delete selected personnel.');
              }
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message || 'Unable to delete selected personnel.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSingle = (head: any) => {
    const headId = Number(head?.HeadID);
    if (!headId) return;

    Alert.alert('Delete personnel', `Delete ${fullName(head)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await officeHeadsAPI.deleteHeads([String(headId)]);
            if (res?.success !== false) {
              loadAllData();
            } else {
              Alert.alert('Delete failed', res?.message || 'Unable to delete this personnel.');
            }
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Unable to delete this personnel.');
          }
        },
      },
    ]);
  };

  const openDetails = (head: any) => {
    setDetailsHead(head);
    setDetailsVisible(true);
    setMenuHeadId(null);
  };

  const openEdit = (head: any) => {
    setEditHead(head);
    setEditForm({
      Position: String(head?.Position || ''),
    });
    setEditVisible(true);
    setMenuHeadId(null);
  };

  const saveEdit = async () => {
    if (!editHead?.HeadID) return;
    if (!editForm.Position.trim()) {
      Alert.alert('Missing info', 'Position is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        FirstName: String(editHead?.FirstName || '').trim(),
        MiddleInitial: String(editHead?.MiddleInitial || '').trim(),
        LastName: String(editHead?.LastName || '').trim(),
        Position: editForm.Position.trim(),
        ContactInfo: String(editHead?.ContactInfo || editHead?.Email || '').trim(),
      };
      const res = await officeHeadsAPI.updateHead(String(editHead.HeadID), payload);
      if (res?.success === false) {
        Alert.alert('Update failed', res?.message || 'Unable to update office personnel.');
      } else {
        setEditVisible(false);
        setEditHead(null);
        loadAllData();
      }
    } catch (error: any) {
      Alert.alert('Update failed', error?.message || 'Unable to update office personnel.');
    } finally {
      setSaving(false);
    }
  };

  const saveAdd = async () => {
    if (!addUserId) {
      Alert.alert('Missing info', 'Select a user to add.');
      return;
    }
    if (!addPosition.trim()) {
      Alert.alert('Missing info', 'Position is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        userId: Number(addUserId),
        position: addPosition.trim(),
        contactInfo: String(selectedUserForAdd?.Email || selectedUserForAdd?.email || '').trim(),
      };
      const res = await officeHeadsAPI.addHead(payload);
      if (res?.success === false) {
        Alert.alert('Add failed', res?.message || 'Unable to add office personnel.');
      } else {
        setAddVisible(false);
        setAddUserId('');
        setAddUserSearch('');
        setAddPosition('');
        setShowAddUserPicker(false);
        loadAllData();
      }
    } catch (error: any) {
      Alert.alert('Add failed', error?.message || 'Unable to add office personnel.');
    } finally {
      setSaving(false);
    }
  };

  const renderCard = ({ item, index }: { item: any; index: number }) => {
    const headId = Number(item?.HeadID || 0);
    const assignedOffices = headOfficeMap.get(headId) || [];
    const assigned = assignedOffices.length > 0;
    const officeSummary = assigned
      ? `${assignedOffices[0]?.OfficeName || assignedOffices[0]?.office_name || 'Office'}${assignedOffices.length > 1 ? ` (+${assignedOffices.length - 1})` : ''}`
      : 'Not assigned';

    const cardWidthStyle = {
      marginLeft: index % 2 === 0 ? 0 : 6,
      marginRight: index % 2 === 0 ? 6 : 0,
    };

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        style={[styles.card, cardWidthStyle, selectedHeadIds.has(headId) && styles.cardSelected]}
        onPress={() => {
          if (deleteMode) toggleSelectedHead(headId);
        }}
      >
        {deleteMode && (
          <TouchableOpacity
            style={[styles.selectionBox, selectedHeadIds.has(headId) && styles.selectionBoxActive]}
            onPress={() => toggleSelectedHead(headId)}
          >
            {selectedHeadIds.has(headId) && <Text style={styles.selectionCheck}>✓</Text>}
          </TouchableOpacity>
        )}

        <View style={styles.cardTopRow}>
          <View style={[styles.statusBadge, assigned ? styles.statusAssigned : styles.statusUnassigned]}>
            <Text style={[styles.statusBadgeText, assigned ? styles.statusAssignedText : styles.statusUnassignedText]}>
              {assigned ? 'Assigned' : 'Unassigned'}
            </Text>
          </View>

          {isAdmin && !deleteMode && (
            <View style={styles.cardMenuWrap}>
              <TouchableOpacity
                style={styles.cardMenuBtn}
                onPress={(event: any) => {
                  event?.stopPropagation?.();
                  setMenuHeadId((prev) => (prev === headId ? null : headId));
                }}
              >
                <Text style={styles.cardMenuBtnText}>⋮</Text>
              </TouchableOpacity>

              {menuHeadId === headId && (
                <View style={styles.cardMenuDropdown}>
                  <TouchableOpacity
                    style={styles.cardMenuItem}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      openEdit(item);
                    }}
                  >
                    <Text style={styles.cardMenuItemText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardMenuItem}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      handleDeleteSingle(item);
                    }}
                  >
                    <Text style={styles.cardMenuDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.avatarWrap}>
          <SmartUserAvatar
            user={item}
            src={avatarUri(item)}
            fullName={fullName(item)}
            size={42}
            textSize={14}
            ring="#bae6fd"
          />
        </View>

        <Text style={styles.cardName} numberOfLines={1}>{fullName(item)}</Text>
        <Text style={styles.cardPosition} numberOfLines={1}>{item?.Position || 'Office Personnel'}</Text>

        <View style={styles.cardInfoBox}>
          <Text style={styles.cardInfoText} numberOfLines={1}>⚿ {item?.Email || item?.ContactInfo || 'No email'}</Text>
          <Text style={styles.cardOfficeText} numberOfLines={1}>Office: {officeSummary}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardJoinText}>Join at {formatDate(item?.CreatedAt || item?.created_at)}</Text>
          <TouchableOpacity onPress={() => openDetails(item)}>
            <Text style={styles.detailsLink}>View details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Loading office personnel...</Text>
      </View>
    );
  }

  const employeeCode = detailsHead ? `#EMP${String(detailsHead?.HeadID || '').padStart(3, '0')}` : '';

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.pageTitle}>Office personel</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.deleteBtn, deleteMode && styles.deleteBtnActive]}
              onPress={deleteMode ? handleDeleteSelected : toggleDeleteMode}
            >
              <Text style={styles.deleteBtnText}>{deleteMode ? `Delete (${selectedHeadIds.size})` : 'Delete'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                clearTransientUi();
                setAddVisible(true);
              }}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search personnel, office, or email..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />

          <View style={styles.filterDropdownWrap}>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowFilterDropdown((prev) => !prev)}
            >
              <Text style={styles.filterBtnText} numberOfLines={1}>
                {PERSONNEL_FILTER_OPTIONS.find((opt) => opt.value === personnelFilter)?.label || 'All Personnel'}
              </Text>
              <Text style={styles.filterArrow}>⌄</Text>
            </TouchableOpacity>

            {showFilterDropdown && (
              <View style={styles.filterDropdownMenu}>
                {PERSONNEL_FILTER_OPTIONS.map((option) => {
                  const active = personnelFilter === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.filterDropdownItem, active && styles.filterDropdownItemActive]}
                      onPress={() => {
                        setPersonnelFilter(option.value);
                        setShowFilterDropdown(false);
                      }}
                    >
                      <Text style={[styles.filterDropdownItemText, active && styles.filterDropdownItemTextActive]}>
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

      {filteredHeads.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No office personnel found.</Text>
          <Text style={styles.emptySub}>Try a different search or filter.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHeads}
          keyExtractor={(item) => toId(item?.HeadID || item?.id)}
          numColumns={2}
          renderItem={renderCard}
          contentContainerStyle={styles.gridContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Modal visible={detailsVisible} transparent animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailsVisible(false)}>
          <Pressable style={styles.modalCardWide} onPress={() => {}}>
            <View style={styles.detailsTopBar}>
              <View style={styles.detailsHeaderIdentity}>
                <SmartUserAvatar
                  user={detailsHead}
                  src={detailsHead ? avatarUri(detailsHead) : null}
                  fullName={detailsHead ? fullName(detailsHead) : ''}
                  size={46}
                  textSize={16}
                  ring="#bae6fd"
                />

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.detailsName} numberOfLines={1}>{detailsHead ? fullName(detailsHead) : '-'}</Text>
                  <View style={styles.detailsTagRow}>
                    <View style={styles.detailsTagMuted}>
                      <Text style={styles.detailsTagMutedText}>{detailsHead?.Position || 'Office Personnel'}</Text>
                    </View>
                    <View style={styles.detailsTagCyan}>
                      <Text style={styles.detailsTagCyanText}>{employeeCode || '#EMP000'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.detailsCloseBtn} onPress={() => setDetailsVisible(false)}>
                <Text style={styles.detailsCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsBody}>
              <View style={styles.detailsBodyHeader}>
                <Text style={styles.detailsSectionTitle}>Offices Managed</Text>
                <View style={styles.detailsCountBadge}>
                  <Text style={styles.detailsCountText}>{detailAssignedOffices.length} OFFICES</Text>
                </View>
              </View>

              {groupedDetailOffices.length > 0 ? (
                <ScrollView style={styles.detailsGroupsScroll} contentContainerStyle={styles.detailsGroupsContent}>
                  {groupedDetailOffices.map((group) => (
                    <View key={group.eventLabel} style={styles.detailsEventCard}>
                      <View style={styles.detailsEventHeader}>
                        <Text style={styles.detailsEventName} numberOfLines={1}>{group.eventLabel}</Text>
                        <View style={styles.detailsEventCountBadge}>
                          <Text style={styles.detailsEventCountText}>{group.officeItems.length}</Text>
                        </View>
                      </View>

                      {group.officeItems.map((office, index) => (
                        <View key={`${toId(office?.OfficeID || office?.id)}-${index}`} style={styles.detailsOfficeRow}>
                          <Text style={styles.detailsOfficeText} numberOfLines={1}>
                            {office?.OfficeName || office?.office_name || `Office #${office?.OfficeID || office?.id}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.detailsNoOfficeWrap}>
                  <Text style={styles.detailsNoOfficeText}>No office assignment.</Text>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setEditVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Edit Office Personnel</Text>

            <View style={styles.editReadonlyInfo}>
              <Text style={styles.editReadonlyText}>{editHead ? fullName(editHead) : '-'}</Text>
              <Text style={styles.editReadonlySubText}>{editHead?.Email || editHead?.ContactInfo || '-'}</Text>
            </View>

            <Text style={styles.inputLabel}>Position</Text>
            <TextInput value={editForm.Position} onChangeText={(v) => setEditForm((p) => ({ ...p, Position: v }))} style={styles.modalInput} />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalActionBtn, styles.modalCancelBtn]} disabled={saving} onPress={() => setEditVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]} disabled={saving} onPress={saveEdit}>
                <Text style={styles.modalSaveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addVisible} transparent animationType="fade" onRequestClose={() => setAddVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setAddVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Office Personnel</Text>

            <Text style={styles.inputLabel}>Select User</Text>
            <View style={styles.addUserDropdownWrap}>
              <TouchableOpacity
                style={styles.modalInputBtn}
                onPress={() => setShowAddUserPicker(true)}
              >
                <Text style={styles.modalInputBtnText} numberOfLines={1}>
                  {addUserId
                    ? fullName(selectedUserForAdd)
                    : 'Choose a user'}
                </Text>
                <Text style={styles.filterArrow}>⌄</Text>
              </TouchableOpacity>
            </View>

            {!!selectedUserForAdd && (
              <View style={styles.autoEmailInfo}>
                <Text style={styles.autoEmailInfoLabel}>Contact Info (auto)</Text>
                <Text style={styles.autoEmailInfoValue}>{selectedUserForAdd?.Email || selectedUserForAdd?.email || 'No email'}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Position</Text>
            <TextInput value={addPosition} onChangeText={setAddPosition} style={styles.modalInput} placeholder="e.g. TESTR" placeholderTextColor="#94a3b8" />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalActionBtn, styles.modalCancelBtn]} disabled={saving} onPress={() => setAddVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]} disabled={saving} onPress={saveAdd}>
                <Text style={styles.modalSaveBtnText}>{saving ? 'Saving...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAddUserPicker} transparent animationType="fade" onRequestClose={() => setShowAddUserPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddUserPicker(false)}>
          <Pressable style={styles.userPickerCard} onPress={() => {}}>
            <View style={styles.userPickerHeader}>
              <Text style={styles.userPickerTitle}>Select User</Text>
              <TouchableOpacity style={styles.userPickerCloseBtn} onPress={() => setShowAddUserPicker(false)}>
                <Text style={styles.userPickerCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.userPickerSearchWrap}>
              <TextInput
                value={addUserSearch}
                onChangeText={setAddUserSearch}
                style={styles.userPickerSearchInput}
                placeholder="Search user or email..."
                placeholderTextColor="#94a3b8"
              />
            </View>

            {filteredAvailableUsersForAdd.length === 0 ? (
              <View style={styles.userPickerEmptyWrap}>
                <Text style={styles.dropdownEmptyText}>No approved users found</Text>
              </View>
            ) : (
              <FlatList
                data={filteredAvailableUsersForAdd}
                keyExtractor={(item) => String(item?.UserID || item?.user_id || item?.id)}
                style={styles.userPickerList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const userId = String(item?.UserID || item?.user_id || item?.id);
                  const active = addUserId === userId;
                  return (
                    <TouchableOpacity
                      style={[styles.userPickerItem, active && styles.userPickerItemActive]}
                      onPress={() => {
                        setAddUserId(userId);
                        setAddUserSearch('');
                        setShowAddUserPicker(false);
                      }}
                    >
                      <Text style={[styles.userPickerItemText, active && styles.userPickerItemTextActive]} numberOfLines={1}>
                        {fullName(item)}
                      </Text>
                      <Text style={styles.userPickerItemSub} numberOfLines={1}>User</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edf0f4',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#edf0f4',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  headerWrap: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    zIndex: 1200,
    elevation: 1200,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  deleteBtn: {
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fda4af',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  addBtn: {
    height: 32,
    borderRadius: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 1300,
    elevation: 1300,
  },
  searchInput: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    fontSize: 11,
    color: '#0f172a',
  },
  filterDropdownWrap: {
    width: 140,
    position: 'relative',
    zIndex: 1400,
    elevation: 1400,
  },
  filterBtn: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  filterBtnText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  filterArrow: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 13,
  },
  filterDropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 38,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 99999,
    elevation: 99999,
  },
  filterDropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  filterDropdownItemText: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
  },
  filterDropdownItemTextActive: {
    color: '#1d4ed8',
  },
  viewIconBtn: {
    width: 28,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewIconText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 13,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 18,
    gap: 8,
  },
  card: {
    flex: 1,
    minHeight: 214,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  selectionBox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  selectionBoxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  selectionCheck: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 24,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusAssigned: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  statusAssignedText: {
    color: '#15803d',
  },
  statusUnassigned: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  statusUnassignedText: {
    color: '#475569',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cardMenuWrap: {
    position: 'relative',
    zIndex: 30,
  },
  cardMenuBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMenuBtnText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
  },
  cardMenuDropdown: {
    position: 'absolute',
    top: 26,
    right: 0,
    minWidth: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    zIndex: 999,
    elevation: 20,
    overflow: 'hidden',
  },
  cardMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardMenuItemText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  cardMenuDeleteText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#d6f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
  },
  cardName: {
    marginTop: 6,
    color: '#0f172a',
    fontSize: 27,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '800',
  },
  cardPosition: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardInfoBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  cardInfoText: {
    color: '#64748b',
    fontSize: 9,
  },
  cardOfficeText: {
    color: '#64748b',
    fontSize: 9,
  },
  cardFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  cardJoinText: {
    color: '#64748b',
    fontSize: 9,
    flex: 1,
  },
  detailsLink: {
    color: '#1e293b',
    fontSize: 11,
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
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    padding: 14,
  },
  modalCardWide: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalLabel: {
    color: '#334155',
    fontWeight: '700',
  },
  modalLine: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 4,
  },
  modalOfficeList: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxHeight: 150,
    marginTop: 2,
    marginBottom: 12,
  },
  modalOfficeItem: {
    color: '#334155',
    fontSize: 12,
    marginBottom: 4,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 2,
  },
  modalInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 12,
    marginBottom: 8,
  },
  editReadonlyInfo: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  editReadonlyText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  editReadonlySubText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  modalInputBtn: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalInputBtnText: {
    color: '#334155',
    fontSize: 12,
    flex: 1,
  },
  addUserDropdownWrap: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 8,
  },
  autoEmailInfo: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 2,
  },
  autoEmailInfoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  autoEmailInfoValue: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  addUserDropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    zIndex: 99999,
    elevation: 99999,
    overflow: 'hidden',
  },
  dropdownEmptyText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 10,
  },
  userPickerCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  userPickerHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userPickerSearchWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userPickerSearchInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 12,
  },
  userPickerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  userPickerCloseBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userPickerCloseBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  userPickerEmptyWrap: {
    paddingVertical: 18,
  },
  userPickerList: {
    maxHeight: 280,
  },
  userPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userPickerItemActive: {
    backgroundColor: '#eff6ff',
  },
  userPickerItemText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  userPickerItemTextActive: {
    color: '#1d4ed8',
  },
  userPickerItemSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
  modalCloseBtn: {
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalCloseBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  detailsTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fdff',
    gap: 8,
  },
  detailsHeaderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  detailsAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  detailsAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#d6f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsAvatarText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  detailsName: {
    color: '#0f172a',
    fontSize: 29,
    lineHeight: 30,
    fontWeight: '800',
  },
  detailsTagRow: {
    marginTop: 3,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  detailsTagMuted: {
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailsTagMutedText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
  detailsTagCyan: {
    borderRadius: 999,
    backgroundColor: '#c7f1fb',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailsTagCyanText: {
    color: '#0e7490',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsCloseBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailsCloseBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailsBodyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsSectionTitle: {
    color: '#334155',
    fontSize: 22,
    fontWeight: '800',
  },
  detailsCountBadge: {
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  detailsCountText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailsGroupsScroll: {
    maxHeight: 360,
  },
  detailsGroupsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailsEventCard: {
    width: '48.5%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 5,
  },
  detailsEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  detailsEventName: {
    color: '#0e7490',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    flex: 1,
  },
  detailsEventCountBadge: {
    borderRadius: 999,
    backgroundColor: '#c7f1fb',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailsEventCountText: {
    color: '#0e7490',
    fontSize: 9,
    fontWeight: '800',
  },
  detailsOfficeRow: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailsOfficeText: {
    color: '#334155',
    fontSize: 11,
  },
  detailsNoOfficeWrap: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  detailsNoOfficeText: {
    color: '#64748b',
    fontSize: 12,
  },
});
