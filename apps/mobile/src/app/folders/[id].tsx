import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { errorCode, errorMessage } from '@/api/errors';
import { queryKeys, useFolder, useFolderComments, useFolderDocuments } from '@/api/queries';
import { foldersApi } from '@/api/records';
import type { FolderComment, FolderDocument, MedicalFolder } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  ListSkeleton,
  LoadingState,
  Screen,
  SegmentedControl,
  useActionSheet,
  useSnackbar,
  type IconName,
} from '@/components/ui';
import { exportFolderPdf } from '@/documents/files';
import { useI18n } from '@/i18n';
import { formatDate, formatNumericDate, formatRelative } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

type Tab = 'details' | 'comments' | 'documents';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const showSnackbar = useSnackbar();
  const [tab, setTab] = useState<Tab>('details');
  const folder = useFolder(id);
  const comments = useFolderComments(id, tab === 'comments');
  const documents = useFolderDocuments(id, tab === 'documents');

  const exportPdf = useMutation({
    mutationFn: (data: MedicalFolder) => exportFolderPdf(data, language),
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  const data = folder.data;
  return (
    <Screen
      keyboard
      header={
        <Header
          title={t('folder.title')}
          right={
            data ? (
              exportPdf.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <IconButton icon="download-outline" label={t('folder.exportPdf')} onPress={() => exportPdf.mutate(data)} size={40} />
              )
            ) : null
          }
        />
      }
      onRefresh={() => {
        void folder.refetch();
        if (tab === 'comments') void comments.refetch();
        if (tab === 'documents') void documents.refetch();
      }}
      refreshing={folder.isRefetching}
      footer={data && tab === 'comments' ? <CommentComposer folderId={id} /> : undefined}
    >
      {folder.isPending ? (
        <LoadingState />
      ) : folder.isError || !data ? (
        <ErrorState error={folder.error} onRetry={() => void folder.refetch()} />
      ) : (
        <>
          <Summary folder={data} />
          <SegmentedControl<Tab>
            options={[
              { value: 'details', label: t('folder.tab.details') },
              { value: 'comments', label: `${t('folder.tab.comments')} · ${data.commentCount}` },
              { value: 'documents', label: `${t('folder.tab.documents')} · ${data.documentCount}` },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'details' ? <Details folder={data} /> : null}
          {tab === 'comments' ? (
            comments.isPending ? (
              <ListSkeleton count={3} height={70} />
            ) : comments.isError ? (
              <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />
            ) : (
              <Comments comments={comments.data} />
            )
          ) : null}
          {tab === 'documents' ? (
            documents.isPending ? (
              <ListSkeleton count={2} height={70} />
            ) : documents.isError ? (
              <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
            ) : (
              <Documents folderId={id} documents={documents.data} />
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Summary({ folder }: { folder: MedicalFolder }) {
  const user = useUser();
  const { t, language } = useI18n();
  return (
    <Card style={styles.summary}>
      <View style={styles.summaryTop}>
        <Badge label={formatDate(folder.visitDate, language)} tone="primary" icon="calendar" />
        <Badge label={t(`concern.${folder.concernCategory}`)} />
      </View>
      <AppText variant="title">{folder.diagnosis}</AppText>
      <View style={styles.people}>
        <View style={styles.person}>
          <Avatar name={folder.doctor.name} url={folder.doctor.avatarUrl} size={34} />
          <View style={styles.flex}>
            <AppText variant="small" color={colors.textMuted}>
              {t('folder.doctor')}
            </AppText>
            <AppText variant="caption" weight="700" numberOfLines={1}>
              {t('common.doctorPrefix')} {folder.doctor.name}
            </AppText>
          </View>
        </View>
        {user.role === 'DOCTOR' ? (
          <View style={styles.person}>
            <Avatar name={folder.patient.name} url={folder.patient.avatarUrl} size={34} />
            <View style={styles.flex}>
              <AppText variant="small" color={colors.textMuted}>
                {t('folder.patient')}
              </AppText>
              <AppText variant="caption" weight="700" numberOfLines={1}>
                {folder.patient.name}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const DETAIL_ICONS: Record<'symptoms' | 'diagnosis' | 'prescription' | 'recommendations', IconName> = {
  symptoms: 'pulse',
  diagnosis: 'clipboard',
  prescription: 'medkit',
  recommendations: 'heart',
};

function Details({ folder }: { folder: MedicalFolder }) {
  const user = useUser();
  const { t } = useI18n();
  const isDoctor = user.role === 'DOCTOR';

  const emailPrescription = async () => {
    const date = formatNumericDate(folder.visitDate);
    const subject = t('folder.emailSubject', { doctor: folder.doctor.name, date });
    const body = [
      t('folder.emailGreeting', { name: folder.patient.name }),
      '',
      t('folder.emailIntro', { date }),
      '',
      `${t('folder.diagnosis')}: ${folder.diagnosis}`,
      '',
      `${t('folder.prescription')}:`,
      folder.prescription ?? '',
      ...(folder.recommendations ? ['', `${t('folder.recommendations')}:`, folder.recommendations] : []),
      '',
      t('folder.emailClosing'),
      `${t('common.doctorPrefix')} ${folder.doctor.name}`,
    ].join('\n');
    const url = `mailto:${folder.patient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('folder.emailPrescription'), t('folder.noMailApp'));
    }
  };

  return (
    <View style={styles.details}>
      {(['symptoms', 'diagnosis', 'prescription', 'recommendations'] as const).map((field) =>
        folder[field] ? (
          <Card key={field} style={styles.detail}>
            <View style={styles.detailTitle}>
              <View style={styles.detailIcon}>
                <Ionicons name={DETAIL_ICONS[field]} size={16} color={colors.primary} />
              </View>
              <AppText variant="overline" color={colors.primaryDark}>
                {t(`folder.${field}`)}
              </AppText>
            </View>
            <AppText variant="body" selectable>
              {folder[field]}
            </AppText>
          </Card>
        ) : null,
      )}
      {isDoctor && folder.medicalComments ? (
        <Card style={[styles.detail, styles.privateNote]}>
          <View style={styles.detailTitle}>
            <View style={[styles.detailIcon, styles.privateIcon]}>
              <Ionicons name="lock-closed" size={14} color={colors.warning} />
            </View>
            <AppText variant="overline" color={colors.warning}>
              {t('folder.medicalComments')}
            </AppText>
          </View>
          <AppText variant="body" selectable>
            {folder.medicalComments}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {t('folder.medicalCommentsHint')}
          </AppText>
        </Card>
      ) : null}
      {isDoctor && folder.prescription ? (
        <Button label={t('folder.emailPrescription')} icon="mail" variant="secondary" onPress={() => void emailPrescription()} />
      ) : null}
    </View>
  );
}

function Comments({ comments }: { comments: FolderComment[] }) {
  const { t, language } = useI18n();
  if (!comments.length) return <EmptyState icon="chatbubbles-outline" text={t('folder.commentsEmpty')} />;
  return (
    <View style={styles.comments}>
      {comments.map((comment) => (
        <View key={comment.id} style={[styles.commentRow, comment.mine && styles.commentRowMine]}>
          {!comment.mine ? <Avatar name={comment.author.name} url={comment.author.avatarUrl} size={30} /> : null}
          <View style={[styles.bubble, comment.mine ? styles.bubbleMine : styles.bubbleOther]}>
            {!comment.mine ? (
              <AppText variant="small" weight="700" color={colors.primaryDark}>
                {comment.author.role === 'DOCTOR' ? `${t('common.doctorPrefix')} ${comment.author.name}` : comment.author.name}
              </AppText>
            ) : null}
            <AppText variant="body" color={comment.mine ? colors.white : colors.text}>
              {comment.body}
            </AppText>
            <AppText variant="small" color={comment.mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} align="right">
              {formatRelative(comment.createdAt, language, t)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function CommentComposer({ folderId }: { folderId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const [text, setText] = useState('');

  const send = useMutation({
    mutationFn: () => foldersApi.addComment(folderId, text.trim()),
    onSuccess: () => {
      setText('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.folderComments(folderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders });
    },
    onError: (error) =>
      showSnackbar({
        message: errorMessage(error, t),
        tone: 'error',
        action:
          errorCode(error) === 'SUBSCRIPTION_REQUIRED'
            ? { label: t('home.activate'), onPress: () => router.push('/subscription') }
            : undefined,
      }),
  });

  return (
    <View style={styles.composer}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('folder.commentPlaceholder')}
        placeholderTextColor={colors.textMuted}
        style={styles.composerInput}
        multiline
        maxLength={2000}
        accessibilityLabel={t('folder.commentPlaceholder')}
      />
      <Pressable
        onPress={() => send.mutate()}
        disabled={!text.trim() || send.isPending}
        accessibilityRole="button"
        accessibilityLabel={t('common.send')}
        style={[styles.sendButton, (!text.trim() || send.isPending) && styles.sendDisabled]}
      >
        {send.isPending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
      </Pressable>
    </View>
  );
}

function documentIcon(mimeType: string): IconName {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document-text';
  return 'document';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Documents({ folderId, documents }: { folderId: string; documents: FolderDocument[] }) {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const showActionSheet = useActionSheet();

  const upload = useMutation({
    mutationFn: (file: { uri: string; name: string; mimeType: string }) => foldersApi.uploadDocument(folderId, file),
    onSuccess: () => {
      showSnackbar({ message: t('folder.uploaded'), tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.folderDocuments(folderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders });
    },
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  const send = (file: { uri: string; name: string; mimeType: string; size?: number | null }) => {
    if (file.size && file.size > MAX_UPLOAD_BYTES) {
      showSnackbar({ message: t('folder.fileTooBig'), tone: 'error' });
      return;
    }
    upload.mutate(file);
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('folder.takePhoto'), t('editProfile.cameraDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      send({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
    }
  };

  const fromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      send({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize });
    }
  };

  const fromFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      send({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size });
    }
  };

  const chooseSource = () =>
    showActionSheet({
      title: t('folder.upload'),
      options: [
        { label: t('folder.takePhoto'), icon: 'camera', onPress: () => void fromCamera() },
        { label: t('folder.choosePhoto'), icon: 'images', onPress: () => void fromGallery() },
        { label: t('folder.chooseFile'), icon: 'document-attach', onPress: () => void fromFiles() },
      ],
    });

  return (
    <View style={styles.documents}>
      <Button
        label={upload.isPending ? t('folder.uploading') : t('folder.upload')}
        icon="cloud-upload"
        variant="secondary"
        onPress={chooseSource}
        loading={upload.isPending}
      />
      {documents.length === 0 ? (
        <EmptyState icon="documents-outline" text={t('folder.documentsEmpty')} />
      ) : (
        documents.map((document) => (
          <Card
            key={document.id}
            style={styles.document}
            onPress={() =>
              router.push({
                pathname: '/document',
                params: { id: document.id, url: document.url, name: document.fileName, mimeType: document.mimeType },
              })
            }
          >
            <View style={styles.documentIcon}>
              <Ionicons name={documentIcon(document.mimeType)} size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {document.fileName}
              </AppText>
              <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
                {formatSize(document.size)} · {t('folder.uploadedBy', { name: document.uploadedBy.name })} ·{' '}
                {formatRelative(document.createdAt, language, t)}
              </AppText>
            </View>
            <Ionicons name="eye-outline" size={20} color={colors.textMuted} />
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  summary: {
    gap: spacing.sm + 2,
  },
  summaryTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  people: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  details: {
    gap: spacing.md - 4,
  },
  detail: {
    gap: spacing.sm,
  },
  detailTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateNote: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: colors.warningSoft,
  },
  privateIcon: {
    backgroundColor: colors.warningSoft,
  },
  comments: {
    gap: spacing.md - 4,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    maxWidth: '88%',
  },
  commentRowMine: {
    alignSelf: 'flex-end',
  },
  bubble: {
    flexShrink: 1,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: 3,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.45,
  },
  documents: {
    gap: spacing.md - 4,
  },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
