import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usersAPI } from '../components/connect';

const COMPANY_EMAIL_DOMAIN = '@lccbonline.edu.ph';

type SelectedRole = 'personnel' | 'auditor';

export default function RegisterScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('personnel');

  const [formData, setFormData] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');

    if (field === 'password') {
      validatePassword(value);
    }
    if (field === 'email') {
      validateEmail(value, selectedRole);
    }
  };

  const handleRoleChange = (role: SelectedRole) => {
    setSelectedRole(role);
    setError('');
    setEmailError('');
    if (formData.email) {
      validateEmail(formData.email, role);
    }
  };

  const validateEmail = (email: string, role: SelectedRole) => {
    const normalized = email.trim().toLowerCase();
    const generalEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!generalEmailRegex.test(normalized)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    if (role === 'personnel' && !normalized.endsWith(COMPANY_EMAIL_DOMAIN)) {
      setEmailError(`Personnel must use ${COMPANY_EMAIL_DOMAIN} email`);
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

    if (numberCount < 2) {
      setPasswordError('Password must contain at least 2 numbers');
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleRegister = async () => {
    const { firstName, middleInitial, lastName, email, password, confirmPassword } = formData;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!validateEmail(email, selectedRole)) {
      setError(
        selectedRole === 'personnel'
          ? `Office Personnel registration requires a ${COMPANY_EMAIL_DOMAIN} address`
          : 'Please enter a valid email address'
      );
      return;
    }

    if (!validatePassword(password)) {
      setError('Password does not meet the security requirements');
      return;
    }

    setLoading(true);
    setError('');

    const roleId = selectedRole === 'auditor' ? 4 : 3;

    try {
      // First attempt OTP flow if enabled on backend, or direct registration
      let otpSent = false;
      try {
        const otpRes = await usersAPI.sendRegistrationOtp({
          firstName: firstName.trim(),
          middleInitial: middleInitial.trim() ? middleInitial.trim().charAt(0).toUpperCase() : '',
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          roleId,
        });
        if (otpRes?.success) {
          otpSent = true;
          router.push({
            pathname: '/otp' as any,
            params: {
              email: email.trim().toLowerCase(),
              roleId: String(roleId),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
            },
          });
          return;
        }
      } catch (otpErr) {
        console.log('OTP send skipped or not active, trying direct register:', otpErr);
      }

      if (!otpSent) {
        const regRes = await usersAPI.register({
          FirstName: firstName.trim(),
          first_name: firstName.trim(),
          MiddleInitial: middleInitial.trim() ? middleInitial.trim().charAt(0).toUpperCase() : '',
          middle_initial: middleInitial.trim() ? middleInitial.trim().charAt(0).toUpperCase() : '',
          LastName: lastName.trim(),
          last_name: lastName.trim(),
          Email: email.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          Password: password,
          password: password,
          RoleID: roleId,
          roleId: roleId,
        });

        if (regRes?.success) {
          Alert.alert(
            'Registration Submitted',
            selectedRole === 'auditor'
              ? 'Your External Auditor account has been created and is pending approval.'
              : 'Your Office Personnel account has been created and is pending approval.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/login'),
              },
            ]
          );
        } else {
          setError(regRes?.message || 'Registration failed. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err?.message || 'Failed to submit registration. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerContainer}>
        <View style={[styles.logoBadge, { marginBottom: 12 }]}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appTitle}>Auditrack</Text>
        <Text style={styles.subtitle}>Create Institutional Account</Text>
      </View>

      <View style={styles.card}>
        {/* Role Selector Tabs */}
        <Text style={styles.rolePickerLabel}>Select Account Role</Text>
        <View style={styles.roleToggleRow}>
          <TouchableOpacity
            style={[styles.roleOption, selectedRole === 'personnel' && styles.roleOptionActive]}
            onPress={() => handleRoleChange('personnel')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="badge"
              size={20}
              color={selectedRole === 'personnel' ? '#fff' : '#64748b'}
            />
            <Text
              style={[
                styles.roleOptionText,
                selectedRole === 'personnel' && styles.roleOptionTextActive,
              ]}
            >
              Personnel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleOption, selectedRole === 'auditor' && styles.roleOptionActive]}
            onPress={() => handleRoleChange('auditor')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="verified-user"
              size={20}
              color={selectedRole === 'auditor' ? '#fff' : '#64748b'}
            />
            <Text
              style={[
                styles.roleOptionText,
                selectedRole === 'auditor' && styles.roleOptionTextActive,
              ]}
            >
              Ext. Auditor
            </Text>
          </TouchableOpacity>
        </View>

        {/* Role Description Badge */}
        <View style={styles.roleInfoBadge}>
          <MaterialIcons
            name="info-outline"
            size={16}
            color={selectedRole === 'auditor' ? '#0284c7' : '#059669'}
          />
          <Text style={styles.roleInfoText}>
            {selectedRole === 'auditor'
              ? 'External Auditor: Review accreditation standards, inspect evidence, and grade compliance.'
              : 'Office Personnel: Manage office compliance checklists, upload evidence, and track task progress.'}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Name Fields */}
        <View style={styles.nameRow}>
          <View style={{ flex: 2, marginRight: 8 }}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Maria"
              value={formData.firstName}
              onChangeText={(val) => handleInputChange('firstName', val)}
              placeholderTextColor="#94a3b8"
              editable={!loading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>M.I.</Text>
            <TextInput
              style={styles.input}
              placeholder="A"
              maxLength={2}
              value={formData.middleInitial}
              onChangeText={(val) => handleInputChange('middleInitial', val)}
              placeholderTextColor="#94a3b8"
              editable={!loading}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Text style={styles.label}>Last Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Santos"
          value={formData.lastName}
          onChangeText={(val) => handleInputChange('lastName', val)}
          placeholderTextColor="#94a3b8"
          editable={!loading}
        />

        {/* Email Field */}
        <Text style={styles.label}>
          {selectedRole === 'personnel'
            ? `Institutional Email (${COMPANY_EMAIL_DOMAIN}) *`
            : 'Email Address *'}
        </Text>
        <TextInput
          style={[styles.input, Boolean(emailError) && styles.inputError]}
          placeholder={
            selectedRole === 'personnel'
              ? `username${COMPANY_EMAIL_DOMAIN}`
              : 'auditor@organization.org'
          }
          value={formData.email}
          onChangeText={(val) => handleInputChange('email', val)}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#94a3b8"
          editable={!loading}
        />
        {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}

        {/* Password */}
        <Text style={styles.label}>Password *</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Min. 8 characters, 2 numbers"
            value={formData.password}
            onChangeText={(val) => handleInputChange('password', val)}
            secureTextEntry={!showPassword}
            placeholderTextColor="#94a3b8"
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.fieldErrorText}>{passwordError}</Text> : null}

        {/* Confirm Password */}
        <Text style={styles.label}>Confirm Password *</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChangeText={(val) => handleInputChange('confirmPassword', val)}
            secureTextEntry={!showConfirmPassword}
            placeholderTextColor="#94a3b8"
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={showConfirmPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {selectedRole === 'auditor'
                ? 'Create Auditor Account'
                : 'Create Personnel Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <View style={styles.loginRedirectRow}>
          <Text style={styles.alreadyText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1a',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: {
    width: 42,
    height: 42,
  },
  logoDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  rolePickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 9,
  },
  roleOptionActive: {
    backgroundColor: '#0284c7',
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  roleOptionTextActive: {
    color: '#ffffff',
  },
  roleInfoBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  roleInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  nameRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#f8fafc',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#f8fafc',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#f87171',
    marginTop: 4,
    marginLeft: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginRedirectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  alreadyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
  },
});
