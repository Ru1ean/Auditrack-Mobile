import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getProfilePicUrl, getStoredUser, storeUser, usersAPI } from '../components/connect';
import SmartUserAvatar from '../components/SmartUserAvatar';

export default function EditProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstname: '',
    middleinitial: '',
    lastname: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userId, setUserId] = useState<string | number>('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const stored = await getStoredUser();
        if (stored) {
          setUser(stored);
          setUserId(stored.userid || stored.id || '');
          setFormData({
            firstname: stored.firstname || '',
            middleinitial: stored.middleinitial || '',
            lastname: stored.lastname || '',
            email: stored.email || '',
          });
        }
      } catch (err) {
        console.log('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handlePickProfilePhoto = async () => {
    if (uploadingPhoto) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      const uid = userId || user?.userid || user?.id;
      if (!uid) {
        Alert.alert('Error', 'User ID not found.');
        return;
      }

      setUploadingPhoto(true);
      const updateRes = await usersAPI.uploadProfilePic(
        uid,
        asset.uri,
        asset.name,
        asset.mimeType || 'image/jpeg'
      );

      if (updateRes && (updateRes.success || updateRes.user)) {
        const updated = updateRes.user || updateRes;
        setUser(updated);
        await storeUser(updated);
        Alert.alert('Success', 'Profile photo updated successfully.');
      } else {
        Alert.alert('Upload Failed', updateRes?.message || 'Could not update profile photo.');
      }
    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      Alert.alert('Error', err?.message || 'Failed to update profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.firstname.trim() || !formData.lastname.trim() || !formData.email.trim()) {
      Alert.alert('Required Fields', 'First name, last name, and email are required.');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstname: formData.firstname.trim(),
        middleinitial: formData.middleinitial.trim() || null,
        lastname: formData.lastname.trim(),
        Email: formData.email.trim(),
        email: formData.email.trim(),
      };

      const response = await usersAPI.updateUser(userId, payload);

      if (response && (response.success || response.user)) {
        const updatedUser = response.user || response;
        await storeUser(updatedUser);
        Alert.alert('Profile Updated', 'Your profile details have been saved successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', response?.message || 'Update failed.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading profile details...</Text>
      </View>
    );
  }

  const avatarUrl = getProfilePicUrl(user);
  const initial = ((formData.firstname || 'U').charAt(0)).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Text style={styles.headerSubtitle}>Keep your personal credentials up to date</Text>
          </View>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                onPress={handlePickProfilePhoto}
                activeOpacity={0.85}
              >
                <SmartUserAvatar
                  user={user}
                  fullName={`${formData.firstname} ${formData.lastname}`.trim() || user?.full_name || 'User'}
                  size={78}
                  textSize={26}
                  ring="#e2e8f0"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarEditBadge}
                onPress={handlePickProfilePhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <MaterialIcons name="camera-alt" size={13} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handlePickProfilePhoto} disabled={uploadingPhoto}>
              <Text style={styles.changePhotoText}>
                {uploadingPhoto ? 'Uploading photo...' : 'Change Profile Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John"
              value={formData.firstname}
              onChangeText={(val) => handleInputChange('firstname', val)}
              editable={!saving}
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Middle Initial</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. A"
                maxLength={5}
                value={formData.middleinitial}
                onChangeText={(val) => handleInputChange('middleinitial', val)}
                editable={!saving}
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Doe"
                value={formData.lastname}
                onChangeText={(val) => handleInputChange('lastname', val)}
                editable={!saving}
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. john.doe@institution.edu"
              value={formData.email}
              onChangeText={(val) => handleInputChange('email', val)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
              placeholderTextColor="#64748b"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748b',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backBtnText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});
