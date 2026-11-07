import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import Navbar from '@/components/navbar';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppShell() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Show navbar only on authenticated routes (not on login/register/otp)
  const showNavbar =
    !pathname.includes('/login') &&
    !pathname.includes('/register') &&
    !pathname.includes('/otp');

  // Compact top safe-area inset so the header sits right below the status bar without wasted gap
  const compactTopInset =
    Platform.OS === 'web'
      ? 0
      : Math.max((insets.top || 0) - (Platform.OS === 'android' ? 6 : 4), 0);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: showNavbar ? '#ffffff' : '#f8fafc',
        paddingTop: compactTopInset,
      }}
    >
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {showNavbar && <Navbar />}
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#0f172a',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#f8fafc' },
          }}
        >
          <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Register', headerShown: false }} />
          <Stack.Screen name="otp" options={{ title: 'Verification', headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="event-detail" options={{ title: 'Event Details', presentation: 'modal' }} />
          <Stack.Screen
            name="requirement-detail"
            options={{ title: 'Task Details', presentation: 'modal' }}
          />
          <Stack.Screen name="upload-document" options={{ title: 'Upload Document', presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <AppShell />
        <StatusBar style="dark" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
