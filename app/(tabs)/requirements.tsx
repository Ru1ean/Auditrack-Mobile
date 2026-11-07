import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import SmartUserAvatar from '../../components/SmartUserAvatar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  criteriaAPI,
  eventsAPI,
  getDeadlineInfo,
  getProfilePicUrl,
  getStoredUser,
  normalizeUser,
  officesAPI,
  personnelAssignmentsAPI,
  requirementsAPI,
  storeUser,
  usersAPI,
} from '../../components/connect';
import EvidenceFilesPanel from '../../components/evidence-files-panel';
import UserFileLightbox from '../../components/user-file-lightbox';

type StatusFilter = 'all' | 'complied' | 'partially' | 'not_complied' | 'my_assigned';

const STATUS_OPTIONS = [
  { id: 3, label: 'Not Complied', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 4, label: 'Partially Complied', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 5, label: 'Complied', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
];

const getEntityId = (obj: any, preferredKey?: string) => {
  if (!obj) return 0;
  if (preferredKey && obj[preferredKey] !== undefined) return Number(obj[preferredKey]);
  return Number(
    obj.requirementid ??
      obj.RequirementID ??
      obj.criteriaid ??
      obj.CriteriaID ??
      obj.areaid ??
      obj.AreaID ??
      obj.eventid ??
      obj.EventID ??
      obj.officeid ??
      obj.OfficeID ??
      obj.id ??
      0
  );
};

const formatDateString = (dateStr: any) => {
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

export default function RequirementsStandardsScreen() {
  const notifParams = useLocalSearchParams<{
    fromNotif?: string;
    eventid?: string;
    areaid?: string;
    requirementid?: string;
    openSubmission?: string;
    notifTs?: string;
  }>();
  const lastHandledNotifTsRef = useRef<string>('');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Main Accreditation Screen State
  const [events, setEvents] = useState<any[]>([]);
  const [mainSearchTerm, setMainSearchTerm] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'active' | 'inactive'>('active');
  const [showStatusFilterMenu, setShowStatusFilterMenu] = useState(false);

  // Auditor & Personnel Assignment Tracking
  const [auditorAssignedAreaIds, setAuditorAssignedAreaIds] = useState<Set<number>>(new Set());
  const [auditorAssignedEventIds, setAuditorAssignedEventIds] = useState<Set<number>>(new Set());
  const [auditorAssignmentsRaw, setAuditorAssignmentsRaw] = useState<any[]>([]);

  const [myAssignedAreaIds, setMyAssignedAreaIds] = useState<Set<number>>(new Set());
  const [myAssignedCriteriaIds, setMyAssignedCriteriaIds] = useState<Set<number>>(new Set());
  const [myAssignedReqIds, setMyAssignedReqIds] = useState<Set<number>>(new Set());

  // Structure Workspace Modal State (Opened via "Open Structure >")
  const [selectedEventForStructure, setSelectedEventForStructure] = useState<any | null>(null);
  const [structureTab, setStructureTab] = useState<'areas' | 'offices'>('areas');
  const [structureSearch, setStructureSearch] = useState('');
  const [loadingStructure, setLoadingStructure] = useState(false);

  // Hierarchy Data for the opened event
  const [areas, setAreas] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [personnelAssignments, setPersonnelAssignments] = useState<any[]>([]);

  // Expanded Nodes in Structure Tree
  const [expandedAreaIds, setExpandedAreaIds] = useState<Set<number>>(new Set());
  const [expandedCriteriaIds, setExpandedCriteriaIds] = useState<Set<number>>(new Set());
  const [expandedReqIds, setExpandedReqIds] = useState<Set<number>>(new Set());

  const toggleExpandReq = (reqId: number) => {
    setExpandedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  // Programs and Offices Tab State
  const [offices, setOffices] = useState<any[]>([]);
  const [officeSearch, setOfficeSearch] = useState('');
  const [activeOfficeTab, setActiveOfficeTab] = useState<'All' | 'Programs' | 'Offices'>('All');

  // Evidence Files Panel & Lightbox
  const [evidencePanelReq, setEvidencePanelReq] = useState<any | null>(null);
  const [lightboxFile, setLightboxFile] = useState<{ url: string; fileName: string } | null>(null);
  const [myFileStatsByReq, setMyFileStatsByReq] = useState<Record<number, any>>({});
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'rejected' | 'pending' | 'unsubmitted' | 'approved' | 'priority'>('all');

  // Auditor Status Evaluation Modal
  const [evaluatingReq, setEvaluatingReq] = useState<any | null>(null);
  const [evalStatusId, setEvalStatusId] = useState<number>(3);
  const [evalComments, setEvalComments] = useState<string>('');
  const [evalSaving, setEvalSaving] = useState(false);

  const isAdmin = Boolean(currentUser?.isAdmin || currentUser?.roleid === 1);
  const isAuditor = Boolean(currentUser?.isAuditor);
  const isPersonnel = Boolean(currentUser?.isPersonnel || (!isAdmin && !isAuditor));
  const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);

  // Load Current User
  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const u = res?.user ? normalizeUser(res.user) : null;
      if (u) {
        setCurrentUser(u);
        await storeUser(u);
        return u;
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

  // Fetch Main Screen Events and Assignments
  const loadMainData = useCallback(async () => {
    try {
      const u = await loadUser();
      const userId = Number(u?.userid || 0);
      const userIsAuditor = Boolean(u?.isAuditor);

      // 1. Fetch Events & Offices
      const [eventsRes, officesRes] = await Promise.all([
        eventsAPI.getAllEvents().catch(() => []),
        officesAPI.getAll().catch(() => []),
      ]);

      const allEvents = Array.isArray(eventsRes?.data)
        ? eventsRes.data
        : Array.isArray(eventsRes)
        ? eventsRes
        : [];
      const allOffices = Array.isArray(officesRes?.data)
        ? officesRes.data
        : Array.isArray(officesRes)
        ? officesRes
        : [];

      setOffices(allOffices);

      // 2. Fetch Auditor Assignments if Auditor
      let assignedEvtIds = new Set<number>();
      let assignedArIds = new Set<number>();
      if (userIsAuditor && userId) {
        try {
          const assignRes = await areasAPI.getAuditorAssignments(userId);
          const raw = Array.isArray(assignRes?.assignments)
            ? assignRes.assignments
            : Array.isArray(assignRes?.data)
            ? assignRes.data
            : [];
          setAuditorAssignmentsRaw(raw);
          assignedArIds = new Set(raw.map((a: any) => Number(a.areaid ?? a.AreaID)).filter(Boolean));
          assignedEvtIds = new Set(raw.map((a: any) => Number(a.eventid ?? a.EventID)).filter(Boolean));
          setAuditorAssignedAreaIds(assignedArIds);
          setAuditorAssignedEventIds(assignedEvtIds);
        } catch (e) {
          console.warn('Failed to load auditor assignments:', e);
        }
      }

      // 3. Fetch Personnel Assignments if Personnel
      if (!userIsAuditor && userId) {
        try {
          const [myPaRes, myReqRes] = await Promise.all([
            personnelAssignmentsAPI.getMyAssignments().catch(() => null),
            requirementsAPI.getMyAssignments().catch(() => null),
          ]);

          const paAreaIds = Array.isArray(myPaRes?.assignedAreaIds)
            ? myPaRes.assignedAreaIds.map(Number)
            : [];
          const paCritIds = Array.isArray(myPaRes?.assignedCriteriaIds)
            ? myPaRes.assignedCriteriaIds.map(Number)
            : [];
          const paReqIds = Array.isArray(myPaRes?.assignedRequirementIds)
            ? myPaRes.assignedRequirementIds.map(Number)
            : [];
          const reqIds = Array.isArray(myReqRes?.data)
            ? myReqRes.data.map((r: any) => Number(r.requirementid || r.RequirementID))
            : [];

          setMyAssignedAreaIds(new Set(paAreaIds));
          setMyAssignedCriteriaIds(new Set(paCritIds));
          setMyAssignedReqIds(new Set([...paReqIds, ...reqIds]));
          if (myReqRes?.fileStatsByReq) {
            setMyFileStatsByReq(myReqRes.fileStatsByReq);
          }
        } catch (e) {
          console.warn('Failed to load personnel assignments:', e);
        }
      }

      // Filter events if auditor has specific event assignments
      const visibleEvents =
        userIsAuditor && assignedEvtIds.size > 0
          ? allEvents.filter((ev: any) => assignedEvtIds.has(getEntityId(ev, 'eventid')))
          : allEvents;

      setEvents(visibleEvents);
    } catch (err) {
      console.error('Error loading main data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadUser]);

  useEffect(() => {
    void loadMainData();

    // Refresh main data on foreground return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !selectedEventForStructure) {
        void loadMainData();
      }
    });
    return () => sub.remove();
  }, [loadMainData, selectedEventForStructure]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadMainData();
  };

  // Refresh Event Structure data (with silent support)
  const refreshStructureData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedEventForStructure) return;
      const isSilent = Boolean(options?.silent);
      if (!isSilent) {
        setLoadingStructure(true);
      }

      const eventId = String(getEntityId(selectedEventForStructure, 'eventid'));
      try {
        const [areasRes, critRes, reqRes, paRes, myReqRes] = await Promise.all([
          areasAPI.getByEvent(eventId).catch(() => []),
          criteriaAPI.getByEvent(eventId).catch(() => []),
          requirementsAPI.getAllRequirements(eventId).catch(() => []),
          personnelAssignmentsAPI.getByEvent(eventId).catch(() => null),
          requirementsAPI.getMyAssignments().catch(() => null),
        ]);

        const areasList = Array.isArray(areasRes?.data)
          ? areasRes.data
          : Array.isArray(areasRes)
          ? areasRes
          : [];
        const critList = Array.isArray(critRes?.data)
          ? critRes.data
          : Array.isArray(critRes)
          ? critRes
          : [];
        const reqList = Array.isArray(reqRes?.data)
          ? reqRes.data
          : Array.isArray(reqRes)
          ? reqRes
          : [];
        const paList = Array.isArray(paRes?.data) ? paRes.data : [];

        setAreas(areasList);
        setCriteria(critList);
        setRequirements(reqList);
        setPersonnelAssignments(paList);

        if (myReqRes?.fileStatsByReq) {
          setMyFileStatsByReq(myReqRes.fileStatsByReq);
        }
      } catch (err) {
        if (!isSilent) {
          console.error('Error refreshing event structure:', err);
        }
      } finally {
        if (!isSilent) {
          setLoadingStructure(false);
        }
      }
    },
    [selectedEventForStructure]
  );

  // Live polling while Event Structure is open
  useEffect(() => {
    if (!selectedEventForStructure) return;

    // Silent background poll every 3 seconds while viewing structure
    const pollInterval = setInterval(() => {
      void refreshStructureData({ silent: true });
    }, 3000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshStructureData({ silent: true });
      }
    });

    return () => {
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, [selectedEventForStructure, refreshStructureData]);

  // Load Event Structure when an Accreditation Card's "Open Structure >" is tapped
  const openEventStructure = async (
    event: any,
    deepLink?: {
      areaid?: number | string | null;
      requirementid?: number | string | null;
      openSubmission?: boolean;
    }
  ) => {
    setSelectedEventForStructure(event);
    setStructureTab('areas');
    setStructureSearch('');
    setLoadingStructure(true);

    const eventId = String(getEntityId(event, 'eventid'));
    try {
      const [areasRes, critRes, reqRes, paRes, myReqRes] = await Promise.all([
        areasAPI.getByEvent(eventId).catch(() => []),
        criteriaAPI.getByEvent(eventId).catch(() => []),
        requirementsAPI.getAllRequirements(eventId).catch(() => []),
        personnelAssignmentsAPI.getByEvent(eventId).catch(() => null),
        requirementsAPI.getMyAssignments().catch(() => null),
      ]);

      const areasList = Array.isArray(areasRes?.data)
        ? areasRes.data
        : Array.isArray(areasRes)
        ? areasRes
        : [];
      const critList = Array.isArray(critRes?.data)
        ? critRes.data
        : Array.isArray(critRes)
        ? critRes
        : [];
      const reqList = Array.isArray(reqRes?.data)
        ? reqRes.data
        : Array.isArray(reqRes)
        ? reqRes
        : [];
      const paList = Array.isArray(paRes?.data) ? paRes.data : [];

      setAreas(areasList);
      setCriteria(critList);
      setRequirements(reqList);
      setPersonnelAssignments(paList);

      if (myReqRes?.fileStatsByReq) {
        setMyFileStatsByReq(myReqRes.fileStatsByReq);
      }

      // Default expand the first area or deep-linked area/requirement
      const targetReqId = Number(deepLink?.requirementid || 0);
      const targetAreaId = Number(deepLink?.areaid || 0);

      if (targetReqId > 0) {
        const matchedReq = reqList.find(
          (r: any) => getEntityId(r, 'requirementid') === targetReqId
        );
        if (matchedReq) {
          const cId = Number(matchedReq.criteriaid ?? matchedReq.CriteriaID ?? 0);
          const matchedCrit = critList.find(
            (c: any) => getEntityId(c, 'criteriaid') === cId
          );
          const aId = Number(
            matchedReq.areaid ??
              matchedReq.AreaID ??
              matchedCrit?.areaid ??
              matchedCrit?.AreaID ??
              targetAreaId ??
              0
          );
          if (aId) setExpandedAreaIds(new Set([aId]));
          if (cId) setExpandedCriteriaIds(new Set([cId]));
          setExpandedReqIds(new Set([targetReqId]));
          if (deepLink?.openSubmission !== false) {
            setEvidencePanelReq(matchedReq);
          }
        } else if (areasList.length > 0) {
          setExpandedAreaIds(new Set([getEntityId(areasList[0], 'areaid')]));
        }
      } else if (targetAreaId > 0) {
        setExpandedAreaIds(new Set([targetAreaId]));
      } else if (areasList.length > 0) {
        setExpandedAreaIds(new Set([getEntityId(areasList[0], 'areaid')]));
      }
    } catch (err) {
      console.error('Error opening event structure:', err);
      Alert.alert('Error', 'Unable to load accreditation structure.');
    } finally {
      setLoadingStructure(false);
    }
  };

  // Deep-link listener from Notifications (1:1 Match with Web ALLC.jsx)
  useEffect(() => {
    if (notifParams.fromNotif !== '1' || loading || events.length === 0) return;
    const tsKey = String(
      notifParams.notifTs ||
        `${notifParams.eventid}-${notifParams.areaid}-${notifParams.requirementid}`
    );
    if (lastHandledNotifTsRef.current === tsKey) return;

    const targetEventId = Number(notifParams.eventid || 0);
    const targetEvent =
      (targetEventId
        ? events.find((e) => getEntityId(e, 'eventid') === targetEventId)
        : null) || events[0];

    if (targetEvent) {
      lastHandledNotifTsRef.current = tsKey;
      void openEventStructure(targetEvent, {
        areaid: notifParams.areaid || null,
        requirementid: notifParams.requirementid || null,
        openSubmission: notifParams.openSubmission === '1',
      });
    }
  }, [
    notifParams.fromNotif,
    notifParams.eventid,
    notifParams.areaid,
    notifParams.requirementid,
    notifParams.openSubmission,
    notifParams.notifTs,
    loading,
    events,
  ]);

  // Map Personnel Assignments across Area, Criteria, and Standard levels
  const { assignedPersonnelMap } = useMemo(() => {
    const map = {
      areas: {} as Record<number, any[]>,
      criteria: {} as Record<number, any[]>,
      requirements: {} as Record<number, any[]>,
    };

    personnelAssignments.forEach((pa) => {
      const userObj = {
        userid: pa.userid,
        fullname:
          pa.fullname ||
          `${pa.firstname || ''} ${pa.lastname || ''}`.trim() ||
          pa.Email ||
          `User #${pa.userid}`,
        email: pa.Email || pa.email,
        profile_pic: pa.profile_pic || pa.ProfilePic || pa.profilepic,
      };

      if (pa.areaid) {
        const aid = Number(pa.areaid);
        if (!map.areas[aid]) map.areas[aid] = [];
        if (!map.areas[aid].some((u) => Number(u.userid) === Number(pa.userid))) {
          map.areas[aid].push(userObj);
        }
      } else if (pa.criteriaid) {
        const cid = Number(pa.criteriaid);
        if (!map.criteria[cid]) map.criteria[cid] = [];
        if (!map.criteria[cid].some((u) => Number(u.userid) === Number(pa.userid))) {
          map.criteria[cid].push(userObj);
        }
      } else if (pa.requirementid) {
        const rid = Number(pa.requirementid);
        if (!map.requirements[rid]) map.requirements[rid] = [];
        if (!map.requirements[rid].some((u) => Number(u.userid) === Number(pa.userid))) {
          map.requirements[rid].push(userObj);
        }
      }
    });

    return { assignedPersonnelMap: map };
  }, [personnelAssignments]);

  // Child Personnel for Area (Sub-items indicator)
  const getChildPersonnelForArea = useCallback(
    (areaId: number) => {
      const directUsers = assignedPersonnelMap.areas[areaId] || [];
      const directUserIds = new Set(directUsers.map((u) => Number(u.userid)));
      const childUsersMap = new Map<number, any>();

      const areaCritList = criteria.filter((c) => Number(c.areaid ?? c.AreaID) === areaId);
      areaCritList.forEach((crit) => {
        const cId = Number(crit.criteriaid ?? crit.CriteriaID);
        (assignedPersonnelMap.criteria[cId] || []).forEach((u) => {
          if (!directUserIds.has(Number(u.userid))) childUsersMap.set(Number(u.userid), u);
        });

        const cReqs = requirements.filter(
          (r) => Number(r.criteriaid ?? r.CriteriaID) === cId
        );
        cReqs.forEach((r) => {
          const rId = Number(r.requirementid ?? r.RequirementID);
          (assignedPersonnelMap.requirements[rId] || []).forEach((u) => {
            if (!directUserIds.has(Number(u.userid))) childUsersMap.set(Number(u.userid), u);
          });
        });
      });

      return Array.from(childUsersMap.values());
    },
    [assignedPersonnelMap, criteria, requirements]
  );

  // Inherited Personnel for Requirement
  const getInheritedPersonnelForReq = useCallback(
    (critId: number, areaId: number) => {
      const inherited: any[] = [];
      const seen = new Set<number>();

      (assignedPersonnelMap.criteria[critId] || []).forEach((u) => {
        if (!seen.has(Number(u.userid))) {
          seen.add(Number(u.userid));
          inherited.push({ ...u, source: 'Sub-area' });
        }
      });

      (assignedPersonnelMap.areas[areaId] || []).forEach((u) => {
        if (!seen.has(Number(u.userid))) {
          seen.add(Number(u.userid));
          inherited.push({ ...u, source: 'Area' });
        }
      });

      return inherited;
    },
    [assignedPersonnelMap]
  );

  // Assignment check helpers
  const isAreaAssignedToMe = useCallback(
    (areaId: number) => {
      if (isAuditor) return auditorAssignedAreaIds.has(areaId);
      return myAssignedAreaIds.has(areaId);
    },
    [isAuditor, auditorAssignedAreaIds, myAssignedAreaIds]
  );

  const isCriteriaAssignedToMe = useCallback(
    (critId: number, areaId: number) => {
      if (isAuditor) return auditorAssignedAreaIds.has(areaId);
      return myAssignedCriteriaIds.has(critId) || myAssignedAreaIds.has(areaId);
    },
    [isAuditor, auditorAssignedAreaIds, myAssignedCriteriaIds, myAssignedAreaIds]
  );

  const isRequirementAssignedToMe = useCallback(
    (reqId: number, critId: number, areaId: number) => {
      if (isAuditor) return auditorAssignedAreaIds.has(areaId);
      return (
        myAssignedReqIds.has(reqId) ||
        myAssignedCriteriaIds.has(critId) ||
        myAssignedAreaIds.has(areaId)
      );
    },
    [isAuditor, auditorAssignedAreaIds, myAssignedReqIds, myAssignedCriteriaIds, myAssignedAreaIds]
  );

  // Accordion Toggles
  const toggleAreaExpand = (areaId: number) => {
    setExpandedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const toggleCriteriaExpand = (critId: number) => {
    setExpandedCriteriaIds((prev) => {
      const next = new Set(prev);
      if (next.has(critId)) next.delete(critId);
      else next.add(critId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedAreaIds(new Set(areas.map((a) => getEntityId(a, 'areaid'))));
    setExpandedCriteriaIds(new Set(criteria.map((c) => getEntityId(c, 'criteriaid'))));
  };

  const collapseAll = () => {
    setExpandedAreaIds(new Set());
    setExpandedCriteriaIds(new Set());
  };

  // Filter Main Events List
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const status = String(e.status || e.Status || '').toLowerCase().trim();
      const isActive = status !== 'inactive';
      if (eventStatusFilter === 'active' && !isActive) return false;
      if (eventStatusFilter === 'inactive' && isActive) return false;

      if (!mainSearchTerm.trim()) return true;
      const q = mainSearchTerm.toLowerCase();
      const name = String(e.eventname || '').toLowerCase();
      const code = String(e.eventcode || '').toLowerCase();
      const desc = String(e.Description || e.description || '').toLowerCase();
      return name.includes(q) || code.includes(q) || desc.includes(q);
    });
  }, [events, eventStatusFilter, mainSearchTerm]);

  // Filter Programs and Offices List (Matching Image 2 Left Section)
  const filteredOffices = useMemo(() => {
    let list = offices || [];
    if (activeOfficeTab === 'Programs') {
      list = list.filter(
        (o) =>
          o.entitytypeid === 1 ||
          String(o.category_name || o.typename || '').toLowerCase().includes('academic') ||
          String(o.category_name || o.typename || '').toLowerCase().includes('program')
      );
    } else if (activeOfficeTab === 'Offices') {
      list = list.filter(
        (o) =>
          o.entitytypeid === 2 ||
          String(o.category_name || o.typename || '').toLowerCase().includes('non-academic') ||
          String(o.category_name || o.typename || '').toLowerCase().includes('office')
      );
    }

    if (!officeSearch.trim()) return list;
    const q = officeSearch.toLowerCase();
    return list.filter((o) => {
      const name = String(o.officename || '').toLowerCase();
      const dept = String(o.department_name || '').toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [offices, activeOfficeTab, officeSearch]);

  // Submission Filter counts & matching
  const submissionCounts = useMemo(() => {
    let rejected = 0;
    let pending = 0;
    let unsubmitted = 0;
    let approved = 0;

    requirements.forEach((r) => {
      const rId = getEntityId(r, 'requirementid');
      const stat = myFileStatsByReq[rId] || null;
      const totFiles = Number(stat?.totalfiles || 0);
      const rejCount = totFiles > 0 ? Number(stat?.rejectedcount || 0) : 0;
      const pendCount = totFiles > 0 ? Number(stat?.pendingcount || 0) : 0;
      const appCount = totFiles > 0 ? Number(stat?.approvedcount || 0) : 0;

      if (rejCount > 0) rejected++;
      if (pendCount > 0) pending++;
      if (totFiles === 0) unsubmitted++;
      if (appCount > 0) approved++;
    });

    return { rejected, pending, unsubmitted, approved, total: requirements.length };
  }, [requirements, myFileStatsByReq]);

  const matchesSubmission = useCallback((rId: number) => {
    if (submissionFilter === 'all' || submissionFilter === 'priority') return true;
    const stat = myFileStatsByReq[rId] || null;
    const totFiles = Number(stat?.totalfiles || 0);
    const rejCount = totFiles > 0 ? Number(stat?.rejectedcount || 0) : 0;
    const pendCount = totFiles > 0 ? Number(stat?.pendingcount || 0) : 0;
    const appCount = totFiles > 0 ? Number(stat?.approvedcount || 0) : 0;

    if (submissionFilter === 'rejected') return rejCount > 0;
    if (submissionFilter === 'pending') return pendCount > 0;
    if (submissionFilter === 'unsubmitted') return totFiles === 0;
    if (submissionFilter === 'approved') return appCount > 0;
    return true;
  }, [submissionFilter, myFileStatsByReq]);

  const matchesRequirement = useCallback((r: any) => {
    const rId = getEntityId(r, 'requirementid');
    if (!matchesSubmission(rId)) return false;
    const q = structureSearch.trim().toLowerCase();
    if (!q) return true;
    const code = String(r.requirementcode || '').toLowerCase();
    const desc = String(r.Description || r.description || '').toLowerCase();
    return code.includes(q) || desc.includes(q);
  }, [matchesSubmission, structureSearch]);

  // Filter Areas & Standards by Structure Search and Submission Filter
  const searchLower = structureSearch.trim().toLowerCase();
  const visibleAreas = useMemo(() => {
    if (!searchLower && (submissionFilter === 'all' || submissionFilter === 'priority')) return areas;
    return areas.filter((a) => {
      const aId = getEntityId(a, 'areaid');
      const aName = String(a.areaname || '').toLowerCase();
      const aCode = String(a.areacode || '').toLowerCase();

      const areaReqs = requirements.filter((r) => Number(r.areaid ?? r.AreaID) === aId);
      const matchedReqs = areaReqs.filter((r) => matchesRequirement(r));
      if (matchedReqs.length > 0) return true;

      if (searchLower && (aName.includes(searchLower) || aCode.includes(searchLower))) {
        if (submissionFilter === 'all' || submissionFilter === 'priority') return true;
        return areaReqs.some((r) => matchesSubmission(getEntityId(r, 'requirementid')));
      }

      return false;
    });
  }, [areas, requirements, searchLower, submissionFilter, matchesRequirement, matchesSubmission]);

  // Auditor Evaluation Save
  const handleSaveEvaluation = async () => {
    if (!evaluatingReq) return;
    setEvalSaving(true);
    const reqId = getEntityId(evaluatingReq, 'requirementid');
    try {
      await requirementsAPI.evaluateRequirement(
        String(reqId),
        evalStatusId,
        evalComments.trim()
      );
      setRequirements((prev) =>
        prev.map((r) =>
          getEntityId(r, 'requirementid') === reqId
            ? { ...r, compliancestatusid: evalStatusId, comment: evalComments.trim() }
            : r
        )
      );
      setEvaluatingReq(null);
      Alert.alert('Assessment Saved', 'Compliance rating and remarks updated successfully.');
    } catch (err: any) {
      Alert.alert('Evaluation Failed', err?.message || 'Could not update status.');
    } finally {
      setEvalSaving(false);
    }
  };

  return (
    <View style={s.container}>
      {/* ─── Main Content Scroll ─── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.mainScrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        {/* Title Banner (Matching Image 1) */}
        <View style={s.titleBanner}>
          <View style={s.titleIconBox}>
            <MaterialIcons name="verified" size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.bannerTitle}>Accreditation & Quality Standards</Text>
            <Text style={s.bannerSubtitle}>
              Manage accreditation frameworks, quality audit sub areas, and standard structures.
            </Text>
          </View>
        </View>

        {/* Filter Controls Row (Search + Active Standards Dropdown - Image 1 & 4) */}
        <View style={s.controlsRow}>
          <View style={s.searchBox}>
            <MaterialIcons name="search" size={18} color="#64748b" />
            <TextInput
              style={s.searchInput}
              placeholder="Search accreditations or codes..."
              placeholderTextColor="#94a3b8"
              value={mainSearchTerm}
              onChangeText={setMainSearchTerm}
            />
            {mainSearchTerm ? (
              <TouchableOpacity onPress={() => setMainSearchTerm('')}>
                <MaterialIcons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Status Dropdown Filter */}
          <TouchableOpacity
            style={s.statusFilterBtn}
            onPress={() => setShowStatusFilterMenu((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={s.statusFilterText}>
              {eventStatusFilter === 'active' ? 'Active Standards' : 'Inactive Standards'}
            </Text>
            <MaterialIcons
              name={showStatusFilterMenu ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* Status Dropdown Popover Menu (Matching Image 4) */}
        {showStatusFilterMenu && (
          <View style={s.statusDropdownMenu}>
            <TouchableOpacity
              style={[
                s.statusDropdownItem,
                eventStatusFilter === 'active' && s.statusDropdownItemActive,
              ]}
              onPress={() => {
                setEventStatusFilter('active');
                setShowStatusFilterMenu(false);
              }}
            >
              <Text
                style={[
                  s.statusDropdownItemText,
                  eventStatusFilter === 'active' && s.statusDropdownItemTextActive,
                ]}
              >
                Active Standards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.statusDropdownItem,
                eventStatusFilter === 'inactive' && s.statusDropdownItemActive,
              ]}
              onPress={() => {
                setEventStatusFilter('inactive');
                setShowStatusFilterMenu(false);
              }}
            >
              <Text
                style={[
                  s.statusDropdownItemText,
                  eventStatusFilter === 'inactive' && s.statusDropdownItemTextActive,
                ]}
              >
                Inactive Standards
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Accreditation Cards Grid (Matching Image 1 & EventCard.jsx) ─── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={s.loadingText}>Loading accreditation frameworks...</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={s.emptyCard}>
            <MaterialIcons name="folder-open" size={48} color="#94a3b8" />
            <Text style={s.emptyTitle}>No Accreditation Standards Found</Text>
            <Text style={s.emptySubtitle}>
              {mainSearchTerm
                ? 'No frameworks match your search query.'
                : 'No accreditation standards are currently available.'}
            </Text>
          </View>
        ) : (
          filteredEvents.map((evt) => {
            const evtId = getEntityId(evt, 'eventid');
            const code = evt.eventcode || 'STANDARD';
            const name = evt.eventname || 'Accreditation Framework';
            const level =
              evt.accreditationlevel && String(evt.accreditationlevel).toUpperCase() !== 'N/A'
                ? evt.accreditationlevel
                : 'Level IV';
            const status = String(evt.status || evt.Status || '').toLowerCase().trim();
            const isActive = status !== 'inactive';

            const assignedAreasList = (auditorAssignmentsRaw || []).filter(
              (a: any) => Number(a.eventid) === evtId
            );

            return (
              <TouchableOpacity
                key={`evt-card-${evtId}`}
                style={s.eventCard}
                onPress={() => openEventStructure(evt)}
                activeOpacity={0.9}
              >
                {/* Header Pills: Code, Level, Active Badge */}
                <View style={s.eventCardPillsRow}>
                  <View style={s.eventCodeBadge}>
                    <MaterialIcons name="fact-check" size={12} color="#1d4ed8" />
                    <Text style={s.eventCodeBadgeText}>{code}</Text>
                  </View>

                  {level ? (
                    <View style={s.eventLevelBadge}>
                      <Text style={s.eventLevelBadgeText}>{level}</Text>
                    </View>
                  ) : null}

                  <View style={isActive ? s.activePill : s.inactivePill}>
                    <View style={isActive ? s.activeDot : s.inactiveDot} />
                    <Text style={isActive ? s.activePillText : s.inactivePillText}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>

                  {(() => {
                    const dl = getDeadlineInfo(evt.deadline, evt);
                    if (!dl.hasDeadline && dl.status === 'none') return null;
                    return (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: dl.bgColor,
                          borderColor: dl.borderColor,
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <MaterialIcons name="schedule" size={11} color={dl.textColor} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: dl.textColor }}>
                          {dl.shortLabel}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Event Name */}
                <Text style={s.eventNameTitle} numberOfLines={2}>
                  {name}
                </Text>

                {/* Auditor Assigned Areas Tag (if applicable) */}
                {isAuditor && assignedAreasList.length > 0 ? (
                  <View style={s.assignedAreasRow}>
                    <Text style={s.assignedAreasLabel}>Your Assigned Areas:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {assignedAreasList.map((a: any, i: number) => (
                        <View key={`ar-tag-${i}`} style={s.assignedAreaChip}>
                          <MaterialIcons name="check" size={10} color="#059669" />
                          <Text style={s.assignedAreaChipText}>{a.areacode || a.areaname}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Created & Updated Meta */}
                <View style={s.cardDatesRow}>
                  <View style={s.cardDateItem}>
                    <MaterialIcons name="event" size={14} color="#94a3b8" />
                    <View style={{ marginLeft: 5 }}>
                      <Text style={s.cardDateLabel}>CREATED</Text>
                      <Text style={s.cardDateValue}>{formatDateString(evt.createdat)}</Text>
                    </View>
                  </View>
                  <View style={s.cardDateItem}>
                    <MaterialIcons name="schedule" size={14} color="#94a3b8" />
                    <View style={{ marginLeft: 5 }}>
                      <Text style={s.cardDateLabel}>UPDATED</Text>
                      <Text style={s.cardDateValue}>
                        {formatDateString(evt.updatedat || evt.createdat)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Action Footer (Matching Image 1) */}
                <View style={s.cardActionFooter}>
                  <Text style={s.evidenceTreeLabel}>Hierarchy & Evidence Tree</Text>
                  <View style={s.openStructureBtn}>
                    <Text style={s.openStructureBtnText}>Open Structure</Text>
                    <MaterialIcons name="chevron-right" size={16} color="#2563eb" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ─── Tier 2: Full Structure Workspace Modal (Matching Image 2 & Image 3) ─── */}
      <Modal
        visible={Boolean(selectedEventForStructure)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedEventForStructure(null)}
      >
        <View style={s.structureContainer}>
          {/* Structure Modal Header (Matching Image 2 Header) */}
          <View style={s.structureHeader}>
            <View style={s.structureHeaderIconBox}>
              <MaterialIcons name="event-note" size={24} color="#2563eb" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.structureHeaderTitle} numberOfLines={1}>
                {selectedEventForStructure?.eventcode ||
                  selectedEventForStructure?.eventname ||
                  'PACUCOA'}
              </Text>
              <Text style={s.structureHeaderSubtitle} numberOfLines={1}>
                {selectedEventForStructure?.eventname || ''}
              </Text>
              <View style={s.structureHeaderTagsRow}>
                <View style={s.structureMetaBadge}>
                  <Text style={s.structureMetaBadgeText}>
                    Created: {formatDateString(selectedEventForStructure?.createdat)}
                  </Text>
                </View>
                <View style={s.structureMetaBadge}>
                  <Text style={s.structureMetaBadgeText}>
                    Updated:{' '}
                    {formatDateString(
                      selectedEventForStructure?.updatedat || selectedEventForStructure?.createdat
                    )}
                  </Text>
                </View>
                {selectedEventForStructure?.accreditationlevel ? (
                  <View style={[s.structureMetaBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Text style={[s.structureMetaBadgeText, { color: '#059669', fontWeight: '800' }]}>
                      {selectedEventForStructure.accreditationlevel}
                    </Text>
                  </View>
                ) : null}
                {(() => {
                  const dl = getDeadlineInfo(
                    selectedEventForStructure?.deadline,
                    selectedEventForStructure
                  );
                  return (
                    <View
                      style={[
                        s.structureMetaBadge,
                        {
                          backgroundColor: dl.bgColor,
                          borderColor: dl.borderColor,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                        },
                      ]}
                    >
                      <MaterialIcons name="schedule" size={10} color={dl.textColor} />
                      <Text style={[s.structureMetaBadgeText, { color: dl.textColor, fontWeight: '700' }]}>
                        {dl.shortLabel}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Close Button ✕ */}
            <TouchableOpacity
              style={s.structureCloseBtn}
              onPress={() => setSelectedEventForStructure(null)}
            >
              <MaterialIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Segmented Switcher: Areas vs Programs and Offices */}
          <View style={s.structureTabsBar}>
            <TouchableOpacity
              style={[s.structureTabBtn, structureTab === 'areas' && s.structureTabBtnActive]}
              onPress={() => setStructureTab('areas')}
            >
              <MaterialIcons
                name="account-tree"
                size={16}
                color={structureTab === 'areas' ? '#2563eb' : '#64748b'}
              />
              <Text
                style={[
                  s.structureTabBtnText,
                  structureTab === 'areas' && s.structureTabBtnTextActive,
                ]}
              >
                Areas ({areas.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.structureTabBtn, structureTab === 'offices' && s.structureTabBtnActive]}
              onPress={() => setStructureTab('offices')}
            >
              <MaterialIcons
                name="apartment"
                size={16}
                color={structureTab === 'offices' ? '#2563eb' : '#64748b'}
              />
              <Text
                style={[
                  s.structureTabBtnText,
                  structureTab === 'offices' && s.structureTabBtnTextActive,
                ]}
              >
                Programs & Offices ({offices.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Tab Content: AREAS HIERARCHY TREE (Matching Image 2 & 3) ─── */}
          {structureTab === 'areas' ? (
            <View style={{ flex: 1 }}>
              {/* Areas Search & Quick Actions */}
              <View style={s.treeSearchRow}>
                <View style={s.treeSearchBox}>
                  <MaterialIcons name="search" size={18} color="#64748b" />
                  <TextInput
                    style={s.treeSearchInput}
                    placeholder="Search areas, sub areas, or standards..."
                    placeholderTextColor="#94a3b8"
                    value={structureSearch}
                    onChangeText={setStructureSearch}
                  />
                  {structureSearch ? (
                    <TouchableOpacity onPress={() => setStructureSearch('')}>
                      <MaterialIcons name="close" size={16} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={s.treeExpandToggleRow}>
                  <TouchableOpacity style={s.treeQuickBtn} onPress={expandAll}>
                    <Text style={s.treeQuickBtnText}>Expand All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.treeQuickBtn} onPress={collapseAll}>
                    <Text style={s.treeQuickBtnText}>Collapse</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Personnel Submission Status Quick Filter Chips */}
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
                          submissionFilter === 'unsubmitted' && s.submissionFilterChipTextActiveUnsubmitted,
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

              {loadingStructure ? (
                <View style={s.loadingBox}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={s.loadingText}>Building accreditation structure...</Text>
                </View>
              ) : visibleAreas.length === 0 ? (
                <View style={s.emptyCard}>
                  <MaterialIcons name="account-tree" size={42} color="#94a3b8" />
                  <Text style={s.emptyTitle}>No Areas Found</Text>
                  <Text style={s.emptySubtitle}>No areas or standards match your search query.</Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
                >
                  {visibleAreas.map((area) => {
                    const aId = getEntityId(area, 'areaid');
                    const isExpanded = expandedAreaIds.has(aId) || (Boolean(searchLower) || (submissionFilter !== 'all' && submissionFilter !== 'priority'));
                    const isAssigned = isAreaAssignedToMe(aId);
                    const directUsers = assignedPersonnelMap.areas[aId] || [];
                    const childUsers = getChildPersonnelForArea(aId);
                    const visibleDirectUsers = isAdmin
                      ? directUsers
                      : isAuditor
                      ? []
                      : directUsers.filter((u: any) => Number(u.userid) === currentUid);
                    const visibleChildUsers = isAdmin
                      ? childUsers
                      : isAuditor
                      ? []
                      : childUsers.filter((u: any) => Number(u.userid) === currentUid);

                    const areaCriteriaList = criteria.filter((c) => {
                      if (Number(c.areaid ?? c.AreaID) !== aId) return false;
                      if (submissionFilter === 'all' || submissionFilter === 'priority') return true;
                      const cId = getEntityId(c, 'criteriaid');
                      return requirements.some(
                        (r) => Number(r.criteriaid ?? r.CriteriaID) === cId && matchesRequirement(r)
                      );
                    });

                    return (
                      <View key={`area-block-${aId}`} style={s.areaBlock}>
                        {/* ── Area Bar (Matching Image 2 & 3: bg-blue-600) ── */}
                        <TouchableOpacity
                          style={s.areaHeaderBar}
                          onPress={() => toggleAreaExpand(aId)}
                          activeOpacity={0.85}
                        >
                          <MaterialIcons
                            name={isExpanded ? 'keyboard-arrow-down' : 'chevron-right'}
                            size={22}
                            color="#ffffff"
                          />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <Text style={s.areaBarTitle}>
                                {area.areacode ? `${area.areacode}: ` : ''}
                                {area.areaname || 'Area'}
                              </Text>

                              {/* ✓ Assigned to you Badge (Matching Image 2) */}
                              {isAssigned && (
                                <View style={s.assignedToYouPill}>
                                  <MaterialIcons name="check" size={10} color="#ffffff" />
                                  <Text style={s.assignedToYouPillText}>Assigned to you</Text>
                                </View>
                              )}

                              {/* Direct Personnel Avatars (Admin sees all; Personnel only sees self; Auditor sees none) */}
                              {visibleDirectUsers.map((u, ui) => {
                                const avUrl = getProfilePicUrl(u.profile_pic);
                                return (
                                  <View key={`dir-u-${ui}`} style={s.personnelAvatarPill}>
                                    <SmartUserAvatar user={u} src={avUrl} fullName={u.fullname} size={14} textSize={7} />
                                    <Text style={s.personnelAvatarPillText} numberOfLines={1}>
                                      {u.fullname}
                                    </Text>
                                  </View>
                                );
                              })}

                              {/* Sub-areas Personnel Avatars */}
                              {visibleChildUsers.map((u, ci) => {
                                const avUrl = getProfilePicUrl(u.profile_pic);
                                return (
                                  <View key={`ch-u-${ci}`} style={s.childPersonnelPill}>
                                    <SmartUserAvatar user={u} src={avUrl} fullName={u.fullname} size={14} textSize={7} />
                                    <Text style={s.childPersonnelPillText} numberOfLines={1}>
                                      {u.fullname} <Text style={{ opacity: 0.8 }}>(Sub-areas)</Text>
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>

                            <View style={s.areaDatesRow}>
                              <Text style={s.areaDatesText}>
                                Created: {formatDateString(area.createdat)} • Updated:{' '}
                                {formatDateString(area.updatedat || area.createdat)}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* ── Expanded Area Children with Connecting Hierarchy Tree Line (Image 3) ── */}
                        {isExpanded && (
                          <View style={s.areaChildrenWrap}>
                            {/* Vertical Hierarchy Guide Line */}
                            <View style={s.treeVerticalLine} />

                            <View style={s.areaChildrenInner}>
                              {areaCriteriaList.length === 0 ? (
                                <View style={s.noSubItemsCard}>
                                  <Text style={s.noSubItemsText}>No sub areas in this area</Text>
                                </View>
                              ) : (
                                areaCriteriaList.map((crit) => {
                                  const cId = getEntityId(crit, 'criteriaid');
                                  const isCritExpanded = expandedCriteriaIds.has(cId) || (Boolean(searchLower) || (submissionFilter !== 'all' && submissionFilter !== 'priority'));
                                  const isCritAssigned = isCriteriaAssignedToMe(cId, aId);
                                  const critDirectUsers = assignedPersonnelMap.criteria[cId] || [];

                                  let critReqs = requirements.filter(
                                    (r) => Number(r.criteriaid ?? r.CriteriaID) === cId && matchesRequirement(r)
                                  );

                                  if (submissionFilter && submissionFilter !== 'all') {
                                    critReqs = [...critReqs].sort((a, b) => {
                                      const getScore = (req: any) => {
                                        const rId = getEntityId(req, 'requirementid');
                                        const stat = myFileStatsByReq[rId] || null;
                                        const totFiles = Number(stat?.totalfiles || 0);
                                        const rejCount = totFiles > 0 ? Number(stat?.rejectedcount || 0) : 0;
                                        const pendCount = totFiles > 0 ? Number(stat?.pendingcount || 0) : 0;
                                        const appCount = totFiles > 0 ? Number(stat?.approvedcount || 0) : 0;
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

                                  if (submissionFilter !== 'all' && submissionFilter !== 'priority' && critReqs.length === 0) {
                                    return null;
                                  }

                                  return (
                                    <View key={`crit-block-${cId}`} style={s.criteriaBlock}>
                                      {/* Horizontal Connector Branch */}
                                      <View style={s.treeHorizontalBranch} />

                                      {/* ── Criteria / Sub-area Bar (Image 3) ── */}
                                      <TouchableOpacity
                                        style={s.criteriaHeaderBar}
                                        onPress={() => toggleCriteriaExpand(cId)}
                                        activeOpacity={0.85}
                                      >
                                        <MaterialIcons
                                          name={isCritExpanded ? 'keyboard-arrow-down' : 'chevron-right'}
                                          size={20}
                                          color="#ffffff"
                                        />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                            <Text style={s.criteriaBarTitle}>
                                              {crit.criteriacode ? `${crit.criteriacode}. ` : ''}
                                              {crit.criterianame || 'Sub Area'}
                                            </Text>

                                            {isCritAssigned && (
                                              <View style={s.assignedToYouPill}>
                                                <MaterialIcons name="check" size={10} color="#ffffff" />
                                                <Text style={s.assignedToYouPillText}>Assigned to you</Text>
                                              </View>
                                            )}

                                            {/* Inherited from Area Avatar */}
                                            {visibleDirectUsers.map((u, di) => {
                                              const avUrl = getProfilePicUrl(u.profile_pic);
                                              return (
                                                <View key={`inh-area-${di}`} style={s.personnelAvatarPill}>
                                                  <SmartUserAvatar user={u} src={avUrl} fullName={u.fullname} size={14} textSize={7} />
                                                  <Text style={s.personnelAvatarPillText} numberOfLines={1}>
                                                    {u.fullname} <Text style={{ opacity: 0.8 }}>(Area)</Text>
                                                  </Text>
                                                </View>
                                              );
                                            })}
                                          </View>

                                          <Text style={s.criteriaDatesText}>
                                            Created: {formatDateString(crit.createdat)} • Updated:{' '}
                                            {formatDateString(crit.updatedat || crit.createdat)}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>

                                      {/* ── Expanded Criteria Standards (Image 3: Requirement Cards) ── */}
                                      {isCritExpanded && (
                                        <View style={s.critChildrenWrap}>
                                          <View style={s.critVerticalLine} />

                                          <View style={s.critChildrenInner}>
                                            {critReqs.length === 0 ? (
                                              <View style={s.noSubItemsCard}>
                                                <Text style={s.noSubItemsText}>No standards assigned to this sub area</Text>
                                              </View>
                                            ) : (
                                              critReqs.map((req) => {
                                                const rId = getEntityId(req, 'requirementid');
                                                const rCode = req.requirementcode || `REQ #${rId}`;
                                                const rDesc = req.Description || req.description || 'Compliance Standard';
                                                const isReqAssigned = isRequirementAssignedToMe(rId, cId, aId);
                                                const myStat = myFileStatsByReq[rId] || null;
                                                const sId = Number(
                                                  req.compliancestatusid ??
                                                    req.ComplianceStatusID ??
                                                    req.status_id ??
                                                    3
                                                );
                                                const opt = STATUS_OPTIONS.find((s) => s.id === sId) || STATUS_OPTIONS[0];

                                                return (
                                                  <View key={`req-card-${rId}`} style={s.reqCardContainer}>
                                                    <View style={s.critHorizontalBranch} />

                                                    {/* Requirement Card (Matching Image 3: bg-blue-50/80 border border-blue-200/80) */}
                                                    <View style={s.requirementCard}>
                                                      <View style={s.reqTopRow}>
                                                        {/* Code Pill (e.g. A.1) */}
                                                        <View style={s.reqCodePill}>
                                                          <Text style={s.reqCodePillText}>{rCode}</Text>
                                                        </View>

                                                        {/* Personnel File Status Badges (replacing plain check green) */}
                                                        {isPersonnel ? (() => {
                                                          const totFiles = Number(myStat?.totalfiles || 0);
                                                          const approvedCount = totFiles > 0 ? Number(myStat?.approvedcount || 0) : 0;
                                                          const pendingCount = totFiles > 0 ? Number(myStat?.pendingcount || 0) : 0;
                                                          const rejectedCount = totFiles > 0 ? Number(myStat?.rejectedcount || 0) : 0;

                                                          return (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                              {isReqAssigned && (
                                                                <View style={s.assignedToYouPillGreen}>
                                                                  <Text style={s.assignedToYouPillGreenText}>
                                                                    Assigned
                                                                  </Text>
                                                                </View>
                                                              )}
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
                                                              {totFiles === 0 && (
                                                                <View style={s.statBadgeEmpty}>
                                                                  <Text style={s.statBadgeTextEmpty}>0 files</Text>
                                                                </View>
                                                              )}
                                                            </View>
                                                          );
                                                        })() : (
                                                          isReqAssigned && (
                                                            <View style={s.assignedToYouPillGreen}>
                                                              <MaterialIcons name="check" size={10} color="#059669" />
                                                              <Text style={s.assignedToYouPillGreenText}>
                                                                Assigned to you
                                                              </Text>
                                                            </View>
                                                          )
                                                        )}

                                                        {/* Avatar pill for Area assignee */}
                                                         {visibleDirectUsers.map((u, ui) => {
                                                           const avUrl = getProfilePicUrl(u.profile_pic);
                                                           return (
                                                             <View key={`ru-${ui}`} style={s.reqAssigneePill}>
                                                               <SmartUserAvatar user={u} src={avUrl} fullName={u.fullname} size={14} textSize={7} />
                                                               <Text style={s.reqAssigneePillText} numberOfLines={1}>
                                                                 {u.fullname} <Text style={{ color: '#94a3b8' }}>(Area)</Text>
                                                               </Text>
                                                             </View>
                                                           );
                                                         })}
                                                      </View>

                                                      {/* Standard Description with 2-line clamp & inline Show more / Show less */}
                                                      <Text
                                                        style={s.requirementDesc}
                                                        numberOfLines={expandedReqIds.has(rId) ? undefined : 2}
                                                      >
                                                        {rDesc}
                                                      </Text>
                                                      {(rDesc.length > 90 || expandedReqIds.has(rId)) && (
                                                        <TouchableOpacity
                                                          onPress={() => toggleExpandReq(rId)}
                                                          activeOpacity={0.7}
                                                          style={{ alignSelf: 'flex-start', marginBottom: 4 }}
                                                        >
                                                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#4f46e5' }}>
                                                            {expandedReqIds.has(rId) ? 'Show less' : 'Show more'}
                                                          </Text>
                                                        </TouchableOpacity>
                                                      )}

                                                      {/* Created & Updated dates */}
                                                      <Text style={s.reqDatesText}>
                                                        Created: {formatDateString(req.createdat)} • Updated:{' '}
                                                        {formatDateString(req.updatedat || req.createdat)}
                                                      </Text>

                                                      {/* Action Buttons: Submissions (Evidence) + Evaluate (Auditor) */}
                                                      <View style={s.reqActionsRow}>
                                                        {/* Compliance status badge */}
                                                        <View
                                                          style={[
                                                            s.statusBadge,
                                                            { backgroundColor: opt.bg, borderColor: opt.border },
                                                          ]}
                                                        >
                                                          <View style={[s.statusDot, { backgroundColor: opt.color }]} />
                                                          <Text style={[s.statusBadgeText, { color: opt.color }]}>
                                                            {opt.label}
                                                          </Text>
                                                        </View>

                                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                                          {/* Submissions Button */}
                                                          <TouchableOpacity
                                                            style={s.submissionsBtn}
                                                            onPress={() => setEvidencePanelReq(req)}
                                                          >
                                                            <MaterialIcons name="folder-shared" size={14} color="#1d4ed8" />
                                                            <Text style={s.submissionsBtnText}>Submissions</Text>
                                                          </TouchableOpacity>

                                                          {/* Auditor Evaluate Button */}
                                                          {isAuditor ? (
                                                            <TouchableOpacity
                                                              style={s.evaluateBtn}
                                                              onPress={() => {
                                                                setEvaluatingReq(req);
                                                                setEvalStatusId(sId);
                                                                setEvalComments(req.comment || '');
                                                              }}
                                                            >
                                                              <MaterialIcons name="tune" size={14} color="#059669" />
                                                              <Text style={s.evaluateBtnText}>Evaluate</Text>
                                                            </TouchableOpacity>
                                                          ) : null}
                                                        </View>
                                                      </View>
                                                    </View>
                                                  </View>
                                                );
                                              })
                                            )}
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ─── Tab Content: PROGRAMS AND OFFICES (Matching Image 2 Left Column) ─── */
            <View style={{ flex: 1 }}>
              <View style={s.officeSearchRow}>
                <View style={s.treeSearchBox}>
                  <MaterialIcons name="search" size={18} color="#64748b" />
                  <TextInput
                    style={s.treeSearchInput}
                    placeholder="Search programs and offices..."
                    placeholderTextColor="#94a3b8"
                    value={officeSearch}
                    onChangeText={setOfficeSearch}
                  />
                  {officeSearch ? (
                    <TouchableOpacity onPress={() => setOfficeSearch('')}>
                      <MaterialIcons name="close" size={16} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Filter Pills: All | Programs | Offices */}
                <View style={s.officeFilterPillsRow}>
                  {(['All', 'Programs', 'Offices'] as const).map((tab) => (
                    <TouchableOpacity
                      key={`otab-${tab}`}
                      style={[s.officeFilterPill, activeOfficeTab === tab && s.officeFilterPillActive]}
                      onPress={() => setActiveOfficeTab(tab)}
                    >
                      <Text
                        style={[
                          s.officeFilterPillText,
                          activeOfficeTab === tab && s.officeFilterPillTextActive,
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
              >
                {filteredOffices.length === 0 ? (
                  <View style={s.emptyCard}>
                    <MaterialIcons name="apartment" size={42} color="#94a3b8" />
                    <Text style={s.emptyTitle}>No Programs or Offices</Text>
                    <Text style={s.emptySubtitle}>No units match your current filter.</Text>
                  </View>
                ) : (
                  filteredOffices.map((off, idx) => {
                    const isProgram =
                      off.entitytypeid === 1 ||
                      String(off.category_name || off.typename || '').toLowerCase().includes('academic') ||
                      String(off.category_name || off.typename || '').toLowerCase().includes('program');
                    const offName = off.officename || off.OfficeName || 'Unit';
                    const dept = off.department_name || off.TypeName || (isProgram ? 'IBED' : 'Institution-wide');

                    return (
                      <View key={`off-card-${idx}`} style={s.programOfficeCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <View style={isProgram ? s.programIconBox : s.officeIconBox}>
                            <MaterialIcons
                              name={isProgram ? 'school' : 'business'}
                              size={20}
                              color={isProgram ? '#0284c7' : '#059669'}
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={s.programOfficeName}>{offName}</Text>
                            <Text style={s.programOfficeDept}>{dept}</Text>

                            <View style={s.programOfficeMetaDates}>
                              <Text style={s.programOfficeDatesText}>
                                CREATED {formatDateString(off.createdat)}   UPDATED{' '}
                                {formatDateString(off.updatedat || off.createdat)}
                              </Text>
                            </View>

                            <View style={s.programOfficeBadgesRow}>
                              <View style={isProgram ? s.academicBadge : s.nonAcademicBadge}>
                                <Text style={isProgram ? s.academicBadgeText : s.nonAcademicBadgeText}>
                                  {isProgram ? 'Academic Program' : 'Non-Academic Office'}
                                </Text>
                              </View>
                              {off.accreditation_level || off.Level ? (
                                <View style={s.levelBadge}>
                                  <Text style={s.levelBadgeText}>{off.accreditation_level || off.Level}</Text>
                                </View>
                              ) : null}
                              <Text style={s.instWideLabel}>
                                {String(dept).toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* ─── Evidence Files Panel Modal ─── */}
      {evidencePanelReq && (
        <EvidenceFilesPanel
          visible={Boolean(evidencePanelReq)}
          requirement={evidencePanelReq}
          isAuditor={isAuditor}
          currentUser={currentUser}
          officeId={evidencePanelReq?.officeid || evidencePanelReq?.officeId}
          onClose={() => setEvidencePanelReq(null)}
          onViewFile={(f) => setLightboxFile(f)}
          onRefreshRequirements={() => {
            void refreshStructureData({ silent: true });
          }}
        />
      )}

      {/* ─── Lightbox Viewer ─── */}
      <UserFileLightbox
        visible={Boolean(lightboxFile)}
        file={lightboxFile}
        allowDownload={!isAuditor}
        onClose={() => setLightboxFile(null)}
      />

      {/* ─── Auditor Evaluation Modal ─── */}
      <Modal visible={Boolean(evaluatingReq)} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalTitle}>Auditor Assessment</Text>
                <Text style={s.modalSub}>
                  {evaluatingReq?.RequirementCode || evaluatingReq?.requirementcode || 'Standard'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEvaluatingReq(null)}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSectionLabel}>Compliance Rating</Text>
            <View style={s.statusOptionRow}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = evalStatusId === opt.id;
                return (
                  <TouchableOpacity
                    key={`eval-opt-${opt.id}`}
                    style={[
                      s.statusOptionBtn,
                      isSelected && {
                        backgroundColor: opt.bg,
                        borderColor: opt.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setEvalStatusId(opt.id)}
                  >
                    <View style={[s.statusDot, { backgroundColor: opt.color }]} />
                    <Text
                      style={[
                        s.statusOptionBtnText,
                        isSelected && { color: opt.color, fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.modalSectionLabel, { marginTop: 14 }]}>Audit Findings / Remarks</Text>
            <TextInput
              style={s.modalCommentsInput}
              placeholder="Enter auditor findings, recommendations, or requirements..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={evalComments}
              onChangeText={setEvalComments}
            />

            <View style={s.modalActionsRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setEvaluatingReq(null)}>
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalSaveBtn}
                onPress={handleSaveEvaluation}
                disabled={evalSaving}
              >
                {evalSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={16} color="#fff" />
                    <Text style={s.modalSaveBtnText}>Save Assessment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Stylesheet Matching Web Design (Images 1, 2, 3, 4) ─── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    paddingBottom: 10,
  },
  headerBreadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerAppLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  headerBreadcrumbSlash: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  headerGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  headerRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  headerRoleBadgePersonnel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRoleBadgeAuditor: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  headerRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRoleBadgeTextPersonnel: {
    color: '#475569',
  },
  headerRoleBadgeTextAuditor: {
    color: '#1d4ed8',
  },

  mainScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Title Banner */
  titleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Search & Controls Row (Image 1 & 4) */
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  statusFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusDropdownMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: -8,
    marginBottom: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  statusDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  statusDropdownItemText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  statusDropdownItemTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },

  /* Accreditation Card (Matching Image 1 & EventCard.jsx) */
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventCardPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  eventCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventCodeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },
  eventLevelBadge: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventLevelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338ca',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  inactivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  inactivePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  eventNameTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
    marginBottom: 12,
  },
  assignedAreasRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
  },
  assignedAreasLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  assignedAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  assignedAreaChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cardDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 12,
  },
  cardDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  cardDateValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  cardActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  evidenceTreeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  openStructureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openStructureBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },

  /* ─── Structure Workspace Modal (Image 2 & 3) ─── */
  structureContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  structureHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
  },
  structureHeaderIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  structureHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  structureHeaderSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  structureHeaderTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  structureMetaBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  structureMetaBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  structureCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  structureTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    gap: 12,
  },
  structureTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  structureTabBtnActive: {
    borderBottomColor: '#2563eb',
  },
  structureTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  structureTabBtnTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },

  treeSearchRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  treeSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
  },
  treeSearchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  treeExpandToggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  treeQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  treeQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },

  /* Area Bar (Matching Image 2 & 3: Solid Royal Blue) */
  areaBlock: {
    marginBottom: 12,
  },
  areaHeaderBar: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  areaBarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  assignedToYouPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  assignedToYouPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  personnelAvatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  avatarCircleSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCircleImg: {
    width: '100%',
    height: '100%',
  },
  avatarCircleSmallText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#2563eb',
  },
  personnelAvatarPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  childPersonnelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  avatarCircleAmber: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCircleAmberText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  childPersonnelPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fef3c7',
  },
  areaDatesRow: {
    marginTop: 6,
  },
  areaDatesText: {
    fontSize: 10,
    color: '#bfdbfe',
  },

  /* Children Tree Connector */
  areaChildrenWrap: {
    position: 'relative',
    marginTop: 8,
    paddingLeft: 16,
  },
  treeVerticalLine: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 12,
    width: 2,
    backgroundColor: '#3b82f6',
  },
  areaChildrenInner: {
    paddingLeft: 4,
  },
  noSubItemsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  noSubItemsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  /* Criteria Block & Bar (Image 3) */
  criteriaBlock: {
    position: 'relative',
    marginBottom: 10,
  },
  treeHorizontalBranch: {
    position: 'absolute',
    left: -12,
    top: 20,
    width: 12,
    height: 2,
    backgroundColor: '#3b82f6',
  },
  criteriaHeaderBar: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  criteriaBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  criteriaDatesText: {
    fontSize: 9,
    color: '#dbeafe',
    marginTop: 4,
  },

  critChildrenWrap: {
    position: 'relative',
    marginTop: 6,
    paddingLeft: 16,
  },
  critVerticalLine: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 8,
    width: 2,
    backgroundColor: '#93c5fd',
  },
  critChildrenInner: {
    paddingLeft: 4,
  },
  critHorizontalBranch: {
    position: 'absolute',
    left: -12,
    top: 24,
    width: 12,
    height: 2,
    backgroundColor: '#93c5fd',
  },

  /* Requirement Standard Card (Image 3) */
  reqCardContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  requirementCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  reqTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  reqCodePill: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reqCodePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  assignedToYouPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  assignedToYouPillGreenText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  reqAssigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  avatarCircleReq: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCircleReqText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  reqAssigneePillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1e293b',
  },
  requirementDesc: {
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 17,
  },
  reqDatesText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 6,
  },
  reqActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
  },
  submissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  submissionsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  evaluateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  evaluateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  /* ─── Programs and Offices View (Image 2 Left Section) ─── */
  officeSearchRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  officeFilterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  officeFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  officeFilterPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  officeFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  officeFilterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  programOfficeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  officeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programOfficeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  programOfficeDept: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  programOfficeMetaDates: {
    marginTop: 6,
  },
  programOfficeDatesText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  programOfficeBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  nonAcademicBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nonAcademicBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  academicBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  academicBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  levelBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  instWideLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginLeft: 'auto',
  },

  /* Badges & Empty States */
  statusBadge: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  /* Modal Styles */
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
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusOptionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  statusOptionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4,
  },
  modalCommentsInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    color: '#0f172a',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlignVertical: 'top',
    height: 80,
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
    borderRadius: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 5,
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
    paddingHorizontal: 14,
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
