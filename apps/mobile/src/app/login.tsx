import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { TextField } from '@/components/TextField';
import { colors, radius, spacing } from '@/theme';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Shkruani emrin e përdoruesit'),
  password: z.string().min(1, 'Shkruani fjalëkalimin'),
});

type LoginForm = z.infer<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Emri i përdoruesit ose fjalëkalimi është i gabuar.';
    if (error.status === 0) return 'Nuk mund të lidhemi me serverin. Kontrolloni lidhjen.';
  }
  return 'Diçka shkoi keq. Provoni përsëri.';
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: ({ username, password }: LoginForm) => signIn(username, password),
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <LinearGradient
          colors={['#14B8A6', colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
        >
          <View style={styles.logo}>
            <Ionicons name="medical" size={34} color={colors.primary} />
          </View>
          <Text style={styles.appName}>Telehealth</Text>
          <Text style={styles.tagline}>Mjeku juaj, kurdo që ju nevojitet</Text>
        </LinearGradient>

        <View style={[styles.formCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.title}>Mirë se vini</Text>
          <Text style={styles.subtitle}>Hyni në llogarinë tuaj për të vazhduar</Text>

          <View style={styles.fields}>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <TextField
                  label="Përdoruesi"
                  placeholder="Emri i përdoruesit"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <TextField
                  ref={passwordRef}
                  label="Fjalëkalimi"
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  accessory={
                    <Pressable
                      onPress={() => setShowPassword((visible) => !visible)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  }
                />
              )}
            />
          </View>

          {login.isError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{loginErrorMessage(login.error)}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={login.isPending}
            style={({ pressed }) => [
              styles.button,
              (pressed || login.isPending) && styles.buttonPressed,
            ]}
            accessibilityRole="button"
          >
            {login.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Hyr</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.xl + spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  formCard: {
    flex: 1,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: colors.textMuted,
  },
  fields: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.danger,
  },
  button: {
    marginTop: spacing.lg,
    height: 52,
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
