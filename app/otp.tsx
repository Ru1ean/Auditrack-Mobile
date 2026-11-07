import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import { usersAPI } from '../components/connect';

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = (params.email as string) || '';
  const firstname = (params.firstname as string) || '';
  const middleinitial = (params.middleinitial as string) || '';
  const lastname = (params.lastname as string) || '';
  const password = (params.password as string) || '';
  const roleid = params.roleid ? Number(params.roleid) : 2;

  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('Enter the one-time PIN sent to your email.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const didSendRef = useRef(false);

  const sendOtp = async () => {
    if (!email) {
      setError('Registration email is missing. Please go back and register again.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await usersAPI.sendRegistrationOtp({
        firstname,
        middleinitial,
        lastname,
        email,
        password,
        roleid,
      });

      setMessage(response?.message || 'We sent a one-time PIN to your email.');
    } catch (err: any) {
      const isTimeout = err?.message?.toLowerCase().includes('timeout');
      setError(
        err?.message ||
          (isTimeout
            ? 'Request timed out while sending OTP. Please click Resend OTP.'
            : 'Failed to send one-time PIN.')
      );
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!email || didSendRef.current) return;
    didSendRef.current = true;
    void sendOtp();
  }, [email]);

  const handleVerify = async () => {
    if (!email) {
      setError('Registration email is missing. Please go back and register again.');
      return;
    }

    if (otp.length !== 6) {
      setError('Enter the 6-digit one-time PIN.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await usersAPI.verifyRegistrationOtp({
        email,
        otp,
      });

      if (response?.success) {
        router.replace({
          pathname: '/login' as any,
          params: {
            message: response.message || 'Email verified. Your account is pending approval.',
          },
        });
        return;
      }

      setError(response?.message || 'Wrong one-time PIN. Please try again.');
    } catch (err: any) {
      setError(err?.message || 'Wrong one-time PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isVerifyDisabled = !email || loading || otp.length !== 6;

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
          {/* Header (Exact match to Web Otp.jsx) */}
          <View style={styles.headerBlock}>
            <View style={styles.brandRow}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandName}>Auditrack</Text>
            </View>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              {email
                ? `Enter the code sent to ${email}`
                : 'Please register first to receive a one-time PIN'}
            </Text>
          </View>

          <View style={styles.formStack}>
            {message ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextInput
              style={[styles.otpInput, focused && styles.otpInputFocused]}
              value={otp}
              onChangeText={(val) => {
                setOtp(val.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="000000"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={6}
              editable={Boolean(email) && !loading}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />

            <TouchableOpacity
              style={[styles.verifyBtn, isVerifyDisabled && styles.verifyBtnDisabled]}
              onPress={handleVerify}
              disabled={isVerifyDisabled}
              activeOpacity={0.85}
            >
              <Text style={styles.verifyBtnText}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendBtn}
              onPress={sendOtp}
              disabled={!email || sending}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.resendBtnText,
                  (!email || sending) && styles.resendBtnTextDisabled,
                ]}
              >
                {sending ? 'Sending...' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>Wrong email? </Text>
              <TouchableOpacity onPress={() => router.replace('/register')}>
                <Text style={styles.footerLink}>Register again</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 32,
    paddingVertical: 32,
    backgroundColor: '#ffffff',
  },
  centerBox: {
    width: '100%',
    maxWidth: 420,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  formStack: {
    gap: 16,
  },
  messageBox: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
  },
  messageText: {
    fontSize: 13.5,
    color: '#1d4ed8',
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
  },
  errorText: {
    fontSize: 13.5,
    color: '#b91c1c',
  },
  otpInput: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 6,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  otpInputFocused: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  verifyBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  verifyBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '600',
  },
  resendBtn: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#2563eb',
  },
  resendBtnTextDisabled: {
    color: '#9ca3af',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerPrompt: {
    fontSize: 13.5,
    color: '#4b5563',
  },
  footerLink: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#2563eb',
  },
});
