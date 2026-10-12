import type { Language } from '../generated/prisma/enums';

type Texts = Record<Language, string>;

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? '');
}

const VERIFY_SUBJECT: Texts = {
  SQ: 'Konfirmoni email-in tuaj',
  EN: 'Confirm your email',
  MK: 'Потврдете ја вашата е-пошта',
};

const VERIFY_TEXT: Texts = {
  SQ: 'Përshëndetje {name},\n\nFaleminderit që u regjistruat në Telehealth. Konfirmoni email-in tuaj duke hapur këtë lidhje:\n{link}\n\nLidhja është e vlefshme për 48 orë.',
  EN: 'Hi {name},\n\nThanks for signing up for Telehealth. Confirm your email by opening this link:\n{link}\n\nThe link is valid for 48 hours.',
  MK: 'Здраво {name},\n\nВи благодариме што се регистриравте на Telehealth. Потврдете ја вашата е-пошта со отворање на оваа врска:\n{link}\n\nВрската важи 48 часа.',
};

const RESET_SUBJECT: Texts = {
  SQ: 'Kodi për rivendosjen e fjalëkalimit',
  EN: 'Your password reset code',
  MK: 'Код за ресетирање на лозинката',
};

const RESET_TEXT: Texts = {
  SQ: 'Përshëndetje {name},\n\nKodi juaj për të rivendosur fjalëkalimin është: {code}\n\nKodi skadon pas 15 minutash. Nëse nuk e kërkuat ju, injorojeni këtë email.',
  EN: "Hi {name},\n\nYour code to reset your password is: {code}\n\nThe code expires in 15 minutes. If you didn't ask for it, ignore this email.",
  MK: 'Здраво {name},\n\nВашиот код за ресетирање на лозинката е: {code}\n\nКодот истекува за 15 минути. Ако не го побаравте вие, игнорирајте ја оваа порака.',
};

const VERIFIED_PAGE: Record<Language, { ok: [string, string]; failed: [string, string] }> = {
  SQ: {
    ok: ['Email-i u konfirmua', 'Tani mund të hyni në aplikacionin Telehealth.'],
    failed: ['Lidhja nuk është më e vlefshme', 'Kërkoni një email të ri konfirmimi nga aplikacioni.'],
  },
  EN: {
    ok: ['Email confirmed', 'You can now log in to the Telehealth app.'],
    failed: ['This link is no longer valid', 'Ask for a new confirmation email in the app.'],
  },
  MK: {
    ok: ['Е-поштата е потврдена', 'Сега можете да се најавите во апликацијата Telehealth.'],
    failed: ['Оваа врска повеќе не важи', 'Побарајте нова е-порака за потврда во апликацијата.'],
  },
};

export function verificationEmail(language: Language, name: string, link: string) {
  return { subject: VERIFY_SUBJECT[language], text: fill(VERIFY_TEXT[language], { name, link }) };
}

export function resetCodeEmail(language: Language, name: string, code: string) {
  return { subject: RESET_SUBJECT[language], text: fill(RESET_TEXT[language], { name, code }) };
}

/** The page the confirmation link opens in the browser. */
export function verifiedPage(language: Language, ok: boolean): string {
  const [title, text] = VERIFIED_PAGE[language][ok ? 'ok' : 'failed'];
  const color = ok ? '#0D9488' : '#DC2626';
  return `<!doctype html><html lang="${language.toLowerCase()}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,system-ui,sans-serif;background:#F4F7F8;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="background:#fff;border-radius:24px;padding:40px 28px;max-width:360px;margin:16px;text-align:center;box-shadow:0 8px 30px rgba(15,23,42,.08)">
<div style="width:64px;height:64px;border-radius:32px;background:${color};color:#fff;font-size:32px;line-height:64px;margin:0 auto 20px">${ok ? '✓' : '!'}</div>
<h1 style="font-size:22px;color:#0B1B2B;margin:0 0 8px">${title}</h1>
<p style="font-size:16px;color:#5B6B7B;margin:0">${text}</p></div></body></html>`;
}
