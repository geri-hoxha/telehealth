import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { callsApi } from './calls';
import {
  configApi,
  contentApi,
  doctorsApi,
  eventsApi,
  foldersApi,
  labReportsApi,
  notificationsApi,
  patientsApi,
  subscriptionApi,
} from './records';

/**
 * Query keys. Localized content includes the language, so switching language refetches it.
 * The whole cache is cleared on sign-out.
 */
export const queryKeys = {
  subscription: ['subscription'] as const,
  claims: ['claims'] as const,
  labReports: (language: string) => ['lab-reports', language] as const,
  stories: (language: string) => ['stories', language] as const,
  benefits: (language: string) => ['benefits', language] as const,
  benefit: (id: string, language: string) => ['benefits', language, id] as const,
  articles: (language: string) => ['articles', language] as const,
  article: (id: string, language: string) => ['articles', language, id] as const,
  events: ['events'] as const,
  eventList: (when: 'upcoming' | 'past', language: string) => ['events', when, language] as const,
  event: (id: string, language: string) => ['events', 'detail', id, language] as const,
  notifications: ['notifications'] as const,
  notificationList: (language: string) => ['notifications', 'list', language] as const,
  unread: (language: string) => ['notifications', 'unread', language] as const,
  folders: ['folders'] as const,
  folderList: (patientId?: string) => ['folders', 'list', patientId ?? 'mine'] as const,
  folder: (id: string) => ['folders', 'detail', id] as const,
  folderComments: (id: string) => ['folders', 'comments', id] as const,
  folderDocuments: (id: string) => ['folders', 'documents', id] as const,
  calls: ['calls'] as const,
  callHistory: ['calls', 'history'] as const,
  call: (id: string) => ['calls', 'detail', id] as const,
  availableDoctors: (query: string) => ['calls', 'available-doctors', query] as const,
  patients: ['patients'] as const,
  patientList: (query: string) => ['patients', 'list', query] as const,
  patient: (id: string) => ['patients', 'detail', id] as const,
  doctor: (id: string) => ['doctors', id] as const,
  config: ['config'] as const,
};

export function useSubscription(enabled = true) {
  return useQuery({ queryKey: queryKeys.subscription, queryFn: subscriptionApi.overview, enabled });
}

export function useClaims() {
  return useQuery({ queryKey: queryKeys.claims, queryFn: subscriptionApi.claims });
}

/** Result names come in the app's language. */
export function useLabReports() {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.labReports(language), queryFn: labReportsApi.latest });
}

export function useStories() {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.stories(language), queryFn: contentApi.stories });
}

export function useBenefits() {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.benefits(language), queryFn: contentApi.benefits });
}

export function useBenefit(id: string) {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.benefit(id, language), queryFn: () => contentApi.benefit(id) });
}

export function useArticles() {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.articles(language), queryFn: contentApi.articles });
}

export function useArticle(id: string) {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.article(id, language), queryFn: () => contentApi.article(id) });
}

export function useEvents(when: 'upcoming' | 'past') {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.eventList(when, language), queryFn: () => eventsApi.list(when) });
}

export function useEvent(id: string) {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.event(id, language), queryFn: () => eventsApi.get(id) });
}

export function useNotifications() {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.notificationList(language), queryFn: notificationsApi.list });
}

/** The bell's count. NotificationCenter keeps it fresh. */
export function useUnreadNotifications(enabled = true) {
  const { language } = useI18n();
  return useQuery({ queryKey: queryKeys.unread(language), queryFn: notificationsApi.unread, enabled });
}

export function useFolders(patientId?: string) {
  return useQuery({ queryKey: queryKeys.folderList(patientId), queryFn: () => foldersApi.list(patientId) });
}

export function useFolder(id: string) {
  return useQuery({ queryKey: queryKeys.folder(id), queryFn: () => foldersApi.get(id) });
}

export function useFolderComments(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.folderComments(id), queryFn: () => foldersApi.comments(id), enabled });
}

export function useFolderDocuments(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.folderDocuments(id), queryFn: () => foldersApi.documents(id), enabled });
}

export function useCallHistory() {
  return useQuery({ queryKey: queryKeys.callHistory, queryFn: () => callsApi.history() });
}

export function useCallDetail(id: string) {
  return useQuery({ queryKey: queryKeys.call(id), queryFn: () => callsApi.get(id) });
}

export function useAvailableDoctors(query: string) {
  return useQuery({
    queryKey: queryKeys.availableDoctors(query),
    queryFn: () => callsApi.availableDoctors(query),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
  });
}

export function usePatients(query: string) {
  return useQuery({
    queryKey: queryKeys.patientList(query),
    queryFn: () => patientsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string) {
  return useQuery({ queryKey: queryKeys.patient(id), queryFn: () => patientsApi.get(id) });
}

export function useDoctor(id: string) {
  return useQuery({ queryKey: queryKeys.doctor(id), queryFn: () => doctorsApi.get(id) });
}

export function useAppConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: configApi.get, staleTime: 10 * 60 * 1000 });
}
