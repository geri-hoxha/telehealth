import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { AppText, Button, ErrorState, Header, IconButton } from '@/components/ui';
import { downloadDocument, shareFile } from '@/documents/files';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

type Params = { id: string; url: string; name: string; mimeType: string };

/**
 * Views a folder document: photos in the app, PDFs and text in a web view on iPhone. Android's
 * web view can't show PDFs, so there it opens the share sheet to pick a viewer.
 */
export default function DocumentScreen() {
  const { id, url, name, mimeType } = useLocalSearchParams<Params>();
  const { t } = useI18n();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const isImage = mimeType?.startsWith('image/');
  const inWebView = Platform.OS === 'ios' && !isImage;

  const load = () => {
    setError(null);
    downloadDocument(id, url, name)
      .then(setLocalUri)
      .catch(setError);
  };
  useEffect(load, [id, url, name]);

  return (
    <SafeAreaView style={[styles.screen, isImage && styles.dark]} edges={['top', 'bottom']}>
      <StatusBar style={isImage ? 'light' : 'dark'} />
      <Header
        title={name}
        back="close"
        tone={isImage ? 'light' : 'default'}
        right={
          localUri ? (
            <IconButton
              icon="share-outline"
              label={t('document.share')}
              onPress={() => void shareFile(localUri, mimeType)}
              variant={isImage ? 'glass' : 'surface'}
              size={40}
            />
          ) : null
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : !localUri ? (
        <View style={styles.center}>
          <ActivityIndicator color={isImage ? colors.white : colors.primary} size="large" />
        </View>
      ) : isImage ? (
        <Image source={{ uri: localUri }} style={styles.flex} contentFit="contain" />
      ) : inWebView ? (
        <WebView source={{ uri: localUri }} originWhitelist={['*']} style={styles.flex} allowingReadAccessToURL={localUri} />
      ) : (
        <View style={styles.center}>
          <View style={styles.fileIcon}>
            <Ionicons name="document-text" size={44} color={colors.primary} />
          </View>
          <AppText variant="subhead" align="center">
            {name}
          </AppText>
          <Button label={t('document.share')} icon="open-outline" onPress={() => void shareFile(localUri, mimeType)} fullWidth={false} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dark: {
    backgroundColor: colors.black,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  fileIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
