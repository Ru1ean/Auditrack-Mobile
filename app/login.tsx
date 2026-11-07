import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
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
import { connect, getStoredUser, getToken, setToken, storeUser, usersAPI } from '../components/connect';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [blockedMs, setBlockedMs] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  // Redirect if already logged in (matching Web Login.jsx)
  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const token = await getToken();
        const user = await getStoredUser();
        if (active && token && user) {
          router.replace('/(tabs)/profile');
        }
      } catch {
        // ignore
      }
    };
    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  // Show message from OTP verification if passed
  useEffect(() => {
    if (params.message && typeof params.message === 'string') {
      setSuccessMessage(params.message);
    }
  }, [params.message]);

  // Restore blocked state on mount (matching Web Login.jsx)
  useEffect(() => {
    const restoreBlocked = async () => {
      try {
        const stored =
          Platform.OS === 'web'
            ? localStorage.getItem('loginBlockedUntil')
            : await AsyncStorage.getItem('loginBlockedUntil');
        if (stored) {
          const until = Number(stored);
          if (!Number.isNaN(until) && until > Date.now()) {
            setBlockedUntil(until);
            setBlockedMs(Math.max(0, until - Date.now()));
          } else {
            if (Platform.OS === 'web') localStorage.removeItem('loginBlockedUntil');
            else await AsyncStorage.removeItem('loginBlockedUntil');
          }
        }
      } catch {
        // ignore
      }
    };
    void restoreBlocked();
  }, []);

  // Server-side pre-check when email changes (matching Web Login.jsx)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const trimmed = email.trim();
        if (!trimmed) {
          setBlockedMs(0);
          setBlockedUntil(null);
          return;
        }
        const resp = await usersAPI.loginStatus(trimmed);
        const remaining = resp?.remainingMs || 0;
        if (remaining > 0) {
          const until = Date.now() + remaining;
          setBlockedMs(remaining);
          setBlockedUntil(until);
          setError(resp?.message || 'Too many failed login attempts. Please wait.');
        } else {
          setBlockedMs(0);
          setBlockedUntil(null);
        }
      } catch {
        // ignore network errors during precheck
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [email]);

  // Countdown for blocked state
  useEffect(() => {
    if (!blockedUntil) return;
    const tick = () => {
      const ms = Math.max(0, blockedUntil - Date.now());
      setBlockedMs(ms);
      if (ms <= 0) {
        setBlockedUntil(null);
        setBlockedMs(0);
        setError('');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const handleLogin = async () => {
    if (blockedMs > 0) return;
    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await connect.post('/user/login', {
        email: email.trim(),
        password,
      });

      if (response.success && response.token) {
        await setToken(response.token);

        let loggedInUser = response.user;
        if (!loggedInUser) {
          try {
            const meRes = await usersAPI.getLoggedInUser();
            if (meRes?.success && meRes?.user) {
              loggedInUser = meRes.user;
            }
          } catch {
            // ignore
          }
        }

        if (loggedInUser) {
          await storeUser(loggedInUser);
        }

        try {
          if (Platform.OS === 'web') localStorage.removeItem('loginBlockedUntil');
          else await AsyncStorage.removeItem('loginBlockedUntil');
        } catch {}

        router.replace('/(tabs)/profile');
      } else {
        const status = response.approvalstatus || response.approvalStatus;
        if (status === 'pending') {
          setError('Your account is pending approval. Please wait for admin approval.');
          Alert.alert(
            'Account Pending',
            'Your account is still pending approval. Please wait for the administrator to review your account.'
          );
        } else if (status === 'denied') {
          setError('Your account has been denied access.');
          Alert.alert(
            'Access Denied',
            'Your account has been denied access. Please contact the administrator for more information.'
          );
        } else {
          setError(response.message || 'Login failed');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

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
          {/* Header (Exact match to Web Login.jsx) */}
          <View style={styles.headerBlock}>
            <View style={styles.brandRow}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandName}>Auditrack</Text>
            </View>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to your account to continue</Text>
          </View>

          {/* Card (Exact match to Web Login.jsx) */}
          <View style={styles.card}>
            {/* Success message */}
            {successMessage && !error ? (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={15} color="#15803d" />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Block / Error banners */}
            {blockedMs > 0 ? (
              <View style={styles.blockedBanner}>
                <Text style={styles.blockedBannerText}>
                  {(() => {
                    const total = Math.ceil(blockedMs / 1000);
                    const m = Math.floor(total / 60);
                    const s = total % 60;
                    return `Too many failed attempts. Please wait ${m}:${String(s).padStart(2, '0')} before retrying.`;
                  })()}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  blockedMs > 0 && styles.inputDisabled,
                ]}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setError('');
                }}
                placeholder="you@lccbonline.edu.ph"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading && blockedMs <= 0}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                    blockedMs > 0 && styles.inputDisabled,
                  ]}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  editable={!loading && blockedMs <= 0}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={blockedMs > 0}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || blockedMs > 0}
              activeOpacity={0.88}
              style={styles.submitTouch}
            >
              {loading || blockedMs > 0 ? (
                <View style={[styles.submitBtn, styles.submitBtnDisabled]}>
                  <Text style={styles.submitBtnText}>
                    {loading
                      ? 'Signing in…'
                      : `Locked (${Math.ceil(blockedMs / 1000)}s)`}
                  </Text>
                </View>
              ) : (
                <LinearGradient
                  colors={['#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>Sign in</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerPrompt}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.footerLink}>Sign up</Text>
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
    paddingVertical: 32,
    backgroundColor: '#ffffff',
  },
  centerBox: {
    width: '100%',
    maxWidth: 420,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  brandLogo: {
    width: 48,
    height: 48,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  welcomeTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 28,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    gap: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#15803d',
  },
  blockedBanner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
  },
  blockedBannerText: {
    fontSize: 13,
    color: '#92400e',
  },
  errorBanner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#b91c1c',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  inputFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  submitTouch: {
    marginTop: 4,
    borderRadius: 10,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
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
    marginTop: 20,
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
