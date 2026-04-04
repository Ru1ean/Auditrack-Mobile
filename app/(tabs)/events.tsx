import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { BASE_URL, eventsAPI } from '../../components/connect';

const normalizeName = (value: any) => String(value || '')
  .replace(/[^A-Za-z0-9.-]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .trim();

const toId = (value: any) => String(value ?? '');

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [downloadableFolders, setDownloadableFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, foldersRes] = await Promise.all([
        eventsAPI.getAllEvents(),
        eventsAPI.getDownloadableFolders().catch(() => ({ success: false, folders: [] })),
      ]);

      const list = Array.isArray(eventsRes)
        ? eventsRes
        : Array.isArray(eventsRes?.data)
          ? eventsRes.data
          : [];

      const folders = Array.isArray(foldersRes?.folders)
        ? foldersRes.folders
        : Array.isArray(foldersRes)
          ? foldersRes
          : [];

      setEvents(list);
      setDownloadableFolders(folders);
    } catch (error) {
      console.log('Events load error:', error);
      setEvents([]);
      setDownloadableFolders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredEvents = useMemo(() => {
    let list = events;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = events.filter((event) => {
        const name = String(event?.EventName || event?.event_name || '').toLowerCase();
        const code = String(event?.EventCode || event?.event_code || '').toLowerCase();
        const desc = String(event?.Description || event?.description || '').toLowerCase();
        return name.includes(term) || code.includes(term) || desc.includes(term);
      });
    }

    return [...list].sort((a, b) => {
      const nameA = String(a?.EventName || a?.event_name || '').toLowerCase();
      const nameB = String(b?.EventName || b?.event_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [events, searchTerm]);

  const isDownloadable = (event: any) => {
    const eventName = String(event?.EventName || event?.event_name || '');
    const normalizedEvent = normalizeName(eventName);
    return downloadableFolders.some((folder) => normalizeName(folder) === normalizedEvent);
  };

  const handleDownload = async (event: any) => {
    const eventName = String(event?.EventName || event?.event_name || '');
    if (!eventName) {
      Alert.alert('Download failed', 'Missing event name.');
      return;
    }

    if (!isDownloadable(event)) {
      Alert.alert('Not available', 'No downloadable folder found for this event.');
      return;
    }

    try {
      const url = `${BASE_URL}/events/download/${encodeURIComponent(eventName)}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Download failed', 'Cannot open download link on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert('Download failed', error?.message || 'Unable to download event files.');
    }
  };

  const renderEventRow = ({ item }: { item: any }) => {
    const status = String(item?.status || 'active').toLowerCase();
    const downloadable = isDownloadable(item);

    return (
      <View style={styles.eventRow}>
        <View style={styles.eventIconWrap}>
          <Text style={styles.eventIconText}>◷</Text>
        </View>

        <View style={styles.eventMain}>
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventTitle} numberOfLines={1}>{item?.EventName || item?.event_name || 'Untitled Event'}</Text>
            <View style={[styles.statusBadge, status === 'active' ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, status === 'active' ? styles.statusActiveText : styles.statusInactiveText]}>
                {status === 'active' ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <Text style={styles.eventCode} numberOfLines={1}>{item?.EventCode || item?.event_code || '-'}</Text>
          <Text style={styles.eventDescription} numberOfLines={1}>{item?.Description || item?.description || ''}</Text>
        </View>

        {downloadable && (
          <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
            <Text style={styles.downloadBtnText}>↓ Download</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Events</Text>

        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search events..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {filteredEvents.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>{searchTerm ? 'No matching events found.' : 'No events available.'}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => toId(item?.EventID || item?.id)}
          renderItem={renderEventRow}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edeff3',
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbe2ea',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    color: '#1f2937',
    fontWeight: '800',
  },
  searchInput: {
    height: 34,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  eventRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconText: {
    color: '#6366f1',
    fontSize: 10,
    lineHeight: 10,
    fontWeight: '800',
  },
  eventMain: {
    flex: 1,
    minWidth: 0,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTitle: {
    color: '#0f172a',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '800',
    maxWidth: '70%',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  statusActiveText: {
    color: '#15803d',
  },
  statusInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  statusInactiveText: {
    color: '#64748b',
  },
  eventCode: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  eventDescription: {
    marginTop: 1,
    color: '#94a3b8',
    fontSize: 10,
  },
  downloadBtn: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  downloadBtnText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
});
