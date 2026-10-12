import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EmptyState, Header, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors } from '@/theme';

/** An in-app web page: the partner clinic network, promotion pages and notification links. */
export default function WebScreen() {
  const { url = '', title = '' } = useLocalSearchParams<{ url: string; title: string }>();
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <Screen scroll={false} edges={['top', 'bottom']} background={colors.surface} header={<Header title={title} back="close" />}>
      {progress < 1 && !failed ? (
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${Math.max(5, progress * 100)}%` }]} />
        </View>
      ) : null}
      {failed ? (
        <EmptyState icon="cloud-offline-outline" text={t('web.loadError')} />
      ) : (
        <WebView
          source={{ uri: url }}
          style={styles.web}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onError={() => setFailed(true)}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: colors.surfaceMuted,
  },
  bar: {
    height: 3,
    backgroundColor: colors.primary,
  },
  web: {
    flex: 1,
  },
});
