import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiSession, apiUrl } from '@/api/client';
import type { MedicalFolder } from '@/api/types';
import { translate, type Language } from '@/i18n';
import { formatNumericDate } from '@/i18n/format';

/** Downloads a folder document (it needs the session token) into the cache and returns its local URI. */
export async function downloadDocument(documentId: string, url: string, fileName: string): Promise<string> {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_').slice(-80) || 'document';
  const token = apiSession.getToken();
  const file = await File.downloadFileAsync(apiUrl(url), new File(Paths.cache, `doc-${documentId}-${safeName}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  return file.uri;
}

export async function shareFile(uri: string, mimeType: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const paragraph = (text: string) => escapeHtml(text).replace(/\n/g, '<br>');

/** "Export to PDF": the folder as a printable page, shared through the system sheet. */
export async function exportFolderPdf(folder: MedicalFolder, language: Language): Promise<void> {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string>) => translate(language, key, params);
  const sections: [string, string | null][] = [
    [t('folder.symptoms'), folder.symptoms],
    [t('folder.diagnosis'), folder.diagnosis],
    [t('folder.prescription'), folder.prescription],
    [t('folder.recommendations'), folder.recommendations],
    [t('folder.medicalComments'), folder.medicalComments],
  ];
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Helvetica, sans-serif; color: #0B1B2B; margin: 36px; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0D9488; padding-bottom: 14px; }
    .brand { font-size: 22px; font-weight: 800; color: #0D9488; }
    h1 { font-size: 24px; margin: 24px 0 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin: 18px 0 8px; padding: 16px; background: #F0FDFA; border-radius: 12px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; }
    .value { font-size: 15px; font-weight: 600; margin-top: 2px; }
    section { margin-top: 20px; page-break-inside: avoid; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #0F766E; margin: 0 0 6px; }
    p { font-size: 15px; line-height: 1.55; margin: 0; }
    footer { margin-top: 36px; font-size: 11px; color: #94A3B8; }
  </style></head><body>
    <header><div class="brand">✚ Telehealth</div><div class="label">${escapeHtml(t('folder.title'))}</div></header>
    <h1>${escapeHtml(folder.diagnosis)}</h1>
    <div class="meta">
      <div><div class="label">${escapeHtml(t('folder.patient'))}</div><div class="value">${escapeHtml(folder.patient.name)}</div></div>
      <div><div class="label">${escapeHtml(t('folder.visitDate'))}</div><div class="value">${formatNumericDate(folder.visitDate)}</div></div>
      <div><div class="label">${escapeHtml(t('folder.doctor'))}</div><div class="value">${escapeHtml(`${t('common.doctorPrefix')} ${folder.doctor.name}`)}</div></div>
      <div><div class="label">${escapeHtml(t('folder.category'))}</div><div class="value">${escapeHtml(t(`concern.${folder.concernCategory}`))}</div></div>
    </div>
    ${sections
      .filter(([, text]) => text)
      .map(([title, text]) => `<section><h2>${escapeHtml(title)}</h2><p>${paragraph(text ?? '')}</p></section>`)
      .join('')}
    <footer>${escapeHtml(t('folder.generatedOn', { date: formatNumericDate(new Date()) }))}</footer>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, margins: { top: 24, bottom: 24, left: 24, right: 24 } });
  await shareFile(uri, 'application/pdf');
}
