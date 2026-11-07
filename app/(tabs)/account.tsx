import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getStoredUser,
  normalizeUser,
  storeUser,
  usersAPI,
} from '../../components/connect';
import SmartUserAvatar from '../../components/SmartUserAvatar';

export default function AccountScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile Tab Navigation ('overview' | 'password') matching Web Profile.jsx
  const [activeTab, setActiveTab] = useState<'overview' | 'password'>('overview');

  // Edit Profile Modal state (Matching Web EditProfileModal.jsx)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleInitial, setEditMiddleInitial] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [pickedPhotoAsset, setPickedPhotoAsset] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');

  // ChangePasswordCard state (Matching Web ChangePasswordCard.jsx)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pwStatus, setPwStatus] = useState<{ type: '' | 'error' | 'success'; message: string }>({
    type: '',
    message: '',
  });

  const loadUser = useCallback(async () => {
    try {
      const res = await usersAPI.getLoggedInUser();
      const nextUser = res?.user ? normalizeUser(res.user) : null;
      if (nextUser) {
        setUser(nextUser);
        await storeUser(nextUser);
        return nextUser;
      }
    } catch {
      const stored = await getStoredUser();
      if (stored) {
        setUser(stored);
        return stored;
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // Coowned countdown timer for Resend OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const openEditProfileModal = () => {
    setEditFirstName(user?.FirstName || user?.firstname || '');
    setEditMiddleInitial(user?.MiddleInitial || user?.middleinitial || '');
    setEditLastName(user?.LastName || user?.lastname || '');
    setEditEmail(user?.Email || user?.email || '');
    setPickedPhotoAsset(null);
    setEditError('');
    setIsEditOpen(true);
  };

  const handlePickPhotoInModal = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setEditError('Image size must be 5MB or less.');
        return;
      }
      setPickedPhotoAsset(asset);
      setEditError('');
    } catch (err: any) {
      setEditError(err?.message || 'Failed to pick image.');
    }
  };

  const handleSaveEditProfile = async () => {
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      setEditError('First name, last name, and email are required.');
      return;
    }

    const uid = user?.UserID || user?.userid || user?.id;
    if (!uid) {
      setEditError('User ID not found.');
      return;
    }

    setSavingProfile(true);
    setEditError('');
    try {
      // Upload photo first if selected
      if (pickedPhotoAsset) {
        await usersAPI.uploadProfilePic(
          uid,
          pickedPhotoAsset.uri,
          pickedPhotoAsset.name || 'profile.jpg',
          pickedPhotoAsset.mimeType || 'image/jpeg'
        );
      }

      const payload = {
        firstname: editFirstName.trim(),
        middleinitial: editMiddleInitial.trim() || null,
        lastname: editLastName.trim(),
        email: editEmail.trim(),
        Email: editEmail.trim(),
      };

      const res = await usersAPI.updateUser(uid, payload);
      if (res?.success || res?.user) {
        await loadUser();
        setIsEditOpen(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        setEditError(res?.message || 'Failed to update profile.');
      }
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password validation & strength helpers matching Web ChangePasswordCard.jsx
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: '', color: '#e2e8f0', textColor: '#64748b', bars: 0 };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { label: 'Weak', color: '#ef4444', textColor: '#dc2626', bars: 1 };
    if (score === 2) return { label: 'Fair', color: '#f59e0b', textColor: '#d97706', bars: 2 };
    if (score === 3) return { label: 'Good', color: '#3b82f6', textColor: '#2563eb', bars: 3 };
    return { label: 'Strong', color: '#10b981', textColor: '#059669', bars: 4 };
  };

  const strength = getPasswordStrength(newPassword);

  const validateBeforeOtp = () => {
    if (!currentPassword.trim()) {
      setPwStatus({ type: 'error', message: 'Please enter your current password.' });
      return false;
    }
    if (!newPassword.trim()) {
      setPwStatus({ type: 'error', message: 'Please enter a new password.' });
      return false;
    }
    if (newPassword.length < 6) {
      setPwStatus({
        type: 'error',
        message: 'New password must be at least 6 characters long.',
      });
      return false;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({
        type: 'error',
        message: 'New password and confirmation do not match.',
      });
      return false;
    }
    if (currentPassword === newPassword) {
      setPwStatus({
        type: 'error',
        message: 'New password must be different from your current password.',
      });
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    setPwStatus({ type: '', message: '' });
    if (!validateBeforeOtp()) return;

    try {
      setSendingOtp(true);
      const res = await usersAPI.sendChangePasswordOtp({ currentPassword });
      if (res?.success) {
        setOtpSent(true);
        setCooldown(60);
        setPwStatus({
          type: 'success',
          message: res.message || 'Verification code sent to your email address.',
        });
      } else {
        setPwStatus({
          type: 'error',
          message: res?.message || 'Failed to send verification code.',
        });
      }
    } catch (error: any) {
      setPwStatus({
        type: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to send verification code.',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleClearPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpSent(false);
    setPwStatus({ type: '', message: '' });
  };

  const handleVerifyAndSavePassword = async () => {
    setPwStatus({ type: '', message: '' });
    if (!validateBeforeOtp()) return;

    if (!otp || otp.trim().length < 6) {
      setPwStatus({
        type: 'error',
        message: 'Please enter the 6-digit OTP sent to your email.',
      });
      return;
    }

    try {
      setSavingPassword(true);
      const res = await usersAPI.verifyAndChangePassword({
        currentPassword,
        newPassword,
        otp: otp.trim(),
      });

      if (res?.success) {
        setPwStatus({
          type: 'success',
          message: res.message || 'Your password has been changed successfully!',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setOtpSent(false);
        setCooldown(0);
      } else {
        setPwStatus({
          type: 'error',
          message: res?.message || 'Failed to update password.',
        });
      }
    } catch (error: any) {
      setPwStatus({
        type: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const fullName = user
    ? `${user.FirstName || user.firstname || ''} ${
        user.MiddleInitial || user.middleinitial
          ? `${user.MiddleInitial || user.middleinitial}. `
          : ''
      }${user.LastName || user.lastname || ''}`.trim()
    : 'Not logged in';

  const roleName =
    user?.RoleName ||
    user?.rolename ||
    (user?.roleid === 1
      ? 'Admin'
      : user?.roleid === 2
      ? 'Office Head'
      : user?.roleid === 3
      ? 'Staff'
      : user?.roleid === 4
      ? 'Auditor'
      : 'Office Personnel');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Single Main Profile Card (1:1 Match with Web Profile.jsx) ─── */}
      <View style={styles.articleCard}>
        {/* Top Summary Header */}
        <View style={styles.topHeaderSection}>
          <View style={styles.userLeftRow}>
            <SmartUserAvatar
              user={user}
              fullName={fullName}
              size={56}
              textSize={18}
              ring="#f1f5f9"
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.myAccountTag}>MY ACCOUNT</Text>
              <View style={styles.nameAndRoleRow}>
                <Text style={styles.fullNameText}>{fullName}</Text>
                <View style={styles.rolePill}>
                  <View style={styles.roleEmeraldDot} />
                  <Text style={styles.rolePillText}>{roleName}</Text>
                </View>
              </View>
              <Text style={styles.emailSubText} numberOfLines={1}>
                {user?.Email || user?.email || ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={openEditProfileModal}
            activeOpacity={0.85}
          >
            <MaterialIcons name="edit" size={14} color="#ffffff" />
            <Text style={styles.editProfileBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Profile Options Navigation Bar (Matching Web Profile.jsx) ─── */}
        <View style={styles.tabsBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('overview')}
            style={[
              styles.tabButton,
              activeTab === 'overview' && styles.tabButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="person-outline"
              size={16}
              color={activeTab === 'overview' ? '#2563eb' : '#64748b'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'overview' && styles.tabButtonTextActive,
              ]}
            >
              Account Information
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('password')}
            style={[
              styles.tabButton,
              activeTab === 'password' && styles.tabButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="vpn-key"
              size={16}
              color={activeTab === 'password' ? '#2563eb' : '#64748b'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'password' && styles.tabButtonTextActive,
              ]}
            >
              Password &amp; Security
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Tab Content ─── */}
        {activeTab === 'overview' ? (
          <View style={styles.overviewBody}>
            <Text style={styles.overviewHeading}>Account information</Text>
            <Text style={styles.overviewSubheading}>
              Basic information connected to your login.
            </Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxLabel}>Full name</Text>
                <Text style={styles.infoBoxValue}>{fullName || '-'}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxLabel}>Email address</Text>
                <Text style={styles.infoBoxValue}>
                  {user?.Email || user?.email || '-'}
                </Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxLabel}>Role</Text>
                <Text style={styles.infoBoxValue}>{roleName}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* ─── 1:1 Web ChangePasswordCard.jsx ─── */
          <View style={styles.passwordTabWrap}>
            <View style={styles.changePwCard}>
              {/* Card Header */}
              <View style={styles.changePwHeader}>
                <View style={styles.changePwHeaderLeft}>
                  <View style={styles.changePwIconBox}>
                    <MaterialIcons name="vpn-key" size={18} color="#4f46e5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.changePwTitle}>Password &amp; Security</Text>
                    <Text style={styles.changePwSubtitle}>
                      Update your account password using email OTP verification
                    </Text>
                  </View>
                </View>

                {otpSent ? (
                  <View style={styles.otpVerifiedPill}>
                    <View style={styles.otpVerifiedDot} />
                    <Text style={styles.otpVerifiedText}>OTP Sent to Email</Text>
                  </View>
                ) : null}
              </View>

              {/* Form Body */}
              <View style={styles.changePwBody}>
                {/* Status Banner */}
                {pwStatus.message ? (
                  <View
                    style={[
                      styles.pwStatusBanner,
                      pwStatus.type === 'error'
                        ? styles.pwStatusBannerError
                        : styles.pwStatusBannerSuccess,
                    ]}
                  >
                    <MaterialIcons
                      name={pwStatus.type === 'error' ? 'error' : 'check-circle'}
                      size={16}
                      color={pwStatus.type === 'error' ? '#ef4444' : '#10b981'}
                    />
                    <Text
                      style={[
                        styles.pwStatusText,
                        pwStatus.type === 'error'
                          ? { color: '#b91c1c' }
                          : { color: '#047857' },
                      ]}
                    >
                      {pwStatus.message}
                    </Text>
                  </View>
                ) : null}

                {/* 1. Current Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Current Password</Text>
                  <View
                    style={[
                      styles.pwInputContainer,
                      otpSent && styles.pwInputContainerDisabled,
                    ]}
                  >
                    <MaterialIcons
                      name="lock-outline"
                      size={16}
                      color="#94a3b8"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.pwTextInput}
                      secureTextEntry={!showCurrentPassword}
                      value={currentPassword}
                      onChangeText={(text) => {
                        setCurrentPassword(text);
                        if (otpSent) setOtpSent(false);
                      }}
                      placeholder="Enter your current password"
                      placeholderTextColor="#94a3b8"
                      editable={!otpSent}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowCurrentPassword((p) => !p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name={showCurrentPassword ? 'visibility-off' : 'visibility'}
                        size={18}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>
                  </View>
                  {otpSent ? (
                    <View style={styles.verifiedSubRow}>
                      <MaterialIcons name="check-circle" size={14} color="#059669" />
                      <Text style={styles.verifiedSubText}>Password verified</Text>
                    </View>
                  ) : null}
                </View>

                {/* 2. New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>New Password</Text>
                  <View style={styles.pwInputContainer}>
                    <MaterialIcons
                      name="lock-outline"
                      size={16}
                      color="#94a3b8"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.pwTextInput}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword((p) => !p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name={showNewPassword ? 'visibility-off' : 'visibility'}
                        size={18}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* 4-Bar Password Strength Indicator */}
                  {newPassword ? (
                    <View style={{ marginTop: 8 }}>
                      <View style={styles.strengthBarsRow}>
                        {[1, 2, 3, 4].map((bar) => (
                          <View
                            key={bar}
                            style={[
                              styles.strengthBarSegment,
                              {
                                backgroundColor:
                                  bar <= strength.bars ? strength.color : '#e2e8f0',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.strengthLabelsRow}>
                        <Text
                          style={[
                            styles.strengthStatusLabel,
                            { color: strength.textColor },
                          ]}
                        >
                          {strength.label}
                        </Text>
                        <Text style={styles.strengthMinLabel}>Min. 6 characters</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* 3. Confirm New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Confirm New Password</Text>
                  <View style={styles.pwInputContainer}>
                    <MaterialIcons
                      name="lock-outline"
                      size={16}
                      color="#94a3b8"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.pwTextInput}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((p) => !p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                        size={18}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>
                  </View>

                  {confirmPassword ? (
                    <Text
                      style={[
                        styles.matchIndicatorText,
                        confirmPassword === newPassword
                          ? { color: '#059669' }
                          : { color: '#ef4444' },
                      ]}
                    >
                      {confirmPassword === newPassword
                        ? '✓ Passwords match'
                        : '✕ Passwords do not match'}
                    </Text>
                  ) : null}
                </View>

                {/* 4. OTP Verification Box (Matching Web ChangePasswordCard.jsx) */}
                <View style={styles.otpBox}>
                  <View style={styles.otpBoxHeader}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.otpBoxTitle}>Email OTP Verification</Text>
                      <Text style={styles.otpBoxDesc}>
                        We&apos;ll send a 6-digit verification code to{' '}
                        <Text style={{ fontWeight: '700', color: '#334155' }}>
                          {user?.Email || user?.email || 'your email'}
                        </Text>{' '}
                        to authorize this change.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.sendOtpBtn,
                        otpSent ? styles.sendOtpBtnResend : styles.sendOtpBtnPrimary,
                        (sendingOtp || cooldown > 0) && styles.btnDisabled,
                      ]}
                      onPress={handleSendOtp}
                      disabled={sendingOtp || cooldown > 0}
                      activeOpacity={0.85}
                    >
                      {sendingOtp ? (
                        <ActivityIndicator
                          size="small"
                          color={otpSent ? '#1d4ed8' : '#ffffff'}
                        />
                      ) : (
                        <MaterialIcons
                          name="mail-outline"
                          size={14}
                          color={otpSent ? '#1d4ed8' : '#ffffff'}
                        />
                      )}
                      <Text
                        style={[
                          styles.sendOtpBtnText,
                          otpSent ? { color: '#1d4ed8' } : { color: '#ffffff' },
                        ]}
                      >
                        {sendingOtp
                          ? 'Sending...'
                          : cooldown > 0
                          ? `Resend (${cooldown}s)`
                          : otpSent
                          ? 'Resend OTP'
                          : 'Send Verification Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {otpSent ? (
                    <View style={styles.otpInputSection}>
                      <Text style={styles.otpInputLabel}>
                        ENTER 6-DIGIT VERIFICATION CODE
                      </Text>
                      <TextInput
                        style={styles.otpCodeInput}
                        value={otp}
                        onChangeText={(val) =>
                          setOtp(val.replace(/\D/g, '').slice(0, 6))
                        }
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="000000"
                        placeholderTextColor="#cbd5e1"
                      />
                    </View>
                  ) : null}
                </View>

                {/* 5. Footer Action Buttons */}
                <View style={styles.changePwFooter}>
                  <Text style={styles.footerTipText}>
                    Use a strong password you don&apos;t use elsewhere.
                  </Text>
                  <View style={styles.footerBtnsRow}>
                    {(currentPassword || newPassword || confirmPassword || otp) ? (
                      <TouchableOpacity
                        style={styles.clearFieldsBtn}
                        onPress={handleClearPasswordFields}
                      >
                        <Text style={styles.clearFieldsBtnText}>Clear Fields</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.updatePwBtn,
                        (!otpSent || otp.length < 6 || savingPassword) &&
                          styles.btnDisabled,
                      ]}
                      onPress={handleVerifyAndSavePassword}
                      disabled={!otpSent || otp.length < 6 || savingPassword}
                      activeOpacity={0.85}
                    >
                      {savingPassword ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <MaterialIcons name="check" size={15} color="#ffffff" />
                      )}
                      <Text style={styles.updatePwBtnText}>
                        {savingPassword ? 'Updating...' : 'Update Password'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ─── Edit Profile Modal (1:1 Match with Web EditProfileModal.jsx) ─── */}
      <Modal
        visible={isEditOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !savingProfile && setIsEditOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !savingProfile && setIsEditOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => !savingProfile && setIsEditOpen(false)}
                disabled={savingProfile}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={styles.modalBody}>
              {editError ? (
                <View style={styles.modalErrorBox}>
                  <MaterialIcons name="error" size={16} color="#dc2626" />
                  <Text style={styles.modalErrorText}>{editError}</Text>
                </View>
              ) : null}

              {/* Profile Picture Uploader Row */}
              <View style={styles.photoPickerCard}>
                <SmartUserAvatar
                  user={
                    pickedPhotoAsset
                      ? { ...user, profilepic: pickedPhotoAsset.uri }
                      : user
                  }
                  fullName={`${editFirstName} ${editLastName}`.trim() || fullName}
                  size={64}
                  textSize={20}
                  ring="#ffffff"
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.photoPickerTitle}>Profile Picture</Text>
                  <Text style={styles.photoPickerSub}>
                    JPG, PNG, WEBP or GIF (max 5MB)
                  </Text>
                  <View style={styles.photoBtnsRow}>
                    <TouchableOpacity
                      style={styles.choosePhotoBtn}
                      onPress={handlePickPhotoInModal}
                      disabled={savingProfile}
                    >
                      <Text style={styles.choosePhotoBtnText}>Choose Photo</Text>
                    </TouchableOpacity>
                    {pickedPhotoAsset ? (
                      <TouchableOpacity
                        style={styles.resetPhotoBtn}
                        onPress={() => setPickedPhotoAsset(null)}
                        disabled={savingProfile}
                      >
                        <Text style={styles.resetPhotoBtnText}>Reset</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Name Fields Grid */}
              <View style={styles.nameFieldsRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.modalFieldLabel}>
                    First Name <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder="First name"
                    placeholderTextColor="#94a3b8"
                    editable={!savingProfile}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.modalFieldLabel}>Middle Initial</Text>
                  <TextInput
                    style={[styles.modalInput, { textAlign: 'center' }]}
                    value={editMiddleInitial}
                    onChangeText={setEditMiddleInitial}
                    maxLength={5}
                    placeholder="M.I."
                    placeholderTextColor="#94a3b8"
                    editable={!savingProfile}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalFieldLabel}>
                  Last Name <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Last name"
                  placeholderTextColor="#94a3b8"
                  editable={!savingProfile}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalFieldLabel}>
                  Email Address <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email address"
                  placeholderTextColor="#94a3b8"
                  editable={!savingProfile}
                />
              </View>

              {/* Footer Actions */}
              <View style={styles.modalFooterActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditOpen(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, savingProfile && styles.btnDisabled]}
                  onPress={handleSaveEditProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : null}
                  <Text style={styles.modalSaveBtnText}>
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  articleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topHeaderSection: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  userLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 200,
  },
  myAccountTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  nameAndRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  fullNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  roleEmeraldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  emailSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tabButtonActive: {
    borderBottomColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#2563eb',
  },
  overviewBody: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  overviewHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  overviewSubheading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 14,
  },
  infoGrid: {
    gap: 10,
  },
  infoBox: {
    backgroundColor: 'rgba(248, 250, 252, 0.7)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  infoBoxValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 2,
  },
  // Password & Security Tab (Matching Web ChangePasswordCard.jsx)
  passwordTabWrap: {
    padding: 16,
  },
  changePwCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  changePwHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  changePwHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  changePwIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePwTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  changePwSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  otpVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  otpVerifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  otpVerifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  changePwBody: {
    padding: 16,
    gap: 14,
  },
  pwStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  pwStatusBannerError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  pwStatusBannerSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  pwStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  pwInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  pwInputContainerDisabled: {
    backgroundColor: '#f8fafc',
  },
  pwTextInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  verifiedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  verifiedSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthBarSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  strengthLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  strengthMinLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  matchIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },
  otpBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: 'rgba(239, 246, 255, 0.7)',
    padding: 14,
  },
  otpBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  otpBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  otpBoxDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  sendOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendOtpBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  sendOtpBtnResend: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  sendOtpBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  otpInputSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(191, 219, 254, 0.8)',
  },
  otpInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  otpCodeInput: {
    width: 180,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 6,
    color: '#0f172a',
  },
  changePwFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  footerTipText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  footerBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  clearFieldsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  clearFieldsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  updatePwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  updatePwBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // Edit Profile Modal (Matching Web EditProfileModal.jsx)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
  },
  modalBody: {
    padding: 20,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 14,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  photoPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  photoPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  photoPickerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  photoBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choosePhotoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  choosePhotoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  resetPhotoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  resetPhotoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  nameFieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
