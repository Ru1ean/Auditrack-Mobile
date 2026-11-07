import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL, getAuthHeaders, requirementsAPI } from './connect';

/* ─── Types ───────────────────────────────────────────── */

type EvidenceFile = {
  id: number;
  url?: string;
  filepath?: string;
  file_path?: string;
  filename?: string;
  fileName?: string;
  file_name?: string;
  displayname?: string;
  displayName?: string;
  display_name?: string;
  comment?: string;
  Comment?: string;
  rejectionreason?: string;
  rejection_reason?: string;
  rejectionReason?: string;
  reviewstatus?: string;
  review_status?: string;
  reviewStatus?: string;
  reviewerName?: string;
  reviewer_name?: string;
  uploadedat?: string;
  uploadedAt?: string;
  uploaded_at?: string;
  uploadedby?: number | string;
  userId?: number | string;
  mimeType?: string;
  mime_type?: string;
};

type EvidenceFilesPanelProps = {
  visible: boolean;
  requirement: any;
  isAuditor: boolean;
  currentUser: any;
  officeId?: string | number;
  onClose: () => void;
  onViewFile: (file: { url: string; fileName: string }) => void;
  onUploadFile?: () => void;
  onRefreshRequirements?: () => void;
};

/* ─── Helpers ─────────────────────────────────────────── */

const normalizeUrl = (url?: string) => {
  if (!url) return '';
  let clean = url.trim();
  clean = clean.replace(/https?:\/\/localhost:\d+/i, BASE_URL);
  clean = clean.replace(/https?:\/\/127\.0\.0\.1:\d+/i, BASE_URL);
  if (clean.startsWith('/')) {
    clean = `${BASE_URL}${clean}`;
  }
  return clean;
};

const getExtension = (value: string) => {
  const clean = String(value || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
};

const isImageExt = (ext: string) =>
  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'].includes(ext);

const getFileTypeLabel = (ext: string) => {
  if (isImageExt(ext)) return 'Image File';
  if (ext === 'pdf') return 'PDF Document';
  if (['doc', 'docx'].includes(ext)) return 'Microsoft Word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Microsoft Excel';
  return ext ? `${ext.toUpperCase()} File` : 'File';
};

const stripExtension = (name: string) => {
  if (!name) return '';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex >= name.length - 6) {
    return name.substring(0, dotIndex);
  }
  return name;
};

const getFileName = (file: EvidenceFile) =>
  file?.displayname ||
  file?.displayName ||
  file?.display_name ||
  file?.filename ||
  file?.fileName ||
  'Document';

const getFileOriginalName = (file: EvidenceFile) =>
  file?.filename || file?.fileName || file?.file_name || 'file';

const getFileUrl = (file: EvidenceFile) =>
  normalizeUrl(file?.url || file?.filepath || file?.file_path || '');

const getFileComment = (file: EvidenceFile) =>
  file?.comment || file?.Comment || '';

const getRejectionReason = (file: EvidenceFile) =>
  file?.rejectionreason ||
  file?.rejection_reason ||
  file?.rejectionReason ||
  '';

const getReviewerName = (file: EvidenceFile) =>
  file?.reviewerName || file?.reviewer_name || '';

type ReviewInfo = {
  statusKey: 'approved' | 'rejected' | 'pending';
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  cardBorder: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const getReviewStatus = (file: EvidenceFile): ReviewInfo => {
  const status = String(
    file?.reviewstatus || file?.review_status || file?.reviewStatus || ''
  ).toLowerCase().trim();

  if (status === 'approved' || status === 'accepted')
    return {
      statusKey: 'approved',
      label: 'Approved',
      color: '#059669',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      cardBorder: '#a7f3d0',
      icon: 'check',
    };
  if (status === 'needs_revision' || status === 'revision' || status === 'rejected')
    return {
      statusKey: 'rejected',
      label: 'Needs Revision',
      color: '#dc2626',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
      cardBorder: '#fecaca',
      icon: 'close',
    };
  return {
    statusKey: 'pending',
    label: 'Pending Review',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    cardBorder: '#e2e8f0',
    icon: 'schedule',
  };
};

const triggerHaptic = (style: 'light' | 'medium' | 'success' = 'light') => {
  try {
    if (Platform.OS === 'web') return;
    if (style === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (style === 'medium') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // fallback
  }
};

/* ─── Draggable Card Component ────────────────────────── */

type DraggableFileCardProps = {
  file: EvidenceFile;
  index: number;
  totalFiles: number;
  isAuditor: boolean;
  isAdmin: boolean;
  reordering: boolean;
  authHeaders: Record<string, string>;
  isDraggingThis: boolean;
  activeDragIndex: number | null;
  hoverDropIndex: number | null;
  draggedCardHeight: number;
  dragTranslateY: Animated.Value;
  onCardLayout: (e: LayoutChangeEvent) => void;
  onDragStart: (index: number, initialPageY: number) => void;
  onDragMove: (index: number, dy: number, gestureY: number) => void;
  onDragEnd: (fromIndex: number) => void;
  onViewFile: (file: { url: string; fileName: string }) => void;
  onStartRename: (file: EvidenceFile) => void;
  onDeleteFile: (file: EvidenceFile) => void;
  commentInput: string;
  onChangeComment: (text: string) => void;
  isSavingComment: boolean;
  onSaveComment: (file: EvidenceFile) => void;
  isReviewing: boolean;
  onReviewFile: (file: EvidenceFile, status: string) => void;
};

const DraggableFileCard: React.FC<DraggableFileCardProps> = ({
  file,
  index,
  totalFiles,
  isAuditor,
  isAdmin,
  reordering,
  authHeaders,
  isDraggingThis,
  activeDragIndex,
  hoverDropIndex,
  draggedCardHeight,
  dragTranslateY,
  onCardLayout,
  onDragStart,
  onDragMove,
  onDragEnd,
  onViewFile,
  onStartRename,
  onDeleteFile,
  commentInput,
  onChangeComment,
  isSavingComment,
  onSaveComment,
  isReviewing,
  onReviewFile,
}) => {
  const shiftY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDraggingRef = useRef(false);

  // Keep latest props in a ref so PanResponder is created once and NEVER recreated mid-drag
  const latestPropsRef = useRef({
    index,
    isAuditor,
    totalFiles,
    onDragStart,
    onDragMove,
    onDragEnd,
  });
  latestPropsRef.current = {
    index,
    isAuditor,
    totalFiles,
    onDragStart,
    onDragMove,
    onDragEnd,
  };

  // Compute live displacement for non-dragged cards so they slide out of the way smoothly
  const targetShift = useMemo(() => {
    if (
      activeDragIndex === null ||
      hoverDropIndex === null ||
      activeDragIndex === index
    ) {
      return 0;
    }
    const offset = (draggedCardHeight || 112) + 10;
    if (
      activeDragIndex < hoverDropIndex &&
      index > activeDragIndex &&
      index <= hoverDropIndex
    ) {
      return -offset;
    }
    if (
      activeDragIndex > hoverDropIndex &&
      index >= hoverDropIndex &&
      index < activeDragIndex
    ) {
      return offset;
    }
    return 0;
  }, [activeDragIndex, hoverDropIndex, index, draggedCardHeight]);

  useEffect(() => {
    if (activeDragIndex === null) {
      shiftY.setValue(0);
      return;
    }
    Animated.spring(shiftY, {
      toValue: targetShift,
      stiffness: 260,
      damping: 26,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [targetShift, activeDragIndex, shiftY]);

  const review = getReviewStatus(file);
  const fileName = getFileName(file);
  const origName = getFileOriginalName(file);
  const fileUrl = getFileUrl(file);
  const ext = getExtension(origName || fileUrl);
  const isImage = isImageExt(ext);
  const fileComment = getFileComment(file);
  const rejectionReason = getRejectionReason(file);
  const reviewer = getReviewerName(file);

  const finishDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    scaleAnim.setValue(1);
    latestPropsRef.current.onDragEnd(latestPropsRef.current.index);
  }, [scaleAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !latestPropsRef.current.isAuditor && latestPropsRef.current.totalFiles > 1,
      onStartShouldSetPanResponderCapture: () =>
        !latestPropsRef.current.isAuditor && latestPropsRef.current.totalFiles > 1,
      onMoveShouldSetPanResponder: () =>
        !latestPropsRef.current.isAuditor && latestPropsRef.current.totalFiles > 1,
      onMoveShouldSetPanResponderCapture: () =>
        !latestPropsRef.current.isAuditor && latestPropsRef.current.totalFiles > 1,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        isDraggingRef.current = true;
        triggerHaptic('medium');
        latestPropsRef.current.onDragStart(
          latestPropsRef.current.index,
          gesture.y0
        );
        Animated.spring(scaleAnim, {
          toValue: 1.03,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, gesture) => {
        if (!isDraggingRef.current) return;
        latestPropsRef.current.onDragMove(
          latestPropsRef.current.index,
          gesture.dy,
          gesture.moveY
        );
      },
      onPanResponderRelease: () => {
        finishDrag();
      },
      onPanResponderTerminate: () => {
        finishDrag();
      },
    })
  ).current;

  // Compute live preview index badge while dragging
  const previewNumber = useMemo(() => {
    if (activeDragIndex === null || hoverDropIndex === null) return index + 1;
    if (isDraggingThis) return hoverDropIndex + 1;
    if (
      activeDragIndex < hoverDropIndex &&
      index > activeDragIndex &&
      index <= hoverDropIndex
    ) {
      return index;
    }
    if (
      activeDragIndex > hoverDropIndex &&
      index >= hoverDropIndex &&
      index < activeDragIndex
    ) {
      return index + 2;
    }
    return index + 1;
  }, [activeDragIndex, hoverDropIndex, index, isDraggingThis]);

  return (
    <View
      style={{ zIndex: isDraggingThis ? 9999 : 1 }}
      onLayout={onCardLayout}
    >
      <Animated.View
        style={[
          s.fileCard,
          { borderColor: isDraggingThis ? '#2563eb' : isAuditor ? '#e2e8f0' : review.cardBorder },
          isDraggingThis && s.fileCardDragging,
          {
            transform: [
              { translateY: isDraggingThis ? dragTranslateY : shiftY },
              { scale: scaleAnim },
            ],
            zIndex: isDraggingThis ? 9999 : 1,
            elevation: isDraggingThis ? 16 : 1,
          },
        ]}
      >
        {/* Top Row: Review status badge (Hidden for External Auditors, replaced with Standard pill) + File # index */}
        <View style={s.fileCardTopRow}>
          {!isAuditor ? (
            <View
              style={[
                s.reviewBadge,
                {
                  backgroundColor: review.bgColor,
                  borderColor: review.borderColor,
                },
              ]}
            >
              <MaterialIcons
                name={review.icon}
                size={13}
                color={review.color}
              />
              <Text style={[s.reviewBadgeText, { color: review.color }]}>
                {review.label}
              </Text>
            </View>
          ) : (
            <View
              style={[
                s.reviewBadge,
                {
                  backgroundColor: '#f1f5f9',
                  borderColor: '#e2e8f0',
                },
              ]}
            >
              <Text style={[s.reviewBadgeText, { color: '#475569' }]}>
                Standard
              </Text>
            </View>
          )}
          <Text style={[s.fileNumber, isDraggingThis && s.fileNumberDragging]}>
            {isDraggingThis && hoverDropIndex !== null && hoverDropIndex !== index
              ? `Moving #${index + 1} ➔ #${hoverDropIndex + 1}`
              : `File #${previewNumber}`}
          </Text>
        </View>

        {/* Middle Row: Drag Handle + Thumbnail + Titles + Actions */}
        <View style={s.fileBodyRow}>
          {/* Reorder Grip Handle: 2x3 Dots - NO ARROW BUTTONS */}
          {!isAuditor && totalFiles > 1 ? (
            <View
              {...panResponder.panHandlers}
              style={[
                s.dragGripHandle,
                isDraggingThis && s.dragGripHandleActive,
              ]}
              hitSlop={{ top: 18, bottom: 18, left: 16, right: 16 }}
            >
              <MaterialIcons
                name="drag-indicator"
                size={22}
                color={isDraggingThis ? '#2563eb' : '#94a3b8'}
              />
            </View>
          ) : !isAuditor ? (
            <View style={s.dragGripHandleDisabled}>
              <MaterialIcons name="drag-indicator" size={20} color="#cbd5e1" />
            </View>
          ) : null}

          {/* Real Image / File Thumbnail */}
          <TouchableOpacity
            style={[
              s.thumbnailBox,
              !isAuditor && review.statusKey === 'approved' && s.thumbnailApprovedBorder,
              !isAuditor && review.statusKey === 'rejected' && s.thumbnailRejectedBorder,
            ]}
            onPress={() => onViewFile({ url: fileUrl, fileName })}
            activeOpacity={0.8}
          >
            {isImage && fileUrl ? (
              <Image
                source={{ uri: fileUrl, headers: authHeaders }}
                style={s.thumbnailImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={s.thumbnailPlaceholder}>
                <Text style={s.thumbnailExtText}>
                  {ext.slice(0, 4).toUpperCase() || 'FILE'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* File Details: Title, Type pill, Original filename */}
          <TouchableOpacity
            style={{ flex: 1, marginLeft: 10 }}
            onPress={() => onViewFile({ url: fileUrl, fileName })}
            activeOpacity={0.7}
          >
            <Text style={s.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            <View style={s.fileMetaRow}>
              <View style={s.fileTypePill}>
                <Text style={s.fileTypeText}>{getFileTypeLabel(ext)}</Text>
              </View>
              <Text style={s.filePathRef} numberOfLines={1}>
                • {origName}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action Buttons: Edit Pencil + Delete Close */}
          {!isAuditor ? (
            <View style={s.fileActions}>
              <TouchableOpacity
                style={s.editActionBtn}
                onPress={() => onStartRename(file)}
              >
                <MaterialIcons name="edit" size={16} color="#e11d48" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.deleteActionBtn}
                onPress={() => onDeleteFile(file)}
              >
                <MaterialIcons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Feedback / Note Box (Hidden for External Auditors matching web UserFilesGridModal.jsx) */}
        {!isAuditor && (
          review.statusKey === 'rejected' ? (
            <View style={s.revisionFeedbackBox}>
              <View style={s.revisionFeedbackHeader}>
                <MaterialIcons name="warning" size={14} color="#dc2626" />
                <Text style={s.revisionFeedbackTitle}>Rejection Reason / Revision Note:</Text>
              </View>
              <Text style={s.revisionFeedbackContent}>
                {rejectionReason || fileComment || 'Needs revision (no comment provided)'}
              </Text>
              {reviewer ? (
                <Text style={s.reviewedByText}>Reviewed by: {reviewer}</Text>
              ) : null}
            </View>
          ) : review.statusKey === 'approved' ? (
            <View style={s.auditorNoteBox}>
              <Text style={s.auditorNoteTitle}>Auditor Note:</Text>
              <Text style={s.auditorNoteContent}>
                {fileComment || 'No comment from auditor'}
              </Text>
              {reviewer ? (
                <Text style={[s.reviewedByText, { color: '#64748b' }]}>Reviewed by: {reviewer}</Text>
              ) : null}
            </View>
          ) : (
            <View style={s.pendingCommentBox}>
              <Text style={s.pendingCommentTitle}>Auditor Note / Comment:</Text>
              <Text
                style={[
                  s.pendingCommentContent,
                  !fileComment && s.italicMutedText,
                ]}
              >
                {fileComment || 'No comment from auditor'}
              </Text>
            </View>
          )
        )}

        {/* Admin Review Action Controls (Approve / Reject only for Admin, hidden for External Auditors) */}
        {isAdmin && !isAuditor ? (
          <View style={s.auditorReviewRow}>
            <TextInput
              style={s.auditorCommentInput}
              placeholder="Add feedback or revision note..."
              placeholderTextColor="#94a3b8"
              value={commentInput ?? ''}
              onChangeText={onChangeComment}
            />
            <View style={s.reviewBtnsGroup}>
              <TouchableOpacity
                style={s.approveBtn}
                onPress={() => onReviewFile(file, 'approved')}
                disabled={isReviewing}
              >
                <MaterialIcons name="check" size={14} color="#059669" />
                <Text style={s.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.rejectBtn}
                onPress={() => onReviewFile(file, 'rejected')}
                disabled={isReviewing}
              >
                <MaterialIcons name="close" size={14} color="#dc2626" />
                <Text style={s.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
};

/* ─── Main Component ─────────────────────────────────── */

export default function EvidenceFilesPanel({
  visible,
  requirement,
  isAuditor,
  currentUser,
  officeId,
  onClose,
  onViewFile,
  onUploadFile,
  onRefreshRequirements,
}: EvidenceFilesPanelProps) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [assignedSubmitters, setAssignedSubmitters] = useState<any[]>([]);
  const [selectedSubmitterId, setSelectedSubmitterId] = useState<number | null>(null);

  // Rename state
  const [renameTarget, setRenameTarget] = useState<EvidenceFile | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Auditor comment / review state
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [savingCommentId, setSavingCommentId] = useState<number | null>(null);
  const [reviewingFileId, setReviewingFileId] = useState<number | null>(null);

  // Drag and drop state
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [hoverDropIndex, setHoverDropIndex] = useState<number | null>(null);
  const activeDragIndexRef = useRef<number | null>(null);
  const hoverDropIndexRef = useRef<number | null>(null);
  const cardLayoutsRef = useRef<{ [key: number]: { y: number; height: number } }>({});
  const frozenLayoutsRef = useRef<{ [key: number]: { y: number; height: number } }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef<number>(0);
  const dragStartScrollYRef = useRef<number>(0);
  const lastGestureDyRef = useRef<number>(0);
  const lastMoveYRef = useRef<number>(0);
  const contentHeightRef = useRef<number>(0);
  const scrollViewHeightRef = useRef<number>(0);
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const lastReorderTimestampRef = useRef<number>(0);
  const filesRef = useRef<EvidenceFile[]>([]);
  filesRef.current = files;

  const requirementId =
    requirement?.RequirementID ||
    requirement?.requirementid ||
    requirement?.id;
  const reqCode =
    requirement?.RequirementCode ||
    requirement?.requirementcode ||
    requirement?.code ||
    'Requirement';

  const currentUserId = Number(
    currentUser?.userid ?? currentUser?.id ?? currentUser?.UserID ?? 0
  );
  const isAdmin = Boolean(
    currentUser?.isAdmin ||
      Number(currentUser?.roleid ?? currentUser?.RoleID ?? 0) === 1 ||
      String(currentUser?.rolename ?? currentUser?.RoleName ?? '')
        .toLowerCase()
        .includes('admin')
  );

  // For Auditor or Admin: load assigned personnel who submitted files
  useEffect(() => {
    if (!visible || (!isAuditor && !isAdmin) || !requirementId) return;
    let mounted = true;
    requirementsAPI
      .getAssignedUsers(requirementId, officeId)
      .then((res: any) => {
        if (!mounted) return;
        const list = Array.isArray(res?.users)
          ? res.users
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setAssignedSubmitters(list);
        if (list.length > 0) {
          const uploader = list.find((u: any) =>
            isAuditor
              ? Number(u.approvedcount ?? u.totalfiles ?? 0) > 0 &&
                (u.hasuploaded || u.has_uploaded)
              : u.hasuploaded || u.has_uploaded
          );
          const firstId = Number(
            uploader
              ? uploader.userid || uploader.id
              : list[0].userid || list[0].id
          );
          setSelectedSubmitterId(firstId);
        }
      })
      .catch((e: any) => console.warn('Failed to load submitters:', e));
    return () => {
      mounted = false;
    };
  }, [visible, isAuditor, isAdmin, requirementId, officeId]);

  const isDraggingActiveRef = useRef(false);
  isDraggingActiveRef.current = activeDragIndex !== null || reordering;
  const isEditingActiveRef = useRef(false);
  isEditingActiveRef.current = renaming || Boolean(renameTarget);

  const onRefreshRequirementsRef = useRef(onRefreshRequirements);
  onRefreshRequirementsRef.current = onRefreshRequirements;
  const hasInitialLoadedRef = useRef(false);

  useEffect(() => {
    hasInitialLoadedRef.current = false;
  }, [requirementId, selectedSubmitterId, officeId]);

  // Load files (with silent background live-polling support)
  const loadFiles = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!requirementId) return;
      const targetUserId = isAuditor || isAdmin
        ? selectedSubmitterId || currentUserId
        : currentUserId;
      if (!targetUserId) return;

      const isSilent = Boolean(options?.silent) || hasInitialLoadedRef.current;
      if (!isSilent) {
        setLoading(true);
      }

      try {
        const res = await requirementsAPI.getUserFile(
          String(requirementId),
          String(targetUserId),
          officeId
        );
        const rawList: EvidenceFile[] = Array.isArray(res?.files)
          ? res.files
          : res?.file
          ? [res.file]
          : [];

        // External Auditors are restricted to viewing ONLY approved files (matching web commit de3e8456)
        const list: EvidenceFile[] = isAuditor
          ? rawList.filter(
              (f) =>
                f &&
                String(f.reviewstatus || f.review_status || f.reviewStatus || '').toLowerCase() ===
                  'approved'
            )
          : rawList;

        // If user is actively dragging cards, renaming, or just reordered within the last 4s, do not overwrite list
        if (
          isDraggingActiveRef.current ||
          isEditingActiveRef.current ||
          Date.now() - lastReorderTimestampRef.current < 4000
        ) {
          return;
        }

        const wasInitialLoad = !hasInitialLoadedRef.current;
        hasInitialLoadedRef.current = true;

        setFiles((prev) => {
          // Compare previous and next to detect status or order updates
          const prevKey = prev
            .map(
              (f) =>
                `${f.id}:${f.reviewstatus || f.review_status || f.reviewStatus}:${
                  f.rejectionreason || f.rejection_reason || f.rejectionReason || ''
                }:${f.comment || f.Comment || ''}:${f.displayname || f.displayName || f.filename}`
            )
            .join('|');
          const nextKey = list
            .map(
              (f) =>
                `${f.id}:${f.reviewstatus || f.review_status || f.reviewStatus}:${
                  f.rejectionreason || f.rejection_reason || f.rejectionReason || ''
                }:${f.comment || f.Comment || ''}:${f.displayname || f.displayName || f.filename}`
            )
            .join('|');

          if (prevKey !== nextKey) {
            if (!wasInitialLoad) {
              // Notify parent screen silently only on real subsequent changes
              onRefreshRequirementsRef.current?.();
            }
            return list;
          }
          return prev;
        });
      } catch {
        if (!isSilent) {
          setFiles([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [requirementId, currentUserId, isAuditor, isAdmin, selectedSubmitterId, officeId]
  );

  useEffect(() => {
    if (!visible) return;
    void getAuthHeaders().then(setAuthHeaders);
    void loadFiles({ silent: false });

    // Live background polling every 6 seconds while panel is open
    const pollInterval = setInterval(() => {
      void loadFiles({ silent: true });
    }, 6000);

    // Immediate refresh on return from background
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadFiles({ silent: true });
      }
    });

    return () => {
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, [visible, loadFiles]);

  // File counts & approval metrics matching Screenshot 1
  const uploadedCount = files.length;
  const maxFiles = requirement?.max_files || requirement?.MaxFiles || 40;
  const approvedCount = files.filter(
    (f) => String(f.reviewstatus || f.review_status || '').toLowerCase() === 'approved'
  ).length;
  const rejectedCount = files.filter((f) =>
    ['rejected', 'needs_revision', 'revision'].includes(
      String(f.reviewstatus || f.review_status || '').toLowerCase()
    )
  ).length;

  // ─── Actions ───────────────────────────────────────────

  // Pick and upload new file(s) (Supports multiple file selection matching Web YourWorkFileUpload.jsx)
  const handlePickAndUploadFile = async () => {
    if (uploading || !requirementId) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const remainingSlots = Math.max(0, maxFiles - files.length);
      const selectedAssets = res.assets.slice(0, remainingSlots);
      if (selectedAssets.length === 0) {
        Alert.alert('Limit Reached', `Maximum of ${maxFiles} standard files allowed.`);
        return;
      }

      setUploading(true);

      let uploadedCountNow = 0;
      for (const asset of selectedAssets) {
        await requirementsAPI.uploadUserFile({
          fileUri: asset.uri,
          fileName: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          requirementId: requirementId,
          userId: currentUserId,
          officeId: officeId,
          displayName: asset.name,
        });
        uploadedCountNow++;
      }

      await loadFiles();
      onRefreshRequirements?.();
      Alert.alert(
        'Upload Complete',
        uploadedCountNow === 1
          ? `"${selectedAssets[0].name}" has been uploaded.`
          : `${uploadedCountNow} standard files have been uploaded.`
      );
    } catch (err: any) {
      console.error('Error uploading file:', err);
      Alert.alert('Upload Failed', err?.message || 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  // Delete file
  const handleDeleteFile = (file: EvidenceFile) => {
    Alert.alert(
      'Remove Evidence',
      `Are you sure you want to remove "${getFileName(file)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await requirementsAPI.deleteEvidenceFile(
                requirementId,
                currentUserId,
                file.id
              );
              await loadFiles();
              onRefreshRequirements?.();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove file.');
            }
          },
        },
      ]
    );
  };

  // Reorder file position
  const handleMoveFile = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const currentList = filesRef.current;
      if (
        fromIndex === toIndex ||
        toIndex < 0 ||
        toIndex >= currentList.length
      ) {
        return;
      }
      const nextFiles = [...currentList];
      const [moved] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, moved);

      // Protect against in-flight polling overwriting the new order
      lastReorderTimestampRef.current = Date.now();

      // Immediate local UI update
      filesRef.current = nextFiles;
      setFiles(nextFiles);

      const orderedIds = nextFiles.map((f) => Number(f.id)).filter(Boolean);
      const targetUserId =
        (isAuditor || isAdmin
          ? selectedSubmitterId || currentUserId
          : currentUserId) ||
        moved?.uploadedby ||
        moved?.userId ||
        '0';

      try {
        setReordering(true);
        await requirementsAPI.reorderFiles(requirementId, targetUserId, orderedIds);
        lastReorderTimestampRef.current = Date.now();
        onRefreshRequirementsRef.current?.();
      } catch (err: any) {
        console.error('Failed to reorder files:', err);
        Alert.alert('Reorder Failed', err?.message || 'Could not update file order.');
        await loadFiles();
      } finally {
        setReordering(false);
      }
    },
    [isAuditor, isAdmin, selectedSubmitterId, currentUserId, requirementId, loadFiles]
  );

  // Recalculate dragged card translation and target drop slot using frozen initial layouts
  const recalculateDragTarget = useCallback((fromIndex: number) => {
    const count = filesRef.current.length;
    if (count <= 1) return;

    const scrollDelta = scrollOffsetRef.current - dragStartScrollYRef.current;
    const totalDy = lastGestureDyRef.current + scrollDelta;
    dragTranslateY.setValue(totalDy);

    const startLayout = frozenLayoutsRef.current[fromIndex];
    const startY = startLayout ? startLayout.y : fromIndex * 120;
    const cardHeight = startLayout ? startLayout.height : 108;
    const currentCenterY = startY + cardHeight / 2 + totalDy;

    let closestIndex = fromIndex;
    let minDistance = Infinity;

    for (let i = 0; i < count; i++) {
      const layout = frozenLayoutsRef.current[i];
      const targetCenterY = layout ? layout.y + layout.height / 2 : i * 120 + 54;
      const dist = Math.abs(currentCenterY - targetCenterY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // Clamp if dragged above first card or below last card
    const firstLayout = frozenLayoutsRef.current[0];
    const lastLayout = frozenLayoutsRef.current[count - 1];
    if (firstLayout && currentCenterY <= firstLayout.y + firstLayout.height / 2) {
      closestIndex = 0;
    } else if (lastLayout && currentCenterY >= lastLayout.y + lastLayout.height / 2) {
      closestIndex = count - 1;
    }

    if (closestIndex !== hoverDropIndexRef.current) {
      hoverDropIndexRef.current = closestIndex;
      setHoverDropIndex(closestIndex);
      triggerHaptic('light');
    }
  }, [dragTranslateY]);

  // Continuous 60fps auto-scroll while holding dragged item near top or bottom of screen
  useEffect(() => {
    if (activeDragIndex === null) return;

    const windowHeight = Dimensions.get('window').height;
    const topEdgeThreshold = 240;
    const bottomEdgeThreshold = windowHeight - 180;

    const autoScrollTimer = setInterval(() => {
      const fromIdx = activeDragIndexRef.current;
      if (fromIdx === null) return;

      const moveY = lastMoveYRef.current;
      if (moveY <= 0) return;

      if (moveY < topEdgeThreshold && scrollOffsetRef.current > 0) {
        const intensity = Math.min(
          1,
          Math.max(0.2, (topEdgeThreshold - moveY) / 140)
        );
        const step = Math.round(intensity * 20);
        const nextY = Math.max(0, scrollOffsetRef.current - step);
        if (nextY !== scrollOffsetRef.current) {
          scrollOffsetRef.current = nextY;
          scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
          recalculateDragTarget(fromIdx);
        }
      } else if (moveY > bottomEdgeThreshold) {
        const maxScroll = Math.max(
          0,
          contentHeightRef.current - scrollViewHeightRef.current
        );
        if (scrollOffsetRef.current < maxScroll) {
          const intensity = Math.min(
            1,
            Math.max(0.2, (moveY - bottomEdgeThreshold) / 140)
          );
          const step = Math.round(intensity * 20);
          const nextY = Math.min(maxScroll, scrollOffsetRef.current + step);
          if (nextY !== scrollOffsetRef.current) {
            scrollOffsetRef.current = nextY;
            scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
            recalculateDragTarget(fromIdx);
          }
        }
      }
    }, 16);

    return () => clearInterval(autoScrollTimer);
  }, [activeDragIndex, recalculateDragTarget]);

  // Drag-and-drop callbacks for 2x3 grip reordering
  const handleDragStart = useCallback(
    (index: number, initialPageY: number) => {
      // Freeze card layouts at the start of drag so layout shifts never cause oscillation
      const snapshot: { [key: number]: { y: number; height: number } } = {};
      Object.keys(cardLayoutsRef.current).forEach((k) => {
        const numKey = Number(k);
        const item = cardLayoutsRef.current[numKey];
        if (item) {
          snapshot[numKey] = { y: item.y, height: item.height };
        }
      });
      frozenLayoutsRef.current = snapshot;
      dragStartScrollYRef.current = scrollOffsetRef.current;
      lastGestureDyRef.current = 0;
      lastMoveYRef.current = initialPageY;
      dragTranslateY.setValue(0);

      activeDragIndexRef.current = index;
      hoverDropIndexRef.current = index;
      setActiveDragIndex(index);
      setHoverDropIndex(index);
    },
    [dragTranslateY]
  );

  const handleDragMove = useCallback(
    (index: number, dy: number, gestureY: number) => {
      if (activeDragIndexRef.current !== index) return;
      lastGestureDyRef.current = dy;
      lastMoveYRef.current = gestureY;
      recalculateDragTarget(index);
    },
    [recalculateDragTarget]
  );

  const handleDragEnd = useCallback(
    (fromIndex: number) => {
      const toIndex = hoverDropIndexRef.current ?? fromIndex;
      activeDragIndexRef.current = null;
      hoverDropIndexRef.current = null;
      lastGestureDyRef.current = 0;
      lastMoveYRef.current = 0;
      dragTranslateY.setValue(0);
      setActiveDragIndex(null);
      setHoverDropIndex(null);

      if (toIndex !== fromIndex) {
        triggerHaptic('success');
        void handleMoveFile(fromIndex, toIndex);
      }
    },
    [dragTranslateY, handleMoveFile]
  );

  // Confirm rename
  const handleConfirmRename = async () => {
    if (!renameTarget) return;
    const cleanName = stripExtension(renameInput.trim());
    if (!cleanName) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }
    setRenaming(true);
    try {
      await requirementsAPI.renameFile(requirementId, renameTarget.id, cleanName);
      await loadFiles();
      setRenameTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to rename file.');
    } finally {
      setRenaming(false);
    }
  };

  // Auditor save note
  const handleSaveComment = async (file: EvidenceFile) => {
    const comment = (commentInputs[file.id] ?? getFileComment(file)).trim();
    if (!comment) {
      Alert.alert('Note', 'Please enter a note first.');
      return;
    }
    setSavingCommentId(file.id);
    try {
      await requirementsAPI.commentOnFile(requirementId, file.id, comment);
      await loadFiles();
      Alert.alert('Saved', 'Auditor note recorded.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save note.');
    } finally {
      setSavingCommentId(null);
    }
  };

  // Auditor review action (Approve / Reject)
  const handleReviewFile = async (file: EvidenceFile, status: string) => {
    setReviewingFileId(file.id);
    try {
      const reason =
        status === 'needs_revision'
          ? (commentInputs[file.id] ?? getFileComment(file)).trim()
          : undefined;
      await requirementsAPI.reviewFile(requirementId, file.id, status, reason);
      await loadFiles();
      onRefreshRequirements?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update review status.');
    } finally {
      setReviewingFileId(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={s.container}>
        {/* ─── Header matching Screenshot 1 ─── */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {reqCode}
            </Text>
            <View style={s.headerSubtitleRow}>
              <Text style={s.standardFilesLabel}>Standard Files</Text>
              {!isAuditor ? (
                <>
                  <View style={s.uploadedCountPill}>
                    <Text style={s.uploadedCountPillText}>
                      {uploadedCount}/{maxFiles} uploaded
                    </Text>
                  </View>
                  {uploadedCount > 0 && (
                    <View
                      style={[
                        s.approvedCountPill,
                        approvedCount === uploadedCount && {
                          backgroundColor: '#ecfdf5',
                          borderColor: '#a7f3d0',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.approvedCountPillText,
                          approvedCount === uploadedCount && { color: '#059669' },
                        ]}
                      >
                        {approvedCount}/{uploadedCount} Approved
                      </Text>
                    </View>
                  )}
                  {rejectedCount > 0 && (
                    <View style={s.rejectedCountPill}>
                      <Text style={s.rejectedCountPillText}>
                        Needs Revision ({rejectedCount})
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={[s.uploadedCountPill, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                  <Text style={[s.uploadedCountPillText, { color: '#475569' }]}>
                    {uploadedCount} {uploadedCount === 1 ? 'file' : 'files'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── Indeterminate Upload Progress Banner (Matching Web UserFilesGridModal.jsx) ─── */}
        {uploading && (
          <View style={s.uploadingBanner}>
            <View style={s.uploadingBannerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={s.uploadingBannerTitle}>Uploading standard file(s)...</Text>
              </View>
              <Text style={s.uploadingBannerSub}>Please wait</Text>
            </View>
            <View style={s.uploadingProgressTrack}>
              <View style={s.uploadingProgressFill} />
            </View>
          </View>
        )}

        {/* ─── Submitter Selector (For Auditor or Admin) ─── */}
        {(isAuditor || isAdmin) && assignedSubmitters.length > 0 ? (
          <View style={s.submittersBar}>
            <Text style={s.submittersLabel}>
              Assigned Personnel ({assignedSubmitters.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {assignedSubmitters.map((sub: any) => {
                const subId = Number(sub.userid || sub.id);
                const isSelected = subId === selectedSubmitterId;
                const subName =
                  `${sub.firstname || ''} ${sub.lastname || ''}`.trim() ||
                  sub.Email ||
                  `User #${subId}`;
                const hasUploaded = isAuditor
                  ? Number(sub.approvedcount ?? sub.totalfiles ?? 0) > 0 &&
                    (sub.hasuploaded || sub.has_uploaded)
                  : sub.hasuploaded || sub.has_uploaded;
                const hasRejected = !isAuditor && (sub.hasrejected || Number(sub.rejectedcount) > 0);

                return (
                  <TouchableOpacity
                    key={`sub-${subId}`}
                    onPress={() => setSelectedSubmitterId(subId)}
                    style={[
                      s.submitterPill,
                      isSelected && s.submitterPillActive,
                    ]}
                  >
                    <MaterialIcons
                      name={
                        isAuditor
                          ? 'person'
                          : hasRejected
                          ? 'error'
                          : hasUploaded
                          ? 'check-circle'
                          : 'person'
                      }
                      size={14}
                      color={
                        isSelected
                          ? '#ffffff'
                          : isAuditor
                          ? '#64748b'
                          : hasRejected
                          ? '#dc2626'
                          : hasUploaded
                          ? '#059669'
                          : '#64748b'
                      }
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        s.submitterPillText,
                        isSelected && s.submitterPillTextActive,
                      ]}
                    >
                      {subName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* ─── Main Files List ─── */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={s.loadingText}>Loading standard evidence files...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
            scrollEnabled={activeDragIndex === null}
            onLayout={(e) => {
              scrollViewHeightRef.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={(_, h) => {
              contentHeightRef.current = h;
            }}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {files.length === 0 ? (
              <View style={s.emptyCard}>
                <MaterialIcons name="cloud-upload" size={48} color="#94a3b8" />
                <Text style={s.emptyTitle}>No Standard Files Uploaded</Text>
                <Text style={s.emptySub}>
                  {isAuditor
                    ? 'The assigned personnel has not submitted any files for this standard yet.'
                    : 'Tap the button below to upload your standard evidence files.'}
                </Text>
              </View>
            ) : (
              files.map((file, index) => (
                <DraggableFileCard
                  key={`efile-${file.id}`}
                  file={file}
                  index={index}
                  totalFiles={files.length}
                  isAuditor={isAuditor}
                  isAdmin={isAdmin}
                  reordering={reordering}
                  authHeaders={authHeaders}
                  isDraggingThis={activeDragIndex === index}
                  activeDragIndex={activeDragIndex}
                  hoverDropIndex={hoverDropIndex}
                  draggedCardHeight={
                    activeDragIndex !== null
                      ? frozenLayoutsRef.current[activeDragIndex]?.height ?? 112
                      : 112
                  }
                  dragTranslateY={dragTranslateY}
                  onCardLayout={(e) => {
                    if (activeDragIndexRef.current === null) {
                      cardLayoutsRef.current[index] = e.nativeEvent.layout;
                    }
                  }}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onViewFile={onViewFile}
                  onStartRename={(target) => {
                    setRenameTarget(target);
                    setRenameInput(stripExtension(getFileName(target)));
                  }}
                  onDeleteFile={handleDeleteFile}
                  commentInput={commentInputs[file.id] ?? ''}
                  onChangeComment={(txt) =>
                    setCommentInputs((prev) => ({ ...prev, [file.id]: txt }))
                  }
                  isSavingComment={savingCommentId === file.id}
                  onSaveComment={handleSaveComment}
                  isReviewing={reviewingFileId === file.id}
                  onReviewFile={handleReviewFile}
                />
              ))
            )}

            {/* ─── Bottom Upload Button (+ Add More Standard Files - Screenshot 1) ─── */}
            {!isAuditor && files.length < 40 && (
              <TouchableOpacity
                style={s.uploadDashedBtn}
                onPress={handlePickAndUploadFile}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={s.uploadDashedBtnText}>Uploading evidence file...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="add" size={18} color="#2563eb" />
                    <Text style={s.uploadDashedBtnText}>
                      {files.length > 0
                        ? `+ Add More Standard Files (${files.length}/40)`
                        : '+ Select Standard File(s) (Max 40)'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ─── Rename Dialog Modal ─── */}
        <Modal
          visible={Boolean(renameTarget)}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameTarget(null)}
        >
          <View style={s.renameModalOverlay}>
            <View style={s.renameModalCard}>
              <Text style={s.renameModalTitle}>Rename Evidence File</Text>
              <Text style={s.renameModalSubtitle}>
                Custom title (file extension will be preserved automatically)
              </Text>
              <TextInput
                style={s.renameInput}
                value={renameInput}
                onChangeText={setRenameInput}
                placeholder="Enter file display name..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
              <View style={s.renameModalActions}>
                <TouchableOpacity
                  style={s.renameCancelBtn}
                  onPress={() => setRenameTarget(null)}
                >
                  <Text style={s.renameCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.renameSaveBtn}
                  onPress={handleConfirmRename}
                  disabled={renaming}
                >
                  {renaming ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={s.renameSaveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

/* ─── STYLES ─────────────────────────────────────────── */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  standardFilesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  uploadedCountPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  uploadedCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  approvedCountPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  approvedCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  rejectedCountPill: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rejectedCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  submittersBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  uploadingBanner: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  uploadingBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  uploadingBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  uploadingBannerSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
  },
  uploadingProgressTrack: {
    height: 5,
    width: '100%',
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    overflow: 'hidden',
  },
  uploadingProgressFill: {
    height: '100%',
    width: '65%',
    backgroundColor: '#2563eb',
    borderRadius: 999,
  },
  submittersLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  submitterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  submitterPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  submitterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  submitterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
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
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  fileCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  fileCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  reviewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fileNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  fileBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragGripHandle: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dragGripHandleActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  dragGripHandleDisabled: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  fileCardDragging: {
    backgroundColor: '#ffffff',
    borderColor: '#2563eb',
    borderWidth: 1.5,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  fileNumberDragging: {
    color: '#2563eb',
    fontWeight: '800',
  },
  dropTargetBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  dropTargetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  dropTargetLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#3b82f6',
    marginHorizontal: 4,
  },
  dropTargetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dropTargetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  thumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailApprovedBorder: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  thumbnailRejectedBorder: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailExtText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  fileName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  fileTypePill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  fileTypeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  filePathRef: {
    fontSize: 9,
    color: '#94a3b8',
    flex: 1,
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  editActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revisionFeedbackBox: {
    marginTop: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
  },
  revisionFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  revisionFeedbackTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  revisionFeedbackContent: {
    fontSize: 11,
    color: '#b91c1c',
    lineHeight: 15,
  },
  reviewedByText: {
    fontSize: 9,
    color: '#ef4444',
    marginTop: 3,
  },
  auditorNoteBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
  },
  auditorNoteTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 2,
  },
  auditorNoteContent: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  pendingCommentBox: {
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
  },
  pendingCommentTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 2,
  },
  pendingCommentContent: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  italicMutedText: {
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  auditorReviewRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  auditorCommentInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    fontSize: 11,
    color: '#0f172a',
    marginBottom: 6,
  },
  reviewBtnsGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  approveBtn: {
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
  approveBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  rejectBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  uploadDashedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  uploadDashedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  renameModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  renameModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  renameModalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 15,
  },
  renameInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  renameModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  renameCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  renameCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  renameSaveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  renameSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
