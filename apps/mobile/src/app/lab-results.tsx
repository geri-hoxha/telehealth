import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLabReports } from '@/api/queries';
import type { LabReportType } from '@/api/types';
import { LabResultCard } from '@/components/LabResultCard';
import { AppText, Button, Card, EmptyState, ErrorState, Header, ListSkeleton, Screen, SegmentedControl, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

const TYPE_ICON: Record<LabReportType, IconName> = { BLOOD: 'water', URINE: 'flask' };

/** The patient's latest blood test and urine test, each value on its scale. */
export default function LabResultsScreen() {
  const { t, tp, language } = useI18n();
  const reports = useLabReports();
  const [chosen, setChosen] = useState<LabReportType | null>(null);

  const list = reports.data ?? [];
  const report = list.find((item) => item.type === chosen) ?? list[0];
  const flagged = report ? report.results.filter((result) => result.status !== 'NORMAL').length : 0;

  return (
    <Screen
      header={<Header title={t('lab.title')} />}
      onRefresh={() => void reports.refetch()}
      refreshing={reports.isRefetching}
    >
      {reports.isPending ? (
        <ListSkeleton count={4} height={150} />
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
      ) : !report ? (
        <EmptyState icon="flask-outline" text={t('lab.empty')} />
      ) : (
        <>
          {list.length > 1 ? (
            <SegmentedControl
              options={list.map((item) => ({
                value: item.type,
                label: t(item.type === 'BLOOD' ? 'lab.blood' : 'lab.urine'),
                icon: TYPE_ICON[item.type],
              }))}
              value={report.type}
              onChange={setChosen}
            />
          ) : null}

          <AppText variant="caption" color={colors.textMuted}>
            {formatDate(report.takenAt, language)} · {report.lab}
          </AppText>

          <Card style={styles.summary}>
            <View style={[styles.summaryIcon, { backgroundColor: flagged ? colors.warningSoft : colors.successSoft }]}>
              <Ionicons
                name={flagged ? 'alert-circle' : 'checkmark-circle'}
                size={22}
                color={flagged ? colors.warning : colors.success}
              />
            </View>
            <View style={styles.flex}>
              <AppText variant="subhead">{flagged ? tp('lab.attention', flagged) : t('lab.allNormal')}</AppText>
              {flagged ? (
                <AppText variant="caption" color={colors.textMuted}>
                  {t('lab.attentionHint')}
                </AppText>
              ) : null}
            </View>
          </Card>

          {report.results.map((result) => (
            <LabResultCard key={result.id} result={result} />
          ))}

          {flagged ? (
            <Button label={t('lab.talkToDoctor')} icon="videocam" onPress={() => router.push('/patient/call')} />
          ) : null}
          <AppText variant="small" color={colors.textMuted} align="center">
            {t('lab.disclaimer')}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
