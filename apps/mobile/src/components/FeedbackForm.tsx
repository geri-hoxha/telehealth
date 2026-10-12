import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { callsApi } from '@/api/calls';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/queries';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';
import { AppText, Button, Stars, TextField, useSnackbar } from './ui';

/** The patient rates a finished call: stars and an optional comment. */
export function FeedbackForm({
  callId,
  initialRating = 0,
  initialComment = '',
  tone = 'light',
  onSent,
}: {
  callId: string;
  initialRating?: number;
  initialComment?: string;
  /** 'dark' on the call screen's dark background. */
  tone?: 'light' | 'dark';
  onSent?: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  const send = useMutation({
    mutationFn: () => callsApi.feedback(callId, rating, comment.trim() || null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.calls });
      showSnackbar({ message: t('call.rateThanks'), tone: 'success' });
      onSent?.();
    },
  });

  return (
    <View style={styles.form}>
      <AppText variant="headline" align="center" color={tone === 'dark' ? colors.white : colors.text}>
        {t('call.rateTitle')}
      </AppText>
      <View style={styles.stars}>
        <Stars value={rating} onChange={setRating} size={36} />
      </View>
      {rating > 0 ? (
        <>
          <TextField
            value={comment}
            onChangeText={setComment}
            placeholder={t('call.ratePlaceholder')}
            multiline
            maxLength={1000}
          />
          <Button label={t('call.rateSend')} onPress={() => send.mutate()} loading={send.isPending} />
          {send.isError ? (
            <AppText variant="caption" color={colors.danger} align="center">
              {errorMessage(send.error, t)}
            </AppText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md - 4,
  },
  stars: {
    alignItems: 'center',
  },
});
