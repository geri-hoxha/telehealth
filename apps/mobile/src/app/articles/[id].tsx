import { useLocalSearchParams } from 'expo-router';
import { useArticle } from '@/api/queries';
import { ContentPage } from '@/components/ContentPage';
import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const article = useArticle(id);

  if (!article.data) {
    return (
      <Screen>{article.isError ? <ErrorState error={article.error} onRetry={() => void article.refetch()} /> : <LoadingState />}</Screen>
    );
  }
  const { data } = article;
  return (
    <ContentPage
      icon={data.icon}
      color={data.color}
      eyebrow={`${formatDate(data.publishedAt, language)} · ${t('home.readMinutes', { count: data.readMinutes })}`}
      title={data.title}
      subtitle={data.summary}
      body={data.body}
    />
  );
}
