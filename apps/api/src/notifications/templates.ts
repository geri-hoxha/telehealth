import type { Prisma } from '../generated/prisma/client';
import type { Language, NotificationType } from '../generated/prisma/enums';
import { localize } from '../common/language';

/** Title and body per type and language. `{name}` takes a value from the notification's params. */
const TEMPLATES: Record<Exclude<NotificationType, 'ANNOUNCEMENT'>, Record<Language, [string, string]>> = {
  FOLDER_CREATED: {
    SQ: ['Dosje e re mjekësore', 'Dr. {doctor} shtoi të dhënat e vizitës suaj.'],
    EN: ['New medical folder', 'Dr. {doctor} added a record of your visit.'],
    MK: ['Ново медицинско досие', 'Д-р {doctor} додаде запис од вашата посета.'],
  },
  FOLDER_COMMENT: {
    SQ: ['Koment i ri', '{author} shkroi një koment në dosjen mjekësore.'],
    EN: ['New comment', '{author} commented on a medical folder.'],
    MK: ['Нов коментар', '{author} остави коментар во медицинското досие.'],
  },
  FOLDER_DOCUMENT: {
    SQ: ['Dokument i ri', '{author} shtoi „{file}" në dosjen mjekësore.'],
    EN: ['New document', '{author} added "{file}" to a medical folder.'],
    MK: ['Нов документ', '{author} додаде „{file}" во медицинското досие.'],
  },
  FREE_LINE: {
    SQ: ['Mjeku juaj është i lirë', 'Dr. {doctor} mund ta marrë thirrjen tuaj tani.'],
    EN: ['Your doctor is free', 'Dr. {doctor} can take your call now.'],
    MK: ['Вашиот лекар е слободен', 'Д-р {doctor} може да го прими вашиот повик сега.'],
  },
  SUBSCRIPTION_ACTIVATED: {
    SQ: ['Abonimi u aktivizua', 'Plani {plan} është aktiv deri më {date}.'],
    EN: ['Subscription activated', 'Your {plan} plan is active until {date}.'],
    MK: ['Претплатата е активирана', 'Планот {plan} е активен до {date}.'],
  },
  EVENT_JOINED: {
    SQ: ['U regjistruat', 'Keni një vend te „{event}", më {date}.'],
    EN: ["You're registered", 'You have a seat at "{event}" on {date}.'],
    MK: ['Се пријавивте', 'Имате место на „{event}" на {date}.'],
  },
};

type NotificationTexts = Pick<Prisma.NotificationGetPayload<object>, 'type' | 'params' | 'title' | 'body'>;

/** The notification's title and body in `language`. */
export function renderNotification(
  notification: NotificationTexts,
  language: Language,
): { title: string; body: string } {
  if (notification.type === 'ANNOUNCEMENT') {
    return { title: localize(notification.title, language), body: localize(notification.body, language) };
  }
  const params = (notification.params ?? {}) as Record<string, Prisma.JsonValue>;
  const fill = (template: string) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => localize(params[key] ?? '', language));
  const [title, body] = TEMPLATES[notification.type][language];
  return { title: fill(title), body: fill(body) };
}
