import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { apiUrl } from '@/api/client';
import { accent, accents, colors } from '@/theme';
import { AppText } from './AppText';

interface AvatarProps {
  name?: string | null;
  /** A path from the API ("/api/files/avatars/…") or a full URL. */
  url?: string | null;
  size?: number;
  /** A white ring, for avatars on photos or gradients. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ACCENT_NAMES = Object.keys(accents);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''}`.toUpperCase();
}

/** The same name always gets the same colour. */
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return accent(ACCENT_NAMES[Math.abs(hash) % ACCENT_NAMES.length]);
}

/** A profile photo, or the person's initials on a colour of their own. */
export function Avatar({ name, url, size = 44, ring = false, style }: AvatarProps) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: Math.max(2, size / 22), borderColor: colors.white } : null;

  if (url) {
    return (
      <Image
        source={{ uri: apiUrl(url) }}
        style={[box, styles.image, ringStyle, style as object]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name ?? undefined}
      />
    );
  }
  if (!name) {
    return (
      <View style={[box, styles.placeholder, ringStyle, style]}>
        <Ionicons name="person" size={size * 0.5} color={colors.textMuted} />
      </View>
    );
  }
  return (
    <LinearGradient colors={colorFor(name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[box, styles.center, ringStyle, style]}>
      <AppText weight="700" color={colors.white} style={{ fontSize: size * 0.38, lineHeight: size * 0.46 }}>
        {initials(name)}
      </AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
