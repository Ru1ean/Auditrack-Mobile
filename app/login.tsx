import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { connect, setToken, storeUser, usersAPI } from '../components/connect';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await connect.post('/user/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      console.log('LOGIN RESPONSE:', response);

      if (response.success && response.token) {
        await setToken(response.token);

        // Fetch current user details or use returned user object
        let loggedInUser = response.user;
        if (!loggedInUser) {
          try {
            const meRes = await usersAPI.getLoggedInUser();
            if (meRes?.success && meRes?.user) {
              loggedInUser = meRes.user;
            }
          } catch (meErr) {
            console.warn('Failed to fetch /user/me on login:', meErr);
          }
        }

        if (loggedInUser) {
          await storeUser(loggedInUser);
        }

        // Navigate to the primary requirements & standards workspace
        router.replace('/(tabs)/requirements');
      } else {
        if (response.approvalStatus === 'pending') {
          setError('Your account registration is pending approval by the administrator.');
          Alert.alert('Account Pending', 'Your account has been submitted and is currently pending approval.');
        } else if (response.approvalStatus === 'denied') {
          setError('Your account access has been denied by the administrator.');
          Alert.alert('Access Denied', 'Your account was not approved. Please contact institutional support.');
        } else {
          setError(response.message || 'Login failed. Please verify your credentials.');
        }
      }
    } catch (err: any) {
      console.log('LOGIN ERROR:', err);
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Branding */}
        <View style={styles.headerContainer}>
          <View style={[styles.logoCard, { marginBottom: 12 }]}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appTitle}>Auditrack</Text>
          <Text style={styles.appSubtitle}>Compliance Audit Management System</Text>
          <Text style={styles.institutionText}>La Consolacion College Bacolod</Text>

          {/* Quick Feature Pills */}
          <View style={styles.featurePillsRow}>
            <View style={styles.featurePill}>
              <MaterialIcons name="verified-user" size={12} color="#2563eb" />
              <Text style={styles.featurePillText}>Audit Management</Text>
            </View>
            <View style={styles.featurePill}>
              <MaterialIcons name="assignment" size={12} color="#2563eb" />
              <Text style={styles.featurePillText}>Standards Tracking</Text>
            </View>
          </View>
        </View>

        {/* Form Card (Matching Web Right Login Card) */}
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to your account to continue</Text>

            {/* Role Tags */}
            <View style={styles.roleTagRow}>
              <View style={styles.roleTag}>
                <MaterialIcons name="rate-review" size={12} color="#1d4ed8" />
                <Text style={styles.roleTagText}>External Auditor</Text>
              </View>
              <View style={[styles.roleTag, styles.roleTagGreen]}>
                <MaterialIcons name="badge" size={12} color="#059669" />
                <Text style={styles.roleTagTextGreen}>Office Personnel</Text>
              </View>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="mail-outline" size={19} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your institutional email"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock-outline" size={19} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                setError('');
              }}
              secureTextEntry={!showPassword}
              editable={!loading}
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.eyeBtn}
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={19}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Sign In</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="person-add-alt" size={18} color="#1d4ed8" style={{ marginRight: 6 }} />
            <Text style={styles.registerButtonText}>Create New Account</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Auditrack Compliance Management System</Text>
          <Text style={styles.footerSubText}>La Consolacion College Bacolod • Automated Portal</Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 36,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoCard: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  logoDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: '#cbd5e1',
  },
  appTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  appSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  institutionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  featurePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
  },
  roleTagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  roleTagGreen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  roleTagTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
  },
  registerButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
  },
  footerContainer: {
    marginTop: 22,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  footerSubText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
});
