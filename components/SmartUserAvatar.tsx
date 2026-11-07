import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getProfilePicUrl, SUPABASE_PROFILE_STORAGE } from './connect';

// 🎨 Exact match of Web's Tailwind avatarPalettes
export const avatarPalettes = [
  { colors: ['#2563eb', '#4f46e5'] as const, ring: '#dbeafe', solid: '#2563eb' }, // blue-600 to indigo-600
  { colors: ['#0ea5e9', '#2563eb'] as const, ring: '#e0f2fe', solid: '#0ea5e9' }, // sky-500 to blue-600
  { colors: ['#3b82f6', '#0891b2'] as const, ring: '#cffafe', solid: '#3b82f6' }, // blue-500 to cyan-600
  { colors: ['#0891b2', '#1d4ed8'] as const, ring: '#dbeafe', solid: '#0891b2' }, // cyan-600 to blue-700
  { colors: ['#2563eb', '#0284c7'] as const, ring: '#e0f2fe', solid: '#2563eb' }, // blue-600 to sky-600
  { colors: ['#475569', '#2563eb'] as const, ring: '#f1f5f9', solid: '#475569' }, // slate-600 to blue-600
];

export function getAvatarStyle(identifier: any = '') {
  let key = '';
  if (typeof identifier === 'object' && identifier !== null) {
    key = String(
      identifier.userid ||
      identifier.id ||
      identifier.UserID ||
      identifier.headid ||
      identifier.HeadID ||
      identifier.Email ||
      identifier.email ||
      identifier.FullName ||
      identifier.full_name ||
      identifier.fullname ||
      `${identifier.firstname || identifier.FirstName || ''} ${identifier.lastname || identifier.LastName || ''}`.trim() ||
      ''
    ).toLowerCase().trim();
  } else {
    key = String(identifier || '').toLowerCase().trim();
  }

  // Normalize middle initials and punctuation (same as web)
  const cleanKey = key.replace(/\b[a-z]\.\s+/g, '').replace(/[^a-z0-9]/g, '');

  let hash = 0;
  const target = cleanKey || key || 'user';
  for (let i = 0; i < target.length; i++) {
    hash = target.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length];
}

export function getInitials(firstname = '', lastname = '', fullName = '') {
  const fn = (firstname || '').trim();
  const ln = (lastname || '').trim();
  if (fn && ln) {
    return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
  }
  const combined = (fullName || fn || '').trim();
  if (combined) {
    const parts = combined.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return combined.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export interface SmartUserAvatarProps {
  user?: any;
  src?: string | null;
  name?: string;
  fullName?: string;
  initials?: string;
  size?: number;
  textSize?: number;
  ring?: boolean | string;
  shape?: 'circle' | 'square' | 'rounded';
  style?: ViewStyle | ViewStyle[];
  imageStyle?: ImageStyle;
  textStyle?: TextStyle;
}

export default function SmartUserAvatar({
  user,
  src,
  name,
  fullName: explicitFullName,
  initials: explicitInitials,
  size = 36,
  textSize,
  ring = false,
  shape = 'circle',
  style,
  imageStyle,
  textStyle,
}: SmartUserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  const firstname = user?.firstname || user?.FirstName || '';
  const lastname = user?.lastname || user?.LastName || '';
  const resolvedFullName =
    explicitFullName ||
    name ||
    user?.full_name ||
    user?.FullName ||
    user?.fullname ||
    `${firstname} ${lastname}`.trim() ||
    firstname ||
    user?.Email ||
    user?.email ||
    'User';

  const resolvedInitials =
    explicitInitials || getInitials(firstname, lastname, resolvedFullName);

  const palette = getAvatarStyle(user || resolvedFullName);

  const rawPic =
    src !== undefined
      ? src
      : user?.profilepic ||
        user?.ProfilePic ||
        user?.profile_pic ||
        user?.avatar ||
        user?.TempPreview ||
        user?.head_profile_pic ||
        user?.HeadProfilePic;

  useEffect(() => {
    setImgFailed(false);
    setFallbackSrc(null);
  }, [rawPic]);

  const resolvedPicUrl = fallbackSrc || getProfilePicUrl(rawPic);

  const borderRadius =
    shape === 'circle' ? Math.round(size / 2) : shape === 'rounded' ? 8 : 0;

  const ringColor =
    typeof ring === 'string'
      ? ring
      : ring === true
      ? palette.ring
      : undefined;

  if (resolvedPicUrl && !imgFailed) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            borderColor: ringColor || 'transparent',
            borderWidth: ringColor ? 2 : 0,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: resolvedPicUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius,
            },
            imageStyle,
          ]}
          contentFit="cover"
          transition={150}
          onError={() => {
            if (
              SUPABASE_PROFILE_STORAGE &&
              !fallbackSrc &&
              resolvedPicUrl &&
              !resolvedPicUrl.includes(SUPABASE_PROFILE_STORAGE)
            ) {
              const filename = resolvedPicUrl.split('/').pop();
              if (filename && filename.includes('.')) {
                setFallbackSrc(`${SUPABASE_PROFILE_STORAGE}/${filename}`);
                return;
              }
            }
            setImgFailed(true);
          }}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={palette.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          borderColor: ringColor || 'transparent',
          borderWidth: ringColor ? 2 : 0,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initialsText,
          {
            fontSize: textSize || Math.max(8, Math.round(size * 0.38)),
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {resolvedInitials}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initialsText: {
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
