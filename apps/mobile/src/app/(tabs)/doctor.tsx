import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CallMedia } from '@/api/calls';
import { useAuth } from '@/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme';

export default function DoctorScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Mjeku</Text>
      {user?.role === 'DOCTOR' ? <DoctorCard /> : <PatientCard />}
    </SafeAreaView>
  );
}

function PatientCard() {
  const call = (media: CallMedia) => router.push({ pathname: '/call', params: { media } });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Flisni me mjekun</Text>
      <Text style={styles.cardText}>
        Telefononi mjekun nga aplikacioni, me zë ose me video. Do t'ju lidhim me mjekun e parë që është i lirë.
      </Text>
      <CallButton icon="call" label="Thirrje zanore" onPress={() => call('AUDIO')} />
      <CallButton icon="videocam" label="Videothirrje" onPress={() => call('VIDEO')} />
    </View>
  );
}

function DoctorCard() {
  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <Ionicons name="radio-button-on" size={18} color={colors.primary} />
        <Text style={styles.cardTitle}>Në dispozicion për thirrje</Text>
      </View>
      <Text style={styles.cardText}>
        Kur një pacient ju telefonon, ky telefon do të bjerë, edhe kur aplikacioni është i mbyllur ose ekrani
        është i kyçur.
      </Text>
    </View>
  );
}

function CallButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={colors.white} />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
