import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

export default function DoctorScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Mjeku</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thirrje testuese</Text>
        <Text style={styles.cardText}>
          Hyni në dhomën e testit me video dhe audio. Kushdo tjetër që hyn në të njëjtën dhomë do të
          lidhet me ju.
        </Text>
        <Pressable
          onPress={() => router.push('/call')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="videocam" size={20} color={colors.white} />
          <Text style={styles.buttonText}>Fillo thirrjen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  button: {
    marginTop: spacing.sm,
    height: 52,
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
