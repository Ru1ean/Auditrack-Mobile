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
import { requirementsAPI } from '../components/connect';

export default function RequirementsScreen() {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function loadRequirements() {
    setLoading(true);
    try {
      const response = await requirementsAPI.getMyAssignments();
      setRequirements(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.log('Requirements load error:', err);
      setRequirements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadRequirements();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequirements();
  };

  const renderRequirementCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.reqCard}
      onPress={() =>
        router.push({
          pathname: '/requirement-detail',
          params: { id: item.RequirementID || item.id },
        })
      }
    >
      <View style={styles.reqHeader}>
        <Text style={styles.reqTitle} numberOfLines={1}>
          {item.requirement_name || item.name}
        </Text>
        <View
          style={[
            styles.uploadBadge,
            item.has_uploaded ? styles.uploadedBadge : styles.notUploadedBadge,
          ]}
        >
          <Text style={styles.uploadStatusText}>
            {item.has_uploaded ? '✓ Uploaded' : '○ Pending'}
          </Text>
        </View>
      </View>

      <Text style={styles.reqDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.reqDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Office:</Text>
          <Text style={styles.detailValue}>{item.office_name || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Deadline:</Text>
          <Text style={styles.detailValue}>{formatDate(item.deadline)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() =>
          router.push({
            pathname: '/upload-document',
            params: { requirementId: item.RequirementID || item.id },
          })
        }
      >
        <Text style={styles.actionButtonText}>
          {item.has_uploaded ? 'View Upload' : 'Upload Document'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const formatDate = (input: any) => {
    if (!input) return 'N/A';
    let dateString = input;
    if (typeof input === 'object') {
      dateString = input.CreatedAt || input.created_at || input.createdAt || input.date || input.EventDate || input.event_date || input.deadline || '';
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
        <Text style={styles.loadingText}>Loading requirements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadRequirements}>
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {requirements.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No tasks assigned</Text>
        </View>
      ) : (
        <FlatList
          data={requirements}
          renderItem={renderRequirementCard}
          keyExtractor={(item) => item.RequirementID?.toString() || item.id?.toString() || Math.random().toString()}
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
  reqCard: {
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
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  reqTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  uploadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  uploadedBadge: {
    backgroundColor: '#d1fae5',
  },
  notUploadedBadge: {
    backgroundColor: '#fee2e2',
  },
  uploadStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  reqDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  reqDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
