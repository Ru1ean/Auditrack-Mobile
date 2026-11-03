import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BASE_URL,
  areasAPI,
  departmentsAPI,
  eventsAPI,
  getProfilePicUrl,
  getStoredUser,
  normalizeUser,
  officesAPI,
  officetypesAPI,
  personnelAssignmentsAPI,
  requirementsAPI,
  storeUser,
  usersAPI,
} from '../../components/connect';
import EvidenceFilesPanel from '../../components/evidence-files-panel';
import UserFileLightbox from '../../components/user-file-lightbox';
import SmartUserAvatar from '../../components/SmartUserAvatar';

type StatusFilter = 'all' | 'compiled' | 'partially' | 'not_compiled';

const STATUS_OPTIONS = [
  { id: 3, label: 'Not Complied', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 4, label: 'Partially Complied', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 5, label: 'Complied', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
];

const getOfficeId = (o: any) =>
  Number(o?.officeid ?? o?.OfficeID ?? o?.id ?? 0);

const getEventId = (e: any) =>
  Number(e?.eventid ?? e?.EventID ?? e?.id ?? 0);

const formatDate = (dateStr: any) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getAvatarUrl = getProfilePicUrl;

/**
 * Utility to reliably check if an entity is an Academic Program or Non-Academic Office.
 * Matches web implementation in entityHelpers.js
 */
const isAcademicEntity = (entity: any) => {
  if (!entity) return false;

  const entitytypeid = Number(entity.entitytypeid ?? entity.EntityTypeID);
  if (entitytypeid === 1) return true;
  if (entitytypeid === 2) return false;

  const officetypeid = Number(entity.officetypeid ?? entity.OfficeTypeID);
  if (officetypeid === 2) return true;
  if (officetypeid === 1) return false;

  const typeStr = String(
    entity.category_name ||
    entity.typename ||
    entity.office_type_name ||
    entity.office_type ||
    entity.type ||
    entity.officeTypeName ||
    ''
  ).trim().toLowerCase();

  if (
    typeStr.includes('non-academic') ||
    typeStr.includes('non academic') ||
    typeStr.includes('non_academic') ||
    typeStr.startsWith('non') ||
    /\bnon\b/i.test(typeStr) ||
    typeStr === 'office' ||
    typeStr.includes('administrative') ||
    typeStr.includes('admin')
  ) {
    return false;
  }

  if (typeStr.includes('academic') || typeStr.includes('program')) {
    return true;
  }

  return false;
};

export default function ProgramsAndOfficesScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Main Lists
  const [offices, setOffices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [myAssignedOfficeCounts, setMyAssignedOfficeCounts] = useState<Record<string, number>>({});
  const [auditorAssignedAreaIds, setAuditorAssignedAreaIds] = useState<Set<number>>(new Set());
  const [auditorAssignedEventIds, setAuditorAssignedEventIds] = useState<Set<number>>(new Set());

  // Office Auditors Map { [officeId]: any[] }
  const [officeAuditorsMap, setOfficeAuditorsMap] = useState<Record<number, any[]>>({});

  // Active Accreditation Selection
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showEventPicker, setShowEventPicker] = useState(false);

  // Toolbar Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [officeTypeFilter, setOfficeTypeFilter] = useState<'' | 'academic' | 'non_academic'>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'compiled' | 'partially' | 'not_compiled'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dropdown Popovers
  const [showOfficeTypeDropdown, setShowOfficeTypeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Office Standards Modal (Screenshot 5)
  const [selectedOfficeForInspection, setSelectedOfficeForInspection] = useState<any | null>(null);
  const [officeRequirements, setOfficeRequirements] = useState<any[]>([]);
  const [loadingOfficeReqs, setLoadingOfficeReqs] = useState(false);
  const [inspectionSearch, setInspectionSearch] = useState('');
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<'all' | 'compiled' | 'partially' | 'not_compiled'>('all');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'rejected' | 'pending' | 'unsubmitted' | 'approved' | 'priority'>('all');
  const [showInspectionStatusMenu, setShowInspectionStatusMenu] = useState(false);
  const [expandedAreaIds, setExpandedAreaIds] = useState<Set<number>>(new Set());
  const [expandedCriteriaIds, setExpandedCriteriaIds] = useState<Set<number>>(new Set());
  const [assignedUsersMap, setAssignedUsersMap] = useState<Record<number, any[]>>({});
  const [expandedReqIds, setExpandedReqIds] = useState<Set<number>>(new Set());

  const toggleExpandReq = (reqId: number) => {
    setExpandedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  // Evidence panel & lightbox
  const [evidencePanelReq, setEvidencePanelReq] = useState<any | null>(null);
  const [lightboxFile, setLightboxFile] = useState<{ url: string; fileName: string } | null>(null);

  // Auditor evaluation modal inside office inspection
  const [evaluatingReq, setEvaluatingReq] = useState<any | null>(null);
  const [evalStatusId, setEvalStatusId] = useState<number>(3);
  const [evalComments, setEvalComments] = useState<string>('');
  const [evalSaving, setEvalSaving] = useState(false);

  const roleid = Number(currentUser?.roleid || 0);
  const rolename = String(currentUser?.rolename || '').toLowerCase();
  const isAdmin = roleid === 1 || rolename === 'admin' || rolename.includes('admin') || Boolean(currentUser?.isAdmin);
  const isAuditor = !isAdmin && (roleid === 4 || rolename.includes('auditor') || Boolean(currentUser?.isExternalAuditor));
  const isPersonnel = !isAdmin && !isAuditor && (roleid === 2 || roleid === 3 || rolename.includes('personnel') || rolename.includes('office') || rolename === 'user' || rolename === 'head');
  const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);

  // Load User
  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const user = res?.user ? normalizeUser(res.user) : null;
      if (user) {
        setCurrentUser(user);
        await storeUser(user);
        return user;
      }
    } catch {
      const stored = await getStoredUser();
      if (stored) {
        setCurrentUser(stored);
        return stored;
      }
    }
    return null;
  }, []);

  // Main Data Fetch
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await loadUser();
      const uId = user?.userid || user?.id;

      // 1. Fetch active events, offices, departments, and user assignments in parallel
      const [eventsRes, officesRes, deptsRes, myAssignmentsRes] = await Promise.all([
        eventsAPI.getAllEvents().catch(() => ({ data: [] })),
        officesAPI.getAll().catch(() => ({ data: [] })),
        departmentsAPI.getAll().catch(() => []),
        requirementsAPI.getMyAssignments().catch(() => null),
      ]);

      const allEventsList = Array.isArray(eventsRes?.data)
        ? eventsRes.data
        : Array.isArray(eventsRes)
        ? eventsRes
        : [];

      // STRICT REQUIREMENT: ONLY SHOW ACTIVE ACCREDITATIONS
      let activeEvents = allEventsList.filter((e: any) => {
        const s = String(e.Status || e.status || '').toLowerCase().trim();
        return s !== 'inactive';
      });

      // If Auditor, load assignments to scope events
      if (isAuditor && uId) {
        try {
          const assignRes = await areasAPI.getAuditorAssignments(uId);
          if (assignRes?.success && Array.isArray(assignRes.assignments)) {
            const evIds = new Set<number>();
            const arIds = new Set<number>();
            assignRes.assignments.forEach((a: any) => {
              if (a.eventid) evIds.add(Number(a.eventid));
              if (a.areaid) arIds.add(Number(a.areaid));
            });
            setAuditorAssignedEventIds(evIds);
            setAuditorAssignedAreaIds(arIds);

            // Scope active events to only assigned events for auditor
            if (evIds.size > 0) {
              activeEvents = activeEvents.filter((e: any) =>
                evIds.has(getEventId(e))
              );
            }
          }
        } catch (e) {
          console.warn('Auditor assignment fetch error:', e);
        }
      }

      setEvents(activeEvents);

      // Default to first active event or persisted event
      setSelectedEventId((prev) => {
        if (prev && activeEvents.some((e: any) => String(getEventId(e)) === String(prev))) {
          return prev;
        }
        return activeEvents.length > 0 ? String(getEventId(activeEvents[0])) : '';
      });

      // Offices Data
      const officesData = Array.isArray(officesRes?.data)
        ? officesRes.data
        : Array.isArray(officesRes)
        ? officesRes
        : [];
      setOffices(officesData);

      // Departments Data
      const deptsList = Array.isArray(deptsRes?.data)
        ? deptsRes.data
        : Array.isArray(deptsRes)
        ? deptsRes
        : [];
      setDepartments(deptsList);

      // Calculate my assigned office counts from requirements assignments
      const countsByOffice: Record<string, number> = {};
      const assignmentRows = Array.isArray(myAssignmentsRes?.data) ? myAssignmentsRes.data : [];
      const officeIdsFromRes = Array.isArray(myAssignmentsRes?.officeIds) ? myAssignmentsRes.officeIds : [];

      assignmentRows.forEach((row: any) => {
        const oid = String(row?.officeid ?? '');
        if (oid) countsByOffice[oid] = (countsByOffice[oid] || 0) + 1;
      });
      officeIdsFromRes.forEach((id: any) => {
        const oid = String(id ?? '');
        if (oid && !countsByOffice[oid]) {
          countsByOffice[oid] = 1;
        }
      });
      setMyAssignedOfficeCounts(countsByOffice);

      // Pre-fetch auditors for offices
      for (const off of officesData.slice(0, 20)) {
        const oid = getOfficeId(off);
        if (oid) {
          areasAPI
            .getAuditorsForOffice(oid)
            .then((res: any) => {
              if (res?.success && Array.isArray(res.auditors)) {
                setOfficeAuditorsMap((prev) => ({ ...prev, [oid]: res.auditors }));
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading Programs & Offices data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadUser, isAuditor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Check if an office is assigned to the current user (Matching OfficesP.jsx logic)
  const isOfficeAssignedToPersonnel = useCallback(
    (o: any) => {
      if (!currentUser) return false;
      const uid = String(currentUser.userid ?? currentUser.id ?? '');
      const hid = String(currentUser.headid ?? '');
      const officeid = String(o.id ?? o.officeid ?? '');

      // 1. Check requirements assignments count
      if (myAssignedOfficeCounts && Number(myAssignedOfficeCounts[officeid] || 0) > 0) {
        return true;
      }

      // 2. Check heads array
      if (Array.isArray(o.heads) && o.heads.length > 0) {
        const matchedHead = o.heads.some((h: any) => {
          if (uid && String(h.userid ?? '') === uid) return true;
          if (hid && String(h.headid ?? '') === hid) return true;

          const headName = String(h.full_name || `${h.firstname || ''} ${h.lastname || ''}`)
            .toLowerCase()
            .trim();
          const userFirst = String(currentUser.firstname || '').toLowerCase().trim();
          const userLast = String(currentUser.lastname || '').toLowerCase().trim();
          if (userFirst && userLast && headName) {
            if (headName.includes(userFirst) && headName.includes(userLast)) return true;
          } else if (userFirst && headName && headName.includes(userFirst)) {
            return true;
          }
          return false;
        });
        if (matchedHead) return true;
      }

      // 3. Check direct headid / head_ids
      if (hid) {
        if (String(o.headid ?? '') === hid) return true;
        if (Array.isArray(o.head_ids) && o.head_ids.some((id: any) => String(id) === hid)) {
          return true;
        }
      }

      // 4. Check head_name string
      if (o.head_name && o.head_name !== 'Unassigned' && o.head_name !== 'unassigned') {
        const headName = String(o.head_name).toLowerCase().trim();
        const userFirst = String(currentUser.firstname || '').toLowerCase().trim();
        const userLast = String(currentUser.lastname || '').toLowerCase().trim();
        if (userFirst && userLast) {
          if (headName.includes(userFirst) && headName.includes(userLast)) return true;
        } else if (userFirst && headName && headName.includes(userFirst)) {
          return true;
        }
      }

      return false;
    },
    [currentUser, myAssignedOfficeCounts]
  );

  // Check if an office is assigned to auditor
  const isOfficeAssignedToAuditor = useCallback(
    (o: any) => {
      if (!currentUser) return false;
      const uid = Number(currentUser.userid ?? currentUser.id ?? 0);
      const officeid = getOfficeId(o);

      // Check loaded office auditors map
      const auds = officeAuditorsMap[officeid];
      if (Array.isArray(auds) && auds.some((a: any) => Number(a.userid) === uid)) {
        return true;
      }

      // Check if office's event is assigned to auditor
      if (auditorAssignedEventIds.size > 0 && auditorAssignedEventIds.has(Number(o.eventid))) {
        return true;
      }

      return false;
    },
    [currentUser, officeAuditorsMap, auditorAssignedEventIds]
  );

  // ── FILTERING PIPELINE ──
  // 1. Role Filter: ONLY ASSIGNED PROGRAMS & OFFICES (No master list bloat)
  const roleFilteredOffices = useMemo(() => {
    if (isPersonnel) {
      return offices.filter(isOfficeAssignedToPersonnel);
    }
    if (isAuditor) {
      return offices.filter(isOfficeAssignedToAuditor);
    }
    return offices;
  }, [offices, isPersonnel, isAuditor, isOfficeAssignedToPersonnel, isOfficeAssignedToAuditor]);

  // 2. Filter by Active Event
  const eventFilteredOffices = useMemo(() => {
    if (!selectedEventId) return roleFilteredOffices;
    return roleFilteredOffices.filter(
      (o) => String(o.eventid ?? o.EventID ?? '') === String(selectedEventId)
    );
  }, [roleFilteredOffices, selectedEventId]);

  // 3. Search Filter
  const searchFilteredOffices = useMemo(() => {
    if (!searchTerm.trim()) return eventFilteredOffices;
    const lower = searchTerm.toLowerCase();
    return eventFilteredOffices.filter((o) => {
      const name = String(o.officename || '').toLowerCase();
      const head = String(o.head_name || '').toLowerCase();
      const type = String(o.office_type_name || o.typename || '').toLowerCase();
      const dept = String(o.department_name || '').toLowerCase();
      return name.includes(lower) || head.includes(lower) || type.includes(lower) || dept.includes(lower);
    });
  }, [eventFilteredOffices, searchTerm]);

  // 4. Dropdown Filter: Office Type (All / Academic / Non Academic)
  const officeTypeFilteredOffices = useMemo(() => {
    if (!officeTypeFilter) return searchFilteredOffices;
    if (officeTypeFilter === 'academic') {
      return searchFilteredOffices.filter(isAcademicEntity);
    }
    return searchFilteredOffices.filter((o) => !isAcademicEntity(o));
  }, [searchFilteredOffices, officeTypeFilter]);

  // 5. Dropdown Filter: Department
  const departmentFilteredOffices = useMemo(() => {
    if (!selectedDepartmentId) return officeTypeFilteredOffices;
    return officeTypeFilteredOffices.filter(
      (o) => String(o.departmentid ?? o.DepartmentID ?? '') === String(selectedDepartmentId)
    );
  }, [officeTypeFilteredOffices, selectedDepartmentId]);

  // Helper to normalize compliance status key
  const getStatusKey = (status: any) => {
    const s = String(status || '').toLowerCase().trim();
    if (!s) return 'not_compiled';
    if (s.includes('partial') || s.includes('partially')) return 'partially';
    if (s.includes('not') || s.includes("n't") || s.includes('incomplete') || s.includes('pending'))
      return 'not_compiled';
    if (s.includes('complied') || s.includes('complete') || s.includes('passed')) return 'compiled';
    return 'not_compiled';
  };

  // 6. Dropdown Filter: Compliance Status
  const fullyFilteredOffices = useMemo(() => {
    if (statusFilter === 'all') return departmentFilteredOffices;
    return departmentFilteredOffices.filter(
      (o) => getStatusKey(o.overallstatus) === statusFilter
    );
  }, [departmentFilteredOffices, statusFilter]);

  // ── GROUPING: Academic Departments & Programs vs Non-Academic Offices ──
  const academicOffices = useMemo(
    () => fullyFilteredOffices.filter(isAcademicEntity),
    [fullyFilteredOffices]
  );

  const nonAcademicOffices = useMemo(
    () => fullyFilteredOffices.filter((o) => !isAcademicEntity(o)),
    [fullyFilteredOffices]
  );

  // Group Academic Programs by Department
  const academicByDept = useMemo(() => {
    const map = new Map<string, { deptId: any; deptName: string; programs: any[] }>();

    for (const office of academicOffices) {
      const deptKey = String(office.departmentid || 'unassigned');
      const deptName = office.department_name || 'Academic Department';

      if (!map.has(deptKey)) {
        map.set(deptKey, {
          deptId: office.departmentid || null,
          deptName,
          programs: [],
        });
      }
      map.get(deptKey)!.programs.push(office);
    }

    return Array.from(map.values());
  }, [academicOffices]);

  // Currently Selected Active Event Object
  const selectedEvent = useMemo(
    () => events.find((e) => String(getEventId(e)) === selectedEventId),
    [events, selectedEventId]
  );

  // ── OPEN OFFICE INSPECTION MODAL (Screenshot 5) ──
  const openOfficeInspection = async (office: any, options?: { silent?: boolean }) => {
    setSelectedOfficeForInspection(office);
    const isSilent = Boolean(options?.silent);
    if (!isSilent) {
      setLoadingOfficeReqs(true);
      setInspectionSearch('');
      setInspectionStatusFilter('all');
      setSubmissionFilter('all');
      setOfficeRequirements([]);
    }

    try {
      const officeId = getOfficeId(office);
      const res = await officesAPI.getOfficeRequirements(officeId);
      const reqList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      setOfficeRequirements(reqList);

      if (!isSilent) {
        // Expand all areas by default
        const areaIds = new Set<number>();
        const critIds = new Set<number>();
        reqList.forEach((r: any) => {
          if (r.areaid) areaIds.add(Number(r.areaid));
          if (r.criteriaid) critIds.add(Number(r.criteriaid));
        });
        setExpandedAreaIds(areaIds);
        setExpandedCriteriaIds(critIds);
      }

      // Fetch assigned personnel for requirements
      const userMap: Record<number, any[]> = {};
      await Promise.all(
        reqList.map(async (r: any) => {
          const reqId = r.requirementid;
          if (reqId) {
            try {
              const uRes = await requirementsAPI.getAssignedUsers(reqId, officeId);
              userMap[reqId] = Array.isArray(uRes?.users) ? uRes.users : uRes?.data || [];
            } catch {
              userMap[reqId] = [];
            }
          }
        })
      );
      setAssignedUsersMap(userMap);
    } catch (err) {
      if (!isSilent) {
        console.error('Failed to load office requirements:', err);
        Alert.alert('Error', 'Could not load standards for this office.');
      }
    } finally {
      if (!isSilent) {
        setLoadingOfficeReqs(false);
      }
    }
  };

  // Live polling while Office Inspection modal is open
  useEffect(() => {
    if (!selectedOfficeForInspection) return;

    const pollInterval = setInterval(() => {
      void openOfficeInspection(selectedOfficeForInspection, { silent: true });
    }, 3000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void openOfficeInspection(selectedOfficeForInspection, { silent: true });
      }
    });

    return () => {
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, [selectedOfficeForInspection]);

  // Compute submission counts for Personnel
  const submissionCounts = useMemo(() => {
    let rejected = 0;
    let pending = 0;
    let unsubmitted = 0;
    let approved = 0;

    officeRequirements.forEach((r: any) => {
      const reqId = Number(r.requirementid);
      const assigned = assignedUsersMap[reqId] || [];
      const targetUsers = isPersonnel ? assigned.filter((u: any) => Number(u.userid) === currentUid) : assigned;
      const totFiles = targetUsers.reduce((sum: number, u: any) => sum + Number(u.totalfiles || 0), 0);
      const rejCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.rejectedcount || 0), 0) : 0;
      const pendCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.pendingcount || 0), 0) : 0;
      const appCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.approvedcount || 0), 0) : 0;

      if (rejCount > 0) rejected++;
      if (pendCount > 0) pending++;
      if (totFiles === 0) unsubmitted++;
      if (appCount > 0) approved++;
    });

    return { rejected, pending, unsubmitted, approved, total: officeRequirements.length };
  }, [officeRequirements, assignedUsersMap, isPersonnel, currentUid]);

  // Group Office Requirements into Hierarchy: Area -> Criteria -> Standards
  const inspectionHierarchy = useMemo(() => {
    if (!officeRequirements || officeRequirements.length === 0) return [];

    let filtered = officeRequirements;

    // Filter by search
    if (inspectionSearch.trim()) {
      const lower = inspectionSearch.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          String(r.requirementcode || '').toLowerCase().includes(lower) ||
          String(r.Description || r.description || '').toLowerCase().includes(lower) ||
          String(r.criterianame || '').toLowerCase().includes(lower) ||
          String(r.areaname || '').toLowerCase().includes(lower)
      );
    }

    // Filter by compliance status
    if (inspectionStatusFilter !== 'all') {
      filtered = filtered.filter((r) => {
        const sId = Number(r.ComplianceStatusID ?? r.status ?? 3);
        if (inspectionStatusFilter === 'compiled') return sId === 5;
        if (inspectionStatusFilter === 'partially') return sId === 4;
        if (inspectionStatusFilter === 'not_compiled') return sId === 3;
        return true;
      });
    }

    // Filter by submission status (Personnel)
    if (submissionFilter !== 'all' && submissionFilter !== 'priority') {
      filtered = filtered.filter((r) => {
        const reqId = Number(r.requirementid);
        const assigned = assignedUsersMap[reqId] || [];
        const targetUsers = isPersonnel ? assigned.filter((u: any) => Number(u.userid) === currentUid) : assigned;
        const totFiles = targetUsers.reduce((sum: number, u: any) => sum + Number(u.totalfiles || 0), 0);
        const rejCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.rejectedcount || 0), 0) : 0;
        const pendCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.pendingcount || 0), 0) : 0;
        const appCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.approvedcount || 0), 0) : 0;

        if (submissionFilter === 'rejected') return rejCount > 0;
        if (submissionFilter === 'pending') return pendCount > 0;
        if (submissionFilter === 'unsubmitted') return totFiles === 0;
        if (submissionFilter === 'approved') return appCount > 0;
        return true;
      });
    }

    if (submissionFilter && submissionFilter !== 'all') {
      filtered = [...filtered].sort((a, b) => {
        const getScore = (r: any) => {
          const reqId = Number(r.requirementid);
          const assigned = assignedUsersMap[reqId] || [];
          const targetUsers = isPersonnel ? assigned.filter((u: any) => Number(u.userid) === currentUid) : assigned;
          const totFiles = targetUsers.reduce((sum: number, u: any) => sum + Number(u.totalfiles || 0), 0);
          const rejCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.rejectedcount || 0), 0) : 0;
          const pendCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.pendingcount || 0), 0) : 0;
          const appCount = totFiles > 0 ? targetUsers.reduce((sum: number, u: any) => sum + Number(u.approvedcount || 0), 0) : 0;
          return { totFiles, rejCount, pendCount, appCount };
        };

        const sa = getScore(a);
        const sb = getScore(b);

        if (submissionFilter === 'approved') return sb.appCount - sa.appCount;
        if (submissionFilter === 'pending') return sb.pendCount - sa.pendCount;
        if (submissionFilter === 'rejected') return sb.rejCount - sa.rejCount;
        if (submissionFilter === 'unsubmitted') return (sa.totFiles === 0 ? 0 : 1) - (sb.totFiles === 0 ? 0 : 1);
        if (submissionFilter === 'priority') {
          const rank = (s: any) => {
            if (s.rejCount > 0) return 1;
            if (s.totFiles === 0) return 2;
            if (s.pendCount > 0) return 3;
            if (s.appCount > 0) return 4;
            return 5;
          };
          return rank(sa) - rank(sb);
        }
        return 0;
      });
    }

    const areaMap = new Map<number, { area: any; criteriaMap: Map<number, { criteria: any; requirements: any[] }> }>();

    filtered.forEach((r) => {
      const areaId = Number(r.areaid || 0);
      const critId = Number(r.criteriaid || 0);

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          area: {
            areaid: areaId,
            areacode: r.areacode || `AREA ${areaId}`,
            areaname: r.areaname || 'General Area',
          },
          criteriaMap: new Map(),
        });
      }

      const areaEntry = areaMap.get(areaId)!;
      if (!areaEntry.criteriaMap.has(critId)) {
        areaEntry.criteriaMap.set(critId, {
          criteria: {
            criteriaid: critId,
            criteriacode: r.criteriacode || `CRIT ${critId}`,
            criterianame: r.criterianame || 'General Sub Area',
            parentcriteriaid: r.parentcriteriaid,
          },
          requirements: [],
        });
      }

      areaEntry.criteriaMap.get(critId)!.requirements.push(r);
    });

    return Array.from(areaMap.values()).map((a) => ({
      ...a.area,
      criteriaList: Array.from(a.criteriaMap.values()),
    }));
  }, [officeRequirements, inspectionSearch, inspectionStatusFilter, submissionFilter, assignedUsersMap, isPersonnel, currentUid]);

  // Auditor Evaluation Save
  const handleSaveEvaluation = async () => {
    if (!evaluatingReq || !selectedOfficeForInspection) return;
    const reqId = Number(evaluatingReq.requirementid);
    const officeId = getOfficeId(selectedOfficeForInspection);

    setEvalSaving(true);
    try {
      await officesAPI.updateOfficeRequirementStatus(officeId, reqId, {
        statusId: evalStatusId,
        comments: evalComments.trim(),
      });

      // Update local inspection requirements
      setOfficeRequirements((prev) =>
        prev.map((r) => {
          if (Number(r.requirementid) === reqId) {
            return {
              ...r,
              ComplianceStatusID: evalStatusId,
              status: evalStatusId,
              Comments: evalComments.trim(),
              comments: evalComments.trim(),
            };
          }
          return r;
        })
      );

      // Refresh offices list in background
      officesAPI.getAll().then((res: any) => {
        const offList = Array.isArray(res?.data) ? res.data : res || [];
        setOffices(offList);
      });

      Alert.alert('Assessment Saved', 'Compliance status has been recorded.');
      setEvaluatingReq(null);
    } catch (err: any) {
      Alert.alert('Evaluation Failed', err?.message || 'Could not update status.');
    } finally {
      setEvalSaving(false);
    }
  };

  return (
    <View style={s.container}>
      {/* ─── Breadcrumb Header matching Screenshot 1 ─── */}
      <View style={s.topBar}>
        <View style={s.breadcrumbRow}>
          <Text style={s.brandTitle}>AUDITRACK</Text>
          <Text style={s.breadcrumbSeparator}>/</Text>
          <Text style={s.greetingText}>
            Hello, {currentUser?.firstname || 'Personnel'} {currentUser?.lastname || ''}
          </Text>
          <View style={s.roleBadgePill}>
            <Text style={s.roleBadgeText}>
              {isAuditor ? 'EXTERNAL AUDITOR' : 'PERSONNEL'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scrollContent}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
      >
        {/* ─── Page Title Banner (Violet/Indigo Building Icon - Screenshot 1) ─── */}
        <View style={s.bannerCard}>
          <View style={s.bannerIconBox}>
            <MaterialIcons name="business" size={26} color="#ffffff" />
          </View>
          <View style={s.bannerTextBox}>
            <Text style={s.bannerTitle}>Programs &amp; Offices</Text>
            <Text style={s.bannerSubtitle}>
              Manage and monitor all academic programs, offices, and compliance assignments.
            </Text>
          </View>
        </View>

        {/* ─── Toolbar Filters: Search + Dropdowns + View Mode Toggle ─── */}
        <View style={s.toolbarCard}>
          {/* Search Input */}
          <View style={s.searchField}>
            <MaterialIcons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={s.searchInput}
              placeholder="Search offices..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <MaterialIcons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Dropdowns Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScrollRow}>
            {/* 1. Office Types Dropdown (Screenshot 4) */}
            <TouchableOpacity
              style={s.dropdownBtn}
              onPress={() => {
                setShowOfficeTypeDropdown((p) => !p);
                setShowDepartmentDropdown(false);
                setShowStatusDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={s.dropdownBtnText}>
                {officeTypeFilter === 'academic'
                  ? 'Academic'
                  : officeTypeFilter === 'non_academic'
                  ? 'Non Academic'
                  : 'All Office Types'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* 2. Departments Dropdown (Screenshot 3) */}
            <TouchableOpacity
              style={s.dropdownBtn}
              onPress={() => {
                setShowDepartmentDropdown((p) => !p);
                setShowOfficeTypeDropdown(false);
                setShowStatusDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={s.dropdownBtnText}>
                {selectedDepartmentId
                  ? departments.find((d) => String(d.id || d.DepartmentID) === selectedDepartmentId)?.name ||
                    'All Departments'
                  : 'All Departments'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* 3. Compliance Status Dropdown (Screenshot 2) */}
            <TouchableOpacity
              style={s.dropdownBtn}
              onPress={() => {
                setShowStatusDropdown((p) => !p);
                setShowOfficeTypeDropdown(false);
                setShowDepartmentDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  s.statusDotSmall,
                  statusFilter === 'compiled'
                    ? { backgroundColor: '#059669' }
                    : statusFilter === 'partially'
                    ? { backgroundColor: '#d97706' }
                    : statusFilter === 'not_compiled'
                    ? { backgroundColor: '#dc2626' }
                    : { backgroundColor: '#94a3b8' },
                ]}
              />
              <Text style={s.dropdownBtnText}>
                {statusFilter === 'compiled'
                  ? 'Complied'
                  : statusFilter === 'partially'
                  ? 'Partially Complied'
                  : statusFilter === 'not_compiled'
                  ? 'Not Complied'
                  : 'All Offices'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* 4. Grid / List View Toggle */}
            <View style={s.viewModeToggleGroup}>
              <TouchableOpacity
                style={[s.viewModeBtn, viewMode === 'grid' && s.viewModeBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                <MaterialIcons
                  name="grid-view"
                  size={16}
                  color={viewMode === 'grid' ? '#2563eb' : '#64748b'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.viewModeBtn, viewMode === 'list' && s.viewModeBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <MaterialIcons
                  name="view-list"
                  size={18}
                  color={viewMode === 'list' ? '#2563eb' : '#64748b'}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Office Type Dropdown Popover (Screenshot 4) */}
          {showOfficeTypeDropdown && (
            <View style={s.popoverMenu}>
              {[
                { label: 'All Office Types', value: '' },
                { label: 'Academic', value: 'academic' },
                { label: 'Non Academic', value: 'non_academic' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[s.popoverItem, officeTypeFilter === opt.value && s.popoverItemActive]}
                  onPress={() => {
                    setOfficeTypeFilter(opt.value as any);
                    setShowOfficeTypeDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      s.popoverItemText,
                      officeTypeFilter === opt.value && s.popoverItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Department Dropdown Popover (Screenshot 3) */}
          {showDepartmentDropdown && (
            <View style={s.popoverMenu}>
              <TouchableOpacity
                style={[s.popoverItem, !selectedDepartmentId && s.popoverItemActive]}
                onPress={() => {
                  setSelectedDepartmentId('');
                  setShowDepartmentDropdown(false);
                }}
              >
                <Text style={[s.popoverItemText, !selectedDepartmentId && s.popoverItemTextActive]}>
                  All Departments
                </Text>
              </TouchableOpacity>
              {departments.map((dept) => {
                const dId = String(dept.id || dept.DepartmentID || '');
                const dName = dept.name || dept.DepartmentName || '';
                return (
                  <TouchableOpacity
                    key={`dept-opt-${dId}`}
                    style={[s.popoverItem, selectedDepartmentId === dId && s.popoverItemActive]}
                    onPress={() => {
                      setSelectedDepartmentId(dId);
                      setShowDepartmentDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        s.popoverItemText,
                        selectedDepartmentId === dId && s.popoverItemTextActive,
                      ]}
                    >
                      {dName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Compliance Status Dropdown Popover (Screenshot 2) */}
          {showStatusDropdown && (
            <View style={s.popoverMenu}>
              {[
                { label: 'All Offices', value: 'all', dot: '#94a3b8' },
                { label: 'Complied', value: 'compiled', dot: '#059669' },
                { label: 'Partially Complied', value: 'partially', dot: '#d97706' },
                { label: 'Not Complied', value: 'not_compiled', dot: '#dc2626' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[s.popoverItem, statusFilter === opt.value && s.popoverItemActive]}
                  onPress={() => {
                    setStatusFilter(opt.value as any);
                    setShowStatusDropdown(false);
                  }}
                >
                  <View style={[s.statusDotSmall, { backgroundColor: opt.dot }]} />
                  <Text
                    style={[
                      s.popoverItemText,
                      statusFilter === opt.value && s.popoverItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ─── Active Accreditation Selector / Tab Bar (Screenshot 1: PACUCOA 2027) ─── */}
        <View style={s.eventSelectorRow}>
          <TouchableOpacity
            style={s.activeEventTab}
            onPress={() => setShowEventPicker((p) => !p)}
            activeOpacity={0.8}
          >
            <View style={s.eventActiveDot} />
            <Text style={s.activeEventCode}>
              {selectedEvent?.eventcode || selectedEvent?.eventname || 'PACUCOA 2027'}
            </Text>
            {events.length > 1 && (
              <MaterialIcons name="arrow-drop-down" size={18} color="#1e40af" />
            )}
          </TouchableOpacity>
        </View>

        {/* Active Events Selection Dropdown */}
        {showEventPicker && events.length > 1 && (
          <View style={s.activeEventsPickerBox}>
            <Text style={s.pickerHeaderLabel}>ACTIVE ACCREDITATION FRAMEWORKS</Text>
            {events.map((ev) => {
              const evId = String(getEventId(ev));
              const isCurr = evId === selectedEventId;
              return (
                <TouchableOpacity
                  key={`ev-tab-${evId}`}
                  style={[s.eventPickerItem, isCurr && s.eventPickerItemActive]}
                  onPress={() => {
                    setSelectedEventId(evId);
                    setShowEventPicker(false);
                  }}
                >
                  <MaterialIcons
                    name="fact-check"
                    size={16}
                    color={isCurr ? '#2563eb' : '#64748b'}
                  />
                  <Text style={[s.eventPickerItemText, isCurr && s.eventPickerItemTextActive]}>
                    {ev.eventcode || ev.eventname}
                  </Text>
                  {isCurr && <MaterialIcons name="check" size={16} color="#2563eb" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Content Body: Academic Programs + Non-Academic Offices ─── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={s.loadingText}>Loading assigned programs and offices...</Text>
          </View>
        ) : fullyFilteredOffices.length === 0 ? (
          <View style={s.emptyCard}>
            <MaterialIcons name="business" size={48} color="#94a3b8" />
            <Text style={s.emptyTitle}>
              {isAuditor ? 'No Assigned Programs or Offices' : 'No Assigned Offices'}
            </Text>
            <Text style={s.emptySubtitle}>
              {isAuditor
                ? 'You are only shown programs and offices assigned to your audit areas.'
                : 'You are only shown programs and offices assigned to you.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            {/* ═══════════════════════════════════════════════════════════
                SECTION 1: ACADEMIC DEPARTMENTS & PROGRAMS (Screenshot 1)
               ═══════════════════════════════════════════════════════════ */}
            {academicOffices.length > 0 && (
              <View style={s.sectionContainer}>
                {/* Section Header */}
                <View style={s.sectionHeaderRow}>
                  <View style={s.sectionHeaderLeft}>
                    <MaterialIcons name="school" size={18} color="#2563eb" />
                    <Text style={s.sectionHeaderTitle}>ACADEMIC DEPARTMENTS &amp; PROGRAMS</Text>
                    <View style={s.sectionCountPill}>
                      <Text style={s.sectionCountPillText}>
                        {academicByDept.length} {academicByDept.length === 1 ? 'Department' : 'Departments'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Departments Groups */}
                {academicByDept.map((deptGroup) => (
                  <View key={`dept-card-${deptGroup.deptId || deptGroup.deptName}`} style={s.deptCard}>
                    {/* Department Header Banner */}
                    <View style={s.deptHeaderBanner}>
                      <View style={s.deptIconBox}>
                        <MaterialIcons name="school" size={20} color="#ffffff" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.deptTitleText}>{deptGroup.deptName}</Text>
                          <View style={s.deptCountPill}>
                            <Text style={s.deptCountPillText}>
                              {deptGroup.programs.length} {deptGroup.programs.length === 1 ? 'Program' : 'Programs'}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.deptSubtitleText}>Department</Text>
                      </View>
                    </View>

                    {/* Department Programs Grid / List */}
                    <View style={s.deptProgramsContainer}>
                      {deptGroup.programs.map((office) =>
                        renderOfficeCard(office, viewMode, openOfficeInspection)
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2: NON-ACADEMIC OFFICES (Screenshot 1 & 3)
               ═══════════════════════════════════════════════════════════ */}
            {nonAcademicOffices.length > 0 && (
              <View style={s.sectionContainer}>
                {/* Section Header */}
                <View style={s.sectionHeaderRow}>
                  <View style={s.sectionHeaderLeft}>
                    <MaterialIcons name="apartment" size={18} color="#059669" />
                    <Text style={s.sectionHeaderTitle}>NON-ACADEMIC OFFICES</Text>
                    <View style={[s.sectionCountPill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[s.sectionCountPillText, { color: '#059669' }]}>
                        {nonAcademicOffices.length} {nonAcademicOffices.length === 1 ? 'Office' : 'Offices'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Institutional Units & Offices Card Banner */}
                <View style={s.deptCard}>
                  <View style={[s.deptHeaderBanner, { backgroundColor: '#f0fdf4', borderBottomColor: '#dcfce7' }]}>
                    <View style={[s.deptIconBox, { backgroundColor: '#059669' }]}>
                      <MaterialIcons name="apartment" size={20} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.deptTitleText}>Institutional Units &amp; Offices</Text>
                      <Text style={s.deptSubtitleText}>Evaluated independently of academic departments</Text>
                    </View>
                  </View>

                  {/* Non-Academic Programs Grid / List */}
                  <View style={s.deptProgramsContainer}>
                    {nonAcademicOffices.map((office) =>
                      renderOfficeCard(office, viewMode, openOfficeInspection)
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════
          OFFICE STANDARDS INSPECTION MODAL (Screenshot 5)
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(selectedOfficeForInspection)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedOfficeForInspection(null)}
      >
        <View style={s.inspectionContainer}>
          {/* Modal Header */}
          <View style={s.inspectionHeader}>
            <View style={s.inspectionHeaderIcon}>
              <MaterialIcons
                name={isAcademicEntity(selectedOfficeForInspection) ? 'school' : 'apartment'}
                size={22}
                color="#2563eb"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.inspectionHeaderTitle} numberOfLines={1}>
                {selectedOfficeForInspection?.officename || 'Program / Office'}
              </Text>
              <View style={s.inspectionHeaderBadges}>
                <View style={s.tagBadgePill}>
                  <Text style={s.tagBadgePillText}>
                    {isAcademicEntity(selectedOfficeForInspection) ? 'Academic' : 'Non Academic'}
                  </Text>
                </View>
                <View style={s.tagBadgePill}>
                  <Text style={s.tagBadgePillText}>
                    Event: {selectedOfficeForInspection?.eventcode || selectedEvent?.eventcode || 'PACUCOA 2027'}
                  </Text>
                </View>
                {selectedOfficeForInspection?.department_name ? (
                  <View style={s.tagBadgePill}>
                    <Text style={s.tagBadgePillText}>
                      {selectedOfficeForInspection.department_name}
                    </Text>
                  </View>
                ) : null}
                {selectedOfficeForInspection?.accreditationlevel &&
                selectedOfficeForInspection.accreditationlevel !== 'None' ? (
                  <View style={[s.tagBadgePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Text style={[s.tagBadgePillText, { color: '#059669', fontWeight: '800' }]}>
                      {selectedOfficeForInspection.accreditationlevel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Close Button ✕ */}
            <TouchableOpacity
              style={s.inspectionCloseBtn}
              onPress={() => setSelectedOfficeForInspection(null)}
            >
              <MaterialIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Meta Summary Box (Screenshot 5: Personnel, External Auditor, Compliance Rate) */}
          <View style={s.inspectionMetaBox}>
            <View style={s.metaLeftGroup}>
              {/* Personnel Assigned - visible to Admin or the assigned personnel */}
              {(isAdmin || isPersonnel) && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.metaLabel}>PERSONNEL</Text>
                  <Text style={s.metaValue}>
                    {selectedOfficeForInspection?.heads && selectedOfficeForInspection.heads.length > 0
                      ? selectedOfficeForInspection.heads
                          .filter((h: any) => isAdmin ? true : Number(h.userid || h.id) === Number(currentUser?.userid))
                          .map((h: any) => h.full_name || h.firstname).join(', ') || (isAdmin ? 'Assigned Personnel' : 'None assigned')
                      : (isAdmin ? (selectedOfficeForInspection?.head_name || 'Assigned Personnel') : 'None assigned')}
                  </Text>
                </View>
              )}

              {/* External Auditor Assigned - visible to Admin or the assigned auditor */}
              {(isAdmin || isAuditor) && (
                <View>
                  <Text style={s.metaLabel}>EXTERNAL AUDITOR</Text>
                  <Text style={s.metaValue}>
                    {officeAuditorsMap[getOfficeId(selectedOfficeForInspection)]?.length
                      ? officeAuditorsMap[getOfficeId(selectedOfficeForInspection)]
                          .filter((a: any) => isAdmin ? true : Number(a.userid || a.id) === Number(currentUser?.userid))
                          .map((a: any) => a.full_name || a.firstname)
                          .join(', ') || (isAdmin ? 'None assigned' : 'None assigned')
                      : 'None assigned'}
                  </Text>
                </View>
              )}
            </View>

            {/* Compliance Rate & Status Pill */}
            <View style={s.metaRightGroup}>
              <Text style={s.metaLabel}>COMPLIANCE</Text>
              <Text style={s.complianceBigText}>
                {selectedOfficeForInspection?.compliancepercent !== undefined
                  ? `${Math.round(Number(selectedOfficeForInspection.compliancepercent))}%`
                  : '0%'}
              </Text>
              <View
                style={[
                  s.statusPillBadge,
                  getStatusKey(selectedOfficeForInspection?.overallstatus) === 'compiled'
                    ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                    : getStatusKey(selectedOfficeForInspection?.overallstatus) === 'partially'
                    ? { backgroundColor: '#fffbeb', borderColor: '#fde68a' }
                    : { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
                ]}
              >
                <View
                  style={[
                    s.statusDotSmall,
                    getStatusKey(selectedOfficeForInspection?.overallstatus) === 'compiled'
                      ? { backgroundColor: '#059669' }
                      : getStatusKey(selectedOfficeForInspection?.overallstatus) === 'partially'
                      ? { backgroundColor: '#d97706' }
                      : { backgroundColor: '#dc2626' },
                  ]}
                />
                <Text
                  style={[
                    s.statusPillBadgeText,
                    getStatusKey(selectedOfficeForInspection?.overallstatus) === 'compiled'
                      ? { color: '#059669' }
                      : getStatusKey(selectedOfficeForInspection?.overallstatus) === 'partially'
                      ? { color: '#d97706' }
                      : { color: '#dc2626' },
                  ]}
                >
                  {selectedOfficeForInspection?.overallstatus || 'Not Complied'}
                </Text>
              </View>
            </View>
          </View>

          {/* Standards Section Header & Search Controls */}
          <View style={s.standardsControlsBar}>
            <View>
              <Text style={s.standardsSectionTitle}>Standards</Text>
              <Text style={s.standardsSectionSubtitle}>Browse areas, sub areas, and standards</Text>
            </View>

            {/* Search Input for standards */}
            <View style={s.inspectionSearchField}>
              <MaterialIcons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={s.inspectionSearchInput}
                placeholder="Search standards..."
                placeholderTextColor="#94a3b8"
                value={inspectionSearch}
                onChangeText={setInspectionSearch}
              />
              {inspectionSearch ? (
                <TouchableOpacity onPress={() => setInspectionSearch('')}>
                  <MaterialIcons name="close" size={14} color="#64748b" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Personnel Submission Status Quick Filter Chips (Inspection Modal) */}
          {isPersonnel && (
            <View style={s.submissionFilterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.submissionFilterScroll}
              >
                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'all' && s.submissionFilterChipActiveAll,
                  ]}
                  onPress={() => setSubmissionFilter('all')}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'all' && s.submissionFilterChipTextActiveAll,
                    ]}
                  >
                    All ({submissionCounts.total})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'rejected' && s.submissionFilterChipActiveRejected,
                  ]}
                  onPress={() => setSubmissionFilter('rejected')}
                  activeOpacity={0.75}
                >
                  <View style={[s.submissionDot, { backgroundColor: '#ef4444' }]} />
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'rejected' && s.submissionFilterChipTextActiveRejected,
                    ]}
                  >
                    Needs Revision {submissionCounts.rejected > 0 ? `(${submissionCounts.rejected})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'pending' && s.submissionFilterChipActivePending,
                  ]}
                  onPress={() => setSubmissionFilter('pending')}
                  activeOpacity={0.75}
                >
                  <View style={[s.submissionDot, { backgroundColor: '#f59e0b' }]} />
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'pending' && s.submissionFilterChipTextActivePending,
                    ]}
                  >
                    Under Review {submissionCounts.pending > 0 ? `(${submissionCounts.pending})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'unsubmitted' && s.submissionFilterChipActiveUnsubmitted,
                  ]}
                  onPress={() => setSubmissionFilter('unsubmitted')}
                  activeOpacity={0.75}
                >
                  <View style={[s.submissionDot, { backgroundColor: '#94a3b8' }]} />
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'unsubmitted' && s.submissionFilterChipActiveUnsubmitted,
                    ]}
                  >
                    Unsubmitted {submissionCounts.unsubmitted > 0 ? `(${submissionCounts.unsubmitted})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'approved' && s.submissionFilterChipActiveApproved,
                  ]}
                  onPress={() => setSubmissionFilter('approved')}
                  activeOpacity={0.75}
                >
                  <View style={[s.submissionDot, { backgroundColor: '#10b981' }]} />
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'approved' && s.submissionFilterChipTextActiveApproved,
                    ]}
                  >
                    Approved {submissionCounts.approved > 0 ? `(${submissionCounts.approved})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.submissionFilterChip,
                    submissionFilter === 'priority' && s.submissionFilterChipActivePriority,
                  ]}
                  onPress={() => setSubmissionFilter('priority')}
                  activeOpacity={0.75}
                >
                  <MaterialIcons
                    name="sort"
                    size={14}
                    color={submissionFilter === 'priority' ? '#4f46e5' : '#64748b'}
                  />
                  <Text
                    style={[
                      s.submissionFilterChipText,
                      submissionFilter === 'priority' && s.submissionFilterChipTextActivePriority,
                    ]}
                  >
                    Attention First
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Standards Tree View */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          >
            {loadingOfficeReqs ? (
              <View style={s.loadingBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={s.loadingText}>Loading assigned standards...</Text>
              </View>
            ) : inspectionHierarchy.length === 0 ? (
              <View style={s.emptyCard}>
                <MaterialIcons name="assignment-late" size={40} color="#94a3b8" />
                <Text style={s.emptyTitle}>No Standards Found</Text>
                <Text style={s.emptySubtitle}>
                  No standards are assigned to this office or match your search criteria.
                </Text>
              </View>
            ) : (
              inspectionHierarchy.map((area) => {
                const isAreaExpanded = expandedAreaIds.has(area.areaid) || (Boolean(inspectionSearch) || (submissionFilter !== 'all' && submissionFilter !== 'priority'));
                const totalReqCount = area.criteriaList.reduce(
                  (sum: number, c: any) => sum + c.requirements.length,
                  0
                );

                return (
                  <View key={`insp-area-${area.areaid}`} style={s.inspectionAreaCard}>
                    {/* Royal Blue Area Bar (Screenshot 5) */}
                    <TouchableOpacity
                      style={s.areaRoyalBlueBar}
                      onPress={() => {
                        setExpandedAreaIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(area.areaid)) next.delete(area.areaid);
                          else next.add(area.areaid);
                          return next;
                        });
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.areaRoyalBlueCode}>{area.areacode}</Text>
                          <View style={s.areaItemsCountPill}>
                            <Text style={s.areaItemsCountPillText}>{totalReqCount} Items</Text>
                          </View>
                        </View>
                        <Text style={s.areaRoyalBlueTitle} numberOfLines={2}>
                          {area.areaname}
                        </Text>
                      </View>

                      {/* Collapse / Expand Button */}
                      <View style={s.collapsePillBtn}>
                        <Text style={s.collapsePillBtnText}>
                          {isAreaExpanded ? 'Collapse' : 'Expand'}
                        </Text>
                        <MaterialIcons
                          name={isAreaExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                          size={16}
                          color="#ffffff"
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Criteria and Standards inside Area */}
                    {isAreaExpanded && (
                      <View style={s.areaChildrenBox}>
                        {area.criteriaList.map((critEntry: any) => {
                          const crit = critEntry.criteria;
                          const reqs = critEntry.requirements;
                          const isCritExpanded = expandedCriteriaIds.has(crit.criteriaid) || (Boolean(inspectionSearch) || (submissionFilter !== 'all' && submissionFilter !== 'priority'));

                          return (
                            <View key={`insp-crit-${crit.criteriaid}`} style={s.criteriaSection}>
                              {/* Blue Criteria Bar */}
                              <TouchableOpacity
                                style={s.criteriaBlueBar}
                                onPress={() => {
                                  setExpandedCriteriaIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(crit.criteriaid)) next.delete(crit.criteriaid);
                                    else next.add(crit.criteriaid);
                                    return next;
                                  });
                                }}
                                activeOpacity={0.9}
                              >
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={s.criteriaCodeText}>{crit.criteriacode}</Text>
                                    <View style={s.critCountPill}>
                                      <Text style={s.critCountPillText}>{reqs.length}</Text>
                                    </View>
                                  </View>
                                  <Text style={s.criteriaNameText} numberOfLines={2}>
                                    {crit.criterianame}
                                  </Text>
                                </View>

                                <View style={s.collapsePillBtnSmall}>
                                  <Text style={s.collapsePillBtnText}>
                                    {isCritExpanded ? 'Collapse' : 'Expand'}
                                  </Text>
                                  <MaterialIcons
                                    name={isCritExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                                    size={14}
                                    color="#ffffff"
                                  />
                                </View>
                              </TouchableOpacity>

                              {/* Standards / Requirements List */}
                              {isCritExpanded && (
                                <View style={s.requirementsListBox}>
                                  {reqs.map((req: any) => {
                                    const reqId = Number(req.requirementid);
                                    const sId = Number(req.ComplianceStatusID ?? req.status ?? 3);
                                    const assignedPersonnel = assignedUsersMap[reqId] || [];
                                    const hasRejected = assignedPersonnel.some(
                                      (u: any) => u.hasrejected === true || Number(u.rejectedcount) > 0
                                    );
                                    const isExpanded = expandedReqIds.has(reqId);
                                    const desc = req.Description || req.description || '';
                                    const shouldShowToggle = desc.length > 110;

                                    return (
                                      <TouchableOpacity
                                        key={`insp-req-${reqId}`}
                                        style={s.standardCard}
                                        activeOpacity={0.7}
                                        onPress={() => setEvidencePanelReq(req)}
                                      >
                                        <View style={s.standardCardMainRow}>
                                          {/* Left Column: Fixed-width Compliance Status Badge */}
                                          <View style={s.statusCol}>
                                            <View
                                              style={[
                                                s.statusDotBadge,
                                                sId === 5
                                                  ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                                                  : sId === 4
                                                  ? { backgroundColor: '#fffbeb', borderColor: '#fde68a' }
                                                  : { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
                                              ]}
                                            >
                                              <View
                                                style={[
                                                  s.statusDotSmall,
                                                  sId === 5
                                                    ? { backgroundColor: '#059669' }
                                                    : sId === 4
                                                    ? { backgroundColor: '#d97706' }
                                                    : { backgroundColor: '#dc2626' },
                                                ]}
                                              />
                                              <Text
                                                numberOfLines={1}
                                                style={[
                                                  s.statusDotBadgeText,
                                                  sId === 5
                                                    ? { color: '#059669' }
                                                    : sId === 4
                                                    ? { color: '#d97706' }
                                                    : { color: '#dc2626' },
                                                ]}
                                              >
                                                {sId === 5
                                                  ? 'Complied'
                                                  : sId === 4
                                                  ? 'Partial'
                                                  : 'Not Complied'}
                                              </Text>
                                            </View>
                                          </View>

                                          {/* Center Column: Code, Active / Needs Revision pills, Description, Show more */}
                                          <View style={s.standardContentCol}>
                                            <View style={s.standardCodeBadgesRow}>
                                              <Text style={s.standardCodeText}>
                                                {req.requirementcode || `REQ-${reqId}`}
                                              </Text>
                                              <View style={s.activeBadge}>
                                                <View style={s.activeBadgeDot} />
                                                <Text style={s.activeBadgeText}>Active</Text>
                                              </View>
                                              {hasRejected && (
                                                <View style={s.needsRevisionBadge}>
                                                  <View style={s.needsRevisionBadgeDot} />
                                                  <Text style={s.needsRevisionBadgeText}>Needs Revision</Text>
                                                </View>
                                              )}
                                            </View>

                                            {/* Standard Description */}
                                            <Text
                                              style={s.standardDescText}
                                              numberOfLines={isExpanded ? undefined : 2}
                                            >
                                              {desc || 'Standard requirement'}
                                            </Text>

                                            {/* Show more / Show less toggle */}
                                            {shouldShowToggle && (
                                              <TouchableOpacity
                                                style={s.showMoreBtn}
                                                onPress={() => toggleExpandReq(reqId)}
                                                activeOpacity={0.7}
                                              >
                                                <Text style={s.showMoreText}>
                                                  {isExpanded ? 'Show less' : 'Show more'}
                                                </Text>
                                              </TouchableOpacity>
                                            )}
                                          </View>

                                          {/* Right: Submitter Avatars + Auditor evaluate */}
                                          <View style={s.standardAssigneeAvatars}>
                                            {!isPersonnel && assignedPersonnel.length > 0 && (
                                              <View style={s.avatarStackRow}>
                                                {assignedPersonnel.slice(0, 3).map((u: any, idx: number) => {
                                                  const picUrl = getAvatarUrl(u);
                                                  const uRejected = u.hasrejected === true || Number(u.rejectedcount) > 0;
                                                  const uUploaded = u.hasuploaded === 1 || u.hasuploaded === true;
                                                  const uName = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.Username || 'U';

                                                  return (
                                                    <View key={`u-av-${u.userid || idx}`} style={s.avatarWrapper}>
                                                      <SmartUserAvatar
                                                        user={u}
                                                        src={picUrl}
                                                        fullName={uName}
                                                        size={22}
                                                        textSize={8}
                                                        ring={uRejected ? '#ef4444' : uUploaded ? '#10b981' : '#e2e8f0'}
                                                      />

                                                      

                                                      {/* Badge Overlay: Admins see normal check/reject badge */}
                                                      {isPersonnel ? null : uRejected ? (
                                                        <View style={s.avatarRejectBadge}>
                                                          <MaterialIcons name="close" size={8} color="#ffffff" />
                                                        </View>
                                                      ) : uUploaded ? (
                                                        <View style={s.avatarCheckBadge}>
                                                          <MaterialIcons name="check" size={8} color="#ffffff" />
                                                        </View>
                                                      ) : null}
                                                    </View>
                                                  );
                                                })}
                                              </View>
                                            )}

                                            {/* For Personnel: show file status badges (e.g. 7 approved, 3 pending, 5 rejected) */}
                                            {isPersonnel && assignedPersonnel.length > 0 && (() => {
                                              const u = assignedPersonnel.find((p: any) => Number(p.userid) === currentUid) || assignedPersonnel[0];
                                              const totalFiles = Number(u.totalfiles || 0);
                                              const approvedCount = totalFiles > 0 ? Number(u.approvedcount || 0) : 0;
                                              const pendingCount = totalFiles > 0 ? Number(u.pendingcount || 0) : 0;
                                              const rejectedCount = totalFiles > 0 ? Number(u.rejectedcount || 0) : 0;

                                              return (
                                                <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginRight: 6 }}>
                                                  {approvedCount > 0 && (
                                                    <View style={s.statBadgeApproved}>
                                                      <View style={s.statDotApproved} />
                                                      <Text style={s.statBadgeTextApproved}>{approvedCount} approved</Text>
                                                    </View>
                                                  )}
                                                  {pendingCount > 0 && (
                                                    <View style={s.statBadgePending}>
                                                      <View style={s.statDotPending} />
                                                      <Text style={s.statBadgeTextPending}>{pendingCount} pending</Text>
                                                    </View>
                                                  )}
                                                  {rejectedCount > 0 && (
                                                    <View style={s.statBadgeRejected}>
                                                      <View style={s.statDotRejected} />
                                                      <Text style={s.statBadgeTextRejected}>{rejectedCount} rejected</Text>
                                                    </View>
                                                  )}
                                                  {totalFiles === 0 && (
                                                    <View style={s.statBadgeEmpty}>
                                                      <Text style={s.statBadgeTextEmpty}>0 files</Text>
                                                    </View>
                                                  )}
                                                </View>
                                              );
                                            })()}

                                            {isAuditor && (
                                              <TouchableOpacity
                                                style={s.evaluateIconBtn}
                                                onPress={(e) => {
                                                  e.stopPropagation?.();
                                                  setEvaluatingReq(req);
                                                  setEvalStatusId(sId);
                                                  setEvalComments(req.Comments || req.comments || '');
                                                }}
                                              >
                                                <MaterialIcons name="rate-review" size={14} color="#059669" />
                                              </TouchableOpacity>
                                            )}
                                          </View>
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          AUDITOR EVALUATION MODAL (When evaluating inside office inspection)
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(evaluatingReq)}
        transparent
        animationType="fade"
        onRequestClose={() => setEvaluatingReq(null)}
      >
        <View style={s.evalModalOverlay}>
          <View style={s.evalModalCard}>
            <View style={s.evalModalHeader}>
              <Text style={s.evalModalTitle}>Evaluate Standard</Text>
              <TouchableOpacity onPress={() => setEvaluatingReq(null)}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.evalReqCode}>
              {evaluatingReq?.requirementcode || `REQ-${evaluatingReq?.requirementid}`}
            </Text>
            <Text style={s.evalReqDesc} numberOfLines={3}>
              {evaluatingReq?.Description || evaluatingReq?.description}
            </Text>

            <Text style={s.evalLabel}>Compliance Status:</Text>
            <View style={s.evalStatusOptionsRow}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = evalStatusId === opt.id;
                return (
                  <TouchableOpacity
                    key={`eval-opt-${opt.id}`}
                    style={[
                      s.evalStatusOptionBtn,
                      isSelected && {
                        backgroundColor: opt.bg,
                        borderColor: opt.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setEvalStatusId(opt.id)}
                  >
                    <View
                      style={[
                        s.statusDotSmall,
                        { backgroundColor: opt.color, marginRight: 6 },
                      ]}
                    />
                    <Text
                      style={[
                        s.evalStatusOptionText,
                        isSelected && { color: opt.color, fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.evalLabel}>Auditor Comments / Recommendations:</Text>
            <TextInput
              style={s.evalCommentsInput}
              placeholder="Add evaluation findings..."
              placeholderTextColor="#94a3b8"
              multiline
              value={evalComments}
              onChangeText={setEvalComments}
            />

            <View style={s.evalActionsRow}>
              <TouchableOpacity
                style={s.evalCancelBtn}
                onPress={() => setEvaluatingReq(null)}
              >
                <Text style={s.evalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.evalSaveBtn}
                onPress={handleSaveEvaluation}
                disabled={evalSaving}
              >
                {evalSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={s.evalSaveBtnText}>Save Assessment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Evidence Files Panel Modal ─── */}
      {evidencePanelReq && (
        <EvidenceFilesPanel
          visible={Boolean(evidencePanelReq)}
          requirement={evidencePanelReq}
          isAuditor={isAuditor}
          currentUser={currentUser}
          officeId={getOfficeId(selectedOfficeForInspection)}
          onClose={() => setEvidencePanelReq(null)}
          onViewFile={(f) => setLightboxFile(f)}
          onRefreshRequirements={() => {
            if (selectedOfficeForInspection) {
              void openOfficeInspection(selectedOfficeForInspection, { silent: true });
            }
          }}
        />
      )}

      {/* ─── Lightbox Modal ─── */}
      {lightboxFile && (
        <UserFileLightbox
          visible={Boolean(lightboxFile)}
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </View>
  );
}

/**
 * Helper to render individual Office / Program card (Screenshot 1: Academic Track, Finance, Registrar)
 */
function renderOfficeCard(
  office: any,
  viewMode: 'grid' | 'list',
  onPress: (o: any) => void
) {
  const isAcademic = isAcademicEntity(office);
  const totalReqs = Number(office.totalrequirements || office.total_requirements || 0);
  const compliance = Math.max(0, Math.min(100, Number(office.compliancepercent || 0)));
  const statusStr = String(office.overallstatus || 'Not Complied');
  const isComplied = statusStr.toLowerCase().includes('complied') && !statusStr.toLowerCase().includes('not') && !statusStr.toLowerCase().includes('partial');
  const isPartial = statusStr.toLowerCase().includes('partial');

  const headsList = Array.isArray(office.heads) ? office.heads : [];
  const auditorsList = Array.isArray(office.auditors) ? office.auditors : [];

  return (
    <TouchableOpacity
      key={`office-card-${getOfficeId(office)}`}
      style={s.programCard}
      onPress={() => onPress(office)}
      activeOpacity={0.85}
    >
      {/* Header: Icon, Title, Badges */}
      <View style={s.programCardHeader}>
        <View style={[s.programIconBox, isAcademic ? s.academicIconBg : s.nonAcademicIconBg]}>
          <MaterialIcons
            name={isAcademic ? 'school' : 'apartment'}
            size={22}
            color={isAcademic ? '#0284c7' : '#059669'}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <Text style={s.programCardTitle} numberOfLines={2}>
              {office.officename}
            </Text>

            {/* Badges on Right */}
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isAcademic && office.accreditationlevel && office.accreditationlevel !== 'None' ? (
                <View style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>{office.accreditationlevel}</Text>
                </View>
              ) : null}
              <View style={[s.typeBadge, isAcademic ? s.academicTypeBadge : s.nonAcademicTypeBadge]}>
                <Text style={isAcademic ? s.academicTypeBadgeText : s.nonAcademicTypeBadgeText}>
                  {office.office_type_name || (isAcademic ? 'Academic' : 'Non Academic')}
                </Text>
              </View>
            </View>
          </View>

          {/* Subtitles: Event Code & Department */}
          <Text style={s.programCardEventCode}>
            {office.eventcode || 'PACUCOA 2027'}
            {office.department_name ? ` • ${office.department_name}` : ''}
          </Text>
        </View>
      </View>

      {/* Dates: Created & Updated (Screenshot 1) */}
      <View style={s.cardDatesRow}>
        <Text style={s.cardDateText}>CREATED: {formatDate(office.createdat)}</Text>
        <Text style={s.cardDateText}>UPDATED: {formatDate(office.updatedat || office.createdat)}</Text>
      </View>

      {/* Standards & Compliance Progress Box (Screenshot 1) */}
      <View style={s.complianceBox}>
        <View style={s.complianceHeaderRow}>
          <Text style={s.standardsCountText}>
            {totalReqs} {totalReqs === 1 ? 'standard' : 'standards'}
          </Text>

          {/* Status Pill Badge */}
          <View
            style={[
              s.cardStatusPill,
              isComplied
                ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                : isPartial
                ? { backgroundColor: '#fffbeb', borderColor: '#fde68a' }
                : { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
            ]}
          >
            <View
              style={[
                s.statusDotSmall,
                isComplied
                  ? { backgroundColor: '#059669' }
                  : isPartial
                  ? { backgroundColor: '#d97706' }
                  : { backgroundColor: '#dc2626' },
              ]}
            />
            <Text
              style={[
                s.cardStatusPillText,
                isComplied
                  ? { color: '#059669' }
                  : isPartial
                  ? { color: '#d97706' }
                  : { color: '#dc2626' },
              ]}
            >
              {isComplied ? 'Complied' : isPartial ? 'Partial' : 'Not Complied'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View
            style={[
              s.progressBar,
              {
                width: `${totalReqs === 0 ? 0 : compliance}%`,
                backgroundColor: isComplied ? '#059669' : isPartial ? '#d97706' : '#2563eb',
              },
            ]}
          />
        </View>
        <View style={s.progressLabelRow}>
          <Text style={s.progressLabelText}>Compliance</Text>
          <Text style={s.progressPercentText}>{compliance.toFixed(1)}%</Text>
        </View>
      </View>

      {/* Avatars Row: Personnel & Auditor (Screenshot 1) */}
      <View style={s.cardAvatarsRow}>
        {/* Personnel Group */}
        <View style={{ flex: 1 }}>
          <Text style={s.avatarGroupLabel}>
            Personnel {headsList.length > 0 ? headsList.length : ''}
          </Text>
          <View style={s.avatarsCluster}>
            {headsList.length === 0 ? (
              <View style={s.unassignedAvatar}>
                <Text style={s.unassignedAvatarText}>Unassigned</Text>
              </View>
            ) : (
              headsList.slice(0, 3).map((head: any, i: number) => {
                const firstName = (head.full_name || head.firstname || 'User').split(' ')[0];
                return (
                  <View key={`hd-${i}`} style={s.avatarItem}>
                    <SmartUserAvatar
                      user={head}
                      size={28}
                      textSize={10}
                      ring="#dbeafe"
                    />
                    <Text style={s.avatarName} numberOfLines={1}>
                      {firstName}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Auditor Group */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.avatarGroupLabel}>
            Auditor {auditorsList.length > 0 ? auditorsList.length : ''}
          </Text>
          <View style={s.avatarsCluster}>
            {auditorsList.length === 0 ? (
              <View style={[s.avatarCircle, { backgroundColor: '#0284c7' }]}>
                <Text style={s.avatarInitials}>VJ</Text>
              </View>
            ) : (
              auditorsList.slice(0, 2).map((aud: any, i: number) => {
                const firstName = (aud.full_name || aud.firstname || 'Auditor').split(' ')[0];
                return (
                  <View key={`aud-${i}`} style={s.avatarItem}>
                    <SmartUserAvatar
                      user={aud}
                      size={28}
                      textSize={10}
                      ring="#dbeafe"
                    />
                    <Text style={s.avatarName} numberOfLines={1}>
                      {firstName}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 10,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  breadcrumbSeparator: {
    fontSize: 12,
    color: '#94a3b8',
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  roleBadgePill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  bannerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  toolbarCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    position: 'relative',
    zIndex: 10,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  filtersScrollRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  dropdownBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginRight: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  viewModeToggleGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  viewModeBtnActive: {
    backgroundColor: '#eff6ff',
  },
  popoverMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 6,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  popoverItemActive: {
    backgroundColor: '#eff6ff',
  },
  popoverItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  popoverItemTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  eventSelectorRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  activeEventTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  eventActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activeEventCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
  },
  activeEventsPickerBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    marginTop: 6,
  },
  pickerHeaderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  eventPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  eventPickerItemActive: {
    backgroundColor: '#eff6ff',
  },
  eventPickerItemText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    marginLeft: 8,
  },
  eventPickerItemTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  sectionContainer: {
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  sectionCountPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sectionCountPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
  },
  deptCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 12,
  },
  deptHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 10,
  },
  deptIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  deptSubtitleText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  deptCountPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  deptCountPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
  },
  deptProgramsContainer: {
    padding: 10,
    gap: 10,
    backgroundColor: '#fafbfc',
  },
  programCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  programIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  academicIconBg: {
    backgroundColor: '#f0f9ff',
    borderColor: '#e0f2fe',
  },
  nonAcademicIconBg: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  programCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  programCardEventCode: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  typeBadge: {
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  academicTypeBadge: {
    backgroundColor: '#eef2ff',
    borderColor: '#e0e7ff',
  },
  academicTypeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4f46e5',
  },
  nonAcademicTypeBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  nonAcademicTypeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  cardDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
    paddingTop: 6,
  },
  cardDateText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  complianceBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  complianceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standardsCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  cardStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  cardStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  progressLabelText: {
    fontSize: 9,
    color: '#64748b',
  },
  progressPercentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e293b',
  },
  cardAvatarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
    paddingTop: 6,
  },
  avatarGroupLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  avatarsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarItem: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarInitials: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  avatarName: {
    fontSize: 8,
    color: '#64748b',
    maxWidth: 44,
    marginTop: 2,
  },
  unassignedAvatar: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  unassignedAvatarText: {
    fontSize: 9,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },

  /* ─── Inspection Modal Styles (Screenshot 5) ─── */
  inspectionContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  inspectionHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectionHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  inspectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  inspectionHeaderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  tagBadgePill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagBadgePillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  inspectionCloseBtn: {
    padding: 4,
  },
  inspectionMetaBox: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeftGroup: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  metaRightGroup: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  complianceBigText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 1,
  },
  statusPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusPillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  standardsControlsBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  standardsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  standardsSectionSubtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  inspectionSearchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
    marginTop: 6,
  },
  inspectionSearchInput: {
    flex: 1,
    marginLeft: 4,
    fontSize: 11,
    color: '#0f172a',
    paddingVertical: 0,
  },
  inspectionAreaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  areaRoyalBlueBar: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaRoyalBlueCode: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  areaItemsCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  areaItemsCountPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  areaRoyalBlueTitle: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    marginTop: 2,
  },
  collapsePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  collapsePillBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  collapsePillBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 2,
  },
  areaChildrenBox: {
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  criteriaSection: {
    marginBottom: 8,
  },
  criteriaBlueBar: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  criteriaCodeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  critCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  critCountPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  criteriaNameText: {
    fontSize: 11,
    color: '#ffffff',
    marginTop: 2,
  },
  requirementsListBox: {
    marginTop: 6,
    paddingLeft: 4,
    gap: 6,
  },
  standardCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  standardCardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  statusCol: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  statusDotBadge: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 4,
  },
  statusDotBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  standardContentCol: {
    flex: 1,
    minWidth: 0,
  },
  standardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  standardCodeBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  standardCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    gap: 4,
  },
  activeBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#06b6d4',
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0891b2',
  },
  needsRevisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    gap: 4,
  },
  needsRevisionBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f43f5e',
  },
  needsRevisionBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#be123c',
  },
  standardAssigneeAvatars: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: 1,
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginLeft: -4,
  },
  submitterAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#f8fafc',
  },
  submitterAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitterAvatarInitials: {
    fontSize: 9,
    fontWeight: '800',
    color: '#334155',
  },
  avatarRejectBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evaluateIconBtn: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  standardDescText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginTop: 3,
  },
  showMoreBtn: {
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  standardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  evidenceUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  evidenceUploadBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  evaluateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  evaluateBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  /* ─── Evaluation Modal Styles ─── */
  evalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  evalModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  evalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  evalModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  evalReqCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 10,
  },
  evalReqDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  evalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 6,
  },
  evalStatusOptionsRow: {
    gap: 6,
  },
  evalStatusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  evalStatusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  evalCommentsInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  evalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  evalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  evalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  evalSaveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evalSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  statBadgeApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statDotApproved: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#059669',
  },
  statBadgeTextApproved: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  statBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statDotPending: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#d97706',
  },
  statBadgeTextPending: {
    fontSize: 9,
    fontWeight: '700',
    color: '#d97706',
  },
  statBadgeRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statDotRejected: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#dc2626',
  },
  statBadgeTextRejected: {
    fontSize: 9,
    fontWeight: '700',
    color: '#dc2626',
  },
  statBadgeEmpty: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statBadgeTextEmpty: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  submissionFilterWrap: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  submissionFilterScroll: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  submissionFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  submissionFilterChipActiveAll: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  submissionFilterChipActiveRejected: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  submissionFilterChipActivePending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  submissionFilterChipActiveUnsubmitted: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  submissionFilterChipActiveApproved: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  submissionFilterChipActivePriority: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  submissionFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  submissionFilterChipTextActiveAll: {
    color: '#2563eb',
    fontWeight: '700',
  },
  submissionFilterChipTextActiveRejected: {
    color: '#dc2626',
    fontWeight: '700',
  },
  submissionFilterChipTextActivePending: {
    color: '#d97706',
    fontWeight: '700',
  },
  submissionFilterChipTextActiveUnsubmitted: {
    color: '#475569',
    fontWeight: '700',
  },
  submissionFilterChipTextActiveApproved: {
    color: '#059669',
    fontWeight: '700',
  },
  submissionFilterChipTextActivePriority: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  submissionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
