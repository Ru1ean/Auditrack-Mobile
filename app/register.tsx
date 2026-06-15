import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usersAPI } from '../components/connect';

const COMPANY_EMAIL_DOMAIN = '@lccbonline.edu.ph';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    office: '',
    contact_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const router = useRouter();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'password') {
      validatePassword(value);
    }

    if (field === 'email') {
      validateEmail(value);
    }
  };

  const validateEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

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

  const handleRegister = async () => {
    const { first_name, last_name, email, password, confirmPassword, contact_number } = formData;

    if (!first_name || !last_name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!validateEmail(email)) {
      setError(`Only ${COMPANY_EMAIL_DOMAIN} email addresses can register`);
      return;
    }

    if (!validatePassword(password)) {
      setError('Please fix the password errors before submitting');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await usersAPI.register({
        first_name,
        last_name,
        email,
        password,
        contact_number,
        approval_status: 'pending',
      });

      if (response.success) {
        Alert.alert('Success', 'Account created! Awaiting admin approval.');
        router.replace('/login');
      } else {
        setError(response.message || 'Registration failed');
      }
    } catch (err: any) {
      console.log('REGISTER ERROR:', err);
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.appTitle}>Create Account</Text>
          <Text style={styles.subtitle}>Fill in your details to register</Text>
        </View>

        <View style={styles.formContainer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter first name"
            value={formData.first_name}
            onChangeText={(val) => handleInputChange('first_name', val)}
            editable={!loading}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter last name"
            value={formData.last_name}
            onChangeText={(val) => handleInputChange('last_name', val)}
            editable={!loading}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email"
            value={formData.email}
            onChangeText={(val) => handleInputChange('email', val)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            placeholderTextColor="#999"
          />
          <Text style={styles.helperText}>{emailError || `Use your ${COMPANY_EMAIL_DOMAIN} email address`}</Text>

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            value={formData.password}
            onChangeText={(val) => handleInputChange('password', val)}
            secureTextEntry
            editable={!loading}
            placeholderTextColor="#999"
          />
          <Text style={styles.helperText}>
            {passwordError || 'Password must be at least 8 characters and contain at least 3 numbers'}
          </Text>

          <TouchableOpacity
            style={[styles.button, loading || passwordError || emailError ? styles.buttonDisabled : null]}
            onPress={handleRegister}
            disabled={loading || Boolean(passwordError) || Boolean(emailError)}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Register'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#1e40af',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    marginBottom: 30,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    fontSize: 14,
  },
  helperText: {
    marginTop: -8,
    marginBottom: 16,
    fontSize: 12,
    color: '#6b7280',
  },
});
