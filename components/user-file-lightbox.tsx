import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAuthHeaders } from './connect';

type UserFileLightboxProps = {
  visible: boolean;
  file: { url: string; fileName: string } | null;
  allowDownload?: boolean;
  onClose: () => void;
};

const getExtension = (value: string) => {
  const clean = String(value || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
};

const isImageExt = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'].includes(ext);

export default function UserFileLightbox({ visible, file, allowDownload = true, onClose }: UserFileLightboxProps) {
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void getAuthHeaders().then(setAuthHeaders);
  }, [visible]);

  if (!visible || !file?.url) return null;

  const url = String(file.url);
  const fileName = String(file.fileName || 'download').trim() || 'download';
  const ext = getExtension(file.fileName || url);
  const isImage = isImageExt(ext);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const headers = await getAuthHeaders();
      if (Platform.OS === 'web') {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to download file');
        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);
        return;
      }

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Download unavailable', 'This file cannot be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Unable to download this file.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.topBar}>
          {allowDownload ? (
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                void handleDownload();
              }}
              disabled={downloading}
            >
              <Text style={styles.downloadBtnText}>{downloading ? 'Downloading...' : 'Download'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inspectBadge}>
              <Text style={styles.inspectBadgeText}>Inspection Mode</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onClose();
            }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {isImage ? (
            <Image
              source={{ uri: url, headers: authHeaders }}
              style={styles.previewImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.unsupportedWrap}>
              <Text style={styles.unsupportedTitle}>{fileName}</Text>
              <Text style={styles.unsupportedText}>Preview is not available for this file type.</Text>
              <TouchableOpacity style={styles.openExternalBtn} onPress={() => void handleDownload()}>
                <Text style={styles.openExternalBtnText}>Open / Download</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  inspectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  inspectBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    width: '94%',
    height: '78%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  unsupportedWrap: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  unsupportedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  unsupportedText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  openExternalBtn: {
    marginTop: 6,
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  openExternalBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
