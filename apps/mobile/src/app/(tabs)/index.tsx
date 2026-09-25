import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { HealthCard } from '@/components/HealthCard';
import { TopBar } from '@/components/TopBar';
import { healthCardMock } from '@/mock/healthCard';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Kartela ime shëndetësore</Text>
        <HealthCard holderName={`${user.firstName} ${user.lastName}`} {...healthCardMock} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
});
