import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Navbar() {
  return (
    <SafeAreaView style={styles.safeAreaNavbar} edges={['top']}>
      <View style={styles.navbar}>
        <Text style={styles.title}>Auditrack</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaNavbar: {
    backgroundColor: '#ffffff',
  },
  navbar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
