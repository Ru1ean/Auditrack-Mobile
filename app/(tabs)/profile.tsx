import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
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
    View
} from 'react-native';
import { BASE_URL, eventsAPI, officeHeadsAPI, officesAPI, officetypesAPI, requirementsAPI, usersAPI } from '../../components/connect';
import EvidenceSubmissionModal from '../../components/evidence-submission-modal';
import UserFileLightbox from '../../components/user-file-lightbox';

type ProfileAvatarProps = {
  uri?: string;
  initials: string;
  containerStyle: any;
  imageStyle: any;
  textStyle: any;
};

function ProfileAvatar({ uri, initials, containerStyle, imageStyle, textStyle }: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(uri) && !imageError;

  return (
    <View style={containerStyle}>
      {showImage ? (
        <Image
          source={{ uri: String(uri) }}
          style={imageStyle}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={textStyle}>{initials || 'U'}</Text>
      )}
    </View>
  );
}

type OfficeCreateForm = {
  office_name: string;
  office_type_id: string;
  head_ids: number[];
  event_id: string;
};

type OfficeEditForm = {
  office_name: string;
  office_type_id: string;
  head_ids: number[];
};

const defaultCreateForm: OfficeCreateForm = {
  office_name: '',
  office_type_id: '',
  head_ids: [],
  event_id: '',
};

const defaultEditForm: OfficeEditForm = {
  office_name: '',
  office_type_id: '',
  head_ids: [],
};

export default function OfficesScreen() {
  const [offices, setOffices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'compiled' | 'partially_compiled' | 'not_compiled'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [activeOfficeMenuId, setActiveOfficeMenuId] = useState<number | null>(null);

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<Set<number>>(new Set());

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<OfficeCreateForm>(defaultCreateForm);
  const [creatingOffice, setCreatingOffice] = useState(false);

  const [officeTypes, setOfficeTypes] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);

  const [editOfficeOpen, setEditOfficeOpen] = useState(false);
  const [editOfficeTarget, setEditOfficeTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState<OfficeEditForm>(defaultEditForm);
  const [savingOfficeEdit, setSavingOfficeEdit] = useState(false);
  const [showOfficeTypeDropdown, setShowOfficeTypeDropdown] = useState(false);
  const [showHeadsDropdown, setShowHeadsDropdown] = useState(false);
  const [showCreateOfficeTypeDropdown, setShowCreateOfficeTypeDropdown] = useState(false);
  const [showCreateHeadsDropdown, setShowCreateHeadsDropdown] = useState(false);
  const [headPickerTarget, setHeadPickerTarget] = useState<'create' | 'edit' | null>(null);

  const [addRequirementsOpen, setAddRequirementsOpen] = useState(false);
  const [addRequirementsOffice, setAddRequirementsOffice] = useState<any>(null);
  const [requirementsCatalog, setRequirementsCatalog] = useState<any[]>([]);
  const [assignedRequirementIds, setAssignedRequirementIds] = useState<Set<number>>(new Set());
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<number>>(new Set());
  const [requirementsSearch, setRequirementsSearch] = useState('');
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [savingRequirements, setSavingRequirements] = useState(false);

  const [officeDetailsOpen, setOfficeDetailsOpen] = useState(false);
  const [officeDetailsTarget, setOfficeDetailsTarget] = useState<any>(null);
  const [officeDetailsRequirements, setOfficeDetailsRequirements] = useState<any[]>([]);
  const [officeDetailsLoading, setOfficeDetailsLoading] = useState(false);
  const [officeDetailsSearch, setOfficeDetailsSearch] = useState('');
  const [officeDetailsStatusFilter, setOfficeDetailsStatusFilter] = useState<'all' | 'complied' | 'partially' | 'not_complied'>('all');
  const [officeDetailsMenuOpen, setOfficeDetailsMenuOpen] = useState(false);
  const [officeDetailsStatusDropdownOpen, setOfficeDetailsStatusDropdownOpen] = useState(false);
  const [assignedUsersMap, setAssignedUsersMap] = useState<Record<number, any[]>>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [updatingStatusReqId, setUpdatingStatusReqId] = useState<number | null>(null);
  const [openingUserFileReqId, setOpeningUserFileReqId] = useState<number | null>(null);
  const [uploadingMyReqId, setUploadingMyReqId] = useState<number | null>(null);
  const [unsubmittingMyReqId, setUnsubmittingMyReqId] = useState<number | null>(null);
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [submissionModalRequirement, setSubmissionModalRequirement] = useState<any>(null);
  const [submissionModalUsers, setSubmissionModalUsers] = useState<any[]>([]);
  const [submissionModalMode, setSubmissionModalMode] = useState<'work' | 'admin'>('work');
  const [fileLightboxVisible, setFileLightboxVisible] = useState(false);
  const [fileLightboxData, setFileLightboxData] = useState<{ url: string; fileName: string } | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalRequirement, setAssignModalRequirement] = useState<any>(null);
  const [assignModalAvailableUsers, setAssignModalAvailableUsers] = useState<any[]>([]);
  const [assignModalAssignedUsers, setAssignModalAssignedUsers] = useState<any[]>([]);
  const [assignModalSelectedUserIds, setAssignModalSelectedUserIds] = useState<Set<number>>(new Set());
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [assignModalTab, setAssignModalTab] = useState<'assign' | 'assigned'>('assign');
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [assignModalSubmitting, setAssignModalSubmitting] = useState(false);
  const [assignModalError, setAssignModalError] = useState('');
  const [removingAssignmentId, setRemovingAssignmentId] = useState<number | null>(null);
  const [togglingUploadAssignmentId, setTogglingUploadAssignmentId] = useState<number | null>(null);

  const extractList = (response: any, keys: string[] = []) => {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];

    for (const key of keys) {
      if (Array.isArray((response as any)[key])) return (response as any)[key];
    }

    if (Array.isArray((response as any).data)) return (response as any).data;

    for (const value of Object.values(response)) {
      if (Array.isArray(value)) return value;
    }

    return [];
  };

  const toId = (...values: any[]) => {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  };

  const apiOrigin = useMemo(() => String(BASE_URL || '').replace(/\/api\/?$/, ''), []);

  const normalizeServerUrl = (value: any, profileFallback = false) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/^https?:\/\/localhost:5000/i, apiOrigin);
    }

    if (raw.startsWith('/')) {
      return `${apiOrigin}${raw}`;
    }

    if (raw.startsWith('uploads/')) {
      return `${apiOrigin}/${raw}`;
    }

    if (raw.includes('/uploads/')) {
      const suffix = raw.substring(raw.indexOf('/uploads/'));
      return `${apiOrigin}${suffix}`;
    }

    if (profileFallback) {
      return `${apiOrigin}/uploads/profile-pics/${raw}`;
    }

    return `${apiOrigin}/${raw}`;
  };

  const getPersonName = (person: any, fallback = 'User') => {
    const fullName = [person?.FirstName, person?.MiddleInitial ? `${person.MiddleInitial}.` : '', person?.LastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || person?.full_name || person?.head_name || person?.name || fallback;
  };

  const getInitials = (name: string) => {
    const cleaned = String(name || '').trim();
    if (!cleaned) return 'U';
    return cleaned
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('');
  };

  const getProfilePicUrl = (person: any) => {
    const raw = person?.ProfilePic || person?.profile_pic || person?.profilePic || person?.head_profile_pic;
    return normalizeServerUrl(raw, true);
  };

  const getFirstName = (person: any, fallback = 'User') => {
    const first = String(person?.FirstName || person?.first_name || '').trim();
    if (first) return first;

    const full = getPersonName(person, fallback);
    return String(full).trim().split(' ')[0] || fallback;
  };

  const getComplianceColor = (percent: number) => {
    if (percent >= 80) return '#059669';
    if (percent >= 50) return '#d97706';
    return '#dc2626';
  };

  const isAdmin =
    currentUser?.RoleName?.toLowerCase() === 'admin' ||
    Number(currentUser?.RoleID || currentUser?.role_id || 0) === 1;
  const roleName = String(currentUser?.RoleName || currentUser?.role_name || currentUser?.role || '').toLowerCase();
  const roleId = Number(currentUser?.RoleID || currentUser?.role_id || 0);
  const isOfficeDetailsReadOnly = !isAdmin;
  const isPersonnelHead =
    roleId === 3 ||
    roleName.includes('personnel head') ||
    roleName.includes('personel head') ||
    roleName.includes('office head');
  const currentUserId = toId(currentUser?.UserID, currentUser?.user_id, currentUser?.id);

  const getStatusKey = (status: string) => {
    const value = String(status || '').toLowerCase().trim();
    if (!value) return 'not_compiled';
    if (value.includes('partial')) return 'partially_compiled';
    if (value.includes('not') || value.includes('pending') || value.includes('un')) return 'not_compiled';
    if (value.includes('complied') || value.includes('compiled') || value.includes('complete')) return 'compiled';
    return 'not_compiled';
  };

  const getStatusLabel = (status: string) => {
    const key = getStatusKey(status);
    if (key === 'compiled') return 'Complied';
    if (key === 'partially_compiled') return 'Partially Complied';
    return 'Not Complied';
  };

  const statusOptions: Array<{
    value: 'all' | 'compiled' | 'partially_compiled' | 'not_compiled';
    label: string;
  }> = [
    { value: 'all', label: 'All' },
    { value: 'compiled', label: 'Complied' },
    { value: 'partially_compiled', label: 'Partially Complied' },
    { value: 'not_compiled', label: 'Not Complied' },
  ];

  const requirementStatusOptions: Array<{
    value: 'all' | 'complied' | 'partially' | 'not_complied';
    label: string;
  }> = [
    { value: 'all', label: 'All' },
    { value: 'complied', label: 'Complied' },
    { value: 'partially', label: 'Partially Complied' },
    { value: 'not_complied', label: 'Not Complied' },
  ];

  const getHeadName = (head: any) => {
    const firstName = head?.FirstName || head?.first_name || '';
    const middleInitial = head?.MiddleInitial || head?.middle_initial;
    const lastName = head?.LastName || head?.last_name || '';
    const combined = `${firstName} ${middleInitial ? `${middleInitial}. ` : ''}${lastName}`.replace(/\s+/g, ' ').trim();
    return combined || head?.full_name || head?.name || `Head ${toId(head?.HeadID, head?.id)}`;
  };

  const getSelectedHeadsText = (headIds: number[]) => {
    if (headIds.length === 0) return 'Select head(s)';
    const selectedHeads = heads.filter((head: any) => headIds.includes(toId(head.HeadID, head.id)));
    if (selectedHeads.length === 1) return getHeadName(selectedHeads[0]);
    return `${headIds.length} heads selected`;
  };

  const openHeadPicker = (target: 'create' | 'edit') => {
    setShowCreateHeadsDropdown(false);
    setShowHeadsDropdown(false);
    setShowCreateOfficeTypeDropdown(false);
    setShowOfficeTypeDropdown(false);
    if (heads.length === 0) {
      loadSupportData();
    }
    setHeadPickerTarget(target);
  };

  const closeHeadPicker = () => {
    setHeadPickerTarget(null);
  };

  const toggleHeadFromPicker = (headId: number) => {
    if (!headId || !headPickerTarget) return;

    if (headPickerTarget === 'create') {
      setCreateForm((prev) => {
        const exists = prev.head_ids.includes(headId);
        if (!exists && prev.head_ids.length >= 4) {
          Alert.alert('Limit reached', 'You can assign up to 4 heads per office.');
          return prev;
        }

        return {
          ...prev,
          head_ids: exists
            ? prev.head_ids.filter((id) => id !== headId)
            : [...prev.head_ids, headId],
        };
      });
      return;
    }

    setEditForm((prev) => {
      const exists = prev.head_ids.includes(headId);
      if (!exists && prev.head_ids.length >= 4) {
        Alert.alert('Limit reached', 'You can assign up to 4 heads per office.');
        return prev;
      }

      return {
        ...prev,
        head_ids: exists
          ? prev.head_ids.filter((id) => id !== headId)
          : [...prev.head_ids, headId],
      };
    });
  };

  const loadSupportData = async () => {
    try {
      const [typeRes, headRes] = await Promise.all([
        officetypesAPI.getAll().catch(() => ({ data: [] })),
        officeHeadsAPI.getAllHeads().catch(() => ({ data: [] })),
      ]);

      const typeList = extractList(typeRes, ['officeTypes', 'types', 'office_types']);
      const headList = extractList(headRes, ['heads', 'office_heads']);
      setOfficeTypes(typeList);
      setHeads(headList);
    } catch {
      setOfficeTypes([]);
      setHeads([]);
    }
  };

  const loadData = async () => {
    try {
      const [officeRes, eventRes, userRes] = await Promise.all([
        officesAPI.getAll(),
        eventsAPI.getAllEvents().catch(() => ({ data: [] })),
        usersAPI.getLoggedInUser().catch(() => null),
      ]);

      const officeList = extractList(officeRes, ['offices']);
      const eventList = extractList(eventRes, ['events']);
      const activeEvents = eventList.filter((event: any) => {
        const status = String(event.Status || event.status || '').toLowerCase();
        return (
          event.IsActive === true ||
          event.active === true ||
          status === 'active' ||
          status === 'compiled'
        );
      });

      setOffices(officeList);
      const eventChoices = activeEvents.length > 0 ? activeEvents : eventList;
      setEvents(eventChoices);
      if (eventChoices.length > 0) {
        const firstEventId = String(toId(eventChoices[0]?.EventID, eventChoices[0]?.id));
        const hasCurrentEvent = eventChoices.some(
          (event: any) => String(toId(event.EventID, event.id)) === String(selectedEventId)
        );
        if (!hasCurrentEvent) {
          setSelectedEventId(firstEventId);
        }
      } else {
        setSelectedEventId('');
      }
      if (userRes) setCurrentUser(userRes.user || userRes);
    } catch (err) {
      console.log('Offices load error:', err);
      setOffices([]);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadData();
      loadSupportData();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredOffices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const bySearch = offices.filter((office: any) => {
      const officeName = String(office.office_name || office.OfficeName || '').toLowerCase();
      const officeType = String(office.office_type_name || office.OfficeTypeName || '').toLowerCase();
      const eventName = String(office.event_name || office.EventName || '').toLowerCase();
      const heads = Array.isArray(office.heads) ? office.heads : [];
      const headNames = heads
        .map((head: any) => String(head.full_name || head.head_name || head.name || ''))
        .join(' ')
        .toLowerCase();

      if (!term) return true;
      return (
        officeName.includes(term) ||
        officeType.includes(term) ||
        eventName.includes(term) ||
        headNames.includes(term)
      );
    });

    const byEvent = selectedEventId
      ? bySearch.filter((office: any) => {
          const eventId = toId(office.event_id, office.EventID, office.eventId, office.EventChildID);
          return String(eventId) === String(selectedEventId);
        })
      : bySearch;

    if (statusFilter === 'all') return byEvent;

    return byEvent.filter((office: any) => getStatusKey(office.overall_status || office.compliance_status) === statusFilter);
  }, [offices, searchTerm, selectedEventId, statusFilter]);

  const toggleSelectedOffice = (officeId: number, selected?: boolean) => {
    setSelectedOfficeIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = selected ?? !next.has(officeId);
      if (shouldSelect) next.add(officeId);
      else next.delete(officeId);
      return next;
    });
  };

  const handleDeletePress = () => {
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedOfficeIds(new Set());
      return;
    }

    if (selectedOfficeIds.size === 0) {
      setDeleteMode(false);
      return;
    }

    Alert.alert('Delete offices', `Delete ${selectedOfficeIds.size} selected office(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const ids = Array.from(selectedOfficeIds);
            await Promise.all(ids.map((id) => officesAPI.deleteOffice(String(id))));
            setDeleteMode(false);
            setSelectedOfficeIds(new Set());
            await loadData();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Unable to delete offices.');
          }
        },
      },
    ]);
  };

  const openCreateModal = () => {
    setCreateForm((prev) => ({
      ...defaultCreateForm,
      event_id: selectedEventId || prev.event_id || String(toId(events[0]?.EventID, events[0]?.id) || ''),
    }));
    setShowCreateOfficeTypeDropdown(false);
    setShowCreateHeadsDropdown(false);
    setCreateModalOpen(true);
  };

  const submitCreateOffice = async () => {
    if (!createForm.office_name.trim()) {
      Alert.alert('Missing field', 'Office name is required.');
      return;
    }

    if (!createForm.event_id) {
      Alert.alert('Missing field', 'Please select an event tab first.');
      return;
    }

    setCreatingOffice(true);
    try {
      await officesAPI.createOffice({
        OfficeName: createForm.office_name.trim(),
        office_name: createForm.office_name.trim(),
        OfficeTypeID: createForm.office_type_id ? Number(createForm.office_type_id) : null,
        office_type_id: createForm.office_type_id ? Number(createForm.office_type_id) : null,
        HeadIDs: createForm.head_ids,
        head_ids: createForm.head_ids,
        EventID: Number(createForm.event_id),
        event_id: Number(createForm.event_id),
      });
      setCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Add office failed', err?.message || 'Unable to create office.');
    } finally {
      setCreatingOffice(false);
    }
  };

  const handleDeleteSingleOffice = (officeId: number) => {
    Alert.alert('Delete office', 'Delete this office?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await officesAPI.deleteOffice(String(officeId));
            setActiveOfficeMenuId(null);
            await loadData();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Unable to delete office.');
          }
        },
      },
    ]);
  };

  const openEditOfficeModal = (office: any) => {
    const officeId = toId(office.id, office.OfficeID);
    const officeName = String(office.office_name || office.OfficeName || '').trim();
    const officeTypeId = String(toId(office.office_type_id, office.OfficeTypeID, office.office_type));

    const headIdsFromArray = Array.isArray(office.head_ids)
      ? office.head_ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
      : [];

    const headsFromObjects = Array.isArray(office.heads)
      ? office.heads
          .map((head: any) => toId(head.HeadID, head.head_id, head.id))
          .filter((id: number) => id > 0)
      : [];

    const fallbackHeadId = toId(office.head_id, office.HeadID);

    const mergedHeadIds = Array.from(new Set([
      ...headIdsFromArray,
      ...headsFromObjects,
      ...(fallbackHeadId > 0 ? [fallbackHeadId] : []),
    ]));

    setEditOfficeTarget({ ...office, id: officeId });
    setEditForm({
      office_name: officeName,
      office_type_id: officeTypeId,
      head_ids: mergedHeadIds,
    });
    setShowOfficeTypeDropdown(false);
    setShowHeadsDropdown(false);
    setEditOfficeOpen(true);
    setActiveOfficeMenuId(null);
  };

  const submitEditOffice = async () => {
    if (!editOfficeTarget) return;
    if (!editForm.office_name.trim()) {
      Alert.alert('Missing field', 'Office name is required.');
      return;
    }

    const officeId = toId(editOfficeTarget.id, editOfficeTarget.OfficeID);
    if (!officeId) {
      Alert.alert('Edit failed', 'Office ID is missing.');
      return;
    }

    setSavingOfficeEdit(true);
    try {
      const existingEventId = toId(
        editOfficeTarget.event_id,
        editOfficeTarget.EventID,
        editOfficeTarget.eventId,
        editOfficeTarget.EventChildID
      );

      const payload = {
        office_name: editForm.office_name.trim(),
        OfficeName: editForm.office_name.trim(),
        office_type_id: editForm.office_type_id ? Number(editForm.office_type_id) : null,
        OfficeTypeID: editForm.office_type_id ? Number(editForm.office_type_id) : null,
        head_ids: editForm.head_ids,
        HeadIDs: editForm.head_ids,
        event_id: existingEventId || null,
        EventID: existingEventId || null,
      };

      await officesAPI.updateOffice(String(officeId), payload);
      setEditOfficeOpen(false);
      setEditOfficeTarget(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Edit failed', err?.message || 'Unable to update office.');
    } finally {
      setSavingOfficeEdit(false);
    }
  };

  const openAddRequirementsModal = async (office: any) => {
    const officeId = toId(office.id, office.OfficeID);
    if (!officeId) return;
    const eventId = toId(office.event_id, office.EventID, office.eventId, office.EventChildID);

    setAddRequirementsOffice({ ...office, id: officeId });
    setAddRequirementsOpen(true);
    setActiveOfficeMenuId(null);
    setLoadingRequirements(true);
    setSelectedRequirementIds(new Set());
    setRequirementsSearch('');

    try {
      const [catalogRes, officeReqRes] = await Promise.all([
        (eventId
          ? requirementsAPI.getAllRequirements(String(eventId)).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })),
        officesAPI.getOfficeRequirements(String(officeId)).catch(() => ({ data: [] })),
      ]);

      const catalog = extractList(catalogRes, ['requirements']);
      const officeReqs = extractList(officeReqRes, ['requirements', 'officeRequirements']);

      const assignedIds = new Set<number>(
        officeReqs
          .map((req: any) => toId(req.RequirementID, req.requirement_id, req.id))
          .filter((id: number) => id > 0)
      );

      setRequirementsCatalog(Array.isArray(catalog) ? catalog : []);
      setAssignedRequirementIds(assignedIds);
    } catch {
      setRequirementsCatalog([]);
      setAssignedRequirementIds(new Set());
    } finally {
      setLoadingRequirements(false);
    }
  };

  const selectableRequirements = useMemo(() => {
    const term = requirementsSearch.trim().toLowerCase();
    return requirementsCatalog
      .filter((req: any) => {
        const reqId = toId(req.RequirementID, req.requirement_id, req.id);
        return reqId > 0;
      })
      .filter((req: any) => {
        if (!term) return true;
        const code = String(req.RequirementCode || req.requirement_code || req.code || '').toLowerCase();
        const name = String(req.RequirementName || req.requirement_name || req.name || '').toLowerCase();
        const desc = String(req.RequirementDescription || req.requirement_description || req.description || '').toLowerCase();
        const criteria = String(req.CriteriaName || req.criteria_name || '').toLowerCase();
        return code.includes(term) || name.includes(term) || desc.includes(term) || criteria.includes(term);
      });
  }, [requirementsCatalog, assignedRequirementIds, requirementsSearch]);

  const groupedSelectableRequirements = useMemo(() => {
    const grouped: Record<string, any> = {};

    selectableRequirements.forEach((req: any) => {
      const areaCode = String(req.AreaCode || req.area_code || 'Area');
      const areaName = String(req.AreaName || req.area_name || '');
      const criteriaCode = String(req.CriteriaCode || req.criteria_code || 'Criteria');
      const criteriaName = String(req.CriteriaName || req.criteria_name || '');

      if (!grouped[areaCode]) {
        grouped[areaCode] = {
          code: areaCode,
          name: areaName,
          criteriaGroups: {},
        };
      }

      if (!grouped[areaCode].criteriaGroups[criteriaCode]) {
        grouped[areaCode].criteriaGroups[criteriaCode] = {
          code: criteriaCode,
          name: criteriaName,
          requirements: [],
        };
      }

      grouped[areaCode].criteriaGroups[criteriaCode].requirements.push(req);
    });

    return Object.values(grouped);
  }, [selectableRequirements]);

  const toggleRequirementSelection = (reqId: number) => {
    // prevent selecting requirements already assigned
    if (assignedRequirementIds.has(reqId)) {
      Alert.alert('Already assigned', 'This requirement is already assigned to the office.');
      return;
    }

    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      const visibleIds = selectableRequirements
        .map((req: any) => toId(req.RequirementID, req.requirement_id, req.id))
        .filter((id: number) => id > 0 && !assignedRequirementIds.has(id));

      const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => next.has(id));
      if (allSelected) {
        visibleIds.forEach((id: number) => next.delete(id));
      } else {
        visibleIds.forEach((id: number) => next.add(id));
      }

      return next;
    });
  };

  const submitAddRequirements = async () => {
    if (!addRequirementsOffice) return;
    const officeId = toId(addRequirementsOffice.id, addRequirementsOffice.OfficeID);
    const selectedIds = Array.from(selectedRequirementIds);
    if (!officeId || selectedIds.length === 0) {
      setAddRequirementsOpen(false);
      return;
    }

    // filter out any that are already assigned (safety net)
    const toSend = selectedIds.filter((id) => !assignedRequirementIds.has(id));
    if (toSend.length === 0) {
      Alert.alert('No new requirements', 'Selected requirements are already assigned to this office.');
      setAddRequirementsOpen(false);
      setSelectedRequirementIds(new Set());
      return;
    }

    setSavingRequirements(true);
    try {
      await officesAPI.addOfficeRequirements(String(officeId), toSend);
      setAddRequirementsOpen(false);
      setAddRequirementsOffice(null);
      setSelectedRequirementIds(new Set());
      await loadData();
    } catch (err: any) {
      Alert.alert('Add requirements failed', err?.message || 'Unable to add requirements.');
    } finally {
      setSavingRequirements(false);
    }
  };

  const getRequirementStatusKey = (req: any): 'complied' | 'partially' | 'not_complied' => {
    const statusId = Number(req.ComplianceStatusID || req.compliance_status_id || req.status_id || req.statusId || 0);
    if (statusId === 5) return 'complied';
    if (statusId === 4) return 'partially';
    if (statusId === 3) return 'not_complied';

    const statusText = String(req.ComplianceStatus || req.compliance_status || req.Status || req.status || '').toLowerCase();
    if (statusText.includes('partial')) return 'partially';
    if (statusText.includes('comp')) return 'complied';
    return 'not_complied';
  };

  const getRequirementStatusLabel = (req: any) => {
    const key = getRequirementStatusKey(req);
    if (key === 'complied') return 'Complied';
    if (key === 'partially') return 'Partially Complied';
    return 'Not Complied';
  };

  const getRequirementStatusId = (req: any) => {
    const statusId = Number(req.ComplianceStatusID || req.compliance_status_id || req.status_id || req.statusId || 0);
    if (statusId === 5 || statusId === 4 || statusId === 3) return statusId;
    const statusKey = getRequirementStatusKey(req);
    if (statusKey === 'complied') return 5;
    if (statusKey === 'partially') return 4;
    return 3;
  };

  const getRequirementUsers = (req: any) => {
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    const fromMap = assignedUsersMap[reqId];
    if (Array.isArray(fromMap)) return fromMap;
    if (Array.isArray(req.assigned_users)) return req.assigned_users;
    if (Array.isArray(req.assignedUsers)) return req.assignedUsers;
    if (Array.isArray(req.users)) return req.users;
    return [];
  };

  const getCurrentUserAssignment = (req: any) => {
    if (!currentUserId) return null;
    return getRequirementUsers(req).find((user: any) => {
      const assignedUserId = toId(user?.UserID, user?.user_id, user?.id);
      return assignedUserId === currentUserId;
    }) || null;
  };

  const canCurrentUserSubmitRequirement = (req: any) => {
    return isPersonnelHead && !!getCurrentUserAssignment(req);
  };

  const hasUploadedFile = (user: any) => {
    if (user?.HasUploaded === true || user?.HasUploaded === 1) return true;
    if (user?.has_uploaded === true || user?.has_uploaded === 1) return true;
    if (user?.FileURL || user?.fileUrl || user?.url) return true;
    return false;
  };

  const getUserDisplayName = (user: any, index: number) => {
    return getPersonName(user, `User ${index + 1}`);
  };

  const loadAssignedUsersForRequirements = async (officeId: number, reqList: any[]) => {
    const nextMap: Record<number, any[]> = {};

    await Promise.all(
      reqList.map(async (req: any) => {
        const reqId = toId(req.RequirementID, req.requirement_id, req.id);
        if (!reqId) return;

        try {
          const assignedRes = await officesAPI.getRequirementAssignedUsers(String(officeId), String(reqId));
          const users = extractList(assignedRes, ['assignedUsers', 'users', 'data']);
          nextMap[reqId] = Array.isArray(users) ? users : [];
        } catch {
          nextMap[reqId] =
            (Array.isArray(req.assigned_users) && req.assigned_users) ||
            (Array.isArray(req.assignedUsers) && req.assignedUsers) ||
            (Array.isArray(req.users) && req.users) ||
            [];
        }
      })
    );

    setAssignedUsersMap(nextMap);
  };

  const reloadOfficeDetailsRequirements = async () => {
    const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
    if (!officeId) return;

    const reqRes = await officesAPI.getOfficeRequirements(String(officeId));
    const reqList = extractList(reqRes, ['requirements', 'officeRequirements']);
    const safeReqList = Array.isArray(reqList) ? reqList : [];
    setOfficeDetailsRequirements(safeReqList);
    await loadAssignedUsersForRequirements(officeId, safeReqList);
  };

  const handleOfficeRequirementStatusChange = async (req: any, newStatusId: 3 | 4 | 5) => {
    if (!isAdmin) {
      return;
    }

    const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    if (!officeId || !reqId) return;

    setUpdatingStatusReqId(reqId);
    try {
      await officesAPI.updateOfficeRequirementStatus(String(officeId), String(reqId), {
        statusId: newStatusId,
      });

      setOfficeDetailsRequirements((prev) =>
        prev.map((item: any) => {
          const itemId = toId(item.RequirementID, item.requirement_id, item.id);
          if (itemId !== reqId) return item;
          return {
            ...item,
            ComplianceStatusID: newStatusId,
            compliance_status_id: newStatusId,
            ComplianceStatus:
              newStatusId === 5 ? 'Complied' : newStatusId === 4 ? 'Partially Complied' : 'Not Complied',
          };
        })
      );
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to update compliance status.');
    } finally {
      setUpdatingStatusReqId(null);
    }
  };

  const handleRequirementCommentClick = (req: any) => {
    if (!isAdmin) {
      return;
    }

    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    setEditingCommentId(reqId);
    setCommentInput(String(req.comments || req.Comments || req.comment || ''));
  };

  const handleRequirementCommentCancel = () => {
    setEditingCommentId(null);
    setCommentInput('');
  };

  const handleRequirementCommentSave = async (req: any) => {
    if (!isAdmin) {
      return;
    }

    const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    if (!officeId || !reqId) return;

    setSavingComment(true);
    try {
      await officesAPI.updateOfficeRequirementStatus(String(officeId), String(reqId), {
        statusId: getRequirementStatusId(req),
        comments: commentInput,
      });

      setOfficeDetailsRequirements((prev) =>
        prev.map((item: any) => {
          const itemId = toId(item.RequirementID, item.requirement_id, item.id);
          if (itemId !== reqId) return item;
          return {
            ...item,
            comments: commentInput,
            Comments: commentInput,
            comment: commentInput,
          };
        })
      );

      setEditingCommentId(null);
      setCommentInput('');
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Unable to save comment.');
    } finally {
      setSavingComment(false);
    }
  };

  const closeSubmissionModal = () => {
    setSubmissionModalVisible(false);
    setSubmissionModalRequirement(null);
    setSubmissionModalUsers([]);
  };

  const closeFileLightbox = () => {
    setFileLightboxVisible(false);
    setFileLightboxData(null);
  };

  const openSubmissionModal = (req: any) => {
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    if (!reqId) return;

    if (isAdmin) {
      setSubmissionModalMode('admin');
      setSubmissionModalUsers(getRequirementUsers(req));
    } else if (canCurrentUserSubmitRequirement(req)) {
      const assignment = getCurrentUserAssignment(req);
      if (!assignment) return;
      setSubmissionModalMode('work');
      setSubmissionModalUsers([
        {
          ...assignment,
          HasUploaded: hasUploadedFile(assignment),
        },
      ]);
    } else {
      return;
    }

    setSubmissionModalRequirement(req);
    setSubmissionModalVisible(true);
  };

  const canOpenSubmissionForRequirement = (req: any) =>
    isAdmin || canCurrentUserSubmitRequirement(req);

  const getRequirementUploadCounts = (req: any) => {
    const users = getRequirementUsers(req);
    const uploadedCount = users.filter((user: any) => hasUploadedFile(user)).length;
    return { uploadedCount, totalCount: users.length };
  };

  const handleViewUploadedUserFile = async (user: any, req: any) => {
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    const userId = toId(user?.UserID, user?.user_id, user?.id, user?.HeadID);
    if (!reqId || !userId) {
      Alert.alert('Unavailable', 'User file is unavailable.');
      return;
    }

    setOpeningUserFileReqId(reqId);
    try {
      const response = await requirementsAPI.getUserFile(String(reqId), String(userId));
      const fileUrl =
        response?.file?.url ||
        response?.file?.FileURL ||
        response?.fileUrl ||
        response?.url ||
        response?.data?.file?.url ||
        response?.data?.fileUrl ||
        user?.FileURL ||
        user?.fileUrl ||
        user?.url;

      if (!fileUrl) {
        Alert.alert('No file', 'No uploaded file found for this user.');
        return;
      }

      const fileName =
        response?.file?.fileName ||
        response?.file?.FileName ||
        response?.fileName ||
        String(fileUrl).split('/').pop() ||
        'Uploaded file';

      setFileLightboxData({
        url: normalizeServerUrl(fileUrl),
        fileName: String(fileName),
      });
      setFileLightboxVisible(true);
    } catch (err: any) {
      Alert.alert('Open file failed', err?.message || 'Unable to open uploaded file.');
    } finally {
      setOpeningUserFileReqId(null);
    }
  };

  const handleUploadMyRequirementFile = async (req: any) => {
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    const assignment = getCurrentUserAssignment(req);

    if (!reqId || !currentUserId || !assignment || !isPersonnelHead) {
      Alert.alert('Read only', 'Only assigned personnel heads can submit files for this requirement.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      setUploadingMyReqId(reqId);
      const response = await requirementsAPI.uploadUserFile({
        fileUri: file.uri,
        fileName: file.name || `requirement-${reqId}`,
        mimeType: file.mimeType || 'application/octet-stream',
        requirementId: String(reqId),
        userId: String(currentUserId),
      });

      if (response?.success === false) {
        throw new Error(response?.message || 'Failed to upload file.');
      }

      await requirementsAPI.markUserAsUploaded(String(reqId), String(currentUserId)).catch(() => null);
      await reloadOfficeDetailsRequirements();
      if (submissionModalVisible && submissionModalRequirement) {
        const assignment = getCurrentUserAssignment(submissionModalRequirement);
        if (assignment) {
          setSubmissionModalUsers([
            {
              ...assignment,
              HasUploaded: true,
            },
          ]);
        }
      }
      Alert.alert('Submitted', 'Your file was uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Unable to upload this file.');
    } finally {
      setUploadingMyReqId(null);
    }
  };

  const handleUnsubmitMyRequirementFile = (req: any) => {
    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
    const assignment = getCurrentUserAssignment(req);

    if (!reqId || !currentUserId || !assignment || !isPersonnelHead) return;

    Alert.alert('Remove submission', 'Remove your uploaded file for this requirement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUnsubmittingMyReqId(reqId);
          try {
            await requirementsAPI.deleteUserFile(String(reqId), String(currentUserId));
            await reloadOfficeDetailsRequirements();
            if (submissionModalVisible && submissionModalRequirement) {
              const assignment = getCurrentUserAssignment(submissionModalRequirement);
              if (assignment) {
                setSubmissionModalUsers([
                  {
                    ...assignment,
                    HasUploaded: false,
                  },
                ]);
              }
            }
          } catch (err: any) {
            Alert.alert('Remove failed', err?.message || 'Unable to remove your uploaded file.');
          } finally {
            setUnsubmittingMyReqId(null);
          }
        },
      },
    ]);
  };

  const loadAssignModalData = async (req: any) => {
    const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
    const reqId = toId(req?.RequirementID, req?.requirement_id, req?.id);
    if (!officeId || !reqId) return;

    setAssignModalLoading(true);
    setAssignModalError('');

    try {
      const [availableRes, assignedRes] = await Promise.all([
        requirementsAPI.getAvailableUsersForAssignment(String(reqId), String(officeId)).catch(() => ({ data: [] })),
        requirementsAPI.getAssignedUsers(String(reqId), String(officeId)).catch(async () =>
          officesAPI.getRequirementAssignedUsers(String(officeId), String(reqId))
        ),
      ]);

      const availableUsers = extractList(availableRes, ['data', 'users', 'availableUsers']);
      const assignedUsers = extractList(assignedRes, ['data', 'assignedUsers', 'users']);
      const safeAvailable = Array.isArray(availableUsers) ? availableUsers : [];
      const safeAssigned = Array.isArray(assignedUsers) ? assignedUsers : [];

      setAssignModalAvailableUsers(safeAvailable);
      setAssignModalAssignedUsers(safeAssigned);
      setAssignedUsersMap((prev) => ({ ...prev, [reqId]: safeAssigned }));
    } catch (err: any) {
      setAssignModalError(err?.message || 'Unable to load assignable users.');
      setAssignModalAvailableUsers([]);
      setAssignModalAssignedUsers([]);
    } finally {
      setAssignModalLoading(false);
    }
  };

  const openAssignUsersModal = async (req: any) => {
    if (!isAdmin) {
      return;
    }

    setAssignModalRequirement(req);
    setAssignModalOpen(true);
    setAssignModalTab('assign');
    setAssignModalSearch('');
    setAssignModalSelectedUserIds(new Set());
    setAssignModalError('');
    await loadAssignModalData(req);
  };

  const closeAssignUsersModal = () => {
    setAssignModalOpen(false);
    setAssignModalRequirement(null);
    setAssignModalAvailableUsers([]);
    setAssignModalAssignedUsers([]);
    setAssignModalSelectedUserIds(new Set());
    setAssignModalSearch('');
    setAssignModalError('');
    setAssignModalTab('assign');
  };

  const toggleAssignUserSelection = (user: any) => {
    const userId = toId(user?.UserID, user?.user_id, user?.id);
    if (!userId || user?.isAssigned) return;

    setAssignModalError('');

    setAssignModalSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        return next;
      }

      const assignedCount = assignModalAssignedUsers.length;
      const selectedCount = next.size;
      if (assignedCount + selectedCount >= 4) {
        setAssignModalError('Maximum 4 users can be assigned to this requirement.');
        return prev;
      }

      next.add(userId);
      return next;
    });
  };

  const submitAssignUsers = async () => {
    if (!isAdmin) {
      return;
    }

    const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
    const reqId = toId(assignModalRequirement?.RequirementID, assignModalRequirement?.requirement_id, assignModalRequirement?.id);
    const userIds = Array.from(assignModalSelectedUserIds);
    if (!officeId || !reqId || userIds.length === 0) {
      setAssignModalError('Select at least one user to assign.');
      return;
    }

    setAssignModalSubmitting(true);
    setAssignModalError('');

    try {
      await requirementsAPI.assignUsersToRequirement(
        String(reqId),
        String(officeId),
        userIds,
        toId(currentUser?.UserID, currentUser?.user_id, currentUser?.id) || undefined
      );

      setAssignModalSelectedUserIds(new Set());
      setAssignModalTab('assigned');
      await loadAssignModalData(assignModalRequirement);
    } catch (err: any) {
      setAssignModalError(err?.message || 'Unable to assign users.');
    } finally {
      setAssignModalSubmitting(false);
    }
  };

  const removeAssignedUser = async (assignmentId: number) => {
    if (!isAdmin) {
      return;
    }

    setRemovingAssignmentId(assignmentId);
    setAssignModalError('');
    try {
      await requirementsAPI.removeUserAssignment(String(assignmentId));
      await loadAssignModalData(assignModalRequirement);
    } catch (err: any) {
      setAssignModalError(err?.message || 'Unable to remove assignment.');
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  const toggleAssignedUploadStatus = async (assignment: any) => {
    if (!isAdmin) {
      return;
    }

    const assignmentId = toId(assignment?.AssignmentID, assignment?.assignment_id, assignment?.id);
    if (!assignmentId) return;

    const hasUploaded = assignment?.HasUploaded === 1 || assignment?.HasUploaded === true;
    setTogglingUploadAssignmentId(assignmentId);
    setAssignModalError('');
    try {
      await requirementsAPI.updateUserUploadStatus(String(assignmentId), !hasUploaded);
      await loadAssignModalData(assignModalRequirement);
    } catch (err: any) {
      setAssignModalError(err?.message || 'Unable to update upload status.');
    } finally {
      setTogglingUploadAssignmentId(null);
    }
  };

  const openOfficeDetailsModal = async (office: any) => {
    const officeId = toId(office.id, office.OfficeID);
    if (!officeId) return;

    setActiveOfficeMenuId(null);
    setOfficeDetailsTarget({ ...office, id: officeId });
    setOfficeDetailsOpen(true);
    setOfficeDetailsMenuOpen(false);
    setOfficeDetailsStatusDropdownOpen(false);
    setOfficeDetailsStatusFilter('all');
    setOfficeDetailsSearch('');
    setOfficeDetailsLoading(true);
    setAssignedUsersMap({});
    setEditingCommentId(null);
    setCommentInput('');

    try {
      const reqRes = await officesAPI.getOfficeRequirements(String(officeId));
      const reqList = extractList(reqRes, ['requirements', 'officeRequirements']);
      const safeReqList = Array.isArray(reqList) ? reqList : [];
      setOfficeDetailsRequirements(safeReqList);
      await loadAssignedUsersForRequirements(officeId, safeReqList);
    } catch {
      setOfficeDetailsRequirements([]);
      setAssignedUsersMap({});
    } finally {
      setOfficeDetailsLoading(false);
    }
  };

  const filteredOfficeRequirements = useMemo(() => {
    const term = officeDetailsSearch.trim().toLowerCase();

    const byStatus =
      officeDetailsStatusFilter === 'all'
        ? officeDetailsRequirements
        : officeDetailsRequirements.filter((req: any) => getRequirementStatusKey(req) === officeDetailsStatusFilter);

    if (!term) return byStatus;

    return byStatus.filter((req: any) => {
      const reqCode = String(req.RequirementCode || req.requirement_code || req.code || '').toLowerCase();
      const reqName = String(req.RequirementName || req.requirement_name || req.name || '').toLowerCase();
      const reqDesc = String(req.RequirementDescription || req.requirement_description || req.Description || req.description || '').toLowerCase();
      const criteriaCode = String(req.CriteriaCode || req.criteria_code || '').toLowerCase();
      const criteriaName = String(req.CriteriaName || req.criteria_name || '').toLowerCase();
      const areaCode = String(req.AreaCode || req.area_code || '').toLowerCase();
      const areaName = String(req.AreaName || req.area_name || '').toLowerCase();
      return (
        reqCode.includes(term) ||
        reqName.includes(term) ||
        reqDesc.includes(term) ||
        criteriaCode.includes(term) ||
        criteriaName.includes(term) ||
        areaCode.includes(term) ||
        areaName.includes(term)
      );
    });
  }, [officeDetailsRequirements, officeDetailsSearch, officeDetailsStatusFilter]);

  const groupedOfficeRequirements = useMemo(() => {
    const grouped: Record<string, any> = {};

    filteredOfficeRequirements.forEach((req: any) => {
      const areaCode = req.AreaCode || req.area_code || 'Area';
      const areaName = req.AreaName || req.area_name || '';
      const criteriaCode = req.CriteriaCode || req.criteria_code || 'Criteria';
      const criteriaName = req.CriteriaName || req.criteria_name || '';

      if (!grouped[areaCode]) {
        grouped[areaCode] = {
          code: areaCode,
          name: areaName,
          criteriaGroups: {},
        };
      }

      if (!grouped[areaCode].criteriaGroups[criteriaCode]) {
        grouped[areaCode].criteriaGroups[criteriaCode] = {
          code: criteriaCode,
          name: criteriaName,
          requirements: [],
        };
      }

      grouped[areaCode].criteriaGroups[criteriaCode].requirements.push(req);
    });

    return Object.values(grouped);
  }, [filteredOfficeRequirements]);

  const filteredAssignableUsers = useMemo(() => {
    const term = assignModalSearch.trim().toLowerCase();

    return assignModalAvailableUsers.filter((user: any) => {
      if (user?.isAssigned) return false;
      if (!term) return true;

      const name = getPersonName(user, '').toLowerCase();
      const email = String(user?.Email || user?.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [assignModalAvailableUsers, assignModalSearch]);

  const getStatusStyles = (status: string) => {
    const key = getStatusKey(status);
    if (key === 'compiled') {
      return {
        badge: styles.statusGood,
        dot: styles.statusDotGood,
      };
    }
    if (key === 'partially_compiled') {
      return {
        badge: styles.statusWarn,
        dot: styles.statusDotWarn,
      };
    }
    return {
      badge: styles.statusBad,
      dot: styles.statusDotBad,
    };
  };

  const officeRequirementStatusStyles: Record<
    'complied' | 'partially' | 'not_complied',
    { badge: any; dot: any }
  > = {
    complied: {
      badge: styles.officeRequirementStatusBadgeGood,
      dot: styles.officeRequirementStatusDotGood,
    },
    partially: {
      badge: styles.officeRequirementStatusBadgeWarn,
      dot: styles.officeRequirementStatusDotWarn,
    },
    not_complied: {
      badge: styles.officeRequirementStatusBadgeBad,
      dot: styles.officeRequirementStatusDotBad,
    },
  };

  const assignRemainingSlots = Math.max(0, 4 - assignModalAssignedUsers.length);

  const officeDetailsCompliancePercent = Math.max(
    0,
    Math.min(100, Number(officeDetailsTarget?.compliance_percent || officeDetailsTarget?.CompliancePercent || 0))
  );
  const officeDetailsComplianceColor = getComplianceColor(officeDetailsCompliancePercent);
  const officeDetailsStatusLabel = getStatusLabel(officeDetailsTarget?.overall_status || officeDetailsTarget?.compliance_status);
  const officeDetailsStatusStyle = getStatusStyles(officeDetailsStatusLabel);
  const addRequirementsEventId = toId(
    addRequirementsOffice?.event_id,
    addRequirementsOffice?.EventID,
    addRequirementsOffice?.eventId,
    addRequirementsOffice?.EventChildID
  );
  const headPickerSelectedIds = headPickerTarget === 'create' ? createForm.head_ids : editForm.head_ids;
  const headPickerTitle = headPickerTarget === 'create' ? 'Select Heads (Add Office)' : 'Select Heads (Edit Office)';

  const renderOfficeCard = ({ item }: { item: any }) => {
    const officeId = toId(item.id, item.OfficeID);
    const checked = selectedOfficeIds.has(officeId);
    const menuOpen = activeOfficeMenuId === officeId;

    const officeHeads = Array.isArray(item.heads) ? item.heads : [];
    const totalReq = Number(item.total_requirements || item.TotalRequirements || 0);
    const compliancePercent = Math.max(
      0,
      Math.min(100, Number(item.compliance_percent || item.CompliancePercent || 0))
    );
    const complianceColor = getComplianceColor(compliancePercent);

    const status = getStatusLabel(item.overall_status || item.compliance_status);
    const statusStyle = getStatusStyles(status);

    const officeType = item.office_type_name || item.OfficeTypeName || 'Office';
    const officeName = item.office_name || item.OfficeName || `Office ${officeId}`;
    const eventName = item.event_name || item.EventName || 'No event';

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        style={[styles.officeCard, checked && styles.selectedOfficeCard]}
        onPress={() => {
          if (deleteMode) {
            toggleSelectedOffice(officeId);
            return;
          }
          openOfficeDetailsModal(item);
        }}
      >
        <View style={styles.officeCardHeader}>
          <View style={styles.officeMainHead}>
            {deleteMode && (
              <TouchableOpacity
                style={[styles.selectionBox, checked && styles.selectionBoxActive]}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleSelectedOffice(officeId);
                }}
              >
                <Text style={styles.selectionBoxText}>{checked ? '✓' : ''}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.officeGlyph}>
              <Text style={styles.officeGlyphText}>⌂</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.officeTitle} numberOfLines={1}>{officeName}</Text>
              <Text style={styles.officeSub} numberOfLines={1}>{eventName}</Text>
            </View>
          </View>

          <View style={styles.officeHeaderRight}>
            <Text style={styles.officeTypePill}>{officeType}</Text>

            {isAdmin && (
              <View style={styles.officeMenuWrap}>
                <TouchableOpacity
                  style={styles.officeMenuTrigger}
                  onPress={(event) => {
                    event.stopPropagation();
                    setActiveOfficeMenuId(menuOpen ? null : officeId);
                  }}
                >
                  <Text style={styles.officeMenuTriggerText}>⋮</Text>
                </TouchableOpacity>

                {menuOpen && (
                  <View style={styles.officeMenuDropdown}>
                    <TouchableOpacity
                      style={styles.officeMenuItem}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEditOfficeModal(item);
                      }}
                    >
                      <Text style={styles.officeMenuItemText}>Edit Office Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.officeMenuItem}
                      onPress={(event) => {
                        event.stopPropagation();
                        openAddRequirementsModal(item);
                      }}
                    >
                      <Text style={styles.officeMenuItemText}>Add Requirements</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.officeMenuItem}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleDeleteSingleOffice(officeId);
                      }}
                    >
                      <Text style={styles.officeMenuDeleteText}>Delete Office</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.reqStatusWrap}>
          <Text style={styles.reqCountText}>{totalReq} requirements</Text>
          <View style={[styles.statusPill, statusStyle.badge]}>
            <View style={[styles.statusDot, statusStyle.dot]} />
            <Text style={styles.statusPillText}>{status}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressLabel}>Compliance</Text>
            <Text style={[styles.progressValue, { color: complianceColor }]}>{compliancePercent.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${compliancePercent}%`, backgroundColor: complianceColor }]} />
          </View>
        </View>

        <View style={styles.personnelWrap}>
          <Text style={styles.personnelTitle}>Personnel</Text>
          {officeHeads.length === 0 ? (
            <View style={styles.personnelEmptyRow}>
              <View style={styles.avatarEmpty}><Text style={styles.avatarEmptyText}>U</Text></View>
              <Text style={styles.personnelEmptyText}>Unassigned</Text>
            </View>
          ) : (
            <View style={styles.personnelCardBlock}>
              <View style={styles.personnelCardTopRow}>
                <View style={styles.personnelCardGrid}>
                  {officeHeads.slice(0, 4).map((head: any, idx: number) => {
                    const name = getPersonName(head, `Personnel ${idx + 1}`);
                    const firstName = getFirstName(head, `P${idx + 1}`);
                    const initials = getInitials(name);
                    const profileUrl = getProfilePicUrl(head);

                    return (
                      <View key={`${officeId}-${idx}`} style={styles.personnelCardItem}>
                        <ProfileAvatar
                          uri={profileUrl}
                          initials={initials || 'U'}
                          containerStyle={styles.personnelCardAvatar}
                          imageStyle={styles.personnelCardAvatarImage}
                          textStyle={styles.personnelCardAvatarText}
                        />
                        <Text style={styles.personnelCardName} numberOfLines={1}>{firstName}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.personnelCountInline}>{officeHeads.length}</Text>
              </View>

              {officeHeads.length > 4 && (
                <Text style={styles.personnelMoreText}>+{officeHeads.length - 4} more</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading office operations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredOffices}
        keyExtractor={(item) => String(toId(item.id, item.OfficeID) || Math.random())}
        renderItem={renderOfficeCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>Office Operations</Text>
                <Text style={styles.pageSubtitle}>Monitor office compliance, assignments, and requirement progress.</Text>
              </View>

              {isAdmin && (
                <View style={styles.topActions}>
                  <TouchableOpacity
                    style={[styles.deleteBtn, deleteMode && styles.deleteBtnActive]}
                    onPress={handleDeletePress}
                  >
                    <Text style={styles.deleteBtnText}>
                      {deleteMode ? (selectedOfficeIds.size > 0 ? `Delete (${selectedOfficeIds.size})` : 'Cancel') : 'Delete'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.controlRow}>
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search offices, personnel, or office types..."
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setShowStatusDropdown((prev) => !prev)}
              >
                <Text style={styles.filterBtnText}>
                  {statusOptions.find((option) => option.value === statusFilter)?.label || 'Status'}
                </Text>
              </TouchableOpacity>

              {showStatusDropdown && (
                <View style={styles.dropdownMenu}>
                  {statusOptions.map((option) => {
                    const active = statusFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        onPress={() => {
                          setStatusFilter(option.value);
                          setShowStatusDropdown(false);
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventTabsWrap}>
              {events.map((event: any) => {
                const eventId = String(toId(event.EventID, event.id));
                const active = selectedEventId === eventId;
                return (
                  <TouchableOpacity
                    key={eventId}
                    onPress={() => setSelectedEventId(eventId)}
                    style={[styles.eventTab, active && styles.eventTabActive]}
                  >
                    <Text style={[styles.eventTabText, active && styles.eventTabTextActive]}>
                      {event.EventCode || event.event_code || event.EventName || event.name || `E-${eventId}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matching offices</Text>
            <Text style={styles.emptySub}>Try broadening your search or changing the current filter.</Text>
          </View>
        }
      />

      <Modal
        visible={officeDetailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOfficeDetailsOpen(false);
          closeAssignUsersModal();
          setOfficeDetailsMenuOpen(false);
          setOfficeDetailsStatusDropdownOpen(false);
        }}
      >
        <Pressable
          style={styles.officeDetailsOverlay}
          onPress={() => {
            setOfficeDetailsOpen(false);
            closeAssignUsersModal();
            setOfficeDetailsMenuOpen(false);
            setOfficeDetailsStatusDropdownOpen(false);
          }}
        >
          <Pressable style={styles.officeDetailsCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.officeDetailsHeader}>
              <View style={styles.officeDetailsTitleWrap}>
                <View style={styles.officeDetailsIconWrap}>
                  <Text style={styles.officeDetailsIconText}>⌂</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.officeDetailsTitle} numberOfLines={1}>
                    {officeDetailsTarget?.office_name || officeDetailsTarget?.OfficeName || 'Office'}
                  </Text>
                  <Text style={styles.officeDetailsSubtitle} numberOfLines={1}>
                    {officeDetailsTarget?.office_type_name || officeDetailsTarget?.OfficeTypeName || 'Office Type'}
                  </Text>
                  <Text style={styles.officeDetailsSubtitle} numberOfLines={1}>
                    Event: {officeDetailsTarget?.event_name || officeDetailsTarget?.EventName || 'No event'}
                  </Text>
                </View>
              </View>

              <View style={styles.officeDetailsActions}>
                {isAdmin && (
                  <View style={styles.officeDetailsMenuWrap}>
                    <TouchableOpacity
                      style={styles.officeDetailsMenuBtn}
                      onPress={() => setOfficeDetailsMenuOpen((prev) => !prev)}
                    >
                      <Text style={styles.officeDetailsMenuBtnText}>⋮</Text>
                    </TouchableOpacity>

                    {officeDetailsMenuOpen && (
                      <View style={styles.officeDetailsMenuDropdown}>
                        <TouchableOpacity
                          style={styles.officeDetailsMenuItem}
                          onPress={() => {
                            setOfficeDetailsMenuOpen(false);
                            setOfficeDetailsOpen(false);
                            closeAssignUsersModal();
                            if (officeDetailsTarget) openEditOfficeModal(officeDetailsTarget);
                          }}
                        >
                          <Text style={styles.officeDetailsMenuItemText}>Edit Office Info</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.officeDetailsMenuItem}
                          onPress={() => {
                            setOfficeDetailsMenuOpen(false);
                            setOfficeDetailsOpen(false);
                            closeAssignUsersModal();
                            if (officeDetailsTarget) openAddRequirementsModal(officeDetailsTarget);
                          }}
                        >
                          <Text style={styles.officeDetailsMenuItemText}>Add Requirements</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.officeDetailsMenuItem}
                          onPress={() => {
                            setOfficeDetailsMenuOpen(false);
                            setOfficeDetailsOpen(false);
                            closeAssignUsersModal();
                            const officeId = toId(officeDetailsTarget?.id, officeDetailsTarget?.OfficeID);
                            if (officeId) handleDeleteSingleOffice(officeId);
                          }}
                        >
                          <Text style={styles.officeDetailsMenuDeleteText}>Delete Office</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.officeDetailsCloseBtn}
                  onPress={() => {
                    setOfficeDetailsOpen(false);
                    closeAssignUsersModal();
                    setOfficeDetailsMenuOpen(false);
                    setOfficeDetailsStatusDropdownOpen(false);
                  }}
                >
                  <Text style={styles.officeDetailsCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.officeDetailsInfoBar}>
              <View style={styles.officeDetailsPersonnelWrap}>
                <Text style={styles.officeDetailsPersonnelTitle}>Personnel</Text>
                {(Array.isArray(officeDetailsTarget?.heads) ? officeDetailsTarget.heads : []).length === 0 ? (
                  <View style={styles.personnelEmptyRow}>
                    <View style={styles.avatarEmpty}><Text style={styles.avatarEmptyText}>U</Text></View>
                    <Text style={styles.personnelEmptyText}>Unassigned</Text>
                  </View>
                ) : (
                  <View style={styles.officeDetailsPersonnelList}>
                    {(Array.isArray(officeDetailsTarget?.heads) ? officeDetailsTarget.heads : []).slice(0, 4).map((head: any, idx: number) => {
                      const name = getPersonName(head, `Personnel ${idx + 1}`);
                      const initials = getInitials(name);
                      const profileUrl = getProfilePicUrl(head);
                      return (
                        <View key={`detail-head-${idx}`} style={styles.officeDetailsPersonnelItem}>
                          <ProfileAvatar
                            uri={profileUrl}
                            initials={initials || 'U'}
                            containerStyle={styles.officeDetailsPersonnelAvatar}
                            imageStyle={styles.officeDetailsPersonnelAvatarImage}
                            textStyle={styles.officeDetailsPersonnelAvatarText}
                          />
                          <Text style={styles.officeDetailsPersonnelName} numberOfLines={1}>{name}</Text>
                        </View>
                      );
                    })}

                    {(Array.isArray(officeDetailsTarget?.heads) ? officeDetailsTarget.heads.length : 0) > 4 && (
                      <Text style={styles.officeDetailsPersonnelMoreText}>
                        +{(Array.isArray(officeDetailsTarget?.heads) ? officeDetailsTarget.heads.length : 0) - 4} more personnel
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.officeDetailsComplianceWrap}>
                <View style={styles.officeDetailsComplianceTopRow}>
                  <Text style={styles.officeDetailsComplianceLabel}>Compliance</Text>
                  <Text style={[styles.officeDetailsComplianceValue, { color: officeDetailsComplianceColor }]}>
                    {officeDetailsCompliancePercent.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.officeDetailsComplianceTrack}>
                  <View
                    style={[
                      styles.officeDetailsComplianceFill,
                      {
                        width: `${officeDetailsCompliancePercent}%`,
                        backgroundColor: officeDetailsComplianceColor,
                      },
                    ]}
                  />
                </View>
                <View style={[styles.statusPill, officeDetailsStatusStyle.badge, styles.officeDetailsStatusPill]}>
                  <View style={[styles.statusDot, officeDetailsStatusStyle.dot]} />
                  <Text style={styles.statusPillText}>{officeDetailsStatusLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.officeDetailsToolsRow}>
              <Text style={styles.officeDetailsToolsTitle}>Requirements</Text>

              <View style={styles.officeDetailsToolsRight}>
                <View style={styles.officeDetailsStatusWrap}>
                  {isAdmin ? (
                    <>
                      <TouchableOpacity
                        style={styles.officeDetailsStatusBtn}
                        onPress={() => setOfficeDetailsStatusDropdownOpen((prev) => !prev)}
                      >
                        <Text style={styles.officeDetailsStatusBtnText}>
                          {requirementStatusOptions.find((option) => option.value === officeDetailsStatusFilter)?.label || 'All'}
                        </Text>
                      </TouchableOpacity>

                      {officeDetailsStatusDropdownOpen && (
                        <View style={styles.officeDetailsStatusDropdown}>
                          {requirementStatusOptions.map((option) => {
                            const active = officeDetailsStatusFilter === option.value;
                            return (
                              <TouchableOpacity
                                key={`req-status-${option.value}`}
                                style={[styles.officeDetailsStatusItem, active && styles.officeDetailsStatusItemActive]}
                                onPress={() => {
                                  setOfficeDetailsStatusFilter(option.value);
                                  setOfficeDetailsStatusDropdownOpen(false);
                                }}
                              >
                                <Text style={[styles.officeDetailsStatusItemText, active && styles.officeDetailsStatusItemTextActive]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.officeDetailsReadOnlyStatusPill}>
                      <View style={[styles.officeDetailsReadOnlyStatusDot, officeDetailsStatusStyle.dot]} />
                      <Text style={styles.officeDetailsReadOnlyStatusText}>
                        {requirementStatusOptions.find((option) => option.value === officeDetailsStatusFilter)?.label || 'All'}
                      </Text>
                    </View>
                  )}
                </View>

                <TextInput
                  style={styles.officeDetailsSearchInput}
                  value={officeDetailsSearch}
                  onChangeText={setOfficeDetailsSearch}
                  placeholder="Search requirements"
                  placeholderTextColor="#94a3b8"
                  editable={!isOfficeDetailsReadOnly}
                />
              </View>
            </View>

            <View style={styles.officeDetailsBody}>
              {officeDetailsLoading ? (
                <View style={styles.officeDetailsEmptyWrap}>
                  <ActivityIndicator size="small" color="#4f46e5" />
                  <Text style={styles.officeDetailsEmptyText}>Loading requirements...</Text>
                </View>
              ) : groupedOfficeRequirements.length === 0 ? (
                <View style={styles.officeDetailsEmptyWrap}>
                  <Text style={styles.officeDetailsEmptyText}>No requirements found.</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.officeDetailsScrollContent}>
                  {groupedOfficeRequirements.map((area: any) => (
                    <View key={`detail-area-${area.code}`} style={styles.officeAreaBlock}>
                      <View style={styles.officeAreaHeader}>
                        <Text style={styles.officeAreaTitle}>{area.code}</Text>
                        {!!area.name && <Text style={styles.officeAreaSub}>{area.name}</Text>}
                      </View>

                      <View style={styles.officeCriteriaGroupWrap}>
                        {Object.values(area.criteriaGroups).map((criteria: any) => (
                          <View key={`detail-criteria-${area.code}-${criteria.code}`} style={styles.officeCriteriaCard}>
                            <View style={styles.officeCriteriaHeader}>
                              <Text style={styles.officeCriteriaTitle}>{criteria.code}</Text>
                              {!!criteria.name && <Text style={styles.officeCriteriaSub}>{criteria.name}</Text>}
                            </View>

                            {criteria.requirements.map((req: any) => {
                              const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                              const reqCode = req.RequirementCode || req.requirement_code || req.code || `R-${reqId}`;
                              const reqDesc = req.RequirementDescription || req.requirement_description || req.Description || req.description || req.RequirementName || req.requirement_name || req.name || 'Requirement';
                              const reqUsers = getRequirementUsers(req);
                              const reqStatusId = getRequirementStatusId(req);
                              const isEditingComment = editingCommentId === reqId;
                              const currentComment = String(req.comments || req.Comments || req.comment || '');
                              const isAssignedToMe = !!getCurrentUserAssignment(req);
                              const canOpenSubmission = canOpenSubmissionForRequirement(req);
                              const { uploadedCount, totalCount } = getRequirementUploadCounts(req);
                              const RequirementRowWrapper: any = canOpenSubmission ? TouchableOpacity : View;
                              return (
                                <RequirementRowWrapper
                                  key={`detail-req-${reqId}`}
                                  style={[
                                    styles.officeRequirementRow,
                                    isAssignedToMe && styles.officeRequirementRowAssigned,
                                  ]}
                                  onPress={canOpenSubmission ? () => openSubmissionModal(req) : undefined}
                                  activeOpacity={canOpenSubmission ? 0.85 : 1}
                                >
                                  <View style={styles.officeRequirementStatusCol}>
                                    {isAdmin ? (
                                      <>
                                        <TouchableOpacity
                                          style={[styles.reqStatusOption, reqStatusId === 5 && styles.reqStatusOptionActive]}
                                          onPress={() => handleOfficeRequirementStatusChange(req, 5)}
                                          disabled={updatingStatusReqId === reqId}
                                        >
                                          <View style={styles.reqStatusOptionRow}>
                                            <View
                                              style={[
                                                styles.reqStatusRadioOuter,
                                                reqStatusId === 5 && styles.reqStatusRadioOuterComplied,
                                              ]}
                                            >
                                              {reqStatusId === 5 && <View style={[styles.reqStatusRadioInner, styles.reqStatusRadioInnerComplied]} />}
                                            </View>
                                            <Text style={[styles.reqStatusOptionText, styles.reqStatusComplied]}>Complied</Text>
                                          </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[styles.reqStatusOption, reqStatusId === 4 && styles.reqStatusOptionActive]}
                                          onPress={() => handleOfficeRequirementStatusChange(req, 4)}
                                          disabled={updatingStatusReqId === reqId}
                                        >
                                          <View style={styles.reqStatusOptionRow}>
                                            <View
                                              style={[
                                                styles.reqStatusRadioOuter,
                                                reqStatusId === 4 && styles.reqStatusRadioOuterPartial,
                                              ]}
                                            >
                                              {reqStatusId === 4 && <View style={[styles.reqStatusRadioInner, styles.reqStatusRadioInnerPartial]} />}
                                            </View>
                                            <Text style={[styles.reqStatusOptionText, styles.reqStatusPartial]}>Partially Complied</Text>
                                          </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[styles.reqStatusOption, reqStatusId === 3 && styles.reqStatusOptionActive]}
                                          onPress={() => handleOfficeRequirementStatusChange(req, 3)}
                                          disabled={updatingStatusReqId === reqId}
                                        >
                                          <View style={styles.reqStatusOptionRow}>
                                            <View
                                              style={[
                                                styles.reqStatusRadioOuter,
                                                reqStatusId === 3 && styles.reqStatusRadioOuterNot,
                                              ]}
                                            >
                                              {reqStatusId === 3 && <View style={[styles.reqStatusRadioInner, styles.reqStatusRadioInnerNot]} />}
                                            </View>
                                            <Text style={[styles.reqStatusOptionText, styles.reqStatusNot]}>Not Complied</Text>
                                          </View>
                                        </TouchableOpacity>
                                      </>
                                    ) : (
                                      <View style={[styles.officeRequirementStatusBadge, officeRequirementStatusStyles[getRequirementStatusKey(req)].badge]}>
                                        <View style={[styles.officeRequirementStatusDot, officeRequirementStatusStyles[getRequirementStatusKey(req)].dot]} />
                                        <Text style={styles.officeRequirementStatusBadgeText}>{getRequirementStatusLabel(req)}</Text>
                                      </View>
                                    )}
                                  </View>

                                  <View style={{ flex: 1 }}>
                                    <View style={styles.officeRequirementCodeRow}>
                                      <Text style={styles.officeRequirementCode}>{reqCode}</Text>
                                      {isAssignedToMe && (
                                        <View style={styles.officeRequirementActiveBadge}>
                                          <View style={styles.officeRequirementActiveDot} />
                                          <Text style={styles.officeRequirementActiveText}>Active</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={styles.officeRequirementDesc}>{reqDesc}</Text>

                                    <View style={styles.officeRequirementUsersRow}>
                                      {reqUsers.length === 0 ? (
                                        <Text style={styles.officeRequirementUsersEmpty}>Unassigned</Text>
                                      ) : (
                                        reqUsers.slice(0, 6).map((user: any, userIndex: number) => {
                                          const displayName = getUserDisplayName(user, userIndex);
                                          const initials = getInitials(displayName);
                                          const uploaded = hasUploadedFile(user);
                                          const profileUrl = getProfilePicUrl(user);
                                          const avatarKey = `req-${reqId}-user-${toId(user?.UserID, user?.id, user?.HeadID)}-${userIndex}`;
                                          return (
                                            isAdmin ? (
                                              <TouchableOpacity
                                                key={avatarKey}
                                                style={[
                                                  styles.officeReqUserAvatar,
                                                  uploaded
                                                    ? styles.officeReqUserAvatarUploaded
                                                    : styles.officeReqUserAvatarPending,
                                                ]}
                                                onPress={(event) => {
                                                  event.stopPropagation?.();
                                                  if (uploaded) {
                                                    void handleViewUploadedUserFile(user, req);
                                                  }
                                                }}
                                              >
                                                <ProfileAvatar
                                                  uri={profileUrl}
                                                  initials={initials || 'U'}
                                                  containerStyle={styles.officeReqUserAvatarInner}
                                                  imageStyle={styles.officeReqUserAvatarImage}
                                                  textStyle={styles.officeReqUserAvatarText}
                                                />
                                              </TouchableOpacity>
                                            ) : (
                                              <View
                                                key={avatarKey}
                                                style={[
                                                  styles.officeReqUserAvatar,
                                                  uploaded
                                                    ? styles.officeReqUserAvatarUploaded
                                                    : styles.officeReqUserAvatarPending,
                                                ]}
                                              >
                                                <ProfileAvatar
                                                  uri={profileUrl}
                                                  initials={initials || 'U'}
                                                  containerStyle={styles.officeReqUserAvatarInner}
                                                  imageStyle={styles.officeReqUserAvatarImage}
                                                  textStyle={styles.officeReqUserAvatarText}
                                                />
                                              </View>
                                            )
                                          );
                                        })
                                      )}

                                      {openingUserFileReqId === reqId && (
                                        <Text style={styles.officeReqFileOpeningText}>Opening file...</Text>
                                      )}
                                    </View>

                                    {isAdmin ? (
                                      isEditingComment ? (
                                        <View style={styles.officeRequirementCommentEditWrap}>
                                          <TextInput
                                            style={styles.officeRequirementCommentInput}
                                            value={commentInput}
                                            onChangeText={setCommentInput}
                                            placeholder="Add comment..."
                                            placeholderTextColor="#94a3b8"
                                            multiline
                                          />
                                          <View style={styles.officeRequirementCommentActions}>
                                            <TouchableOpacity
                                              style={styles.officeRequirementCommentSaveBtn}
                                              onPress={() => handleRequirementCommentSave(req)}
                                              disabled={savingComment}
                                            >
                                              <Text style={styles.officeRequirementCommentSaveText}>
                                                {savingComment ? 'Saving...' : 'Save'}
                                              </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.officeRequirementCommentCancelBtn}
                                              onPress={handleRequirementCommentCancel}
                                              disabled={savingComment}
                                            >
                                              <Text style={styles.officeRequirementCommentCancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      ) : (
                                        <TouchableOpacity
                                          style={styles.officeRequirementCommentPreview}
                                          onPress={() => handleRequirementCommentClick(req)}
                                        >
                                          <Text style={styles.officeRequirementCommentPreviewText}>
                                            {currentComment || 'Add comment...'}
                                          </Text>
                                        </TouchableOpacity>
                                      )
                                    ) : (
                                      <View style={[styles.officeRequirementCommentPreview, styles.officeRequirementCommentPreviewReadOnly]}>
                                        <Text style={[styles.officeRequirementCommentPreviewText, styles.officeRequirementCommentPreviewTextReadOnly]}>
                                          {currentComment || 'No comment added'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  <View style={styles.officeRequirementRightCol}>
                                    {totalCount > 0 && (
                                      <Text style={styles.officeRequirementUploadCount}>
                                        Uploaded {uploadedCount}/{totalCount}
                                      </Text>
                                    )}
                                    {isAdmin ? (
                                      <TouchableOpacity
                                        style={styles.officeRequirementAssignBtn}
                                        onPress={(event) => {
                                          event.stopPropagation?.();
                                          openAssignUsersModal(req);
                                        }}
                                      >
                                        <Text style={styles.officeRequirementAssignText}>Assign</Text>
                                      </TouchableOpacity>
                                    ) : canOpenSubmission ? (
                                      <Text style={styles.officeRequirementTapHint}>Tap to upload</Text>
                                    ) : (
                                      <Text style={styles.officeRequirementReadOnlyText}>View only</Text>
                                    )}
                                  </View>
                                </RequirementRowWrapper>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.officeDetailsFooter}>
              <TouchableOpacity
                style={styles.officeDetailsFooterCloseBtn}
                onPress={() => {
                  setOfficeDetailsOpen(false);
                  closeAssignUsersModal();
                  setOfficeDetailsMenuOpen(false);
                  setOfficeDetailsStatusDropdownOpen(false);
                }}
              >
                <Text style={styles.officeDetailsFooterCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <EvidenceSubmissionModal
        visible={submissionModalVisible}
        requirement={submissionModalRequirement}
        users={submissionModalUsers}
        mode={submissionModalMode}
        canUpload={submissionModalMode === 'work' && !!submissionModalRequirement && canCurrentUserSubmitRequirement(submissionModalRequirement)}
        uploading={uploadingMyReqId === toId(submissionModalRequirement?.RequirementID, submissionModalRequirement?.requirement_id, submissionModalRequirement?.id)}
        unsubmitting={unsubmittingMyReqId === toId(submissionModalRequirement?.RequirementID, submissionModalRequirement?.requirement_id, submissionModalRequirement?.id)}
        normalizeUrl={normalizeServerUrl}
        getProfilePicUrl={getProfilePicUrl}
        getUserDisplayName={getUserDisplayName}
        onClose={closeSubmissionModal}
        onSelectFile={() => {
          if (submissionModalRequirement) {
            void handleUploadMyRequirementFile(submissionModalRequirement);
          }
        }}
        onUnsubmit={() => {
          if (submissionModalRequirement) {
            handleUnsubmitMyRequirementFile(submissionModalRequirement);
          }
        }}
        onViewFile={(user) => {
          if (submissionModalRequirement) {
            void handleViewUploadedUserFile(user, submissionModalRequirement);
          }
        }}
      />

      <UserFileLightbox
        visible={fileLightboxVisible}
        file={fileLightboxData}
        onClose={closeFileLightbox}
      />

      <Modal
        visible={assignModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAssignUsersModal}
      >
        <Pressable style={styles.assignModalOverlay} onPress={closeAssignUsersModal}>
          <Pressable style={styles.assignModalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.assignModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignModalTitle}>Assign Users</Text>
                <Text style={styles.assignModalSub} numberOfLines={1}>
                  {assignModalRequirement?.RequirementCode || assignModalRequirement?.requirement_code || 'Requirement'}
                </Text>
              </View>
              <TouchableOpacity style={styles.assignModalCloseBtn} onPress={closeAssignUsersModal}>
                <Text style={styles.assignModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.assignTabsRow}>
              <TouchableOpacity
                style={[styles.assignTabBtn, assignModalTab === 'assign' && styles.assignTabBtnActive]}
                onPress={() => setAssignModalTab('assign')}
              >
                <Text style={[styles.assignTabText, assignModalTab === 'assign' && styles.assignTabTextActive]}>
                  Assign ({assignRemainingSlots} left)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.assignTabBtn, assignModalTab === 'assigned' && styles.assignTabBtnActive]}
                onPress={() => setAssignModalTab('assigned')}
              >
                <Text style={[styles.assignTabText, assignModalTab === 'assigned' && styles.assignTabTextActive]}>
                  Assigned ({assignModalAssignedUsers.length}/4)
                </Text>
              </TouchableOpacity>
            </View>

            {assignModalTab === 'assign' ? (
              <View style={styles.assignModalBody}>
                <View style={styles.assignSearchWrap}>
                  <TextInput
                    style={styles.assignSearchInput}
                    value={assignModalSearch}
                    onChangeText={setAssignModalSearch}
                    placeholder="Search users"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.assignSearchHint}>Select up to {assignRemainingSlots} user(s).</Text>
                </View>

                {assignModalLoading ? (
                  <View style={styles.assignEmptyWrap}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                    <Text style={styles.assignEmptyText}>Loading users...</Text>
                  </View>
                ) : assignRemainingSlots <= 0 ? (
                  <View style={styles.assignEmptyWrap}>
                    <Text style={styles.assignEmptyText}>This requirement already has 4 users assigned.</Text>
                  </View>
                ) : filteredAssignableUsers.length === 0 ? (
                  <View style={styles.assignEmptyWrap}>
                    <Text style={styles.assignEmptyText}>No available users found.</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.assignUsersList} contentContainerStyle={styles.assignUsersListContent}>
                    {filteredAssignableUsers.map((user: any, index: number) => {
                      const userId = toId(user?.UserID, user?.user_id, user?.id);
                      const selected = assignModalSelectedUserIds.has(userId);
                      const name = getUserDisplayName(user, index);
                      const initials = getInitials(name);
                      const profileUrl = getProfilePicUrl(user);
                      const isDisabled = !selected && assignModalSelectedUserIds.size >= assignRemainingSlots;

                      return (
                        <TouchableOpacity
                          key={`assign-user-${userId}-${index}`}
                          style={[
                            styles.assignUserRow,
                            selected && styles.assignUserRowSelected,
                            isDisabled && styles.assignUserRowDisabled,
                          ]}
                          onPress={() => {
                            if (!isDisabled) toggleAssignUserSelection(user);
                          }}
                          disabled={isDisabled}
                        >
                          <Text style={[styles.assignUserCheck, selected && styles.assignUserCheckActive]}>
                            {selected ? '☑' : '☐'}
                          </Text>
                          <ProfileAvatar
                            uri={profileUrl}
                            initials={initials || 'U'}
                            containerStyle={styles.assignUserAvatar}
                            imageStyle={styles.assignUserAvatarImage}
                            textStyle={styles.assignUserAvatarText}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.assignUserName}>{name}</Text>
                            <Text style={styles.assignUserEmail}>{user?.Email || user?.email || '-'}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {!!assignModalError && <Text style={styles.assignErrorText}>{assignModalError}</Text>}

                <View style={styles.assignFooter}>
                  <Text style={styles.assignFooterText}>{assignModalSelectedUserIds.size} selected</Text>
                  <View style={styles.assignFooterActions}>
                    <TouchableOpacity
                      style={styles.assignCancelBtn}
                      onPress={closeAssignUsersModal}
                      disabled={assignModalSubmitting}
                    >
                      <Text style={styles.assignCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.assignSaveBtn,
                        (assignModalSubmitting || assignModalSelectedUserIds.size === 0) && { opacity: 0.6 },
                      ]}
                      onPress={submitAssignUsers}
                      disabled={assignModalSubmitting || assignModalSelectedUserIds.size === 0}
                    >
                      <Text style={styles.assignSaveText}>{assignModalSubmitting ? 'Assigning...' : 'Assign'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.assignModalBody}>
                {assignModalLoading ? (
                  <View style={styles.assignEmptyWrap}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                    <Text style={styles.assignEmptyText}>Loading assigned users...</Text>
                  </View>
                ) : assignModalAssignedUsers.length === 0 ? (
                  <View style={styles.assignEmptyWrap}>
                    <Text style={styles.assignEmptyText}>No users assigned yet.</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.assignUsersList} contentContainerStyle={styles.assignUsersListContent}>
                    {assignModalAssignedUsers.map((user: any, index: number) => {
                      const assignmentId = toId(user?.AssignmentID, user?.assignment_id, user?.id);
                      const name = getUserDisplayName(user, index);
                      const initials = getInitials(name);
                      const profileUrl = getProfilePicUrl(user);
                      const uploaded = user?.HasUploaded === 1 || user?.HasUploaded === true;

                      return (
                        <View
                          key={`assigned-user-${assignmentId}-${index}`}
                          style={[styles.assignedUserRow, uploaded && styles.assignedUserRowUploaded]}
                        >
                          <ProfileAvatar
                            uri={profileUrl}
                            initials={initials || 'U'}
                            containerStyle={styles.assignUserAvatar}
                            imageStyle={styles.assignUserAvatarImage}
                            textStyle={styles.assignUserAvatarText}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.assignUserName}>{name}</Text>
                            <Text style={styles.assignUserEmail}>{user?.Email || user?.email || '-'}</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.uploadToggleBtn, uploaded && styles.uploadToggleBtnActive]}
                            onPress={() => {
                              if (isAdmin) {
                                toggleAssignedUploadStatus(user);
                              }
                            }}
                            disabled={!isAdmin || togglingUploadAssignmentId === assignmentId}
                          >
                            <Text style={[styles.uploadToggleText, uploaded && styles.uploadToggleTextActive]}>
                              {uploaded ? 'Uploaded' : 'Not Uploaded'}
                            </Text>
                          </TouchableOpacity>

                          {isAdmin && (
                            <TouchableOpacity
                              style={[styles.removeAssignBtn, removingAssignmentId === assignmentId && { opacity: 0.6 }]}
                              onPress={() => removeAssignedUser(assignmentId)}
                              disabled={removingAssignmentId === assignmentId}
                            >
                              <Text style={styles.removeAssignText}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                )}

                {!!assignModalError && <Text style={styles.assignErrorText}>{assignModalError}</Text>}

                <View style={styles.assignFooter}>
                  <Text style={styles.assignFooterText}>{assignModalAssignedUsers.length} assigned</Text>
                  <TouchableOpacity style={styles.assignCancelBtn} onPress={closeAssignUsersModal}>
                    <Text style={styles.assignCancelText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={createModalOpen} transparent animationType="fade" onRequestClose={() => {
        setCreateModalOpen(false);
        setShowCreateOfficeTypeDropdown(false);
        setShowCreateHeadsDropdown(false);
      }}>
        <Pressable style={styles.modalOverlay} onPress={() => {
          setCreateModalOpen(false);
          setShowCreateOfficeTypeDropdown(false);
          setShowCreateHeadsDropdown(false);
        }}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Office</Text>

            <Text style={styles.modalLabel}>Office Name</Text>
            <TextInput
              style={styles.modalInput}
              value={createForm.office_name}
              onChangeText={(text) => setCreateForm((prev) => ({ ...prev, office_name: text }))}
              placeholder="Enter office name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Office Type</Text>
            <View style={styles.modalSelectWrap}>
              <TouchableOpacity
                style={styles.modalSelectBtn}
                onPress={() => {
                  setShowCreateOfficeTypeDropdown((prev) => !prev);
                  setShowCreateHeadsDropdown(false);
                }}
              >
                <Text style={styles.modalSelectText}>
                  {officeTypes.find((type: any) => String(toId(type.OfficeTypeID, type.id)) === createForm.office_type_id)?.TypeName ||
                    officeTypes.find((type: any) => String(toId(type.OfficeTypeID, type.id)) === createForm.office_type_id)?.name ||
                    'Select Office Type'}
                </Text>
                <Text style={styles.modalSelectArrow}>{showCreateOfficeTypeDropdown ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {showCreateOfficeTypeDropdown && (
                <View style={styles.modalDropdownList}>
                  {officeTypes.map((type: any) => {
                    const typeId = String(toId(type.OfficeTypeID, type.id));
                    const active = createForm.office_type_id === typeId;
                    return (
                      <TouchableOpacity
                        key={`create-office-type-${typeId}`}
                        style={[styles.modalDropdownItem, active && styles.modalDropdownItemActive]}
                        onPress={() => {
                          setCreateForm((prev) => ({ ...prev, office_type_id: typeId }));
                          setShowCreateOfficeTypeDropdown(false);
                        }}
                      >
                        <Text style={[styles.modalDropdownItemText, active && styles.modalDropdownItemTextActive]}>
                          {type.TypeName || type.name || `Type ${typeId}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.modalLabel}>Head(s)</Text>
            <View style={styles.modalSelectWrap}>
              <TouchableOpacity
                style={styles.modalSelectBtn}
                onPress={() => openHeadPicker('create')}
              >
                <Text style={styles.modalSelectText}>{getSelectedHeadsText(createForm.head_ids)}</Text>
                <Text style={styles.modalSelectArrow}>▾</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Event</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {events.map((event: any) => {
                const eventId = String(toId(event.EventID, event.id));
                const active = createForm.event_id === eventId;
                return (
                  <TouchableOpacity
                    key={`create-${eventId}`}
                    style={[styles.eventTab, active && styles.eventTabActive]}
                    onPress={() => setCreateForm((prev) => ({ ...prev, event_id: eventId }))}
                  >
                    <Text style={[styles.eventTabText, active && styles.eventTabTextActive]}>
                      {event.EventCode || event.event_code || event.EventName || event.name || eventId}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setCreateModalOpen(false);
                  setShowCreateOfficeTypeDropdown(false);
                  setShowCreateHeadsDropdown(false);
                }}
                disabled={creatingOffice}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, creatingOffice && { opacity: 0.7 }]}
                onPress={submitCreateOffice}
                disabled={creatingOffice}
              >
                <Text style={styles.modalSaveBtnText}>{creatingOffice ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editOfficeOpen} transparent animationType="fade" onRequestClose={() => {
        setEditOfficeOpen(false);
        setShowOfficeTypeDropdown(false);
        setShowHeadsDropdown(false);
      }}>
        <Pressable style={styles.modalOverlay} onPress={() => {
          setEditOfficeOpen(false);
          setShowOfficeTypeDropdown(false);
          setShowHeadsDropdown(false);
        }}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Office</Text>

            <Text style={styles.modalLabel}>Office Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editForm.office_name}
              onChangeText={(text) => setEditForm((prev) => ({ ...prev, office_name: text }))}
              placeholder="Enter office name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Office Type</Text>
            <View style={styles.modalSelectWrap}>
              <TouchableOpacity
                style={styles.modalSelectBtn}
                onPress={() => {
                  setShowOfficeTypeDropdown((prev) => !prev);
                  setShowHeadsDropdown(false);
                }}
              >
                <Text style={styles.modalSelectText}>
                  {officeTypes.find((type: any) => String(toId(type.OfficeTypeID, type.id)) === editForm.office_type_id)?.TypeName ||
                    officeTypes.find((type: any) => String(toId(type.OfficeTypeID, type.id)) === editForm.office_type_id)?.name ||
                    'Select Office Type'}
                </Text>
                <Text style={styles.modalSelectArrow}>{showOfficeTypeDropdown ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {showOfficeTypeDropdown && (
                <View style={styles.modalDropdownList}>
                  {officeTypes.map((type: any) => {
                    const typeId = String(toId(type.OfficeTypeID, type.id));
                    const active = editForm.office_type_id === typeId;
                    return (
                      <TouchableOpacity
                        key={`office-type-${typeId}`}
                        style={[styles.modalDropdownItem, active && styles.modalDropdownItemActive]}
                        onPress={() => {
                          setEditForm((prev) => ({ ...prev, office_type_id: typeId }));
                          setShowOfficeTypeDropdown(false);
                        }}
                      >
                        <Text style={[styles.modalDropdownItemText, active && styles.modalDropdownItemTextActive]}>
                          {type.TypeName || type.name || `Type ${typeId}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.modalLabel}>Head(s)</Text>
            <View style={styles.modalSelectWrap}>
              <TouchableOpacity
                style={styles.modalSelectBtn}
                onPress={() => openHeadPicker('edit')}
              >
                <Text style={styles.modalSelectText}>{getSelectedHeadsText(editForm.head_ids)}</Text>
                <Text style={styles.modalSelectArrow}>▾</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setEditOfficeOpen(false);
                  setShowOfficeTypeDropdown(false);
                  setShowHeadsDropdown(false);
                }}
                disabled={savingOfficeEdit}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, savingOfficeEdit && { opacity: 0.7 }]}
                onPress={submitEditOffice}
                disabled={savingOfficeEdit}
              >
                <Text style={styles.modalSaveBtnText}>{savingOfficeEdit ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={headPickerTarget !== null} transparent animationType="slide" onRequestClose={closeHeadPicker}>
        <Pressable style={styles.modalOverlay} onPress={closeHeadPicker}>
          <Pressable style={styles.headPickerCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.headPickerHeader}>
              <Text style={styles.headPickerTitle}>{headPickerTitle}</Text>
              <Text style={styles.headPickerSub}>{headPickerSelectedIds.length}/4 selected</Text>
            </View>

            {heads.length === 0 ? (
              <View style={styles.headPickerEmptyWrap}>
                <Text style={styles.headPickerEmptyText}>No heads available</Text>
              </View>
            ) : (
              <FlatList
                data={heads}
                keyExtractor={(head: any, index: number) => `picker-head-${toId(head.HeadID, head.id)}-${index}`}
                style={styles.headPickerList}
                contentContainerStyle={styles.headPickerListContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                renderItem={({ item: head }) => {
                  const headId = toId(head.HeadID, head.id);
                  const active = headPickerSelectedIds.includes(headId);
                  return (
                    <TouchableOpacity
                      style={[styles.headPickerRow, active && styles.headPickerRowActive]}
                      onPress={() => toggleHeadFromPicker(headId)}
                    >
                      <Text style={[styles.headPickerCheck, active && styles.headPickerCheckActive]}>{active ? '✓' : '○'}</Text>
                      <Text style={[styles.headPickerName, active && styles.headPickerNameActive]}>{getHeadName(head)}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <View style={styles.headPickerFooter}>
              <TouchableOpacity style={styles.headPickerDoneBtn} onPress={closeHeadPicker}>
                <Text style={styles.headPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addRequirementsOpen} transparent animationType="slide" onRequestClose={() => setAddRequirementsOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Add Requirements to Office</Text>
                <Text style={styles.sheetSubtitle}>
                  {addRequirementsOffice?.office_name || addRequirementsOffice?.OfficeName || 'Office'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddRequirementsOpen(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetContent}>
              <View style={styles.sheetColumn}>
                <TextInput
                  style={styles.sheetSearchInput}
                  value={requirementsSearch}
                  onChangeText={setRequirementsSearch}
                  placeholder="Search requirements by code, description, or criteria..."
                  placeholderTextColor="#94a3b8"
                />

                <TouchableOpacity style={styles.sheetSelectAllRow} onPress={toggleSelectAllVisible}>
                  <Text style={styles.sheetSelectAllText}>
                    Select All ({selectableRequirements.filter((req: any) => !assignedRequirementIds.has(toId(req.RequirementID, req.requirement_id, req.id))).length})
                  </Text>
                  <Text style={styles.sheetSelectAllCount}>{selectedRequirementIds.size} selected</Text>
                </TouchableOpacity>

                {loadingRequirements ? (
                  <View style={styles.sheetPlaceholderWrap}>
                    <ActivityIndicator size="small" color="#16a34a" />
                    <Text style={styles.sheetPlaceholderText}>Loading requirements...</Text>
                  </View>
                ) : selectableRequirements.length === 0 ? (
                  <View style={styles.sheetPlaceholderWrap}>
                    <Text style={styles.sheetPlaceholderIcon}>📄</Text>
                    <Text style={styles.sheetPlaceholderText}>
                      {addRequirementsEventId ? 'No requirements found under this event' : 'This office has no event assigned'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.sheetList}>
                    {groupedSelectableRequirements.map((area: any) => {
                      const areaRequirements = Object.values(area.criteriaGroups).reduce(
                        (sum: number, criteria: any) => sum + criteria.requirements.length,
                        0
                      );

                      return (
                        <View key={`add-area-${area.code}`} style={styles.addReqAreaCard}>
                          <View style={styles.addReqAreaHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.addReqAreaTitle}>{area.code}</Text>
                              {!!area.name && <Text style={styles.addReqAreaSub}>{area.name}</Text>}
                            </View>
                            <Text style={styles.addReqAreaCount}>{areaRequirements}</Text>
                          </View>

                          <View style={styles.addReqCriteriaWrap}>
                            {Object.values(area.criteriaGroups).map((criteria: any) => (
                              <View key={`add-criteria-${area.code}-${criteria.code}`} style={styles.addReqCriteriaCard}>
                                <View style={styles.addReqCriteriaHeader}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.addReqCriteriaTitle}>{criteria.code}</Text>
                                    {!!criteria.name && <Text style={styles.addReqCriteriaSub}>{criteria.name}</Text>}
                                  </View>
                                  <Text style={styles.addReqCriteriaCount}>{criteria.requirements.length}</Text>
                                </View>

                                {criteria.requirements.map((req: any) => {
                                  const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                  const selected = selectedRequirementIds.has(reqId);
                                  const alreadyAssigned = assignedRequirementIds.has(reqId);
                                  const code = req.RequirementCode || req.requirement_code || req.code || `R-${reqId}`;
                                  const description =
                                    req.RequirementDescription ||
                                    req.requirement_description ||
                                    req.Description ||
                                    req.description ||
                                    req.RequirementName ||
                                    req.requirement_name ||
                                    req.name ||
                                    'No description';

                                  return (
                                    <TouchableOpacity
                                      key={`req-${reqId}`}
                                      style={[
                                        styles.requirementRow,
                                        selected && styles.requirementRowSelected,
                                        alreadyAssigned && styles.requirementRowDisabled,
                                      ]}
                                      onPress={() => {
                                        if (!alreadyAssigned) toggleRequirementSelection(reqId);
                                      }}
                                      disabled={alreadyAssigned}
                                    >
                                      <Text style={[styles.requirementCheck, alreadyAssigned && styles.requirementCheckDisabled]}>
                                        {alreadyAssigned ? '✓' : selected ? '☑' : '☐'}
                                      </Text>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.requirementCode}>{code}</Text>
                                        <Text style={styles.requirementDesc} numberOfLines={2}>{description}</Text>
                                        {alreadyAssigned && (
                                          <View style={styles.requirementAssignedBadge}>
                                            <Text style={styles.requirementAssignedBadgeText}>Already assigned</Text>
                                          </View>
                                        )}
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>

            <View style={styles.sheetFooter}>
              <Text style={styles.sheetFooterCount}>{selectedRequirementIds.size} requirements selected</Text>
              <View style={styles.sheetFooterActions}>
                <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setAddRequirementsOpen(false)}>
                  <Text style={styles.sheetCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetAddBtn, (selectedRequirementIds.size === 0 || savingRequirements) && { opacity: 0.6 }]}
                  onPress={submitAddRequirements}
                  disabled={selectedRequirementIds.size === 0 || savingRequirements}
                >
                  <Text style={styles.sheetAddBtnText}>{savingRequirements ? 'Adding...' : '+ Add Requirements'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    zIndex: 1000,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  pageSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11,
  },
  topActions: {
    flexDirection: 'row',
    gap: 6,
  },
  deleteBtn: {
    height: 30,
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
    height: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 1000,
  },
  searchInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    fontSize: 11,
    color: '#0f172a',
  },
  filterBtn: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: 38,
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingVertical: 4,
    zIndex:9999999999999,
    elevation: 999999999,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#1d4ed8',
  },
  eventTabsWrap: {
    gap: 6,
    paddingTop: 2,
    paddingBottom: 6,
  },
  eventTab: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventTabActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  eventTabText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  eventTabTextActive: {
    color: '#1d4ed8',
  },
  officeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
    zIndex: 1,
  },
  selectedOfficeCard: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  officeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  officeMainHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  officeGlyph: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#cffafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeGlyphText: {
    color: '#0e7490',
    fontSize: 14,
    fontWeight: '700',
  },
  officeTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  officeSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  officeTypePill: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 130,
  },
  officeHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  officeMenuWrap: {
    position: 'relative',
    zIndex: 900,
  },
  officeMenuTrigger: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  officeMenuTriggerText: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
  },
  officeMenuDropdown: {
    position: 'absolute',
    right: 0,
    top: 32,
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    zIndex: 900,
    elevation: 32,
    paddingVertical: 4,
  },
  officeMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  officeMenuItemText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  officeMenuDeleteText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  reqStatusWrap: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reqCountText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  statusGood: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  statusWarn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  statusBad: {
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotGood: {
    backgroundColor: '#10b981',
  },
  statusDotWarn: {
    backgroundColor: '#f59e0b',
  },
  statusDotBad: {
    backgroundColor: '#ef4444',
  },
  progressRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  progressValue: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  personnelWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 7,
  },
  personnelTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personnelCardBlock: {
    gap: 6,
  },
  personnelCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  personnelCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1,
  },
  personnelCardItem: {
    width: 52,
    alignItems: 'center',
    gap: 4,
  },
  personnelCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personnelCardAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  personnelCardAvatarText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
  },
  personnelCardName: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  personnelCountInline: {
    color: '#334155',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
    paddingTop: 4,
  },
  personnelMoreText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: -6,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  avatarText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
  },
  personnelCount: {
    marginLeft: 10,
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  personnelEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmptyText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  personnelEmptyText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  selectionBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBoxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  selectionBoxText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 10,
  },
  emptyWrap: {
    marginTop: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  officeDetailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  officeDetailsCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 99999,
    elevation: 99999,
  },
  officeDetailsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  officeDetailsTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  officeDetailsIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeDetailsIconText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '800',
  },
  officeDetailsTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  officeDetailsSubtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  officeDetailsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  officeDetailsMenuWrap: {
    position: 'relative',
    zIndex: 100,
  },
  officeDetailsMenuBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeDetailsMenuBtnText: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
  },
  officeDetailsMenuDropdown: {
    position: 'absolute',
    right: 0,
    top: 34,
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    zIndex: 101,
    elevation: 20,
    paddingVertical: 4,
  },
  officeDetailsMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  officeDetailsMenuItemText: {
    color: '#334155',
    fontSize: 14,
  },
  officeDetailsMenuDeleteText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  officeDetailsCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  officeDetailsCloseText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  officeDetailsInfoBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  officeDetailsPersonnelWrap: {
    flex: 1,
    paddingRight: 8,
    gap: 6,
  },
  officeDetailsPersonnelTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  officeDetailsPersonnelList: {
    gap: 6,
  },
  officeDetailsPersonnelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  officeDetailsPersonnelAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeDetailsPersonnelAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  officeDetailsPersonnelAvatarText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
  },
  officeDetailsPersonnelName: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  officeDetailsPersonnelMoreText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  officeDetailsComplianceWrap: {
    width: 150,
    gap: 5,
  },
  officeDetailsComplianceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  officeDetailsComplianceLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  officeDetailsComplianceValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  officeDetailsComplianceTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  officeDetailsComplianceFill: {
    height: '100%',
    borderRadius: 999,
  },
  officeDetailsStatusPill: {
    alignSelf: 'flex-end',
  },
  officeDetailsToolsRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  officeDetailsToolsTitle: {
    color: '#334155',
    fontSize: 30,
    fontWeight: '800',
  },
  officeDetailsToolsRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  officeDetailsStatusWrap: {
    position: 'relative',
    zIndex: 90,
  },
  officeDetailsStatusBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  officeDetailsStatusBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  officeDetailsReadOnlyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  officeDetailsReadOnlyStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  officeDetailsReadOnlyStatusText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  officeDetailsStatusDropdown: {
    position: 'absolute',
    right: 0,
    top: 36,
    minWidth: 160,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    zIndex: 100000,
    elevation: 100000,
    paddingVertical: 4,
  },
  officeDetailsStatusItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  officeDetailsStatusItemActive: {
    backgroundColor: '#eff6ff',
  },
  officeDetailsStatusItemText: {
    color: '#334155',
    fontSize: 12,
  },
  officeDetailsStatusItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  officeDetailsSearchInput: {
    width: 180,
    height: 34,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 12,
  },
  officeDetailsBody: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  officeDetailsScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  officeDetailsEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  officeDetailsEmptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  officeAreaBlock: {
    gap: 8,
  },
  officeAreaHeader: {
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  officeAreaTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  officeAreaSub: {
    color: '#e0e7ff',
    fontSize: 12,
  },
  officeCriteriaGroupWrap: {
    gap: 8,
  },
  officeCriteriaCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  officeCriteriaHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  officeCriteriaTitle: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  officeCriteriaSub: {
    color: '#64748b',
    fontSize: 12,
  },
  officeRequirementRowAssigned: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
  },
  officeRequirementCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  officeRequirementActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#a5f3fc',
    backgroundColor: '#ecfeff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  officeRequirementActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06b6d4',
  },
  officeRequirementActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0e7490',
  },
  officeRequirementUploadCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'right',
  },
  officeRequirementTapHint: {
    color: '#0891b2',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  officeRequirementRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  officeRequirementStatusCol: {
    width: 130,
    gap: 2,
    paddingTop: 2,
  },
  officeRequirementStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  officeRequirementStatusBadgeGood: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  officeRequirementStatusBadgeWarn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  officeRequirementStatusBadgeBad: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  officeRequirementStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  officeRequirementStatusDotGood: {
    backgroundColor: '#0d9488',
  },
  officeRequirementStatusDotWarn: {
    backgroundColor: '#b45309',
  },
  officeRequirementStatusDotBad: {
    backgroundColor: '#e11d48',
  },
  officeRequirementStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  reqStatusOption: {
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  reqStatusOptionActive: {
    backgroundColor: '#eef2ff',
  },
  reqStatusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqStatusRadioOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqStatusRadioOuterComplied: {
    borderColor: '#0d9488',
  },
  reqStatusRadioOuterPartial: {
    borderColor: '#b45309',
  },
  reqStatusRadioOuterNot: {
    borderColor: '#e11d48',
  },
  reqStatusRadioInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reqStatusRadioInnerComplied: {
    backgroundColor: '#0d9488',
  },
  reqStatusRadioInnerPartial: {
    backgroundColor: '#b45309',
  },
  reqStatusRadioInnerNot: {
    backgroundColor: '#e11d48',
  },
  reqStatusOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reqStatusComplied: {
    color: '#0d9488',
  },
  reqStatusPartial: {
    color: '#b45309',
  },
  reqStatusNot: {
    color: '#e11d48',
  },
  officeRequirementStatusText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  officeRequirementCode: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '800',
  },
  officeRequirementDesc: {
    color: '#64748b',
    fontSize: 14,
  },
  officeRequirementUsersRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  officeRequirementUsersEmpty: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  officeReqUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  officeReqUserAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeReqUserAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  officeReqUserAvatarUploaded: {
    backgroundColor: '#ccfbf1',
    borderColor: '#0d9488',
  },
  officeReqUserAvatarPending: {
    backgroundColor: '#fee2e2',
    borderColor: '#e11d48',
  },
  officeReqUserAvatarText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
  },
  officeReqFileOpeningText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
  officeRequirementCommentPreview: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  officeRequirementCommentPreviewReadOnly: {
    backgroundColor: '#f1f5f9',
  },
  officeRequirementCommentPreviewText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  officeRequirementCommentPreviewTextReadOnly: {
    color: '#64748b',
  },
  officeRequirementCommentEditWrap: {
    marginTop: 8,
    gap: 8,
  },
  officeRequirementCommentInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
    color: '#0f172a',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  officeRequirementCommentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  officeRequirementCommentSaveBtn: {
    borderRadius: 7,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  officeRequirementCommentSaveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  officeRequirementCommentCancelBtn: {
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  officeRequirementCommentCancelText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  officeRequirementRightCol: {
    width: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  officeRequirementAssignBtn: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  officeRequirementAssignText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '700',
  },
  officeRequirementReadOnlyText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  officeDetailsFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
  },
  officeDetailsFooterCloseBtn: {
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  officeDetailsFooterCloseText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  assignModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 99999,
    elevation: 99999,
  },
  assignModalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 100000,
    elevation: 100000,
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#4f46e5',
  },
  assignModalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  assignModalSub: {
    marginTop: 2,
    color: '#e0e7ff',
    fontSize: 12,
  },
  assignModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignModalCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  assignTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  assignTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  assignTabBtnActive: {
    borderBottomColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  assignTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  assignTabTextActive: {
    color: '#4f46e5',
  },
  assignModalBody: {
    flex: 1,
    backgroundColor: '#fff',
  },
  assignSearchWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  assignSearchInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    paddingHorizontal: 10,
    color: '#0f172a',
    backgroundColor: '#fff',
    fontSize: 13,
  },
  assignSearchHint: {
    marginTop: 5,
    color: '#64748b',
    fontSize: 11,
  },
  assignUsersList: {
    flex: 1,
  },
  assignUsersListContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  assignUserRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  assignUserRowSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  assignUserRowDisabled: {
    opacity: 0.6,
  },
  assignUserCheck: {
    color: '#64748b',
    fontSize: 16,
  },
  assignUserCheckActive: {
    color: '#4f46e5',
  },
  assignUserAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  assignUserAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  assignUserAvatarText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  assignUserName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  assignUserEmail: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 11,
  },
  assignedUserRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  assignedUserRowUploaded: {
    borderColor: '#6ee7b7',
    backgroundColor: '#ecfdf5',
  },
  uploadToggleBtn: {
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  uploadToggleBtnActive: {
    backgroundColor: '#bbf7d0',
  },
  uploadToggleText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadToggleTextActive: {
    color: '#166534',
  },
  removeAssignBtn: {
    borderRadius: 7,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  removeAssignText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '700',
  },
  assignEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  assignEmptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  assignErrorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  assignFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  assignFooterText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  assignFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignCancelBtn: {
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  assignCancelText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  assignSaveBtn: {
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  assignSaveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 14,
    zIndex: 100000,
    elevation: 100000,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  modalSelectWrap: {
    position: 'relative',
    zIndex: 40,
  },
  modalSelectBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    backgroundColor: '#fff',
    minHeight: 42,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalSelectText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  modalSelectArrow: {
    color: '#64748b',
    fontSize: 12,
  },
  modalDropdownList: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    maxHeight: 220,
    zIndex: 100050,
    elevation: 100050,
  },
  modalDropdownListLarge: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    maxHeight: 250,
    overflow: 'hidden',
    zIndex: 100050,
    elevation: 100050,
  },
  modalDropdownScroll: {
    maxHeight: 250,
    flexGrow: 0,
  },
  modalDropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  modalDropdownItemText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
  modalDropdownItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  modalDropdownCheck: {
    width: 20,
    color: '#64748b',
    fontSize: 12,
  },
  modalDropdownCheckActive: {
    color: '#2563eb',
  },
  modalDropdownEmpty: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#94a3b8',
    fontSize: 12,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCancelBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headPickerCard: {
    width: '100%',
    maxWidth: 430,
    height: '70%',
    maxHeight: 560,
    minHeight: 320,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 100001,
    elevation: 100001,
  },
  headPickerHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#eef2ff',
  },
  headPickerTitle: {
    color: '#1e1b4b',
    fontSize: 16,
    fontWeight: '800',
  },
  headPickerSub: {
    marginTop: 2,
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
  },
  headPickerList: {
    flex: 1,
    minHeight: 140,
  },
  headPickerListContent: {
    padding: 10,
    gap: 8,
  },
  headPickerRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headPickerRowActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  headPickerCheck: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
  },
  headPickerCheckActive: {
    color: '#4f46e5',
  },
  headPickerName: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  headPickerNameActive: {
    color: '#312e81',
  },
  headPickerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  headPickerDoneBtn: {
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headPickerDoneText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headPickerEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  headPickerEmptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  sheetCard: {
    flex: 1,
    marginTop: 28,
    marginHorizontal: 8,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    zIndex: 100000,
    elevation: 100000,
  },
  sheetHeader: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#dcfce7',
    fontSize: 14,
    marginTop: 2,
  },
  sheetClose: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  sheetContent: {
    flex: 1,
    flexDirection: 'column',
  },
  sheetColumn: {
    flex: 1,
    padding: 10,
  },
  sheetColumnPreview: {
    flex: 1,
    padding: 10,
  },
  sheetSearchInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    height: 38,
    color: '#0f172a',
    fontSize: 12,
  },
  sheetSelectAllRow: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetSelectAllText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetSelectAllCount: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  sheetList: {
    flex: 1,
  },
  addReqAreaCard: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    overflow: 'hidden',
  },
  addReqAreaHeader: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addReqAreaTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  addReqAreaSub: {
    color: '#e0e7ff',
    fontSize: 14,
    marginTop: 1,
  },
  addReqAreaCount: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  addReqCriteriaWrap: {
    padding: 8,
    gap: 8,
  },
  addReqCriteriaCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  addReqCriteriaHeader: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addReqCriteriaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  addReqCriteriaSub: {
    color: '#e0e7ff',
    fontSize: 12,
  },
  addReqCriteriaCount: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  requirementRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 8,
  },
  requirementRowSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  requirementRowDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    opacity: 0.8,
  },
  requirementCheck: {
    color: '#334155',
    fontSize: 16,
    marginTop: 1,
  },
  requirementCheckDisabled: {
    color: '#16a34a',
  },
  requirementCode: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  requirementName: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  requirementDesc: {
    marginTop: 2,
    color: '#475569',
    fontSize: 14,
  },
  requirementAssignedBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  requirementAssignedBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  previewTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  previewSub: {
    marginTop: 2,
    marginBottom: 10,
    color: '#64748b',
    fontSize: 13,
  },
  previewRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 8,
    marginBottom: 8,
  },
  sheetPlaceholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  sheetPlaceholderIcon: {
    color: '#cbd5e1',
    fontSize: 34,
  },
  sheetPlaceholderText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetFooterCount: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  sheetFooterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sheetCancelBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  sheetCancelBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetAddBtn: {
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#16a34a',
  },
  sheetAddBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
