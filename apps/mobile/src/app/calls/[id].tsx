import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { callsApi } from '@/api/calls';
import { errorMessage } from '@/api/errors';
import { useCallDetail } from '@/api/queries';
import type { Call, CallParticipant } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { FeedbackForm } from '@/components/FeedbackForm';
import { CALL_STATE_TONE } from '@/components/rows';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Header,
  ListGroup,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  Stars,
  useSnackbar,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDateTime, formatDuration, formatTime } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

export default function CallDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const call = useCallDetail(id);

  return (
    <Screen
      header={<Header title={t('callDetail.title')} />}
      onRefresh={() => void call.refetch()}
      refreshing={call.isRefetching}
    >
      {call.isPending ? (
        <LoadingState />
      ) : call.isError ? (
        <ErrorState error={call.error} onRetry={() => void call.refetch()} />
      ) : (
        <CallDetail call={call.data} />
      )}
    </Screen>
  );
}

function CallDetail({ call }: { call: Call }) {
  const user = useUser();
  const { t, language } = useI18n();
  const showSnackbar = useSnackbar();
  const isPatient = user.role === 'PATIENT';
  const other = isPatient ? (call.answeredAt ? call.doctor : null) : call.patient;

  const freeLine = useMutation({
    mutationFn: () => callsApi.freeLine(call.id),
    onSuccess: () => showSnackbar({ message: t('callDetail.freeLineSent'), tone: 'success' }),
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  const openParticipant = (participant: CallParticipant) => {
    if (isPatient && participant.role !== 'PATIENT') {
      router.push({ pathname: '/doctors/[id]', params: { id: participant.id } });
    } else if (!isPatient && participant.role === 'PATIENT') {
      router.push({ pathname: '/patients/[id]', params: { id: participant.id } });
    }
  };

  return (
    <>
      <Card style={styles.top}>
        {other ? (
          <Avatar name={other.name} url={other.avatarUrl} size={72} />
        ) : (
          <View style={styles.systemAvatar}>
            <Ionicons name="medical" size={32} color={colors.primary} />
          </View>
        )}
        <AppText variant="headline" align="center">
          {other ? (isPatient ? `${t('common.doctorPrefix')} ${other.name}` : other.name) : t('callDetail.noDoctor')}
        </AppText>
        <View style={styles.badges}>
          <Badge label={t(`media.${call.media}`)} icon={call.media === 'VIDEO' ? 'videocam' : 'call'} />
          <Badge label={t(`callState.${call.state}`)} tone={CALL_STATE_TONE[call.state]} />
        </View>
      </Card>

      <SectionHeader title={t('callDetail.times')} />
      <Card style={styles.timeline}>
        <TimelineItem icon="arrow-up-circle" label={t('callDetail.requested')} value={formatDateTime(call.createdAt, language)} />
        <TimelineItem
          icon="play-circle"
          label={t('callDetail.started')}
          value={call.answeredAt ? formatTime(call.answeredAt) : t('common.noData')}
        />
        <TimelineItem
          icon="stop-circle"
          label={t('callDetail.ended')}
          value={call.endedAt ? formatTime(call.endedAt) : t('common.noData')}
        />
        <TimelineItem
          icon="hourglass"
          label={t('callDetail.duration')}
          value={call.durationSeconds !== null ? formatDuration(call.durationSeconds, t) : t('common.noData')}
          last
        />
      </Card>

      {call.participants.length ? (
        <ListGroup title={t('callDetail.participants')}>
          {call.participants.map((participant) => {
            const canOpen = isPatient ? participant.role !== 'PATIENT' : participant.role === 'PATIENT';
            return (
              <ListRow
                key={participant.id}
                left={<Avatar name={participant.name} url={participant.avatarUrl} size={40} />}
                title={participant.role === 'PATIENT' ? participant.name : `${t('common.doctorPrefix')} ${participant.name}`}
                subtitle={[t(`callDetail.role.${participant.role}`), participant.specialty].filter(Boolean).join(' · ')}
                onPress={canOpen ? () => openParticipant(participant) : undefined}
              />
            );
          })}
        </ListGroup>
      ) : null}

      <SectionHeader title={isPatient ? t('callDetail.feedback') : t('callDetail.patientFeedback')} />
      <Card>
        {call.feedback ? (
          <View style={styles.feedback}>
            <Stars value={call.feedback.rating} size={22} />
            {call.feedback.comment ? (
              <AppText variant="body" color={colors.textSecondary}>
                “{call.feedback.comment}”
              </AppText>
            ) : null}
          </View>
        ) : isPatient && call.state === 'ENDED' && call.answeredAt ? (
          <FeedbackForm callId={call.id} />
        ) : (
          <AppText variant="body" color={colors.textMuted}>
            {t('callDetail.noFeedback')}
          </AppText>
        )}
      </Card>

      {!isPatient ? (
        <Card style={styles.freeLine}>
          <View style={styles.freeLineRow}>
            <View style={styles.freeLineIcon}>
              <Ionicons name="call" size={20} color={colors.success} />
            </View>
            <AppText variant="caption" color={colors.textSecondary} style={styles.flex}>
              {t('callDetail.freeLineHint')}
            </AppText>
          </View>
          <Button label={t('callDetail.freeLine')} icon="radio" onPress={() => freeLine.mutate()} loading={freeLine.isPending} />
        </Card>
      ) : null}
    </>
  );
}

function TimelineItem({ icon, label, value, last }: { icon: 'arrow-up-circle' | 'play-circle' | 'stop-circle' | 'hourglass'; label: string; value: string; last?: boolean }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineText}>
        <AppText variant="caption" color={colors.textMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  systemAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeline: {
    paddingVertical: spacing.md - 4,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md - 4,
  },
  timelineRail: {
    alignItems: 'center',
    width: 24,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: 14,
    backgroundColor: colors.primarySoft,
    marginVertical: 2,
  },
  timelineText: {
    flex: 1,
    paddingBottom: spacing.md - 4,
  },
  feedback: {
    gap: spacing.sm,
  },
  freeLine: {
    gap: spacing.md - 4,
  },
  freeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  freeLineIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
