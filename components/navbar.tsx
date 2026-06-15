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
    backgroundColor: '#1e293b',
  },
  navbar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  title: {
    color: '#0891b2',
    fontSize: 20,
    fontWeight: '700',
  },
});
