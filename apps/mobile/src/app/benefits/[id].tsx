import { router, useLocalSearchParams } from 'expo-router';
import { useBenefit } from '@/api/queries';
import { ContentPage } from '@/components/ContentPage';
import { Button, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';

/** A "My benefits" promotion page. */
export default function BenefitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const benefit = useBenefit(id);

  if (!benefit.data) {
    return (
      <Screen>{benefit.isError ? <ErrorState error={benefit.error} onRetry={() => void benefit.refetch()} /> : <LoadingState />}</Screen>
    );
  }
  const { data } = benefit;
  return (
    <ContentPage
      icon={data.icon}
      color={data.color}
      eyebrow={t('home.benefits')}
      title={data.title}
      subtitle={data.subtitle}
      body={data.body}
      footer={
        data.url ? (
          <Button
            label={t('benefit.openPage')}
            icon="open-outline"
            onPress={() => router.push({ pathname: '/web', params: { url: data.url ?? '', title: data.title } })}
          />
        ) : null
      }
    />
  );
}
