import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '600',
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="requirements"
        options={{
          title: 'Accreditation',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      backgroundColor: '#eff6ff',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }
                  : undefined
              }
            >
              <Feather name="layers" size={19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Programs & Offices',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      backgroundColor: '#eff6ff',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }
                  : undefined
              }
            >
              <MaterialCommunityIcons
                name="office-building-outline"
                size={20}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      backgroundColor: '#eff6ff',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }
                  : undefined
              }
            >
              <Feather name="bell" size={19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'My Profile',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      backgroundColor: '#eff6ff',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }
                  : undefined
              }
            >
              <Feather name="user" size={19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="office-personnel" options={{ href: null }} />
    </Tabs>
  );
}
