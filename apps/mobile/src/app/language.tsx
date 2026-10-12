import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandHero } from '@/components/BrandHero';
import { AppText, Button } from '@/components/ui';
import { LANGUAGES, translate, useI18n, type Language } from '@/i18n';
import { colors, radius, shadows, spacing } from '@/theme';

/** First launch: pick the app's language. The texts switch as soon as one is tapped. */
export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { setLanguage } = useI18n();
  const [selected, setSelected] = useState<Language>('sq');
  const t = (key: Parameters<typeof translate>[1]) => translate(selected, key);

  return (
    <View style={styles.screen}>
      <ScrollView bounces={false} contentContainerStyle={styles.scroll}>
        <BrandHero tagline={t('auth.tagline')} />
        <View style={styles.sheet}>
          <AppText variant="title">{t('language.title')}</AppText>
          <AppText variant="body" color={colors.textMuted}>
            {t('language.subtitle')}
          </AppText>
          <View style={styles.options} accessibilityRole="radiogroup">
            {LANGUAGES.map((language) => {
              const isSelected = language.code === selected;
              return (
                <Pressable
                  key={language.code}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setSelected(language.code);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <AppText style={styles.flag}>{language.flag}</AppText>
                  <AppText variant="subhead" style={styles.optionName}>
                    {language.name}
                  </AppText>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={t('common.continue')} icon="arrow-forward" onPress={() => void setLanguage(selected)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  options: {
    marginTop: spacing.lg,
    gap: spacing.md - 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 68,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.85,
  },
  flag: {
    fontSize: 30,
    lineHeight: 36,
  },
  optionName: {
    flex: 1,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
});
