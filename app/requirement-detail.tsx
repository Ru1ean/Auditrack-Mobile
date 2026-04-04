import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { requirementsAPI } from '../components/connect';

export default function RequirementDetailScreen() {
  const { id } = useLocalSearchParams();
  const [requirement, setRequirement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (id) loadRequirementDetails();
  }, [id]);

  const loadRequirementDetails = async () => {
    setLoading(true);
    try {
      const response = await requirementsAPI.getMyAssignments();
      const reqs = Array.isArray(response) ? response : response.data || [];
      const found = reqs.find(
        (r: any) => (r.RequirementID?.toString() || r.id?.toString()) === id?.toString()
      );
      setRequirement(found);
    } catch (err) {
      console.log('Requirement detail load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!requirement) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Requirement not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Task Details</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.name}>{requirement.requirement_name || requirement.name}</Text>

          <View style={styles.statusContainer}>
            <Text style={styles.label}>Upload Status:</Text>
            <View
              style={[
                styles.uploadBadge,
                requirement.has_uploaded ? styles.uploadedBadge : styles.pendingBadge,
              ]}
            >
              <Text style={styles.badgeText}>
                {requirement.has_uploaded ? '✓ Uploaded' : '○ Pending'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{requirement.description || 'No description'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <DetailRow label="Office" value={requirement.office_name || 'N/A'} />
            <DetailRow label="Deadline" value={formatDate(requirement.deadline)} />
            <DetailRow label="Assigned By" value={requirement.assigned_by || 'N/A'} />
          </View>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() =>
              router.push({
                pathname: '/upload-document',
                params: { requirementId: requirement.RequirementID || requirement.id },
              })
            }
          >
            <Text style={styles.uploadButtonText}>
              {requirement.has_uploaded ? 'View Upload' : 'Upload Document'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton2} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  uploadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  uploadedBadge: {
    backgroundColor: '#d1fae5',
  },
  pendingBadge: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  description: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton2: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
});
