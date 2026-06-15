import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAuthHeaders, requirementsAPI } from './connect';

type EvidenceSubmissionModalProps = {
  visible: boolean;
  requirement: any;
  users: any[];
  mode: 'work' | 'admin';
  canUpload: boolean;
  uploading?: boolean;
  unsubmitting?: boolean;
  normalizeUrl: (value: any) => string;
  getProfilePicUrl: (user: any) => string | undefined;
  getUserDisplayName: (user: any, index: number) => string;
  onClose: () => void;
  onSelectFile: () => void;
  onUnsubmit: () => void;
  onViewFile: (user: any) => void;
};

const getExtension = (value: string) => {
  const clean = String(value || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
};

const isImageExt = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext);

const getFileTypeLabel = (ext: string) => {
  if (isImageExt(ext)) return 'Image';
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'Document';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Spreadsheet';
  return ext ? ext.toUpperCase() : 'File';
};

const hasUploaded = (user: any) =>
  user?.HasUploaded === 1 ||
  user?.HasUploaded === true ||
  user?.has_uploaded === 1 ||
  user?.has_uploaded === true;

export default function EvidenceSubmissionModal({
  visible,
  requirement,
  users,
  mode,
  canUpload,
  uploading = false,
  unsubmitting = false,
  normalizeUrl,
  getProfilePicUrl,
  getUserDisplayName,
  onClose,
  onSelectFile,
  onUnsubmit,
  onViewFile,
}: EvidenceSubmissionModalProps) {
  const requirementId = requirement?.RequirementID || requirement?.requirement_id || requirement?.id;
  const title =
    requirement?.RequirementCode ||
    requirement?.requirement_code ||
    requirement?.code ||
    'Requirement';

  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [fileByUserId, setFileByUserId] = useState<Record<number, any>>({});
  const [loadingByUserId, setLoadingByUserId] = useState<Record<number, boolean>>({});

  const uploadedUserIds = useMemo(
    () =>
      (users || [])
        .filter((user) => hasUploaded(user))
        .map((user) => Number(user?.UserID || user?.user_id || user?.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [users]
  );

  useEffect(() => {
    if (!visible) return;
    void getAuthHeaders().then(setAuthHeaders);
  }, [visible]);

  useEffect(() => {
    if (!visible || !requirementId || uploadedUserIds.length === 0) {
      setFileByUserId({});
      setLoadingByUserId({});
      return;
    }

    let cancelled = false;
    const nextLoading = uploadedUserIds.reduce<Record<number, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    setLoadingByUserId(nextLoading);
    setFileByUserId({});

    const fetchFiles = async () => {
      await Promise.all(
        uploadedUserIds.map(async (userId) => {
          try {
            const response = await requirementsAPI.getUserFile(String(requirementId), String(userId));
            const file =
              response?.file ||
              response?.data?.file ||
              (response?.url ? { url: response.url, fileName: response.fileName } : null);
            if (!cancelled && file?.url) {
              setFileByUserId((prev) => ({
                ...prev,
                [userId]: {
                  ...file,
                  url: normalizeUrl(file.url),
                  fileName: file.fileName || file.FileName || file.name || 'Uploaded file',
                },
              }));
            }
          } catch {
            // ignore missing files
          } finally {
            if (!cancelled) {
              setLoadingByUserId((prev) => ({ ...prev, [userId]: false }));
            }
          }
        })
      );
    };

    void fetchFiles();
    return () => {
      cancelled = true;
    };
  }, [visible, requirementId, uploadedUserIds.join(','), normalizeUrl]);

  const workUser = mode === 'work' ? users[0] : null;
  const workUserId = workUser ? Number(workUser?.UserID || workUser?.user_id || workUser?.id) : null;
  const workHasUploaded = workUser ? hasUploaded(workUser) : false;
  const workFile = workUserId ? fileByUserId[workUserId] : null;
  const workLoading = workUserId ? loadingByUserId[workUserId] : false;

  const assignedCount = users.length;
  const turnedInCount = users.filter((user) => hasUploaded(user)).length;

  const renderWorkEvidence = () => {
    const ext = getExtension(workFile?.fileName || workFile?.url || '');
    const statusLabel = workHasUploaded ? 'Submitted' : 'Assigned';

    return (
      <View style={styles.evidenceSection}>
        <View style={styles.evidenceHeader}>
          <Text style={styles.evidenceTitle}>Evidence</Text>
          <Text style={[styles.evidenceStatus, workHasUploaded && styles.evidenceStatusSubmitted]}>
            {statusLabel}
          </Text>
        </View>

        {!workHasUploaded ? (
          canUpload ? (
            <TouchableOpacity
              style={[styles.selectFileBtn, uploading && styles.selectFileBtnDisabled]}
              onPress={onSelectFile}
              disabled={uploading}
            >
              <Text style={styles.selectFileBtnText}>{uploading ? 'Uploading...' : '+ Select file'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.readOnlyHint}>Only assigned personnel can upload evidence.</Text>
          )
        ) : (
          <View style={styles.submittedRow}>
            <TouchableOpacity
              style={styles.fileCard}
              onPress={() => workUser && onViewFile(workUser)}
              disabled={!workFile?.url || workLoading}
            >
              <View style={styles.fileCardTextWrap}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {workLoading ? 'Loading...' : workFile?.fileName || 'Uploaded file'}
                </Text>
                <Text style={styles.fileType}>{getFileTypeLabel(ext)}</Text>
              </View>
              <View style={styles.thumbWrap}>
                {workLoading ? (
                  <ActivityIndicator size="small" color="#94a3b8" />
                ) : workFile?.url && isImageExt(ext) ? (
                  <Image
                    source={{ uri: workFile.url, headers: authHeaders }}
                    style={styles.thumbImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.thumbFallback}>{(ext || 'FILE').toUpperCase()}</Text>
                )}
              </View>
            </TouchableOpacity>

            {canUpload && (
              <TouchableOpacity
                style={[styles.removeBtn, unsubmitting && styles.removeBtnDisabled]}
                onPress={onUnsubmit}
                disabled={unsubmitting}
              >
                <Text style={styles.removeBtnText}>{unsubmitting ? '...' : '✕'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderAdminUserList = () => (
    <View style={styles.adminSection}>
      <View style={styles.adminStatsRow}>
        <View style={styles.adminStatCard}>
          <Text style={styles.adminStatValue}>{assignedCount}</Text>
          <Text style={styles.adminStatLabel}>Assigned</Text>
        </View>
        <View style={[styles.adminStatCard, styles.adminStatCardSubmitted]}>
          <Text style={[styles.adminStatValue, styles.adminStatValueSubmitted]}>{turnedInCount}</Text>
          <Text style={[styles.adminStatLabel, styles.adminStatLabelSubmitted]}>Submitted</Text>
        </View>
      </View>

      {users.map((user, index) => {
        const userId = Number(user?.UserID || user?.user_id || user?.id);
        const uploaded = hasUploaded(user);
        const file = userId ? fileByUserId[userId] : null;
        const loading = userId ? loadingByUserId[userId] : false;
        const displayName = getUserDisplayName(user, index);
        const ext = getExtension(file?.fileName || file?.url || '');
        const profileUrl = getProfilePicUrl(user);

        return (
          <TouchableOpacity
            key={`submission-user-${userId || index}`}
            style={[styles.adminUserCard, uploaded && styles.adminUserCardUploaded]}
            onPress={() => uploaded && onViewFile(user)}
            disabled={!uploaded || !file?.url}
          >
            <View style={styles.adminUserTop}>
              <View style={styles.adminAvatarWrap}>
                {profileUrl ? (
                  <Image source={{ uri: profileUrl }} style={styles.adminAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.adminAvatarFallback}>
                    <Text style={styles.adminAvatarFallbackText}>{displayName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                {uploaded && <View style={styles.adminAvatarCheck}><Text style={styles.adminAvatarCheckText}>✓</Text></View>}
              </View>
              <Text style={styles.adminUserName} numberOfLines={1}>{displayName}</Text>
            </View>

            <View style={styles.adminFilePreview}>
              <View style={styles.adminFileTextWrap}>
                {!uploaded ? (
                  <>
                    <Text style={styles.adminFileMuted}>No attachment submitted</Text>
                    <Text style={styles.adminFileTypeMuted}>File</Text>
                  </>
                ) : loading ? (
                  <>
                    <Text style={styles.adminFileMuted}>Loading preview...</Text>
                    <Text style={styles.adminFileTypeMuted}>File</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.adminFileName} numberOfLines={2}>{file?.fileName || 'Attachment'}</Text>
                    <Text style={styles.adminFileTypeMuted}>{getFileTypeLabel(ext)}</Text>
                  </>
                )}
              </View>
              <View style={styles.adminThumbWrap}>
                {uploaded && !loading && file?.url && isImageExt(ext) ? (
                  <Image source={{ uri: file.url, headers: authHeaders }} style={styles.adminThumb} contentFit="cover" />
                ) : (
                  <Text style={styles.adminThumbFallback}>{uploaded ? (ext || 'FILE').toUpperCase() : '—'}</Text>
                )}
              </View>
            </View>

            <Text style={[styles.adminUserStatus, uploaded && styles.adminUserStatusSubmitted]}>
              {uploaded ? 'Submitted' : 'Assigned'}
            </Text>
          </TouchableOpacity>
        );
      })}

      {users.length === 0 && (
        <Text style={styles.emptyUsersText}>No assigned users.</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {mode === 'work' ? renderWorkEvidence() : renderAdminUserList()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 12,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  closeBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 28,
  },
  evidenceSection: {
    gap: 12,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  evidenceStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  evidenceStatusSubmitted: {
    color: '#059669',
  },
  selectFileBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  selectFileBtnDisabled: {
    opacity: 0.6,
  },
  selectFileBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  readOnlyHint: {
    fontSize: 13,
    color: '#94a3b8',
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  fileCardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  fileType: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnDisabled: {
    opacity: 0.5,
  },
  removeBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  adminSection: {
    gap: 12,
  },
  adminStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adminStatCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  adminStatCardSubmitted: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  adminStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  adminStatValueSubmitted: {
    color: '#047857',
  },
  adminStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  adminStatLabelSubmitted: {
    color: '#059669',
  },
  adminUserCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  adminUserCardUploaded: {
    borderColor: '#a7f3d0',
  },
  adminUserTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adminAvatarWrap: {
    position: 'relative',
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  adminAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatarFallbackText: {
    color: '#475569',
    fontWeight: '700',
  },
  adminAvatarCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatarCheckText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  adminUserName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  adminFilePreview: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 74,
  },
  adminFileTextWrap: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  adminFileMuted: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  adminFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  adminFileTypeMuted: {
    marginTop: 2,
    fontSize: 12,
    color: '#94a3b8',
  },
  adminThumbWrap: {
    width: 88,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  adminThumb: {
    width: '100%',
    height: '100%',
  },
  adminThumbFallback: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  adminUserStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  adminUserStatusSubmitted: {
    color: '#059669',
  },
  emptyUsersText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
    paddingVertical: 20,
  },
});
