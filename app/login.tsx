import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, setToken } from '../components/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Use correct endpoint to match backend mount (/api + /user)
      const response = await api.post('/user/login', { email, password });
      console.log('LOGIN RESPONSE:', response);
      if (response.success) {
        await setToken(response.token);
        router.replace('/home');
      } else {
        if (response.approvalStatus === 'pending') {
          setError('Your account is pending approval.');
          Alert.alert('Account Pending', 'Please wait for admin approval.');
        } else if (response.approvalStatus === 'denied') {
          setError('Your account has been denied.');
          Alert.alert('Access Denied', 'Contact the administrator.');
        } else {
          setError(response.message || 'Login failed');
        }
      }
    } catch (err: any) {
      console.log('LOGIN ERROR:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title={loading ? 'Signing in...' : 'Sign In'}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  error: {
    color: 'red',
    marginBottom: 12,
  },
});