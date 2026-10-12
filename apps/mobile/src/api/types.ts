// What the API sends and receives. Dates arrive as ISO strings.

export type Role = 'PATIENT' | 'DOCTOR';
export type Sex = 'MALE' | 'FEMALE';
export type ApiLanguage = 'SQ' | 'EN' | 'MK';

export interface DoctorProfile {
  specialty: string | null;
  bio: string | null;
  licenceNumber: string | null;
  country: string | null;
  city: string | null;
  healthCentre: string | null;
}

/** The signed-in user. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** PATIENT (the "client") calls doctors; DOCTOR answers. */
  role: Role;
  phone: string | null;
  personalId: string | null;
  sex: Sex | null;
  avatarUrl: string | null;
  language: ApiLanguage;
  doctorProfile: DoctorProfile | null;
  createdAt: string;
}

/** Someone shown on another screen. */
export interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialty: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// --- calls ---

export type CallMedia = 'AUDIO' | 'VIDEO';
export type CallState = 'QUEUED' | 'RINGING' | 'ACCEPTED' | 'ENDED' | 'DECLINED' | 'CANCELED' | 'UNANSWERED' | 'FAILED';

export interface CallParticipant extends Person {
  role: 'PATIENT' | 'DOCTOR' | 'ADDED_DOCTOR';
}

export interface PatientPlan {
  planName: string;
  startsAt: string;
  endsAt: string;
}

export interface Call {
  id: string;
  state: CallState;
  media: CallMedia;
  patient: Person;
  /** The doctor ringing now, or who answered. */
  doctor: Person | null;
  createdAt: string;
  ringingAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  /** QUEUED: patients waiting ahead. */
  queuePosition: number | null;
  /** Doctors rung so far. */
  attemptCount: number;
  /** Doctors: whether this phone should be ringing for the call. */
  ringingForMe: boolean;
  participants: CallParticipant[];
  feedback: { rating: number; comment: string | null } | null;
  /** Doctors only. */
  patientPlan: PatientPlan | null;
  eventId: string | null;
}

/** What the app needs to join the call's LiveKit room. */
export interface CallJoin {
  serverUrl: string;
  roomName: string;
  token: string;
}

export interface CallWithJoin {
  call: Call;
  join: CallJoin;
}

/** A phone's push token. VOIP: iOS PushKit (calls). APNS: iOS notifications. FCM: Android (both). */
export interface PushDevice {
  platform: 'IOS' | 'ANDROID';
  kind: 'VOIP' | 'APNS' | 'FCM';
  token: string;
}

// --- subscription ---

export type SubscriptionSource = 'INSURANCE' | 'PREPAID' | 'DEMO';
export type PolicyType = 'HEALTH' | 'FAMILY' | 'CORPORATE' | 'TRAVEL';
export const POLICY_TYPES: PolicyType[] = ['HEALTH', 'FAMILY', 'CORPORATE', 'TRAVEL'];

export interface Subscription {
  id: string;
  source: SubscriptionSource;
  policyType: PolicyType | null;
  planName: string;
  cardNumber: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface SubscriptionOverview {
  active: Subscription | null;
  history: Subscription[];
  demoAvailable: boolean;
}

export type ClaimStatus = 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Claim {
  id: string;
  number: string;
  title: string;
  provider: string | null;
  amount: string;
  currency: string;
  status: ClaimStatus;
  submittedAt: string;
  updatedAt: string;
}

// --- content ---

interface ContentLook {
  /** An Ionicons name. */
  icon: string;
  /** A key of `accents` in the theme. */
  color: string;
  imageUrl: string | null;
}

export interface Story extends ContentLook {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface Benefit extends ContentLook {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  url: string | null;
}

export interface Article extends ContentLook {
  id: string;
  title: string;
  summary: string;
  body: string;
  readMinutes: number;
  publishedAt: string;
}

// --- events ---

export type EventStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

export interface HealthEvent {
  id: string;
  title: string;
  description: string;
  specialist: Person;
  startsAt: string;
  endsAt: string;
  capacity: number;
  participantCount: number;
  freePlaces: number;
  joined: boolean;
  status: EventStatus;
}

// --- notifications ---

export type NotificationType =
  | 'FOLDER_CREATED'
  | 'FOLDER_COMMENT'
  | 'FOLDER_DOCUMENT'
  | 'FREE_LINE'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'EVENT_JOINED'
  | 'ANNOUNCEMENT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  folderId: string | null;
  eventId: string | null;
  /** FREE_LINE: "Call now" rings this doctor first. */
  doctorId: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadNotifications {
  count: number;
  latest: AppNotification | null;
}

// --- medical folders ---

export type ConcernCategory =
  | 'GENERAL'
  | 'CARDIOLOGY'
  | 'RESPIRATORY'
  | 'DERMATOLOGY'
  | 'GASTROENTEROLOGY'
  | 'NEUROLOGY'
  | 'PEDIATRICS'
  | 'MENTAL_HEALTH'
  | 'ORTHOPEDICS'
  | 'OTHER';

export const CONCERN_CATEGORIES: ConcernCategory[] = [
  'GENERAL',
  'CARDIOLOGY',
  'RESPIRATORY',
  'DERMATOLOGY',
  'GASTROENTEROLOGY',
  'NEUROLOGY',
  'PEDIATRICS',
  'MENTAL_HEALTH',
  'ORTHOPEDICS',
  'OTHER',
];

export interface MedicalFolder {
  id: string;
  visitDate: string;
  symptoms: string;
  diagnosis: string;
  prescription: string | null;
  recommendations: string | null;
  /** Always null for patients. */
  medicalComments: string | null;
  concernCategory: ConcernCategory;
  doctor: Person;
  patient: Person & { email: string };
  commentCount: number;
  documentCount: number;
  createdAt: string;
}

export interface NewFolder {
  patientId: string;
  visitDate: string;
  symptoms: string;
  diagnosis: string;
  prescription?: string;
  recommendations?: string;
  medicalComments?: string;
  concernCategory: ConcernCategory;
}

export interface FolderComment {
  id: string;
  body: string;
  author: Person & { role: Role };
  mine: boolean;
  createdAt: string;
}

export interface FolderDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: Person;
  /** Needs the session token. */
  url: string;
  createdAt: string;
}

// --- doctors and patients ---

export interface Doctor extends Person {
  sex: Sex | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  healthCentre: string | null;
  callCount: number;
}

export interface Patient extends Person {
  email: string;
  phone: string | null;
  personalId: string | null;
  sex: Sex | null;
  folderCount: number;
  block: { endsAt: string; reason: string } | null;
  plan: PatientPlan | null;
}

export interface AppConfig {
  supportPhone: string | null;
  /** A path is relative to the API. */
  partnerNetworkUrl: string;
}
