import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme';

export function TopBar() {
  const { user, signOut } = useAuth();
  if (!user) {
    return null;
  }

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  function confirmSignOut() {
    Alert.alert('Dil', 'Dëshironi të dilni nga llogaria?', [
      { text: 'Anulo', style: 'cancel' },
      { text: 'Dil', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.greeting}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View>
          <Text style={styles.hello}>Përshëndetje,</Text>
          <Text style={styles.name}>{user.firstName}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* Notifications are not built yet. */}
        <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Njoftimet">
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={confirmSignOut}
          accessibilityRole="button"
          accessibilityLabel="Dil"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  hello: {
    fontSize: 13,
    color: colors.textMuted,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
