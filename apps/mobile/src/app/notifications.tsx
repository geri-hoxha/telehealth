import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { queryKeys, useNotifications } from '@/api/queries';
import { notificationsApi } from '@/api/records';
import type { AppNotification } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { startCall } from '@/calls/start-call';
import { NotificationRow } from '@/components/rows';
import { AppText, EmptyState, ErrorState, Header, ListSkeleton, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { openNotification } from '@/notifications/open-notification';
import { colors, spacing } from '@/theme';

/** Notifications, newest first. Tapping one opens what it is about; a free line offers "Call now". */
export default function NotificationsScreen() {
  const user = useUser();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const hasUnread = notifications.data?.some((notification) => !notification.readAt);

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  const open = (notification: AppNotification) => {
    if (!notification.readAt) {
      void notificationsApi
        .markRead(notification.id)
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }))
        .catch(() => {});
    }
    // A free line only calls through its "Call now" button, never by tapping the row.
    if (notification.type !== 'FREE_LINE') openNotification(notification, user.role, notification.title);
  };

  return (
    <Screen
      scroll={false}
      header={
        <Header
          title={t('notifications.title')}
          right={
            hasUnread ? (
              <Pressable onPress={() => markAllRead.mutate()} accessibilityRole="button" hitSlop={8}>
                <AppText variant="caption" weight="700" color={colors.primary}>
                  {t('notifications.markAllRead')}
                </AppText>
              </Pressable>
            ) : null
          }
        />
      }
    >
      {notifications.isPending ? (
        <View style={styles.padded}>
          <ListSkeleton count={5} height={86} />
        </View>
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      ) : (
        <FlatList
          data={notifications.data}
          keyExtractor={(notification) => notification.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching}
              onRefresh={() => void notifications.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" text={t('notifications.empty')} />}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => open(item)}
              onCallNow={
                item.type === 'FREE_LINE' && item.doctorId && user.role === 'PATIENT'
                  ? () => {
                      open(item);
                      startCall('VIDEO', { preferredDoctorId: item.doctorId ?? undefined });
                    }
                  : undefined
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md - 4,
  },
});
