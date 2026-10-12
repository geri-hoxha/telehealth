import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiProduces, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { languageFromHeader } from '../common/language';
import type { Language } from '../generated/prisma/enums';

export class AppConfigDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '+355 4 000 0000', description: '"Call assistance" dials it' })
  supportPhone: string | null;

  @ApiProperty({ example: '/api/pages/partners', description: 'Opened in the in-app web view; a path is relative to the API' })
  partnerNetworkUrl: string;
}

/** Placeholder partner clinics until the insurer's real list is connected. */
const PARTNERS = [
  { name: 'Poliklinika Qendrore', city: 'Tiranë', services: { SQ: 'Vizita specialistike, analiza, radiologji', EN: 'Specialist visits, lab tests, radiology', MK: 'Специјалистички прегледи, анализи, радиологија' } },
  { name: 'Laboratori Diagnostik', city: 'Durrës', services: { SQ: 'Analiza gjaku dhe urine', EN: 'Blood and urine tests', MK: 'Анализи на крв и урина' } },
  { name: 'Qendra e Fizioterapisë', city: 'Shkodër', services: { SQ: 'Fizioterapi dhe rehabilitim', EN: 'Physiotherapy and rehabilitation', MK: 'Физиотерапија и рехабилитација' } },
  { name: 'Klinika Dentare', city: 'Vlorë', services: { SQ: 'Stomatologji', EN: 'Dentistry', MK: 'Стоматологија' } },
  { name: 'Qendra Optike', city: 'Elbasan', services: { SQ: 'Kontroll i syve, syze', EN: 'Eye checks, glasses', MK: 'Преглед на очи, очила' } },
  { name: 'Poliklinika Shkup', city: 'Shkup', services: { SQ: 'Mjekësi familjare, pediatri', EN: 'Family medicine, paediatrics', MK: 'Семејна медицина, педијатрија' } },
] as const;

const PAGE_TEXTS: Record<Language, { title: string; intro: string }> = {
  SQ: { title: 'Rrjeti i klinikave partnere', intro: 'Tregoni kartën tuaj dixhitale të shëndetit në këto klinika.' },
  EN: { title: 'Partner clinic network', intro: 'Show your digital health card at these clinics.' },
  MK: { title: 'Мрежа на партнерски клиники', intro: 'Покажете ја вашата дигитална здравствена картичка во овие клиники.' },
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

@ApiTags('app')
@Controller()
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  /** Settings the app reads at start, so they can change without a new build. */
  @Get('config')
  @ApiOkResponse({ type: AppConfigDto })
  appConfig(): AppConfigDto {
    return {
      supportPhone: this.config.get<string>('SUPPORT_PHONE') || null,
      partnerNetworkUrl: this.config.get<string>('PARTNER_NETWORK_URL') || '/api/pages/partners',
    };
  }

  /** The default partner network page. `lang` is sq, en or mk. */
  @Get('pages/partners')
  @Header('content-type', 'text/html; charset=utf-8')
  @ApiProduces('text/html')
  partners(@Query('lang') lang: string | undefined, @Req() request: Request): string {
    const language = languageFromHeader(lang) ?? languageFromHeader(request.headers['accept-language']) ?? 'SQ';
    const { title, intro } = PAGE_TEXTS[language];
    const rows = PARTNERS.map(
      (partner) => `<li><div class="icon">✚</div><div><b>${escapeHtml(partner.name)}</b>
<span>${escapeHtml(partner.city)} · ${escapeHtml(partner.services[language])}</span></div></li>`,
    ).join('');
    return `<!doctype html><html lang="${language.toLowerCase()}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#F4F7F8;color:#0B1B2B}
header{padding:28px 20px 20px;background:linear-gradient(135deg,#14B8A6,#0F766E);color:#fff}
h1{font-size:22px;margin:0 0 6px}p{margin:0;opacity:.9}
ul{list-style:none;margin:0;padding:16px;display:grid;gap:12px}
li{display:flex;gap:14px;align-items:center;background:#fff;border-radius:18px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.05)}
.icon{width:44px;height:44px;border-radius:14px;background:#CCFBF1;color:#0F766E;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
b{display:block;font-size:16px;margin-bottom:2px}span{color:#5B6B7B;font-size:14px}
</style></head><body><header><h1>${title}</h1><p>${intro}</p></header><ul>${rows}</ul></body></html>`;
  }
}
