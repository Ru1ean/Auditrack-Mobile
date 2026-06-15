import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { eventsAPI } from '../components/connect';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getAllEvents();
      setEvents(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.log('Events load error:', err);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadEvents();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const renderEventCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => router.push({ pathname: '/event-detail', params: { id: item.EventID || item.id } })}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.event_name || item.name}</Text>
        <View style={[styles.statusBadge, getStatusStyle(item.compliance_status)]}>
          <Text style={styles.statusText}>{item.compliance_status || 'Not Submitted'}</Text>
        </View>
      </View>
      <Text style={styles.eventCode}>{item.event_code || item.code}</Text>
      <Text style={styles.eventDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.eventFooter}>
        <Text style={styles.eventDate}>{formatDate(item.created_at || item.date)}</Text>
      </View>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { backgroundColor: '#d1fae5' };
      case 'not complied':
      case 'not compiled':
        return { backgroundColor: '#fee2e2' };
      default:
        return { backgroundColor: '#fef3c7' };
    }
  };

  const formatDate = (input: any) => {
    if (!input) return 'N/A';
    let dateString = input;
    if (typeof input === 'object') {
      dateString = input.CreatedAt || input.created_at || input.createdAt || input.date || input.EventDate || input.event_date || '';
    }
    try {
      const date = new Date(String(dateString));
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {events.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No events available</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventCard}
          keyExtractor={(item) => item.EventID?.toString() || item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  listContainer: {
    padding: 12,
    paddingBottom: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  eventCode: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  eventDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  eventDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
