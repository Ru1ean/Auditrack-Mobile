import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import {
    areasAPI,
    criteriaAPI,
    eventsAPI,
    officesAPI,
    requirementsAPI,
    usersAPI,
} from '../../components/connect';

type EventFormState = {
  EventName: string;
  EventCode: string;
  Description: string;
  status: string;
};

const defaultForm: EventFormState = {
  EventName: '',
  EventCode: '',
  Description: '',
  status: 'active',
};

export default function StandardsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [menuEventId, setMenuEventId] = useState<number | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);

  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [formState, setFormState] = useState<EventFormState>(defaultForm);

  const [areas, setAreas] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [structureSearch, setStructureSearch] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());
  const [expandedCriteria, setExpandedCriteria] = useState<Set<number>>(new Set());
  const [expandedNoArea, setExpandedNoArea] = useState(true);
  const [structureActionMenuOpen, setStructureActionMenuOpen] = useState(false);
  const [manageStructureOpen, setManageStructureOpen] = useState(false);
  const [manageMainTab, setManageMainTab] = useState<'add' | 'assign'>('add');
  const [structureDeleteMode, setStructureDeleteMode] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<Set<number>>(new Set());
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<number>>(new Set());
  const [manageTab, setManageTab] = useState<'add-area' | 'add-criteria' | 'add-requirement'>('add-area');
  const [areaForm, setAreaForm] = useState({ AreaCode: '', AreaName: '', Description: '' });
  const [criteriaForm, setCriteriaForm] = useState({ AreaID: '', CriteriaCode: '', CriteriaName: '', Description: '' });
  const [requirementForm, setRequirementForm] = useState({
    AreaFilter: '',
    CriteriaID: '',
    ParentRequirementCode: '',
    RequirementCode: '',
    Description: '',
  });
  const [criteriaAreaDropdownOpen, setCriteriaAreaDropdownOpen] = useState(false);
  const [requirementAreaDropdownOpen, setRequirementAreaDropdownOpen] = useState(false);
  const [requirementCriteriaDropdownOpen, setRequirementCriteriaDropdownOpen] = useState(false);
  const [parentRequirementDropdownOpen, setParentRequirementDropdownOpen] = useState(false);
  const [parentRequirementOptions, setParentRequirementOptions] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [eventOffices, setEventOffices] = useState<any[]>([]);
  const [officeSearchTerm, setOfficeSearchTerm] = useState('');
  const [requirementAssignSearchTerm, setRequirementAssignSearchTerm] = useState('');
  const [selectedAssignOfficeIds, setSelectedAssignOfficeIds] = useState<Set<number>>(new Set());
  const [selectedAssignRequirementIds, setSelectedAssignRequirementIds] = useState<Set<number>>(new Set());
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(false);
  const [assigningRequirements, setAssigningRequirements] = useState(false);
  const [editStructureOpen, setEditStructureOpen] = useState(false);
  const [editStructureType, setEditStructureType] = useState<'area' | 'criteria' | 'requirement'>('area');
  const [editStructureTarget, setEditStructureTarget] = useState<any>(null);
  const [editStructureCode, setEditStructureCode] = useState('');
  const [editStructureName, setEditStructureName] = useState('');
  const [editStructureDescription, setEditStructureDescription] = useState('');
  const [savingStructureEdit, setSavingStructureEdit] = useState(false);

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

  useEffect(() => {
    loadInitialData();
  }, []);

  const isAdmin =
    currentUser?.RoleName?.toLowerCase() === 'admin' ||
    Number(currentUser?.RoleID || 0) === 1;

  const normalizeEvent = (event: any) => {
    const id = Number(event.EventID ?? event.id ?? 0);
    return {
      ...event,
      id,
      name: event.EventName || event.event_name || event.name || 'Untitled',
      code: event.EventCode || event.event_code || event.code || 'N/A',
      description: event.Description || event.description || '',
      status: String(event.status || event.Status || 'active').toLowerCase(),
    };
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [eventsRes, userRes] = await Promise.all([
        eventsAPI.getAllEvents(),
        usersAPI.getLoggedInUser().catch(() => null),
      ]);

      const eventsListRaw = Array.isArray(eventsRes) ? eventsRes : eventsRes?.data || [];
      setEvents(eventsListRaw.map(normalizeEvent));

      if (userRes) {
        setCurrentUser(userRes?.user || userRes);
      }
    } catch (err) {
      console.log('Standards load error:', err);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInitialData();
  };

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      if (statusFilter === 'active' && event.status !== 'active') return false;
      if (statusFilter === 'inactive' && event.status !== 'inactive') return false;
      if (!term) return true;

      return (
        String(event.name).toLowerCase().includes(term) ||
        String(event.code).toLowerCase().includes(term) ||
        String(event.description).toLowerCase().includes(term)
      );
    });
  }, [events, searchTerm, statusFilter]);

  const openStructureModal = async (event: any) => {
    if (!event?.id) return;
    setActiveEvent(event);
    setStructureModalOpen(true);
    setStructureSearch('');
    setStructureActionMenuOpen(false);
    setStructureDeleteMode(false);
    setSelectedAreaIds(new Set());
    setSelectedCriteriaIds(new Set());
    setSelectedRequirementIds(new Set());
    setExpandedAreas(new Set());
    setExpandedCriteria(new Set());
    setExpandedNoArea(true);
    await loadStructureData(event.id);
  };

  const loadStructureData = async (eventId: number) => {
    setLoadingStructure(true);
    try {
      // 1) Areas for event (fallback to all areas + filter by event)
      const areasRes = await areasAPI.getByEvent(String(eventId)).catch(() => ({ data: [] }));
      let areaList = extractList(areasRes, ['areas']);
      if (areaList.length === 0) {
        const allAreasRes = await areasAPI.getAll().catch(() => ({ data: [] }));
        const allAreas = extractList(allAreasRes, ['areas']);
        areaList = allAreas.filter((area: any) => {
          const linkedEventId = toId(
            area.EventID,
            area.event_id,
            area.EventChildID,
            area.event_child_id,
            area.ParentEventID,
            area.parent_event_id
          );
          return linkedEventId === eventId;
        });
      }

      // 2) Criteria for event (fallback to all criteria + filter by event)
      const criteriaByEventRes = await criteriaAPI.getByEvent(String(eventId)).catch(() => ({ data: [] }));
      let eventCriteria = extractList(criteriaByEventRes, ['criteria']);
      if (eventCriteria.length === 0) {
        const allCriteriaRes = await criteriaAPI.getAll().catch(() => ({ data: [] }));
        const allCriteria = extractList(allCriteriaRes, ['criteria']);
        eventCriteria = allCriteria.filter((criterion: any) => {
          const linkedEventId = toId(
            criterion.EventID,
            criterion.event_id,
            criterion.EventChildID,
            criterion.event_child_id,
            criterion.ParentEventID,
            criterion.parent_event_id
          );
          return linkedEventId === eventId;
        });
      }

      let uniqueCriteria = Array.from(
        new Map(eventCriteria.map((c: any) => [toId(c.CriteriaID, c.criteria_id, c.id), c])).values()
      );

      // 3) Requirements for event (fallback to all requirements + filter)
      const reqByEventRes = await requirementsAPI
        .getRequirementsByEvent(String(eventId))
        .catch(() => ({ data: [] }));
      let reqList = extractList(reqByEventRes, ['requirements']);

      if (reqList.length === 0) {
        const allRequirementsRes = await requirementsAPI
          .getAllRequirements()
          .catch(() => ({ data: [] }));
        const allRequirements = extractList(allRequirementsRes, ['requirements']);

        const criteriaIds = new Set(
          uniqueCriteria
            .map((criterion: any) => toId(criterion.CriteriaID, criterion.criteria_id, criterion.id))
            .filter(Boolean)
        );

        reqList = allRequirements.filter((req: any) => {
          const reqEventId = toId(req.EventID, req.event_id, req.EventChildID, req.event_child_id);
          const reqCriteriaId = toId(req.CriteriaID, req.criteria_id);
          return reqEventId === eventId || criteriaIds.has(reqCriteriaId);
        });
      }

      // If criteria endpoint is empty but requirements exist, build criteria from requirements.
      if (uniqueCriteria.length === 0 && reqList.length > 0) {
        const derivedPairs = reqList
          .map((req: any) => {
            const criteriaId = toId(req.CriteriaID, req.criteria_id);
            if (!criteriaId) return null;

            return [
              criteriaId,
              {
                CriteriaID: criteriaId,
                CriteriaCode: req.CriteriaCode || req.criteria_code || `C${criteriaId}`,
                CriteriaName:
                  req.CriteriaName ||
                  req.criteria_name ||
                  req.RequirementCode ||
                  req.requirement_code ||
                  `Criteria ${criteriaId}`,
                AreaID: req.AreaID ?? req.area_id ?? null,
                EventID: req.EventID ?? req.event_id ?? eventId,
              },
            ] as const;
          })
          .filter(Boolean) as Array<readonly [number, any]>;

        uniqueCriteria = Array.from(new Map<number, any>(derivedPairs).values());
      }

      // 4) If area endpoint still gave no data, infer areas from criteria so hierarchy remains visible.
      if (areaList.length === 0) {
        const inferredAreaMap = new Map<number, any>();
        uniqueCriteria.forEach((criterion: any) => {
          const areaId = toId(
            criterion.AreaID,
            criterion.area_id,
            criterion.AreaId,
            criterion.areaId
          );
          if (!areaId) return;
          if (!inferredAreaMap.has(areaId)) {
            inferredAreaMap.set(areaId, {
              AreaID: areaId,
              AreaName:
                criterion.AreaName ||
                criterion.area_name ||
                criterion.AreaCode ||
                criterion.area_code ||
                `Area ${areaId}`,
              inferred: true,
            });
          }
        });
        areaList = Array.from(inferredAreaMap.values());
      }

      const initialExpandedAreas = new Set<number>(
        areaList
          .map((area: any) => toId(area.AreaID, area.area_id, area.id, area.AreaId))
          .filter(Boolean)
      );
      const initialExpandedCriteria = new Set<number>(
        uniqueCriteria
          .map((criterion: any) =>
            toId(criterion.CriteriaID, criterion.criteria_id, criterion.id, criterion.CriteriaId)
          )
          .filter(Boolean)
      );

      setAreas(areaList);
      setCriteria(uniqueCriteria);
      setRequirements(reqList);
      setExpandedAreas(initialExpandedAreas);
      setExpandedCriteria(initialExpandedCriteria);
      setExpandedNoArea(true);
    } catch (err) {
      console.log('Structure load error:', err);
      setAreas([]);
      setCriteria([]);
      setRequirements([]);
    } finally {
      setLoadingStructure(false);
    }
  };

  const toggleSelectEvent = (eventId: number, selected?: boolean) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = selected ?? !next.has(eventId);
      if (shouldSelect) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  };

  const confirmDeleteSelected = () => {
    if (selectedEventIds.size === 0) {
      Alert.alert('No selection', 'Select at least one standard to delete.');
      return;
    }

    Alert.alert(
      'Delete standards',
      `Delete ${selectedEventIds.size} selected standard(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventsAPI.deleteEvents(Array.from(selectedEventIds).map(String));
              setDeleteMode(false);
              setSelectedEventIds(new Set());
              await loadInitialData();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message || 'Unable to delete standards.');
            }
          },
        },
      ]
    );
  };

  const deleteSingleEvent = (event: any) => {
    Alert.alert(
      'Delete standard',
      `Delete "${event.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventsAPI.deleteEvents([String(event.id)]);
              await loadInitialData();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message || 'Unable to delete event.');
            }
          },
        },
      ]
    );
  };

  const startAdd = () => {
    setFormState(defaultForm);
    setAddModalOpen(true);
  };

  const startEdit = (event: any) => {
    setActiveEvent(event);
    setFormState({
      EventName: event.name,
      EventCode: event.code,
      Description: event.description,
      status: event.status || 'active',
    });
    setEditModalOpen(true);
  };

  const startCopy = (event: any) => {
    setActiveEvent(event);
    setFormState({
      EventName: `${event.name} (Copy)`,
      EventCode: `${event.code}-COPY`,
      Description: event.description,
      status: event.status || 'active',
    });
    setCopyModalOpen(true);
  };

  const submitAdd = async () => {
    if (!formState.EventName.trim() || !formState.EventCode.trim()) {
      Alert.alert('Missing fields', 'Event name and event code are required.');
      return;
    }

    try {
      await eventsAPI.addEvent(formState);
      setAddModalOpen(false);
      await loadInitialData();
    } catch (err: any) {
      Alert.alert('Add failed', err?.message || 'Unable to add standard.');
    }
  };

  const submitEdit = async () => {
    if (!activeEvent?.id) return;

    try {
      await eventsAPI.updateEvent(String(activeEvent.id), formState);
      setEditModalOpen(false);
      await loadInitialData();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to update standard.');
    }
  };

  const submitCopy = async () => {
    if (!activeEvent?.id) return;

    try {
      await eventsAPI.copyEvent({
        sourceEventId: activeEvent.id,
        newEventName: formState.EventName,
        newEventCode: formState.EventCode,
        newDescription: formState.Description,
      });
      setCopyModalOpen(false);
      await loadInitialData();
    } catch (err: any) {
      Alert.alert('Copy failed', err?.message || 'Unable to copy standard.');
    }
  };

  const clearStructureSelections = () => {
    setSelectedAreaIds(new Set());
    setSelectedCriteriaIds(new Set());
    setSelectedRequirementIds(new Set());
  };

  const loadAssignmentData = async () => {
    if (!activeEvent?.id) return;

    setLoadingAssignmentData(true);
    try {
      const officesRes = await officesAPI.getAll().catch(() => ({ data: [] }));
      const allOffices = extractList(officesRes, ['offices']);

      const byEvent = allOffices.filter((office: any) => {
        const officeEventId = toId(
          office.event_id,
          office.EventID,
          office.eventId,
          office.EventChildID,
          office.event_child_id
        );
        return officeEventId === activeEvent.id;
      });

      setEventOffices(byEvent.length > 0 ? byEvent : allOffices);
      setSelectedAssignOfficeIds(new Set());
      setSelectedAssignRequirementIds(new Set());
      setOfficeSearchTerm('');
      setRequirementAssignSearchTerm('');
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Unable to load offices for assignment.');
    } finally {
      setLoadingAssignmentData(false);
    }
  };

  useEffect(() => {
    if (manageStructureOpen && manageMainTab === 'assign') {
      void Promise.resolve().then(() => {
        loadAssignmentData();
      });
    }
  }, [manageStructureOpen, manageMainTab, activeEvent?.id]);

  const toggleAssignOffice = (officeId: number, checked: boolean) => {
    setSelectedAssignOfficeIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(officeId);
      else next.delete(officeId);
      return next;
    });
  };

  const toggleAssignRequirement = (requirementId: number, checked: boolean) => {
    setSelectedAssignRequirementIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(requirementId);
      else next.delete(requirementId);
      return next;
    });
  };

  const toggleAssignRequirementBatch = (requirementIds: number[], checked: boolean) => {
    setSelectedAssignRequirementIds((prev) => {
      const next = new Set(prev);
      requirementIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleAssignSelected = async () => {
    if (selectedAssignOfficeIds.size === 0) {
      Alert.alert('No office selected', 'Select at least one office.');
      return;
    }
    if (selectedAssignRequirementIds.size === 0) {
      Alert.alert('No requirement selected', 'Select at least one requirement.');
      return;
    }

    setAssigningRequirements(true);
    try {
      const officeIds = Array.from(selectedAssignOfficeIds);
      const requirementIds = Array.from(selectedAssignRequirementIds);

      await Promise.all(
        officeIds.map((officeId) =>
          officesAPI.addOfficeRequirements(String(officeId), requirementIds)
        )
      );

      Alert.alert(
        'Success',
        `Assigned ${requirementIds.length} requirement(s) to ${officeIds.length} office(s).`
      );
      setSelectedAssignOfficeIds(new Set());
      setSelectedAssignRequirementIds(new Set());
    } catch (err: any) {
      Alert.alert('Assign failed', err?.message || 'Unable to assign selected requirements.');
    } finally {
      setAssigningRequirements(false);
    }
  };

  const handleAddAreaToStructure = async () => {
    if (!activeEvent?.id) return;
    if (!areaForm.AreaCode.trim() || !areaForm.AreaName.trim()) {
      Alert.alert('Missing fields', 'Area code and area name are required.');
      return;
    }

    try {
      await areasAPI.addArea({
        EventID: activeEvent.id,
        EventChildID: activeEvent.id,
        AreaCode: areaForm.AreaCode,
        AreaName: areaForm.AreaName,
        Description: areaForm.Description || null,
      });
      setAreaForm({ AreaCode: '', AreaName: '', Description: '' });
      await loadStructureData(activeEvent.id);
      Alert.alert('Success', 'Area added.');
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Unable to add area.');
    }
  };

  const handleAddCriteriaToStructure = async () => {
    if (!activeEvent?.id) return;
    if (!criteriaForm.CriteriaCode.trim() || !criteriaForm.CriteriaName.trim()) {
      Alert.alert('Missing fields', 'Criteria code and name are required.');
      return;
    }

    try {
      await criteriaAPI.addCriteria({
        EventID: activeEvent.id,
        AreaID: criteriaForm.AreaID ? Number(criteriaForm.AreaID) : null,
        CriteriaCode: criteriaForm.CriteriaCode,
        CriteriaName: criteriaForm.CriteriaName,
        Description: criteriaForm.Description || null,
        ParentCriteriaID: null,
      });
      setCriteriaForm({ AreaID: '', CriteriaCode: '', CriteriaName: '', Description: '' });
      setCriteriaAreaDropdownOpen(false);
      await loadStructureData(activeEvent.id);
      Alert.alert('Success', 'Criteria added.');
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Unable to add criteria.');
    }
  };

  const handleAddRequirementToStructure = async () => {
    if (!activeEvent?.id) return;
    if (!requirementForm.CriteriaID || !requirementForm.Description.trim()) {
      Alert.alert('Missing fields', 'Criteria and description are required.');
      return;
    }

    try {
      await requirementsAPI.addRequirement({
        RequirementCode: requirementForm.RequirementCode || null,
        Description: requirementForm.Description,
        CriteriaID: Number(requirementForm.CriteriaID),
        ParentRequirementCode: requirementForm.ParentRequirementCode || null,
      });
      setRequirementForm({
        AreaFilter: '',
        CriteriaID: '',
        ParentRequirementCode: '',
        RequirementCode: '',
        Description: '',
      });
      setParentRequirementOptions([]);
      setRequirementAreaDropdownOpen(false);
      setRequirementCriteriaDropdownOpen(false);
      setParentRequirementDropdownOpen(false);
      await loadStructureData(activeEvent.id);
      Alert.alert('Success', 'Requirement added.');
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Unable to add requirement.');
    }
  };

  const openStructureEdit = (type: 'area' | 'criteria' | 'requirement', item: any) => {
    setEditStructureType(type);
    setEditStructureTarget(item);

    if (type === 'area') {
      setEditStructureCode(item.AreaCode || item.area_code || '');
      setEditStructureName(item.AreaName || item.area_name || '');
      setEditStructureDescription(item.Description || item.description || '');
    } else if (type === 'criteria') {
      setEditStructureCode(item.CriteriaCode || item.criteria_code || '');
      setEditStructureName(item.CriteriaName || item.criteria_name || '');
      setEditStructureDescription(item.Description || item.description || '');
    } else {
      setEditStructureCode(item.RequirementCode || item.requirement_code || '');
      setEditStructureName('');
      setEditStructureDescription(
        item.Description || item.description || item.RequirementName || item.requirement_name || ''
      );
    }

    setEditStructureOpen(true);
  };

  const handleSaveStructureEdit = async () => {
    if (!activeEvent?.id || !editStructureTarget) return;

    try {
      setSavingStructureEdit(true);

      if (editStructureType === 'area') {
        const areaId = toId(
          editStructureTarget.AreaID,
          editStructureTarget.area_id,
          editStructureTarget.id,
          editStructureTarget.AreaId
        );
        if (!areaId) {
          Alert.alert('Missing area', 'Area ID is required for updating.');
          return;
        }
        if (!editStructureCode.trim() || !editStructureName.trim()) {
          Alert.alert('Missing fields', 'Area code and area name are required.');
          return;
        }

        await areasAPI.updateArea(String(areaId), {
          EventID: activeEvent.id,
          EventChildID: activeEvent.id,
          AreaCode: editStructureCode.trim(),
          AreaName: editStructureName.trim(),
          Description: editStructureDescription.trim() || null,
        });
      } else if (editStructureType === 'criteria') {
        const criteriaId = toId(
          editStructureTarget.CriteriaID,
          editStructureTarget.criteria_id,
          editStructureTarget.id,
          editStructureTarget.CriteriaId
        );
        if (!criteriaId) {
          Alert.alert('Missing criteria', 'Criteria ID is required for updating.');
          return;
        }
        if (!editStructureCode.trim() || !editStructureName.trim()) {
          Alert.alert('Missing fields', 'Criteria code and name are required.');
          return;
        }

        const targetAreaId = toId(
          editStructureTarget.AreaID,
          editStructureTarget.area_id,
          editStructureTarget.AreaId,
          editStructureTarget.areaId
        );

        await criteriaAPI.updateCriteria(String(criteriaId), {
          EventID: activeEvent.id,
          AreaID: targetAreaId || null,
          CriteriaCode: editStructureCode.trim(),
          CriteriaName: editStructureName.trim(),
          Description: editStructureDescription.trim() || null,
          ParentCriteriaID: editStructureTarget.ParentCriteriaID ?? null,
        });
      } else {
        const requirementId = toId(
          editStructureTarget.RequirementID,
          editStructureTarget.requirement_id,
          editStructureTarget.id
        );
        const criteriaId = toId(
          editStructureTarget.CriteriaID,
          editStructureTarget.criteria_id,
          editStructureTarget.CriteriaId,
          editStructureTarget.criteriaId
        );

        if (!requirementId || !criteriaId) {
          Alert.alert('Missing requirement', 'Requirement and criteria IDs are required for updating.');
          return;
        }
        if (!editStructureDescription.trim()) {
          Alert.alert('Missing fields', 'Requirement description is required.');
          return;
        }

        await requirementsAPI.updateRequirement(String(requirementId), {
          RequirementCode: editStructureCode.trim() || null,
          Description: editStructureDescription.trim(),
          CriteriaID: criteriaId,
          ParentRequirementCode: editStructureTarget.ParentRequirementCode || null,
        });
      }

      setEditStructureOpen(false);
      await loadStructureData(activeEvent.id);
      Alert.alert('Updated', 'Structure item updated successfully.');
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to update structure item.');
    } finally {
      setSavingStructureEdit(false);
    }
  };

  const handleDeleteStructureItems = async () => {
    if (!activeEvent?.id) return;

    const areaIds = Array.from(selectedAreaIds);
    const criteriaIds = Array.from(selectedCriteriaIds);
    const requirementIds = Array.from(selectedRequirementIds);

    // include descendants for selected areas/criteria
    const areaCriteriaIds = criteria
      .filter((item: any) => areaIds.includes(toId(item.AreaID, item.area_id, item.AreaId, item.areaId)))
      .map((item: any) => toId(item.CriteriaID, item.criteria_id, item.CriteriaId, item.criteriaId));

    const allCriteriaIds = [...new Set([...criteriaIds, ...areaCriteriaIds].filter(Boolean))];

    const criteriaRequirementIds = requirements
      .filter((item: any) => allCriteriaIds.includes(toId(item.CriteriaID, item.criteria_id)))
      .map((item: any) => toId(item.RequirementID, item.requirement_id, item.id));

    const allRequirementIds = [...new Set([...requirementIds, ...criteriaRequirementIds].filter(Boolean))];

    if (areaIds.length === 0 && allCriteriaIds.length === 0 && allRequirementIds.length === 0) {
      Alert.alert('No selection', 'Select at least one area, criteria, or requirement.');
      return;
    }

    Alert.alert('Delete Items', 'Delete selected structure items? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (allRequirementIds.length > 0) {
              await requirementsAPI.deleteRequirements(allRequirementIds.map(String));
            }
            if (allCriteriaIds.length > 0) {
              await criteriaAPI.deleteCriteria(allCriteriaIds.map(String));
            }
            if (areaIds.length > 0) {
              await areasAPI.deleteAreas(areaIds.map(String));
            }

            clearStructureSelections();
            setStructureDeleteMode(false);
            await loadStructureData(activeEvent.id);
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Unable to delete selected items.');
          }
        },
      },
    ]);
  };

  const requirementsByCriteria = useMemo(() => {
    return requirements.reduce((map: Record<number, any[]>, item: any) => {
      const criteriaId = toId(item.CriteriaID, item.criteria_id, item.CriteriaId, item.criteriaId);
      if (!map[criteriaId]) map[criteriaId] = [];
      map[criteriaId].push(item);
      return map;
    }, {} as Record<number, any[]>);
  }, [requirements]);

  const eventAreas = useMemo(() => {
    return areas
      .map((area: any) => {
        const id = toId(area.AreaID, area.area_id, area.id, area.AreaId);
        return {
          id,
          code: area.AreaCode || area.area_code || '',
          name: area.AreaName || area.area_name || `Area ${id}`,
        };
      })
      .filter((area: any) => area.id > 0);
  }, [areas]);

  const filteredCriteriaOptions = useMemo(() => {
    if (!requirementForm.AreaFilter) return [];
    const selectedAreaId = Number(requirementForm.AreaFilter);
    if (!Number.isFinite(selectedAreaId) || selectedAreaId <= 0) return [];

    return criteria
      .filter((criterion: any) => {
        const areaId = toId(criterion.AreaID, criterion.area_id, criterion.AreaId, criterion.areaId);
        return areaId === selectedAreaId;
      })
      .map((criterion: any) => {
        const criteriaId = toId(
          criterion.CriteriaID,
          criterion.criteria_id,
          criterion.id,
          criterion.CriteriaId
        );
        return {
          id: criteriaId,
          code: criterion.CriteriaCode || criterion.criteria_code || `C${criteriaId}`,
          name: criterion.CriteriaName || criterion.criteria_name || `Criteria ${criteriaId}`,
        };
      })
      .filter((item: any) => item.id > 0);
  }, [criteria, requirementForm.AreaFilter]);

  const buildNextRequirementCode = (criteriaIdValue: string, parentCode?: string) => {
    const criteriaId = Number(criteriaIdValue);
    if (!Number.isFinite(criteriaId) || criteriaId <= 0) return '';

    const selectedCriterion = criteria.find((criterion: any) => {
      const id = toId(criterion.CriteriaID, criterion.criteria_id, criterion.id, criterion.CriteriaId);
      return id === criteriaId;
    });

    const baseCode = String(
      parentCode || selectedCriterion?.CriteriaCode || selectedCriterion?.criteria_code || ''
    ).trim();
    if (!baseCode) return '';

    const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = requirementsByCriteria[criteriaId] || [];
    const nums = existing
      .map((req: any) => {
        const code = String(req.RequirementCode || req.requirement_code || '');
        const match = code.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
        return match ? Number(match[1]) : null;
      })
      .filter((num: number | null): num is number => num !== null);

    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${baseCode}.${next}`;
  };

  const onSelectCriteriaArea = (areaIdValue: string) => {
    setCriteriaForm((prev) => ({
      ...prev,
      AreaID: areaIdValue,
    }));
    setCriteriaAreaDropdownOpen(false);
  };

  const onSelectRequirementArea = (areaIdValue: string) => {
    setRequirementForm((prev) => ({
      ...prev,
      AreaFilter: areaIdValue,
      CriteriaID: '',
      ParentRequirementCode: '',
      RequirementCode: '',
    }));
    setParentRequirementOptions([]);
    setRequirementAreaDropdownOpen(false);
    setRequirementCriteriaDropdownOpen(false);
    setParentRequirementDropdownOpen(false);
  };

  const onSelectRequirementCriteria = async (criteriaIdValue: string) => {
    setRequirementCriteriaDropdownOpen(false);
    setParentRequirementDropdownOpen(false);

    if (!criteriaIdValue) {
      setRequirementForm((prev) => ({
        ...prev,
        CriteriaID: '',
        ParentRequirementCode: '',
        RequirementCode: '',
      }));
      setParentRequirementOptions([]);
      return;
    }

    setLoadingParents(true);
    try {
      const criteriaId = Number(criteriaIdValue);
      const options = requirementsByCriteria[criteriaId] || [];
      setParentRequirementOptions(options);
      setRequirementForm((prev) => ({
        ...prev,
        CriteriaID: criteriaIdValue,
        ParentRequirementCode: '',
        RequirementCode: buildNextRequirementCode(criteriaIdValue),
      }));
    } finally {
      setLoadingParents(false);
    }
  };

  const onSelectParentRequirement = (parentCode: string) => {
    setRequirementForm((prev) => ({
      ...prev,
      ParentRequirementCode: parentCode,
      RequirementCode: buildNextRequirementCode(prev.CriteriaID, parentCode || undefined),
    }));
    setParentRequirementDropdownOpen(false);
  };

  useEffect(() => {
    if (!manageStructureOpen || manageMainTab !== 'add') {
      void Promise.resolve().then(() => {
        setCriteriaAreaDropdownOpen(false);
        setRequirementAreaDropdownOpen(false);
        setRequirementCriteriaDropdownOpen(false);
        setParentRequirementDropdownOpen(false);
      });
    }
  }, [manageStructureOpen, manageMainTab, manageTab]);

  const areasWithContent = useMemo(() => {
    const term = structureSearch.trim().toLowerCase();
    const criteriaByArea = criteria.reduce((map: Record<number, any[]>, item: any) => {
      const areaId = toId(item.AreaID, item.area_id, item.AreaId, item.areaId);
      if (!map[areaId]) map[areaId] = [];
      map[areaId].push(item);
      return map;
    }, {});

    return areas
      .map((area) => {
        const areaId = toId(area.AreaID, area.area_id, area.id, area.AreaId);
        const allCriteria = criteriaByArea[areaId] || [];
        const visibleCriteria = allCriteria
          .map((criterion) => {
            const criterionId = toId(
              criterion.CriteriaID,
              criterion.criteria_id,
              criterion.id,
              criterion.CriteriaId
            );
            const allRequirements = requirementsByCriteria[criterionId] || [];
            const visibleRequirements = allRequirements.filter((req) => {
              if (!term) return true;
              return (
                String(req.RequirementCode || req.requirement_code || '').toLowerCase().includes(term) ||
                String(req.RequirementName || req.requirement_name || req.Description || '').toLowerCase().includes(term)
              );
            });

            const criterionMatches =
              !term ||
              String(criterion.CriteriaCode || criterion.criteria_code || '').toLowerCase().includes(term) ||
              String(criterion.CriteriaName || criterion.criteria_name || '').toLowerCase().includes(term);

            if (!criterionMatches && visibleRequirements.length === 0) return null;

            return {
              ...criterion,
              requirements: visibleRequirements,
            };
          })
          .filter(Boolean) as any[];

        const areaMatches =
          !term ||
          String(area.AreaCode || area.area_code || '').toLowerCase().includes(term) ||
          String(area.AreaName || area.area_name || '').toLowerCase().includes(term);

        if (!areaMatches && visibleCriteria.length === 0) return null;

        return {
          ...area,
          criteria: visibleCriteria,
        };
      })
      .filter(Boolean) as any[];
  }, [areas, criteria, requirementsByCriteria, structureSearch]);

  const noAreaCriteria = useMemo(() => {
    return criteria.filter((item: any) => {
      const areaIdRaw = item.AreaID ?? item.area_id;
      return (
        areaIdRaw === null ||
        areaIdRaw === undefined ||
        areaIdRaw === '' ||
        Number(areaIdRaw) === 0
      );
    });
  }, [criteria]);

  const visibleNoAreaCriteria = useMemo(() => {
    const term = structureSearch.trim().toLowerCase();
    return noAreaCriteria
      .map((criterion: any) => {
        const criterionId = toId(
          criterion.CriteriaID,
          criterion.criteria_id,
          criterion.id,
          criterion.CriteriaId
        );
        const allRequirements = requirementsByCriteria[criterionId] || [];
        const visibleRequirements = allRequirements.filter((req: any) => {
          if (!term) return true;
          return (
            String(req.RequirementCode || req.requirement_code || '').toLowerCase().includes(term) ||
            String(
              req.RequirementName || req.requirement_name || req.Description || req.description || ''
            )
              .toLowerCase()
              .includes(term)
          );
        });

        const criterionMatches =
          !term ||
          String(criterion.CriteriaCode || criterion.criteria_code || '').toLowerCase().includes(term) ||
          String(criterion.CriteriaName || criterion.criteria_name || '').toLowerCase().includes(term);

        if (!criterionMatches && visibleRequirements.length === 0) return null;

        return {
          ...criterion,
          requirements: visibleRequirements,
        };
      })
      .filter(Boolean) as any[];
  }, [noAreaCriteria, requirementsByCriteria, structureSearch]);

  const renderEventCard = ({ item }: { item: any }) => {
    const isChecked = selectedEventIds.has(item.id);

    return (
      <View style={styles.cardWrap}>
        <Pressable
          style={styles.eventCard}
          onPress={() => {
            if (deleteMode) {
              toggleSelectEvent(item.id);
            } else {
              openStructureModal(item);
            }
          }}
        >
          <View style={styles.cardBubble} />

          {deleteMode && (
            <TouchableOpacity
              style={[styles.checkbox, isChecked && styles.checkboxActive]}
              onPress={() => toggleSelectEvent(item.id)}
            >
              <Text style={styles.checkboxText}>{isChecked ? '✓' : ''}</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.cardHeaderRow, deleteMode && { marginLeft: 26 }]}> 
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>STANDARD EVENT</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
            </View>

            {isAdmin && !deleteMode && (
              <TouchableOpacity
                style={styles.dotButton}
                onPress={() => setMenuEventId((prev) => (prev === item.id ? null : item.id))}
              >
                <Text style={styles.dotText}>⋮</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.cardCodeWrap, deleteMode && { marginLeft: 26 }]}> 
            <Text style={styles.cardCode}>{item.code}</Text>
          </View>

          <View style={[styles.cardFooter, deleteMode && { marginLeft: 26 }]}> 
            <Text style={styles.cardFooterLeft}>Open structure</Text>
            <Text style={styles.cardFooterRight}>View</Text>
          </View>
        </Pressable>

        {menuEventId === item.id && (
          <View style={styles.optionsMenu}>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setMenuEventId(null);
                startEdit(item);
              }}
            >
              <Text style={styles.optionsText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setMenuEventId(null);
                startCopy(item);
              }}
            >
              <Text style={styles.optionsText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionsItem}
              onPress={() => {
                setMenuEventId(null);
                deleteSingleEvent(item);
              }}
            >
              <Text style={styles.optionsDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0ea5b7" />
        <Text style={styles.loadingText}>Loading standards...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEventCard}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.headerTopRow}>
              <View style={styles.titleGroup}>
                <Text style={styles.headerTitle}>Compliance Standards</Text>
                <Text style={styles.headerSubtitle}>
                  Manage event structures, criteria, and requirement flows.
                </Text>
              </View>

              {isAdmin && (
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={[styles.deleteBtn, deleteMode && styles.deleteBtnActive]}
                    onPress={() => {
                      if (deleteMode) {
                        setDeleteMode(false);
                        setSelectedEventIds(new Set());
                      } else {
                        setDeleteMode(true);
                        setSelectedEventIds(new Set());
                      }
                    }}
                  >
                    <Text style={styles.deleteBtnText}>{deleteMode ? 'Cancel' : 'Delete'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.addBtn} onPress={startAdd}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.controlsRow}>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search events, codes, or descriptions..."
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
              />

              <View style={styles.filterWrap}>
                <TouchableOpacity
                  style={[styles.filterBtn, statusFilter === 'active' && styles.filterBtnActive]}
                  onPress={() => setStatusFilter('active')}
                >
                  <Text
                    style={[styles.filterBtnText, statusFilter === 'active' && styles.filterBtnTextActive]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterBtn, statusFilter === 'inactive' && styles.filterBtnActive]}
                  onPress={() => setStatusFilter('inactive')}
                >
                  <Text
                    style={[
                      styles.filterBtnText,
                      statusFilter === 'inactive' && styles.filterBtnTextActive,
                    ]}
                  >
                    Inactive
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {isAdmin && deleteMode && (
              <View style={styles.bulkDeleteBar}>
                <Text style={styles.bulkDeleteText}>Selected: {selectedEventIds.size}</Text>
                <TouchableOpacity
                  style={[styles.bulkDeleteBtn, selectedEventIds.size === 0 && styles.bulkDeleteBtnDisabled]}
                  onPress={confirmDeleteSelected}
                  disabled={selectedEventIds.size === 0}
                >
                  <Text style={styles.bulkDeleteBtnText}>Delete Selected</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No standards found.</Text>
          </View>
        }
      />

      <EventFormModal
        visible={addModalOpen}
        title="Add Event"
        formState={formState}
        setFormState={setFormState}
        submitText="Add"
        onClose={() => setAddModalOpen(false)}
        onSubmit={submitAdd}
      />

      <EventFormModal
        visible={editModalOpen}
        title="Edit Event"
        formState={formState}
        setFormState={setFormState}
        submitText="Save"
        onClose={() => setEditModalOpen(false)}
        onSubmit={submitEdit}
      />

      <EventFormModal
        visible={copyModalOpen}
        title="Copy Event"
        formState={formState}
        setFormState={setFormState}
        submitText="Copy"
        onClose={() => setCopyModalOpen(false)}
        onSubmit={submitCopy}
      />

      <Modal visible={structureModalOpen} transparent animationType="fade" onRequestClose={() => setStructureModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.structureModalCard}>
            <View style={styles.structureHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.structureTitle}>{activeEvent?.name || 'Event Structure'}</Text>
                <Text style={styles.structureCode}>{activeEvent?.code || ''}</Text>
              </View>
              <View style={styles.structureHeaderActions}>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => setStructureActionMenuOpen((prev) => !prev)}
                    style={styles.structureDotsBtn}
                  >
                    <Text style={styles.structureDotsText}>⋮</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setStructureModalOpen(false)} style={styles.closeModalBtn}>
                  <Text style={styles.closeModalBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            </View>

            {isAdmin && structureActionMenuOpen && (
              <View style={styles.structureActionMenu}>
                <TouchableOpacity
                  style={styles.structureActionItem}
                  onPress={() => {
                    setStructureActionMenuOpen(false);
                    setManageStructureOpen(true);
                  }}
                >
                  <Text style={styles.structureActionItemText}>Manage Structure</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.structureActionItem}
                  onPress={() => {
                    setStructureActionMenuOpen(false);
                    setStructureDeleteMode(true);
                    clearStructureSelections();
                  }}
                >
                  <Text style={styles.structureActionDeleteText}>Delete Items</Text>
                </TouchableOpacity>
              </View>
            )}

            {isAdmin && structureDeleteMode && (
              <View style={styles.structureDeleteBar}>
                <Text style={styles.structureDeleteText}>
                  Delete mode: select items then delete.
                </Text>
                <View style={styles.structureDeleteActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setStructureDeleteMode(false);
                      clearStructureSelections();
                    }}
                    style={styles.structureDeleteCancelBtn}
                  >
                    <Text style={styles.structureDeleteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeleteStructureItems} style={styles.structureDeleteConfirmBtn}>
                    <Text style={styles.structureDeleteConfirmText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TextInput
              value={structureSearch}
              onChangeText={setStructureSearch}
              placeholder="Search area, criteria, requirement"
              placeholderTextColor="#94a3b8"
              style={styles.structureSearch}
            />

            {loadingStructure ? (
              <View style={styles.structureLoadingWrap}>
                <ActivityIndicator size="small" color="#0ea5b7" />
                <Text style={styles.loadingText}>Loading structure...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.structureScroll}
                contentContainerStyle={styles.structureScrollContent}
              >
                {areasWithContent.length === 0 && visibleNoAreaCriteria.length === 0 && (
                  <View style={styles.structureEmptyWrap}>
                    <Text style={styles.structureEmptyText}>
                      No areas, criteria, or requirements found for this event.
                    </Text>
                  </View>
                )}

                {areasWithContent.map((area) => {
                  const areaId = toId(area.AreaID, area.area_id, area.id, area.AreaId);
                  const areaExpanded = expandedAreas.has(areaId);

                  return (
                    <View key={String(areaId)} style={styles.structureAreaCard}>
                      <View style={styles.structureAreaHeader}>
                        <View style={styles.structureRowInline}>
                          {structureDeleteMode && (
                            <TouchableOpacity
                              style={[
                                styles.structureCheckbox,
                                selectedAreaIds.has(areaId) && styles.structureCheckboxActive,
                              ]}
                              onPress={() =>
                                setSelectedAreaIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(areaId)) next.delete(areaId);
                                  else next.add(areaId);
                                  return next;
                                })
                              }
                            >
                              <Text style={styles.structureCheckboxText}>
                                {selectedAreaIds.has(areaId) ? '✓' : ''}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.structureExpandTap}
                            onPress={() => {
                              setExpandedAreas((prev) => {
                                const next = new Set(prev);
                                if (next.has(areaId)) next.delete(areaId);
                                else next.add(areaId);
                                return next;
                              });
                            }}
                          >
                            <Text style={styles.structureAreaTitle}>
                              {areaExpanded ? '▼' : '▶'}{' '}
                              {(area.AreaCode || area.area_code)
                                ? `${area.AreaCode || area.area_code} - ${area.AreaName || area.area_name || 'Unnamed Area'}`
                                : area.AreaName || area.area_name || 'Unnamed Area'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {isAdmin && !structureDeleteMode && (
                          <TouchableOpacity
                            style={[styles.structureEditBtn, styles.structureEditBtnLight]}
                            onPress={() => openStructureEdit('area', area)}
                          >
                            <Text style={[styles.structureEditIcon, styles.structureEditIconLight]}>✎</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {areaExpanded &&
                        area.criteria.map((criterion: any) => {
                          const criteriaId = toId(
                            criterion.CriteriaID,
                            criterion.criteria_id,
                            criterion.id,
                            criterion.CriteriaId
                          );
                          const criteriaExpanded = expandedCriteria.has(criteriaId);

                          return (
                            <View key={String(criteriaId)} style={styles.criteriaWrap}>
                              <View style={styles.criteriaHeader}>
                                <View style={styles.structureRowInline}>
                                  {structureDeleteMode && (
                                    <TouchableOpacity
                                      style={[
                                        styles.structureCheckbox,
                                        selectedCriteriaIds.has(criteriaId) && styles.structureCheckboxActive,
                                      ]}
                                      onPress={() =>
                                        setSelectedCriteriaIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(criteriaId)) next.delete(criteriaId);
                                          else next.add(criteriaId);
                                          return next;
                                        })
                                      }
                                    >
                                      <Text style={styles.structureCheckboxText}>
                                        {selectedCriteriaIds.has(criteriaId) ? '✓' : ''}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                  <TouchableOpacity
                                    style={styles.structureExpandTap}
                                    onPress={() => {
                                      setExpandedCriteria((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(criteriaId)) next.delete(criteriaId);
                                        else next.add(criteriaId);
                                        return next;
                                      });
                                    }}
                                  >
                                    <Text style={styles.criteriaTitle}>
                                      {criteriaExpanded ? '▼' : '▶'}{' '}
                                      {(criterion.CriteriaCode || criterion.criteria_code)
                                        ? `${criterion.CriteriaCode || criterion.criteria_code} - ${criterion.CriteriaName || criterion.criteria_name || 'Unnamed Criteria'}`
                                        : criterion.CriteriaName || criterion.criteria_name || 'Unnamed Criteria'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                                {isAdmin && !structureDeleteMode && (
                                  <TouchableOpacity
                                    style={[styles.structureEditBtn, styles.structureEditBtnLight]}
                                    onPress={() => openStructureEdit('criteria', criterion)}
                                  >
                                    <Text style={[styles.structureEditIcon, styles.structureEditIconLight]}>✎</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {criteriaExpanded && (
                                <View style={styles.requirementsWrap}>
                                  {criterion.requirements.length === 0 ? (
                                    <Text style={styles.noItemsText}>No requirements</Text>
                                  ) : (
                                    criterion.requirements.map((req: any) => (
                                      (() => {
                                        const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                        return (
                                      <View
                                        key={String(req.RequirementID || req.requirement_id || req.id || Math.random())}
                                        style={styles.requirementItem}
                                      >
                                        <View style={styles.structureRowInline}>
                                          {structureDeleteMode && (
                                            <TouchableOpacity
                                              style={[
                                                styles.structureCheckbox,
                                                selectedRequirementIds.has(reqId) && styles.structureCheckboxActive,
                                              ]}
                                              onPress={() =>
                                                setSelectedRequirementIds((prev) => {
                                                  const next = new Set(prev);
                                                  if (next.has(reqId)) next.delete(reqId);
                                                  else next.add(reqId);
                                                  return next;
                                                })
                                              }
                                            >
                                              <Text style={styles.structureCheckboxText}>
                                                {selectedRequirementIds.has(reqId) ? '✓' : ''}
                                              </Text>
                                            </TouchableOpacity>
                                          )}
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.requirementCode}>
                                              {req.RequirementCode || req.requirement_code || 'REQ'}
                                            </Text>
                                            <Text style={styles.requirementText}>
                                              {req.RequirementName ||
                                                req.requirement_name ||
                                                req.Description ||
                                                req.description ||
                                                'Untitled requirement'}
                                            </Text>
                                          </View>
                                          {isAdmin && !structureDeleteMode && (
                                            <TouchableOpacity
                                              style={[styles.structureEditBtn, styles.structureEditBtnSoft]}
                                              onPress={() => openStructureEdit('requirement', req)}
                                            >
                                              <Text style={styles.structureEditIcon}>✎</Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                      </View>
                                        );
                                      })()
                                    ))
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                    </View>
                  );
                })}

                <View style={styles.structureAreaCard}>
                  <TouchableOpacity
                    style={styles.noAreaTitle}
                    onPress={() => setExpandedNoArea((prev) => !prev)}
                  >
                    <Text style={styles.noAreaTitleText}>
                      {expandedNoArea ? '▼' : '▶'} No Area Assigned ({visibleNoAreaCriteria.length})
                    </Text>
                  </TouchableOpacity>

                  {expandedNoArea && visibleNoAreaCriteria.length === 0 ? (
                    <Text style={styles.noItemsText}>No criteria without area</Text>
                  ) : (
                    expandedNoArea &&
                    visibleNoAreaCriteria.map((item: any) => {
                      const criteriaId = toId(
                        item.CriteriaID,
                        item.criteria_id,
                        item.id,
                        item.CriteriaId
                      );
                      const criteriaExpanded = expandedCriteria.has(criteriaId);

                      return (
                        <View
                          key={String(item.CriteriaID || item.criteria_id || item.id || Math.random())}
                          style={styles.noAreaCriteriaItem}
                        >
                          <View style={styles.criteriaHeader}>
                            <View style={styles.structureRowInline}>
                              {structureDeleteMode && (
                                <TouchableOpacity
                                  style={[
                                    styles.structureCheckbox,
                                    selectedCriteriaIds.has(criteriaId) && styles.structureCheckboxActive,
                                  ]}
                                  onPress={() =>
                                    setSelectedCriteriaIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(criteriaId)) next.delete(criteriaId);
                                      else next.add(criteriaId);
                                      return next;
                                    })
                                  }
                                >
                                  <Text style={styles.structureCheckboxText}>
                                    {selectedCriteriaIds.has(criteriaId) ? '✓' : ''}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={styles.structureExpandTap}
                                onPress={() => {
                                  setExpandedCriteria((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(criteriaId)) next.delete(criteriaId);
                                    else next.add(criteriaId);
                                    return next;
                                  });
                                }}
                              >
                                <Text style={styles.noAreaCriteriaText}>
                                  {criteriaExpanded ? '▼' : '▶'} {item.CriteriaCode || item.criteria_code || 'CR'} -{' '}
                                  {item.CriteriaName || item.criteria_name || 'Unnamed Criteria'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            {isAdmin && !structureDeleteMode && (
                              <TouchableOpacity
                                style={[styles.structureEditBtn, styles.structureEditBtnLight]}
                                onPress={() => openStructureEdit('criteria', item)}
                              >
                                <Text style={[styles.structureEditIcon, styles.structureEditIconLight]}>✎</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {criteriaExpanded && (
                            <View style={styles.requirementsWrap}>
                              {item.requirements.length === 0 ? (
                                <Text style={styles.noItemsText}>No requirements</Text>
                              ) : (
                                item.requirements.map((req: any) => (
                                  (() => {
                                    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                    return (
                                  <View
                                    key={String(req.RequirementID || req.requirement_id || req.id || Math.random())}
                                    style={styles.requirementItem}
                                  >
                                    <View style={styles.structureRowInline}>
                                      {structureDeleteMode && (
                                        <TouchableOpacity
                                          style={[
                                            styles.structureCheckbox,
                                            selectedRequirementIds.has(reqId) && styles.structureCheckboxActive,
                                          ]}
                                          onPress={() =>
                                            setSelectedRequirementIds((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(reqId)) next.delete(reqId);
                                              else next.add(reqId);
                                              return next;
                                            })
                                          }
                                        >
                                          <Text style={styles.structureCheckboxText}>
                                            {selectedRequirementIds.has(reqId) ? '✓' : ''}
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.requirementCode}>
                                          {req.RequirementCode || req.requirement_code || 'REQ'}
                                        </Text>
                                        <Text style={styles.requirementText}>
                                          {req.RequirementName ||
                                            req.requirement_name ||
                                            req.Description ||
                                            req.description ||
                                            'Untitled requirement'}
                                        </Text>
                                      </View>
                                      {isAdmin && !structureDeleteMode && (
                                        <TouchableOpacity
                                          style={[styles.structureEditBtn, styles.structureEditBtnSoft]}
                                          onPress={() => openStructureEdit('requirement', req)}
                                        >
                                          <Text style={styles.structureEditIcon}>✎</Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                    );
                                  })()
                                ))
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={manageStructureOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManageStructureOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setManageStructureOpen(false)}>
          <Pressable style={styles.manageModalCard}>
            <View style={styles.manageHeaderRow}>
              <Text style={styles.manageTitle}>Manage Structure</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setManageStructureOpen(false)}>
                <Text style={styles.closeModalBtnText}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.manageMainTabs}>
              <TouchableOpacity
                style={[styles.manageMainTabBtn, manageMainTab === 'add' && styles.manageMainTabBtnActive]}
                onPress={() => setManageMainTab('add')}
              >
                <Text
                  style={[
                    styles.manageMainTabText,
                    manageMainTab === 'add' && styles.manageMainTabTextActive,
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manageMainTabBtn,
                  manageMainTab === 'assign' && styles.manageMainTabBtnActive,
                ]}
                onPress={() => setManageMainTab('assign')}
              >
                <Text
                  style={[
                    styles.manageMainTabText,
                    manageMainTab === 'assign' && styles.manageMainTabTextActive,
                  ]}
                >
                  Assign To Offices
                </Text>
              </TouchableOpacity>
            </View>

            {manageMainTab === 'add' && (
              <View style={styles.manageTabs}>
                <TouchableOpacity
                  style={[styles.manageTabBtn, manageTab === 'add-area' && styles.manageTabBtnActive]}
                  onPress={() => setManageTab('add-area')}
                >
                  <Text style={[styles.manageTabText, manageTab === 'add-area' && styles.manageTabTextActive]}>
                    Add Area
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.manageTabBtn, manageTab === 'add-criteria' && styles.manageTabBtnActive]}
                  onPress={() => setManageTab('add-criteria')}
                >
                  <Text style={[styles.manageTabText, manageTab === 'add-criteria' && styles.manageTabTextActive]}>
                    Add Criteria
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.manageTabBtn, manageTab === 'add-requirement' && styles.manageTabBtnActive]}
                  onPress={() => setManageTab('add-requirement')}
                >
                  <Text
                    style={[
                      styles.manageTabText,
                      manageTab === 'add-requirement' && styles.manageTabTextActive,
                    ]}
                  >
                    Add Requirement
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {manageMainTab === 'add' && manageTab === 'add-area' && (
              <View style={styles.manageFormWrap}>
                <TextInput
                  style={styles.formInput}
                  placeholder="Area Code"
                  placeholderTextColor="#94a3b8"
                  value={areaForm.AreaCode}
                  onChangeText={(text) => setAreaForm((prev) => ({ ...prev, AreaCode: text }))}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Area Name"
                  placeholderTextColor="#94a3b8"
                  value={areaForm.AreaName}
                  onChangeText={(text) => setAreaForm((prev) => ({ ...prev, AreaName: text }))}
                />
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Description"
                  placeholderTextColor="#94a3b8"
                  value={areaForm.Description}
                  onChangeText={(text) => setAreaForm((prev) => ({ ...prev, Description: text }))}
                  multiline
                />
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddAreaToStructure}>
                  <Text style={styles.submitBtnText}>Save Area</Text>
                </TouchableOpacity>
              </View>
            )}

            {manageMainTab === 'add' && manageTab === 'add-criteria' && (
              <View style={styles.manageFormWrap}>
                <Text style={styles.formLabel}>Area (optional)</Text>
                <View style={[styles.dropdownWrap, criteriaAreaDropdownOpen && styles.dropdownWrapOpen]}>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setCriteriaAreaDropdownOpen((prev) => !prev)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {criteriaForm.AreaID
                        ? (() => {
                            const selected = eventAreas.find((item: any) => String(item.id) === criteriaForm.AreaID);
                            if (!selected) return 'No Area (optional)';
                            return selected.code
                              ? `${selected.code} - ${selected.name}`
                              : selected.name;
                          })()
                        : 'No Area (optional)'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{criteriaAreaDropdownOpen ? '▴' : '▾'}</Text>
                  </TouchableOpacity>

                  {criteriaAreaDropdownOpen && (
                    <ScrollView style={styles.dropdownMenuList}>
                      <TouchableOpacity
                        style={styles.dropdownMenuItem}
                        onPress={() => onSelectCriteriaArea('')}
                      >
                        <Text style={styles.dropdownMenuItemText}>No Area (optional)</Text>
                      </TouchableOpacity>

                      {eventAreas.map((area: any) => (
                        <TouchableOpacity
                          key={`criteria-area-${area.id}`}
                          style={styles.dropdownMenuItem}
                          onPress={() => onSelectCriteriaArea(String(area.id))}
                        >
                          <Text style={styles.dropdownMenuItemText}>
                            {area.code ? `${area.code} - ${area.name}` : area.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <Text style={styles.formLabel}>Criteria Code (editable)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Criteria Code"
                  placeholderTextColor="#94a3b8"
                  value={criteriaForm.CriteriaCode}
                  onChangeText={(text) => setCriteriaForm((prev) => ({ ...prev, CriteriaCode: text }))}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="Criteria Name"
                  placeholderTextColor="#94a3b8"
                  value={criteriaForm.CriteriaName}
                  onChangeText={(text) => setCriteriaForm((prev) => ({ ...prev, CriteriaName: text }))}
                />
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Description"
                  placeholderTextColor="#94a3b8"
                  value={criteriaForm.Description}
                  onChangeText={(text) => setCriteriaForm((prev) => ({ ...prev, Description: text }))}
                  multiline
                />
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddCriteriaToStructure}>
                  <Text style={styles.submitBtnText}>Save Criteria</Text>
                </TouchableOpacity>
              </View>
            )}

            {manageMainTab === 'add' && manageTab === 'add-requirement' && (
              <View style={styles.manageFormWrap}>
                <Text style={styles.formLabel}>Area</Text>
                <View style={[styles.dropdownWrap, requirementAreaDropdownOpen && styles.dropdownWrapOpen]}>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setRequirementAreaDropdownOpen((prev) => !prev)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {requirementForm.AreaFilter
                        ? (() => {
                            const selected = eventAreas.find((item: any) => String(item.id) === requirementForm.AreaFilter);
                            return selected
                              ? selected.code
                                ? `${selected.code} - ${selected.name}`
                                : selected.name
                              : 'Select area';
                          })()
                        : 'Select area'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{requirementAreaDropdownOpen ? '▴' : '▾'}</Text>
                  </TouchableOpacity>

                  {requirementAreaDropdownOpen && (
                    <ScrollView style={styles.dropdownMenuList}>
                      {eventAreas.map((area: any) => (
                        <TouchableOpacity
                          key={`requirement-area-${area.id}`}
                          style={styles.dropdownMenuItem}
                          onPress={() => onSelectRequirementArea(String(area.id))}
                        >
                          <Text style={styles.dropdownMenuItemText}>
                            {area.code ? `${area.code} - ${area.name}` : area.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <Text style={styles.formLabel}>Criteria</Text>
                <View style={[styles.dropdownWrap, requirementCriteriaDropdownOpen && styles.dropdownWrapOpen]}>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => {
                      if (!requirementForm.AreaFilter) return;
                      setRequirementCriteriaDropdownOpen((prev) => !prev);
                    }}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {requirementForm.CriteriaID
                        ? (() => {
                            const selected = filteredCriteriaOptions.find(
                              (item: any) => String(item.id) === requirementForm.CriteriaID
                            );
                            return selected
                              ? selected.code
                                ? `${selected.code} - ${selected.name}`
                                : selected.name
                              : 'Select criteria';
                          })()
                        : requirementForm.AreaFilter
                          ? 'Select criteria'
                          : 'Select area first'}
                    </Text>
                    <Text style={styles.dropdownArrow}>{requirementCriteriaDropdownOpen ? '▴' : '▾'}</Text>
                  </TouchableOpacity>

                  {requirementCriteriaDropdownOpen && (
                    <ScrollView style={styles.dropdownMenuList}>
                      {filteredCriteriaOptions.length === 0 ? (
                        <View style={styles.dropdownMenuItem}>
                          <Text style={styles.dropdownMenuEmptyText}>No criteria found under this area.</Text>
                        </View>
                      ) : (
                        filteredCriteriaOptions.map((criterion: any) => (
                          <TouchableOpacity
                            key={`requirement-criteria-${criterion.id}`}
                            style={styles.dropdownMenuItem}
                            onPress={() => onSelectRequirementCriteria(String(criterion.id))}
                          >
                            <Text style={styles.dropdownMenuItemText}>
                              {criterion.code ? `${criterion.code} - ${criterion.name}` : criterion.name}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  )}
                </View>

                <Text style={styles.formLabel}>Parent Requirement (optional)</Text>
                <View style={[styles.dropdownWrap, parentRequirementDropdownOpen && styles.dropdownWrapOpen]}>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => {
                      if (!requirementForm.CriteriaID) return;
                      setParentRequirementDropdownOpen((prev) => !prev);
                    }}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {requirementForm.ParentRequirementCode ||
                        (requirementForm.CriteriaID
                          ? loadingParents
                            ? 'Loading parent requirements...'
                            : 'No parent requirement (optional)'
                          : 'Select criteria first')}
                    </Text>
                    <Text style={styles.dropdownArrow}>{parentRequirementDropdownOpen ? '▴' : '▾'}</Text>
                  </TouchableOpacity>

                  {parentRequirementDropdownOpen && (
                    <ScrollView style={styles.dropdownMenuList}>
                      <TouchableOpacity
                        style={styles.dropdownMenuItem}
                        onPress={() => onSelectParentRequirement('')}
                      >
                        <Text style={styles.dropdownMenuItemText}>No parent requirement (optional)</Text>
                      </TouchableOpacity>

                      {parentRequirementOptions.map((req: any) => {
                        const reqCode = req.RequirementCode || req.requirement_code || '';
                        const reqDesc = req.Description || req.RequirementName || req.requirement_name || '';
                        return (
                          <TouchableOpacity
                            key={`parent-req-${toId(req.RequirementID, req.requirement_id, req.id)}`}
                            style={styles.dropdownMenuItem}
                            onPress={() => onSelectParentRequirement(String(reqCode))}
                          >
                            <Text style={styles.dropdownMenuItemText}>
                              {reqCode ? `${reqCode} - ${reqDesc}` : reqDesc || 'Requirement'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                <Text style={styles.formLabel}>Requirement Code (editable)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Requirement Code (optional)"
                  placeholderTextColor="#94a3b8"
                  value={requirementForm.RequirementCode}
                  onChangeText={(text) =>
                    setRequirementForm((prev) => ({ ...prev, RequirementCode: text }))
                  }
                />
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Description"
                  placeholderTextColor="#94a3b8"
                  value={requirementForm.Description}
                  onChangeText={(text) =>
                    setRequirementForm((prev) => ({ ...prev, Description: text }))
                  }
                  multiline
                />
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddRequirementToStructure}>
                  <Text style={styles.submitBtnText}>Save Requirement</Text>
                </TouchableOpacity>
              </View>
            )}

            {manageMainTab === 'assign' && (
              <View style={styles.assignWrap}>
                <View style={styles.assignHeaderRow}>
                  <Text style={styles.assignTitle}>Bulk Assign Requirements To Offices</Text>
                  <Text style={styles.assignHint}>Select offices and requirements, then assign in one action.</Text>
                </View>

                {loadingAssignmentData ? (
                  <View style={styles.structureLoadingWrap}>
                    <ActivityIndicator size="small" color="#0ea5b7" />
                    <Text style={styles.loadingText}>Loading offices and requirements...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.assignColumns}>
                      <View style={styles.assignPanel}>
                        <View style={styles.assignPanelHeader}>
                          <Text style={styles.assignPanelTitle}>Offices</Text>
                          <TouchableOpacity
                            onPress={() => {
                              const filteredOfficeIds = eventOffices
                                .filter((office: any) => {
                                  const label = String(
                                    office.office_name || office.OfficeName || ''
                                  ).toLowerCase();
                                  const query = officeSearchTerm.trim().toLowerCase();
                                  return !query || label.includes(query);
                                })
                                .map((office: any) => toId(office.id, office.OfficeID));

                              const allSelected =
                                filteredOfficeIds.length > 0 &&
                                filteredOfficeIds.every((id: number) => selectedAssignOfficeIds.has(id));

                              setSelectedAssignOfficeIds((prev) => {
                                const next = new Set(prev);
                                filteredOfficeIds.forEach((id: number) => {
                                  if (allSelected) next.delete(id);
                                  else next.add(id);
                                });
                                return next;
                              });
                            }}
                          >
                            <Text style={styles.assignSelectAllText}>Select all</Text>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.assignSearchInput}
                          placeholder="Search offices..."
                          placeholderTextColor="#94a3b8"
                          value={officeSearchTerm}
                          onChangeText={setOfficeSearchTerm}
                        />

                        <ScrollView style={styles.assignList}>
                          {eventOffices
                            .filter((office: any) => {
                              const label = String(
                                office.office_name || office.OfficeName || ''
                              ).toLowerCase();
                              const query = officeSearchTerm.trim().toLowerCase();
                              return !query || label.includes(query);
                            })
                            .map((office: any) => {
                              const officeId = toId(office.id, office.OfficeID);
                              const checked = selectedAssignOfficeIds.has(officeId);
                              const label = office.office_name || office.OfficeName || `Office ${officeId}`;

                              return (
                                <TouchableOpacity
                                  key={String(officeId)}
                                  style={[styles.assignItemRow, checked && styles.assignItemRowActive]}
                                  onPress={() => toggleAssignOffice(officeId, !checked)}
                                >
                                  <View
                                    style={[
                                      styles.assignCheckbox,
                                      checked && styles.assignCheckboxActive,
                                    ]}
                                  >
                                    <Text style={styles.assignCheckboxText}>{checked ? '✓' : ''}</Text>
                                  </View>
                                  <Text style={styles.assignItemText}>{label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                        </ScrollView>
                      </View>

                      <View style={styles.assignPanelLarge}>
                        <View style={styles.assignPanelHeader}>
                          <Text style={styles.assignPanelTitle}>Requirements by Area and Criteria</Text>
                          <TouchableOpacity
                            onPress={() => {
                              const ids: number[] = [];
                              areasWithContent.forEach((area) => {
                                area.criteria.forEach((criterion: any) => {
                                  const criteriaId = toId(
                                    criterion.CriteriaID,
                                    criterion.criteria_id,
                                    criterion.id
                                  );
                                  (requirementsByCriteria[criteriaId] || []).forEach((req: any) => {
                                    const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                    if (reqId) ids.push(reqId);
                                  });
                                });
                              });
                              visibleNoAreaCriteria.forEach((criterion: any) => {
                                (criterion.requirements || []).forEach((req: any) => {
                                  const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                  if (reqId) ids.push(reqId);
                                });
                              });
                              const uniqueIds = [...new Set(ids)];
                              const allSelected =
                                uniqueIds.length > 0 &&
                                uniqueIds.every((id) => selectedAssignRequirementIds.has(id));
                              toggleAssignRequirementBatch(uniqueIds, !allSelected);
                            }}
                          >
                            <Text style={styles.assignSelectAllText}>Select all</Text>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.assignSearchInput}
                          placeholder="Search areas, criteria, or requirements..."
                          placeholderTextColor="#94a3b8"
                          value={requirementAssignSearchTerm}
                          onChangeText={setRequirementAssignSearchTerm}
                        />

                        <ScrollView style={styles.assignList}>
                          {areasWithContent.map((area) => {
                            const areaRequirementIds: number[] = area.criteria.flatMap((criterion: any) => {
                              const criteriaId = toId(
                                criterion.CriteriaID,
                                criterion.criteria_id,
                                criterion.id
                              );
                              return (requirementsByCriteria[criteriaId] || [])
                                .map((req: any) => toId(req.RequirementID, req.requirement_id, req.id))
                                .filter(Boolean);
                            });

                            const areaChecked =
                              areaRequirementIds.length > 0 &&
                              areaRequirementIds.every((id) => selectedAssignRequirementIds.has(id));

                            return (
                              <View key={String(toId(area.AreaID, area.area_id, area.id))} style={styles.assignAreaBlock}>
                                <TouchableOpacity
                                  style={styles.assignAreaHeader}
                                  onPress={() =>
                                    toggleAssignRequirementBatch(areaRequirementIds, !areaChecked)
                                  }
                                >
                                  <View style={[styles.assignCheckbox, areaChecked && styles.assignCheckboxActive]}>
                                    <Text style={styles.assignCheckboxText}>{areaChecked ? '✓' : ''}</Text>
                                  </View>
                                  <Text style={styles.assignAreaHeaderText}>
                                    {area.AreaName || area.area_name || 'Area'}
                                  </Text>
                                </TouchableOpacity>

                                {area.criteria.map((criterion: any) => {
                                  const criteriaId = toId(
                                    criterion.CriteriaID,
                                    criterion.criteria_id,
                                    criterion.id
                                  );
                                  const reqs = (criterion.requirements || []).filter((req: any) => {
                                    const q = requirementAssignSearchTerm.trim().toLowerCase();
                                    if (!q) return true;
                                    return (
                                      String(req.RequirementCode || '').toLowerCase().includes(q) ||
                                      String(req.Description || req.RequirementName || '').toLowerCase().includes(q)
                                    );
                                  });
                                  const criterionReqIds = reqs
                                    .map((req: any) => toId(req.RequirementID, req.requirement_id, req.id))
                                    .filter(Boolean);

                                  if (reqs.length === 0 && requirementAssignSearchTerm.trim()) return null;

                                  const criterionChecked =
                                    criterionReqIds.length > 0 &&
                                    criterionReqIds.every((id: number) => selectedAssignRequirementIds.has(id));

                                  return (
                                    <View key={String(criteriaId)} style={styles.assignCriteriaBlock}>
                                      <TouchableOpacity
                                        style={styles.assignCriteriaHeader}
                                        onPress={() =>
                                          toggleAssignRequirementBatch(criterionReqIds, !criterionChecked)
                                        }
                                      >
                                        <View
                                          style={[
                                            styles.assignCheckbox,
                                            criterionChecked && styles.assignCheckboxActive,
                                          ]}
                                        >
                                          <Text style={styles.assignCheckboxText}>{criterionChecked ? '✓' : ''}</Text>
                                        </View>
                                        <Text style={styles.assignCriteriaHeaderText}>
                                          {criterion.CriteriaCode || criterion.criteria_code || 'C'} -{' '}
                                          {criterion.CriteriaName || criterion.criteria_name || 'Criteria'}
                                        </Text>
                                      </TouchableOpacity>

                                      {reqs.map((req: any) => {
                                        const reqId = toId(req.RequirementID, req.requirement_id, req.id);
                                        const checked = selectedAssignRequirementIds.has(reqId);
                                        return (
                                          <TouchableOpacity
                                            key={String(reqId)}
                                            style={[styles.assignReqRow, checked && styles.assignItemRowActive]}
                                            onPress={() => toggleAssignRequirement(reqId, !checked)}
                                          >
                                            <View
                                              style={[
                                                styles.assignCheckbox,
                                                checked && styles.assignCheckboxActive,
                                              ]}
                                            >
                                              <Text style={styles.assignCheckboxText}>{checked ? '✓' : ''}</Text>
                                            </View>
                                            <Text style={styles.assignReqText}>
                                              {req.RequirementCode || 'REQ'} -{' '}
                                              {req.Description || req.RequirementName || 'Requirement'}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  );
                                })}
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>

                    <View style={styles.assignFooter}>
                      <Text style={styles.assignFooterText}>
                        Selected: {selectedAssignOfficeIds.size} office(s), {selectedAssignRequirementIds.size} requirement(s)
                      </Text>
                      <TouchableOpacity
                        style={[styles.submitBtn, assigningRequirements && { opacity: 0.7 }]}
                        onPress={handleAssignSelected}
                        disabled={assigningRequirements}
                      >
                        <Text style={styles.submitBtnText}>
                          {assigningRequirements ? 'Assigning...' : 'Assign Selected'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editStructureOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditStructureOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditStructureOpen(false)}>
          <Pressable style={styles.formModalCard}>
            <Text style={styles.formModalTitle}>
              {editStructureType === 'area'
                ? 'Edit Area'
                : editStructureType === 'criteria'
                  ? 'Edit Criteria'
                  : 'Edit Requirement'}
            </Text>

            <Text style={styles.formLabel}>
              {editStructureType === 'requirement' ? 'Requirement Code' : 'Code'}
            </Text>
            <TextInput
              style={styles.formInput}
              value={editStructureCode}
              onChangeText={setEditStructureCode}
              placeholder={editStructureType === 'requirement' ? 'Requirement code (optional)' : 'Enter code'}
              placeholderTextColor="#94a3b8"
            />

            {editStructureType !== 'requirement' && (
              <>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editStructureName}
                  onChangeText={setEditStructureName}
                  placeholder="Enter name"
                  placeholderTextColor="#94a3b8"
                />
              </>
            )}

            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={editStructureDescription}
              onChangeText={setEditStructureDescription}
              placeholder="Enter description"
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditStructureOpen(false)}
                disabled={savingStructureEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, savingStructureEdit && { opacity: 0.7 }]}
                onPress={handleSaveStructureEdit}
                disabled={savingStructureEdit}
              >
                <Text style={styles.submitBtnText}>{savingStructureEdit ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function EventFormModal({
  visible,
  title,
  formState,
  setFormState,
  submitText,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  formState: EventFormState;
  setFormState: React.Dispatch<React.SetStateAction<EventFormState>>;
  submitText: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.formModalCard}>
          <Text style={styles.formModalTitle}>{title}</Text>

          <Text style={styles.formLabel}>Event Name</Text>
          <TextInput
            style={styles.formInput}
            value={formState.EventName}
            onChangeText={(text) => setFormState((prev) => ({ ...prev, EventName: text }))}
            placeholder="Enter event name"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.formLabel}>Event Code</Text>
          <TextInput
            style={styles.formInput}
            value={formState.EventCode}
            onChangeText={(text) => setFormState((prev) => ({ ...prev, EventCode: text }))}
            placeholder="Enter event code"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={formState.Description}
            onChangeText={(text) => setFormState((prev) => ({ ...prev, Description: text }))}
            placeholder="Enter description"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.statusSelectWrap}>
            <TouchableOpacity
              style={[styles.statusOption, formState.status === 'active' && styles.statusOptionActive]}
              onPress={() => setFormState((prev) => ({ ...prev, status: 'active' }))}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  formState.status === 'active' && styles.statusOptionTextActive,
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, formState.status === 'inactive' && styles.statusOptionActive]}
              onPress={() => setFormState((prev) => ({ ...prev, status: 'inactive' }))}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  formState.status === 'inactive' && styles.statusOptionTextActive,
                ]}
              >
                Inactive
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
              <Text style={styles.submitBtnText}>{submitText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    marginVertical: 30,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  headerWrap: {
    marginTop: 10,
    marginBottom: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  titleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnActive: {
    backgroundColor: '#fecaca',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  filterWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  filterBtnActive: {
    backgroundColor: '#2563eb',
  },
  filterBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  bulkDeleteBar: {
    marginTop: 10,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkDeleteText: {
    color: '#be123c',
    fontWeight: '600',
    fontSize: 12,
  },
  bulkDeleteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bulkDeleteBtnDisabled: {
    opacity: 0.5,
  },
  bulkDeleteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  cardWrap: {
    width: '100%',
    marginBottom: 12,
    position: 'relative',
  },
  eventCard: {
    minHeight: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 3,
  },
  cardBubble: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#cffafe',
    right: -22,
    top: -20,
  },
  checkbox: {
    position: 'absolute',
    left: 8,
    top: 10,
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  checkboxActive: {
    backgroundColor: '#ef4444',
  },
  checkboxText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0e7490',
    letterSpacing: 1,
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
  },
  dotButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 16,
    lineHeight: 16,
    color: '#475569',
  },
  cardCodeWrap: {
    marginTop: 12,
  },
  cardCode: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: '100%',
  },
  cardFooter: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardFooterLeft: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooterRight: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  optionsMenu: {
    position: 'absolute',
    top: 44,
    right: 8,
    zIndex: 15,
    width: 120,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  optionsItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionsText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  optionsDeleteText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  formModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    zIndex: 100000,
    elevation: 100000,
  },
  formModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  formLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  formTextArea: {
    height: 80,
  },
  statusSelectWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  statusOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  statusOptionText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  statusOptionTextActive: {
    color: '#1e40af',
  },
  formActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  structureModalCard: {
    width: '100%',
    maxWidth: 520,
    height: '86%',
    minHeight: 420,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  structureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  structureHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  structureDotsBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  structureDotsText: {
    color: '#334155',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
  },
  structureActionMenu: {
    position: 'absolute',
    top: 58,
    right: 14,
    zIndex: 50,
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 9,
  },
  structureActionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  structureActionItemText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  structureActionDeleteText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  structureDeleteBar: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  structureDeleteText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  structureDeleteActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  structureDeleteCancelBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  structureDeleteCancelText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  structureDeleteConfirmBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#dc2626',
  },
  structureDeleteConfirmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  structureTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  structureCode: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  structureSearch: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 12,
  },
  structureLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  structureScroll: {
    flex: 1,
    minHeight: 200,
  },
  structureScrollContent: {
    paddingBottom: 12,
  },
  structureEmptyWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureEmptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  structureAreaCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  structureAreaHeader: {
    backgroundColor: '#8f3de8',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  structureAreaTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  structureExpandTap: {
    flex: 1,
  },
  structureRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  structureEditBtn: {
    width: 34,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  structureEditBtnLight: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  structureEditBtnSoft: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  structureEditIcon: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  structureEditIconLight: {
    color: '#f8fafc',
  },
  structureCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e11d48',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureCheckboxActive: {
    backgroundColor: '#e11d48',
  },
  structureCheckboxText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  criteriaWrap: {
    marginTop: 10,
    marginLeft: 18,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a6f9',
  },
  criteriaHeader: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#5b63de',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  criteriaTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  requirementsWrap: {
    marginTop: 10,
    marginLeft: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#5c9cf2',
    paddingLeft: 10,
    gap: 8,
  },
  requirementItem: {
    backgroundColor: '#c2d0e5',
    borderRadius: 8,
    padding: 9,
  },
  requirementCode: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 3,
  },
  requirementText: {
    color: '#334155',
    fontSize: 12,
  },
  noItemsText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 5,
  },
  noAreaTitle: {
    backgroundColor: '#8f3de8',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  noAreaTitleText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  noAreaCriteriaItem: {
    marginTop: 10,
    marginLeft: 18,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a6f9',
  },
  noAreaCriteriaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  manageModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    overflow: 'visible',
  },
  manageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  manageMainTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  manageMainTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 8,
  },
  manageMainTabBtnActive: {
    backgroundColor: '#0ea5b7',
  },
  manageMainTabText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  manageMainTabTextActive: {
    color: '#fff',
  },
  manageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  manageTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginBottom: 10,
  },
  manageTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageTabBtnActive: {
    backgroundColor: '#0891b2',
  },
  manageTabText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  manageTabTextActive: {
    color: '#fff',
  },
  manageFormWrap: {
    gap: 8,
    zIndex: 99,
  },
  dropdownWrap: {
    position: 'relative',
    zIndex: 99,
  },
  dropdownWrapOpen: {
    zIndex: 999,
    elevation: 999,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  dropdownTriggerText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  dropdownArrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownMenuList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 180,
    zIndex: 999,
    elevation: 999,
  },
  dropdownMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownMenuItemText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
  dropdownMenuEmptyText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  assignWrap: {
    gap: 10,
  },
  assignHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  assignHint: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    textAlign: 'right',
  },
  assignColumns: {
    flexDirection: 'row',
    gap: 10,
  },
  assignPanel: {
    width: '33%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  assignPanelLarge: {
    width: '64%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  assignPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  assignPanelTitle: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  assignSelectAllText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  assignSearchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 8,
  },
  assignList: {
    maxHeight: 290,
  },
  assignItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  assignItemRowActive: {
    backgroundColor: '#ecfeff',
    borderColor: '#67e8f9',
  },
  assignItemText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  assignCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  assignCheckboxActive: {
    backgroundColor: '#0ea5b7',
    borderColor: '#0ea5b7',
  },
  assignCheckboxText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  assignAreaBlock: {
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  assignAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#8b5cf6',
  },
  assignAreaHeaderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  assignCriteriaBlock: {
    margin: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  assignCriteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#4f46e5',
  },
  assignCriteriaHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  assignReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  assignReqText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  assignFooter: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  assignFooterText: {
    color: '#64748b',
    fontSize: 12,
    flex: 1,
  },
});
