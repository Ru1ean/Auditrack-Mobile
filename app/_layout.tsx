import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/navbar';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  
  // Show navbar only on authenticated routes (not on login/register)
  const showNavbar = !pathname.includes('/login') && !pathname.includes('/register');

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1 }}>
            {showNavbar && <Navbar />}
            <Stack>
              <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
              <Stack.Screen name="register" options={{ title: 'Register', headerShown: false }} />
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
        </SafeAreaView>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
