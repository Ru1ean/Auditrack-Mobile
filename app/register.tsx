import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COMPANY_EMAIL_DOMAIN = '@lccbonline.edu.ph';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Support both Personnel (Register.jsx) and External Auditor (RegisterAuditor.jsx)
  const [accountType, setAccountType] = useState<'personnel' | 'auditor'>(
    params.mode === 'auditor' ? 'auditor' : 'personnel'
  );

  const [formData, setFormData] = useState({
    firstname: '',
    middleinitial: '',
    lastname: '',
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validateEmail = (email: string, mode: 'personnel' | 'auditor' = accountType) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === 'auditor') {
      const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
      if (!isValidFormat) {
        setEmailError('Please enter a valid email address');
        return false;
      }
      setEmailError('');
      return true;
    }
    if (!normalizedEmail.endsWith(COMPANY_EMAIL_DOMAIN)) {
      setEmailError(`Email must use the ${COMPANY_EMAIL_DOMAIN} domain`);
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string) => {
    const numberCount = (password.match(/\d/g) || []).length;
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return false;
    }
    if (numberCount < 3) {
      setPasswordError('Password must contain at least 3 numbers');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleChange = (name: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    if (name === 'password') validatePassword(value);
    if (name === 'email') validateEmail(value, accountType);
  };

  const handleModeSwitch = (mode: 'personnel' | 'auditor') => {
    setAccountType(mode);
    setError('');
    setEmailError('');
    if (formData.email) {
      validateEmail(formData.email, mode);
    }
  };

  const handleSubmit = () => {
    setError('');

    if (!formData.firstname.trim() || !formData.lastname.trim() || !formData.email.trim() || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!validateEmail(formData.email, accountType)) {
      setError(
        accountType === 'personnel'
          ? `Only ${COMPANY_EMAIL_DOMAIN} email addresses can register`
          : 'Please enter a valid email address'
      );
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('Please fix the password errors before submitting');
      return;
    }

    setLoading(true);
    try {
      const roleid = accountType === 'auditor' ? 4 : 2;
      router.push({
        pathname: '/otp' as any,
        params: {
          firstname: formData.firstname.trim(),
          middleinitial: formData.middleinitial.trim(),
          lastname: formData.lastname.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          roleid: String(roleid),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const pwLongEnough = formData.password.length >= 8;
  const pwHasNums = (formData.password.match(/\d/g) || []).length >= 3;
  const isDisabled = loading || Boolean(passwordError) || Boolean(emailError);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerBox}>
          {/* Header (Exact match to Web Register.jsx / RegisterAuditor.jsx) */}
          <View style={styles.headerBlock}>
            <View style={styles.brandRow}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandName}>Auditrack</Text>
            </View>
            <Text style={styles.pageTitle}>
              {accountType === 'auditor' ? 'Auditor Sign Up' : 'Create Account'}
            </Text>
            <Text style={styles.pageSubtitle}>
              Fill in the details below to get started
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Subtle Account Type Switcher (Personnel vs External Auditor) */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, accountType === 'personnel' && styles.modeTabActive]}
                onPress={() => handleModeSwitch('personnel')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    accountType === 'personnel' && styles.modeTabTextActive,
                  ]}
                >
                  Office Personnel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, accountType === 'auditor' && styles.modeTabActive]}
                onPress={() => handleModeSwitch('auditor')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    accountType === 'auditor' && styles.modeTabTextActive,
                  ]}
                >
                  External Auditor
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Auditor info banner (Matching RegisterAuditor.jsx) */}
            {accountType === 'auditor' ? (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  External Auditor Invite verified: any valid email accepted.
                </Text>
              </View>
            ) : null}

            {/* Name row (2 columns matching Web) */}
            <View style={styles.nameRow}>
              <View style={styles.halfCol}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'firstname' && styles.inputFocused,
                  ]}
                  value={formData.firstname}
                  onChangeText={(v) => handleChange('firstname', v)}
                  placeholder="First name"
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setFocusedField('firstname')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'lastname' && styles.inputFocused,
                  ]}
                  value={formData.lastname}
                  onChangeText={(v) => handleChange('lastname', v)}
                  placeholder="Last name"
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setFocusedField('lastname')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Middle Initial */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Middle Initial</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'middleinitial' && styles.inputFocused,
                ]}
                value={formData.middleinitial}
                onChangeText={(v) => handleChange('middleinitial', v)}
                maxLength={1}
                placeholder="e.g. A"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                onFocus={() => setFocusedField('middleinitial')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address *</Text>
              <TextInput
                style={[
                  styles.input,
                  Boolean(emailError) && styles.inputError,
                  focusedField === 'email' && !emailError && styles.inputFocused,
                ]}
                value={formData.email}
                onChangeText={(v) => handleChange('email', v)}
                placeholder={
                  accountType === 'auditor'
                    ? 'name@example.com'
                    : `name${COMPANY_EMAIL_DOMAIN}`
                }
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
              {emailError ? (
                <Text style={styles.fieldErrorText}>{emailError}</Text>
              ) : (
                <Text style={styles.fieldHelperText}>
                  {accountType === 'auditor'
                    ? 'Any valid email address (Gmail, Yahoo, etc.)'
                    : `Use your ${COMPANY_EMAIL_DOMAIN} email`}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    Boolean(passwordError) && styles.inputError,
                    focusedField === 'password' && !passwordError && styles.inputFocused,
                  ]}
                  value={formData.password}
                  onChangeText={(v) => handleChange('password', v)}
                  placeholder="Create a password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={16}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>

              {/* Password strength indicators (Matching Web Register.jsx: 8+ characters, 3+ numbers) */}
              <View style={styles.strengthRow}>
                {[
                  { met: pwLongEnough, label: '8+ characters' },
                  { met: pwHasNums, label: '3+ numbers' },
                ].map(({ met, label }) => (
                  <View key={label} style={styles.strengthItem}>
                    <Feather
                      name={met ? 'check-circle' : 'circle'}
                      size={13}
                      color={met ? '#16a34a' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.strengthLabel,
                        { color: met ? '#16a34a' : '#94a3b8' },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Submit Button (Green gradient matching Web Register.jsx) */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isDisabled}
              activeOpacity={0.88}
              style={styles.submitTouch}
            >
              {isDisabled ? (
                <View style={[styles.submitBtn, styles.submitBtnDisabled]}>
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Creating Account…' : 'Create Account'}
                  </Text>
                </View>
              ) : (
                <LinearGradient
                  colors={['#16a34a', '#15803d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Creating Account…' : 'Create Account'}
                  </Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign in link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerPrompt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#ffffff',
  },
  centerBox: {
    width: '100%',
    maxWidth: 420,
    paddingBottom: 16,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  brandLogo: {
    width: 44,
    height: 44,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    gap: 14,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  errorBanner: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: 12.5,
    color: '#b91c1c',
  },
  infoBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#1d4ed8',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
    gap: 5,
  },
  fieldGroup: {
    gap: 5,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontSize: 13.5,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  inputFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#fca5a5',
  },
  fieldErrorText: {
    marginTop: 3,
    fontSize: 11.5,
    color: '#dc2626',
  },
  fieldHelperText: {
    marginTop: 3,
    fontSize: 11.5,
    color: '#94a3b8',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  strengthLabel: {
    fontSize: 11.5,
  },
  submitTouch: {
    marginTop: 4,
    borderRadius: 10,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerPrompt: {
    fontSize: 13,
    color: '#64748b',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
});
