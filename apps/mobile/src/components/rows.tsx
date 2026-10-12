import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import type { AppNotification, Call, CallState, HealthEvent, MedicalFolder, NotificationType, Patient } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatDate, formatDayAndTime, formatDuration, formatRelative, formatTime, monthShort, weekdayShort } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';
import { AppText, Avatar, Badge, Button, Card, type BadgeTone, type IconName } from './ui';

// List items shared by several screens.

export const CALL_STATE_TONE: Record<CallState, BadgeTone> = {
  QUEUED: 'warning',
  RINGING: 'info',
  ACCEPTED: 'primary',
  ENDED: 'success',
  DECLINED: 'neutral',
  CANCELED: 'neutral',
  UNANSWERED: 'danger',
  FAILED: 'danger',
};

/** One call in a history list, from the viewer's side: patients see the doctor, doctors the patient. */
export function CallRow({ call, viewer, onPress }: { call: Call; viewer: 'PATIENT' | 'DOCTOR'; onPress: () => void }) {
  const { t, language } = useI18n();
  const other = viewer === 'PATIENT' ? (call.answeredAt ? call.doctor : null) : call.patient;
  const name = other?.name ?? t('call.systemName');
  return (
    <Card onPress={onPress} style={styles.row} accessibilityLabel={`${name}, ${t(`callState.${call.state}`)}`}>
      {other ? (
        <Avatar name={other.name} url={other.avatarUrl} size={46} />
      ) : (
        <View style={styles.systemAvatar}>
          <Ionicons name="medical" size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.metaRow}>
          <Ionicons name={call.media === 'VIDEO' ? 'videocam' : 'call'} size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {formatDayAndTime(call.createdAt, language, t)}
            {call.durationSeconds !== null ? ` · ${formatDuration(call.durationSeconds, t)}` : ''}
          </AppText>
        </View>
      </View>
      <Badge label={t(`callState.${call.state}`)} tone={CALL_STATE_TONE[call.state]} />
    </Card>
  );
}

/** An activity card: a date tile, title, specialist and places left. */
export function EventCard({ event, onPress }: { event: HealthEvent; onPress: () => void }) {
  const { t, tp, language } = useI18n();
  const filled = event.capacity > 0 ? event.participantCount / event.capacity : 1;
  return (
    <Card onPress={onPress} style={styles.eventCard} accessibilityLabel={event.title}>
      <View style={styles.eventTop}>
        <View style={[styles.dateTile, event.status === 'LIVE' && styles.dateTileLive]}>
          <AppText variant="small" weight="700" color={event.status === 'LIVE' ? colors.white : colors.primaryDark}>
            {monthShort(event.startsAt, language).toUpperCase()}
          </AppText>
          <AppText variant="title" color={event.status === 'LIVE' ? colors.white : colors.text} style={styles.dateDay}>
            {new Date(event.startsAt).getDate()}
          </AppText>
          <AppText variant="small" color={event.status === 'LIVE' ? 'rgba(255,255,255,0.85)' : colors.textMuted}>
            {weekdayShort(event.startsAt, language)}
          </AppText>
        </View>
        <View style={styles.rowText}>
          {event.status === 'LIVE' ? <Badge label={t('activities.live')} tone="live" dot /> : null}
          <AppText variant="subhead" numberOfLines={2}>
            {event.title}
          </AppText>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted}>
              {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
            </AppText>
          </View>
        </View>
      </View>
      <View style={styles.eventSpecialist}>
        <Avatar name={event.specialist.name} url={event.specialist.avatarUrl} size={28} />
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={styles.flex}>
          {t('common.doctorPrefix')} {event.specialist.name}
          {event.specialist.specialty ? ` · ${event.specialist.specialty}` : ''}
        </AppText>
      </View>
      {event.status !== 'ENDED' ? (
        <View style={styles.eventFooter}>
          <View style={styles.capacityBar}>
            <View style={[styles.capacityFill, { width: `${Math.min(100, filled * 100)}%` }, event.freePlaces === 0 && styles.capacityFull]} />
          </View>
          {event.joined ? (
            <Badge label={t('activities.joined')} tone="success" icon="checkmark" />
          ) : event.freePlaces === 0 ? (
            <Badge label={t('activities.full')} tone="danger" />
          ) : (
            <AppText variant="small" weight="700" color={colors.primaryDark}>
              {tp('activities.placesLeft', event.freePlaces)}
            </AppText>
          )}
        </View>
      ) : null}
    </Card>
  );
}

/** A medical folder in a list: date, diagnosis, doctor and counts. */
export function FolderCard({ folder, onPress, showDoctor = true }: { folder: MedicalFolder; onPress: () => void; showDoctor?: boolean }) {
  const { t, language } = useI18n();
  return (
    <Card onPress={onPress} style={styles.folderCard} accessibilityLabel={folder.diagnosis}>
      <View style={styles.folderTop}>
        <View style={styles.folderIcon}>
          <Ionicons name="document-text" size={22} color={colors.primary} />
        </View>
        <View style={styles.rowText}>
          <AppText variant="small" weight="700" color={colors.primaryDark}>
            {formatDate(folder.visitDate, language)}
          </AppText>
          <AppText variant="subhead" numberOfLines={2}>
            {folder.diagnosis}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      <AppText variant="caption" color={colors.textSecondary} numberOfLines={2}>
        {folder.symptoms}
      </AppText>
      <View style={styles.folderFooter}>
        {showDoctor ? (
          <View style={[styles.metaRow, styles.flex]}>
            <Avatar name={folder.doctor.name} url={folder.doctor.avatarUrl} size={22} />
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              {t('common.doctorPrefix')} {folder.doctor.name}
            </AppText>
          </View>
        ) : (
          <View style={styles.flex}>
            <Badge label={t(`concern.${folder.concernCategory}`)} tone="primary" />
          </View>
        )}
        <View style={styles.counts}>
          <View style={styles.metaRow}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted}>
              {folder.commentCount}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="attach" size={15} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted}>
              {folder.documentCount}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const NOTIFICATION_ICON: Record<NotificationType, { icon: IconName; color: string; background: string }> = {
  FOLDER_CREATED: { icon: 'document-text', color: colors.primary, background: colors.primaryTint },
  FOLDER_COMMENT: { icon: 'chatbubble-ellipses', color: colors.info, background: colors.infoSoft },
  FOLDER_DOCUMENT: { icon: 'attach', color: '#7C3AED', background: '#EDE9FE' },
  FREE_LINE: { icon: 'call', color: colors.success, background: colors.successSoft },
  SUBSCRIPTION_ACTIVATED: { icon: 'shield-checkmark', color: colors.primary, background: colors.primaryTint },
  EVENT_JOINED: { icon: 'calendar', color: colors.warning, background: colors.warningSoft },
  ANNOUNCEMENT: { icon: 'megaphone', color: colors.danger, background: colors.dangerSoft },
};

export function NotificationRow({
  notification,
  onPress,
  onCallNow,
}: {
  notification: AppNotification;
  onPress: () => void;
  /** FREE_LINE: the "Call now" action. */
  onCallNow?: () => void;
}) {
  const { t, language } = useI18n();
  const look = NOTIFICATION_ICON[notification.type];
  const unread = !notification.readAt;
  return (
    <Card onPress={onPress} style={[styles.notification, unread && styles.notificationUnread]} accessibilityLabel={notification.title}>
      <View style={[styles.notificationIcon, { backgroundColor: look.background }]}>
        <Ionicons name={look.icon} size={20} color={look.color} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.notificationTitle}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {notification.title}
          </AppText>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          {notification.body}
        </AppText>
        <AppText variant="small" color={colors.textMuted}>
          {formatRelative(notification.createdAt, language, t)}
        </AppText>
        {onCallNow ? (
          <Button label={t('notifications.callNow')} icon="call" size="sm" onPress={onCallNow} style={styles.callNow} />
        ) : null}
      </View>
    </Card>
  );
}

export function PatientRow({ patient, onPress }: { patient: Patient; onPress: () => void }) {
  const { t, tp } = useI18n();
  return (
    <Card onPress={onPress} style={styles.row} accessibilityLabel={patient.name}>
      <Avatar name={patient.name} url={patient.avatarUrl} size={48} />
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {patient.name}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {patient.phone ?? patient.email}
        </AppText>
        <View style={styles.metaRow}>
          <Ionicons name="folder-open-outline" size={13} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted}>
            {tp('patients.folders', patient.folderCount)}
          </AppText>
        </View>
      </View>
      {patient.block ? <Badge label={t('patients.blocked')} tone="danger" icon="ban" /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  systemAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCard: {
    gap: spacing.md - 4,
  },
  eventTop: {
    flexDirection: 'row',
    gap: spacing.md - 2,
  },
  dateTile: {
    width: 58,
    paddingVertical: spacing.sm,
    borderRadius: radius.md + 2,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
  },
  dateTileLive: {
    backgroundColor: colors.danger,
  },
  dateDay: {
    lineHeight: 28,
  },
  eventSpecialist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  capacityBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  capacityFull: {
    backgroundColor: colors.danger,
  },
  folderCard: {
    gap: spacing.sm + 2,
  },
  folderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  counts: {
    flexDirection: 'row',
    gap: spacing.md - 4,
  },
  notification: {
    flexDirection: 'row',
    gap: spacing.md - 4,
    alignItems: 'flex-start',
  },
  notificationUnread: {
    backgroundColor: '#F7FEFD',
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  callNow: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
});
