import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';
import { seedLabReports } from './lab-reports.seed';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Demo data for the prototype. Re-running it resets everything except accounts and phones, and
// moves dates so the "live" event is happening now.

const DEMO_PASSWORD = '1234';
const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW + offsetMs);
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Tirane' }).format(date);
/** A text in the app's three languages. */
const t = (sq: string, en: string, mk: string) => ({ sq, en, mk });

type DemoUser = Omit<Prisma.UserCreateInput, 'passwordHash'> & { profile?: Prisma.DoctorProfileCreateWithoutUserInput };

const USERS: Record<string, DemoUser> = {
  patient: {
    email: 'patient@telehealth.al', firstName: 'Patient', lastName: 'Demo', role: 'PATIENT',
    phone: '+355691234567', personalId: 'J90101001A', sex: 'MALE',
  },
  arta: {
    email: 'arta@telehealth.al', firstName: 'Arta', lastName: 'Kola', role: 'PATIENT',
    phone: '+355682345678', personalId: 'I85512002B', sex: 'FEMALE',
  },
  elton: {
    email: 'elton@telehealth.al', firstName: 'Elton', lastName: 'Basha', role: 'PATIENT',
    phone: '+355673456789', personalId: 'K01003003C', sex: 'MALE',
  },
  arben: {
    email: 'doktor@telehealth.al', firstName: 'Arben', lastName: 'Mjeku', role: 'DOCTOR', sex: 'MALE',
    phone: '+355694567890',
    profile: {
      specialty: 'Mjekësi familjare',
      bio: 'Mjek familjeje me 12 vjet përvojë në kujdesin parësor. Merret me sëmundjet e zakonshme, kontrollet e rregullta dhe këshillimin për një jetë më të shëndetshme.',
      licenceNumber: 'AL-MED-10234', country: 'Shqipëri', city: 'Tiranë', healthCentre: 'Qendra Shëndetësore Nr. 3',
    },
  },
  drita: {
    email: 'drita@telehealth.al', firstName: 'Drita', lastName: 'Leka', role: 'DOCTOR', sex: 'FEMALE',
    profile: {
      specialty: 'Pediatri',
      bio: 'Pediatre që ndjek fëmijët nga lindja deri në adoleshencë. Prindërit i këshillon për ushqyerjen, vaksinat dhe rritjen.',
      licenceNumber: 'AL-MED-11872', country: 'Shqipëri', city: 'Durrës', healthCentre: 'Poliklinika e Durrësit',
    },
  },
  besnik: {
    email: 'besnik@telehealth.al', firstName: 'Besnik', lastName: 'Shehu', role: 'DOCTOR', sex: 'MALE',
    profile: {
      specialty: 'Kardiologji',
      bio: 'Kardiolog me fokus te tensioni i lartë dhe parandalimi i sëmundjeve të zemrës.',
      licenceNumber: 'AL-MED-09311', country: 'Shqipëri', city: 'Tiranë', healthCentre: 'Spitali Universitar "Nënë Tereza"',
    },
  },
  elena: {
    email: 'elena@telehealth.al', firstName: 'Elena', lastName: 'Stojanovska', role: 'DOCTOR', sex: 'FEMALE',
    profile: {
      specialty: 'Dermatologji',
      bio: 'Dermatologe që trajton alergjitë e lëkurës, aknet dhe kontrollin e nishaneve.',
      licenceNumber: 'MK-LK-55120', country: 'Maqedonia e Veriut', city: 'Shkup', healthCentre: 'Klinika Dermatologjike Shkup',
    },
  },
};

async function seedUsers() {
  const passwordHash = await hash(DEMO_PASSWORD);
  const ids: Record<string, string> = {};
  for (const [key, { profile, ...user }] of Object.entries(USERS)) {
    // Photos uploaded while trying the app are dropped (the files stay in UPLOADS_DIR).
    const data = { ...user, emailVerifiedAt: new Date(NOW - 400 * DAY), avatarFile: null };
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { ...data, passwordHash },
      create: { ...data, passwordHash },
    });
    if (profile) {
      await prisma.doctorProfile.upsert({ where: { userId: saved.id }, update: profile, create: { ...profile, userId: saved.id } });
    }
    ids[key] = saved.id;
    console.log(`Seeded ${user.role!.toLowerCase()}: ${user.email} / ${DEMO_PASSWORD}`);
  }
  return ids;
}

async function reset() {
  // Children first; calls and folders take their attempts, invites, comments and documents along.
  await prisma.notification.deleteMany();
  await prisma.call.deleteMany();
  await prisma.medicalFolder.deleteMany();
  await prisma.event.deleteMany();
  await prisma.story.deleteMany();
  await prisma.benefit.deleteMany();
  await prisma.article.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.labReport.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.prepaidCard.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.patientBlock.deleteMany();
  await prisma.authToken.deleteMany({ where: { kind: { not: 'BIOMETRIC' } } });
}

async function seedInsurance(u: Record<string, string>) {
  // Policy dates are whole days in Albanian time (UTC+1 in winter).
  const validFrom = new Date('2026-01-01T00:00:00+01:00');
  const validTo = new Date('2027-12-31T23:59:59+01:00');
  const patientPolicy = await prisma.insurancePolicy.create({
    data: { type: 'HEALTH', cardNumber: '4021883011230042', planName: 'Premium', validFrom, validTo },
  });
  // Free to activate from the app ("My registration").
  await prisma.insurancePolicy.createMany({
    data: [
      { type: 'HEALTH', cardNumber: '4021883011230059', planName: 'Standard', validFrom, validTo },
      { type: 'FAMILY', cardNumber: '5100200030004000', planName: 'Family', validFrom, validTo },
      { type: 'CORPORATE', cardNumber: '6200100020003000', planName: 'Corporate', validFrom, validTo },
      // Expired, to show the error.
      { type: 'TRAVEL', cardNumber: '7300100020003000', planName: 'Travel', validFrom: new Date('2025-06-01T00:00:00+02:00'), validTo: new Date('2025-08-31T23:59:59+02:00') },
    ],
  });
  // Codes are stored without dashes; the app accepts them with or without.
  await prisma.prepaidCard.createMany({
    data: [
      { code: 'TH30DEMO', planName: 'Prepaid 30', durationDays: 30 },
      { code: 'TH90DEMO', planName: 'Prepaid 90', durationDays: 90 },
      { code: 'TH365DEMO', planName: 'Prepaid 365', durationDays: 365 },
    ],
  });
  const eltonCard = await prisma.prepaidCard.create({
    data: { code: 'THELTON', planName: 'Prepaid 90', durationDays: 90, redeemedAt: at(-30 * DAY) },
  });

  await prisma.subscription.create({
    data: {
      userId: u.patient, source: 'INSURANCE', planName: 'Premium', cardNumber: patientPolicy.cardNumber,
      policyId: patientPolicy.id, startsAt: validFrom, endsAt: validTo, createdAt: new Date('2026-01-05T09:00:00Z'),
    },
  });
  await prisma.subscription.create({
    data: {
      userId: u.elton, source: 'PREPAID', planName: 'Prepaid 90', cardNumber: '7700412398765521',
      prepaidCardId: eltonCard.id, startsAt: at(-30 * DAY), endsAt: at(60 * DAY),
    },
  });
  // Arta has no subscription, to show what needs one.

  await prisma.claim.createMany({
    data: [
      { userId: u.patient, number: 'DM-2026-00247', title: 'Barna me recetë', provider: 'Farmacia 10', amount: '2300', status: 'SUBMITTED', submittedAt: at(-1 * DAY) },
      { userId: u.patient, number: 'DM-2026-00239', title: 'Ekografi abdominale', provider: 'Spitali Hygeia', amount: '7500', status: 'IN_REVIEW', submittedAt: at(-6 * DAY) },
      { userId: u.patient, number: 'DM-2026-00211', title: 'Vizitë te kardiologu', provider: 'Spitali Amerikan', amount: '6000', status: 'APPROVED', submittedAt: at(-20 * DAY) },
      { userId: u.patient, number: 'DM-2026-00184', title: 'Analiza gjaku', provider: 'Laboratori Intermedica', amount: '4500', status: 'PAID', submittedAt: at(-40 * DAY) },
      { userId: u.patient, number: 'DM-2026-00102', title: 'Fizioterapi (10 seanca)', provider: 'Qendra Fizio Plus', amount: '12000', status: 'REJECTED', submittedAt: at(-70 * DAY) },
    ],
  });
}

async function seedContent() {
  await prisma.story.createMany({
    data: [
      {
        position: 1, icon: 'shield-checkmark', color: 'teal',
        title: t('Vaksina e gripit', 'Flu shot', 'Вакцина против грип'),
        body: t(
          'Sezoni i gripit po vjen. Vaksinohuni në tetor ose nëntor që të jeni të mbrojtur gjatë gjithë dimrit.',
          "Flu season is coming. Get vaccinated in October or November to stay protected all winter.",
          'Сезоната на грип доаѓа. Вакцинирајте се во октомври или ноември за да бидете заштитени цела зима.',
        ),
      },
      {
        position: 2, icon: 'water', color: 'sky',
        title: t('Pini ujë', 'Drink water', 'Пијте вода'),
        body: t(
          '6–8 gota ujë në ditë ndihmojnë përqendrimin, lëkurën dhe tretjen. Mbani gjithmonë një shishe me vete.',
          '6–8 glasses of water a day help your focus, skin and digestion. Keep a bottle with you.',
          '6–8 чаши вода дневно помагаат за концентрацијата, кожата и варењето. Секогаш носете шише со вас.',
        ),
      },
      {
        position: 3, icon: 'moon', color: 'indigo',
        title: t('Gjumë i mirë', 'Sleep well', 'Добар сон'),
        body: t(
          'Të rriturit kanë nevojë për 7–9 orë gjumë. Fikni ekranet një orë para se të flini.',
          'Adults need 7–9 hours of sleep. Turn off screens an hour before bed.',
          'На возрасните им требаат 7–9 часа сон. Исклучете ги екраните еден час пред спиење.',
        ),
      },
      {
        position: 4, icon: 'walk', color: 'amber',
        title: t('30 minuta ecje', 'Walk 30 minutes', 'Прошетајте 30 минути'),
        body: t(
          'Një shëtitje e shpejtë çdo ditë ul tensionin dhe rrezikun e sëmundjeve të zemrës.',
          'A brisk daily walk lowers blood pressure and the risk of heart disease.',
          'Секојдневна брза прошетка го намалува притисокот и ризикот од срцеви болести.',
        ),
      },
      {
        position: 5, icon: 'call', color: 'coral',
        title: t('Mjeku, 24/7', 'A doctor, 24/7', 'Лекар, 24/7'),
        body: t(
          'Nuk ndiheni mirë? Shtypni butonin e thirrjes dhe një mjek i lirë do t\'ju përgjigjet, ditë e natë.',
          "Not feeling well? Tap the call button and a free doctor will answer, day or night.",
          'Не се чувствувате добро? Притиснете го копчето за повик и слободен лекар ќе ви одговори, дење и ноќе.',
        ),
      },
    ],
  });

  await prisma.benefit.createMany({
    data: [
      {
        position: 1, icon: 'flask', color: 'violet',
        title: t('15% zbritje në analiza', '15% off lab tests', '15% попуст на анализи'),
        subtitle: t('Në laboratorët partnerë', 'At partner laboratories', 'Во партнерските лаборатории'),
        body: t(
          'Tregoni kartën tuaj dixhitale të shëndetit në çdo laborator partner dhe përfitoni 15% zbritje në të gjitha analizat e gjakut dhe urinës.\n\nOferta vlen deri në fund të vitit për të gjithë anëtarët me abonim aktiv.',
          'Show your digital health card at any partner laboratory and get 15% off all blood and urine tests.\n\nThe offer is valid until the end of the year for every member with an active subscription.',
          'Покажете ја вашата дигитална здравствена картичка во која било партнерска лабораторија и добијте 15% попуст на сите анализи на крв и урина.\n\nПонудата важи до крајот на годината за сите членови со активна претплата.',
        ),
      },
      {
        position: 2, icon: 'eye', color: 'sky',
        title: t('Kontroll falas i syve', 'Free eye check-up', 'Бесплатен преглед на очи'),
        subtitle: t('Një herë në vit', 'Once a year', 'Еднаш годишно'),
        body: t(
          'Një kontroll i plotë i shikimit, pa pagesë, një herë në vit në qendrat optike partnere.\n\nRezervoni duke treguar kartën tuaj dixhitale.',
          'A full vision check-up, free of charge, once a year at partner optical centres.\n\nBook by showing your digital card.',
          'Целосен преглед на видот, бесплатно, еднаш годишно во партнерските оптички центри.\n\nЗакажете со покажување на вашата дигитална картичка.',
        ),
      },
      {
        position: 3, icon: 'body', color: 'amber',
        title: t('Fizioterapi me çmim të ulët', 'Physiotherapy for less', 'Физиотерапија по пониска цена'),
        subtitle: t('20% zbritje për seancë', '20% off each session', '20% попуст по сесија'),
        body: t(
          'Seancat e fizioterapisë kushtojnë 20% më pak në qendrat partnere. Kërkoni një rekomandim nga mjeku juaj në aplikacion.',
          'Physiotherapy sessions cost 20% less at partner centres. Ask your doctor in the app for a referral.',
          'Сесиите физиотерапија чинат 20% помалку во партнерските центри. Побарајте упат од вашиот лекар во апликацијата.',
        ),
      },
      {
        position: 4, icon: 'medkit', color: 'coral',
        title: t('10% zbritje në farmaci', '10% off at pharmacies', '10% попуст во аптеки'),
        subtitle: t('Për barnat me recetë', 'On prescription drugs', 'За лекови на рецепт'),
        body: t(
          'Në farmacitë partnere paguani 10% më pak për barnat me recetë nga mjekët e Telehealth.',
          'At partner pharmacies, pay 10% less for drugs prescribed by Telehealth doctors.',
          'Во партнерските аптеки плаќате 10% помалку за лековите препишани од лекарите на Telehealth.',
        ),
      },
    ],
  });

  await prisma.article.createMany({
    data: [
      {
        icon: 'thermometer', color: 'sky', readMinutes: 4, publishedAt: at(-2 * DAY),
        title: t('Grip apo ftohje?', 'Flu or a cold?', 'Грип или настинка?'),
        summary: t('Si t\'i dalloni dhe kur duhet të telefononi mjekun.', 'How to tell them apart and when to call a doctor.', 'Како да ги разликувате и кога да се јавите на лекар.'),
        body: t(
          'Ftohja vjen ngadalë: hundë e zënë, teshtima dhe pak dhimbje fyti. Gripi vjen papritur, me temperaturë të lartë, dhimbje muskujsh dhe lodhje të madhe.\n\nTë dyja shkaktohen nga viruse, ndaj antibiotikët nuk ndihmojnë. Pushoni, pini shumë lëngje dhe uleni temperaturën me paracetamol.\n\nTelefononi mjekun nëse temperatura zgjat më shumë se 3 ditë, nëse merrni frymë me vështirësi ose nëse keni sëmundje kronike.',
          'A cold comes on slowly: a blocked nose, sneezing and a mild sore throat. The flu hits suddenly, with a high fever, aching muscles and great tiredness.\n\nBoth are caused by viruses, so antibiotics do not help. Rest, drink plenty of fluids and bring the fever down with paracetamol.\n\nCall a doctor if the fever lasts more than 3 days, if breathing is hard, or if you have a chronic illness.',
          'Настинката доаѓа полека: затнат нос, кивање и благо болно грло. Грипот доаѓа ненадејно, со висока температура, болки во мускулите и голем замор.\n\nДвете се предизвикани од вируси, па антибиотиците не помагаат. Одморете се, пијте многу течности и намалете ја температурата со парацетамол.\n\nЈавете се на лекар ако температурата трае повеќе од 3 дена, ако тешко дишете или ако имате хронична болест.',
        ),
      },
      {
        icon: 'heart', color: 'coral', readMinutes: 5, publishedAt: at(-6 * DAY),
        title: t('Tensioni i lartë', 'High blood pressure', 'Висок крвен притисок'),
        summary: t('Pse quhet "vrasësi i heshtur" dhe si ta mbani nën kontroll.', 'Why it is called the "silent killer" and how to keep it in check.', 'Зошто се вика „тивок убиец" и како да го држите под контрола.'),
        body: t(
          'Tensioni i lartë shpesh nuk jep asnjë shenjë, por me kohë dëmton zemrën, veshkat dhe enët e gjakut.\n\nMateni tensionin të paktën një herë në muaj. Vlera normale është nën 130/85.\n\nUlni kripën, lëvizni çdo ditë, mbani peshën nën kontroll dhe merrini barnat rregullisht nëse mjeku jua ka përshkruar.',
          'High blood pressure often has no signs, but over time it damages the heart, kidneys and blood vessels.\n\nMeasure it at least once a month. A normal reading is below 130/85.\n\nCut down on salt, move every day, keep your weight in check and take your medicine regularly if your doctor prescribed it.',
          'Високиот притисок честопати нема знаци, но со текот на времето ги оштетува срцето, бубрезите и крвните садови.\n\nМерете го барем еднаш месечно. Нормалната вредност е под 130/85.\n\nНамалете ја солта, движете се секој ден, контролирајте ја тежината и редовно земајте ги лековите ако лекарот ви ги препишал.',
        ),
      },
      {
        icon: 'nutrition', color: 'amber', readMinutes: 3, publishedAt: at(-11 * DAY),
        title: t('Ushqim i shëndetshëm në 5 hapa', 'Healthy eating in 5 steps', 'Здрава исхрана во 5 чекори'),
        summary: t('Ndryshime të vogla që sjellin rezultate të mëdha.', 'Small changes with big results.', 'Мали промени со големи резултати.'),
        body: t(
          '1. Gjysma e pjatës perime dhe fruta.\n2. Drithëra të plota në vend të bukës së bardhë.\n3. Peshk dy herë në javë.\n4. Ujë në vend të pijeve me sheqer.\n5. Më pak ushqime të përpunuara dhe të kripura.',
          '1. Fill half your plate with vegetables and fruit.\n2. Whole grains instead of white bread.\n3. Fish twice a week.\n4. Water instead of sugary drinks.\n5. Fewer processed and salty foods.',
          '1. Половина чинија зеленчук и овошје.\n2. Интегрални житарки наместо бел леб.\n3. Риба двапати неделно.\n4. Вода наместо засладени пијалаци.\n5. Помалку преработена и солена храна.',
        ),
      },
      {
        icon: 'cloudy-night', color: 'indigo', readMinutes: 4, publishedAt: at(-16 * DAY),
        title: t('Stresi dhe gjumi', 'Stress and sleep', 'Стрес и сон'),
        summary: t('Si ndikojnë te njëri-tjetri dhe çfarë mund të bëni.', 'How they affect each other and what you can do.', 'Како влијаат еден на друг и што можете да направите.'),
        body: t(
          'Stresi e vështirëson gjumin, dhe gjumi i pakët e shton stresin.\n\nShkoni në shtrat dhe zgjohuni në të njëjtën orë. Shmangni kafenë pas drekës. Provoni frymëmarrje të ngadaltë për 5 minuta para gjumit.\n\nNëse pagjumësia zgjat më shumë se tre javë, flisni me mjekun.',
          'Stress makes sleep harder, and too little sleep adds to stress.\n\nGo to bed and wake up at the same time. Avoid coffee after lunch. Try slow breathing for 5 minutes before sleep.\n\nIf sleeplessness lasts more than three weeks, talk to a doctor.',
          'Стресот го отежнува сонот, а малку сон го зголемува стресот.\n\nОдете во кревет и будете се во исто време. Избегнувајте кафе по ручек. Пробајте бавно дишење 5 минути пред спиење.\n\nАко несоницата трае повеќе од три недели, разговарајте со лекар.',
        ),
      },
      {
        icon: 'chatbubbles', color: 'teal', readMinutes: 2, publishedAt: at(-24 * DAY),
        title: t('Kur të telefononi mjekun?', 'When to call a doctor?', 'Кога да се јавите на лекар?'),
        summary: t('Shumë shqetësime zgjidhen me një telefonatë.', 'Many worries can be solved with one call.', 'Многу грижи се решаваат со еден повик.'),
        body: t(
          'Një mjek në telefon mund t\'ju ndihmojë me temperaturën, dhimbjet e lehta, skuqjet, pyetjet për barnat ose rezultatet e analizave.\n\nPër dhimbje të forta gjoksi, vështirësi në frymëmarrje ose humbje vetëdijeje, telefononi menjëherë 127.',
          'A doctor on the phone can help with fever, mild pain, rashes, questions about medicines or test results.\n\nFor severe chest pain, trouble breathing or fainting, call 127 right away.',
          'Лекар преку телефон може да помогне со температура, блага болка, осип, прашања за лекови или резултати од анализи.\n\nЗа силна болка во градите, отежнато дишење или губење свест, веднаш јавете се на 194.',
        ),
      },
    ],
  });
}

async function seedEvents(u: Record<string, string>) {
  const event = (data: Omit<Prisma.EventUncheckedCreateInput, 'id'>, participants: string[]) =>
    prisma.event.create({ data: { ...data, participants: { create: participants.map((userId) => ({ userId })) } } });

  // Rings Arben, the "doktor" login, so "Request a call" can be tried with one phone.
  const live = await event(
    {
      specialistId: u.arben, capacity: 40, startsAt: at(-30 * MINUTE), endsAt: at(6 * HOUR),
      title: t('Konsultë e hapur: gripi dhe ftohja', 'Open consultation: flu and colds', 'Отворена консултација: грип и настинка'),
      description: t(
        'Dr. Arben Mjeku u përgjigjet pyetjeve për gripin, ftohjen dhe vaksinat. Pjesëmarrësit mund të kërkojnë një thirrje gjatë sesionit.',
        'Dr. Arben Mjeku answers questions about flu, colds and vaccines. Participants can request a call during the session.',
        'Д-р Арбен Мјеку одговара на прашања за грип, настинка и вакцини. Учесниците можат да побараат повик за време на сесијата.',
      ),
    },
    [u.patient, u.elton],
  );
  await event(
    {
      specialistId: u.besnik, capacity: 25, startsAt: at(3 * DAY + 2 * HOUR), endsAt: at(3 * DAY + 3 * HOUR),
      title: t('Si ta mbani tensionin nën kontroll', 'Keeping blood pressure in check', 'Како да го контролирате притисокот'),
      description: t(
        'Një orë me kardiologun Besnik Shehu: matja e saktë e tensionit, ushqimi dhe barnat.',
        'An hour with cardiologist Besnik Shehu: measuring blood pressure correctly, food and medicines.',
        'Еден час со кардиологот Бесник Шеху: правилно мерење на притисокот, исхрана и лекови.',
      ),
    },
    [u.arta],
  );
  await event(
    {
      specialistId: u.drita, capacity: 2, startsAt: at(7 * DAY + 4 * HOUR), endsAt: at(7 * DAY + 5 * HOUR),
      title: t('Vaksinat e fëmijëve', "Children's vaccines", 'Вакцини за деца'),
      description: t(
        'Pediatrja Drita Leka shpjegon kalendarin e vaksinave dhe u përgjigjet pyetjeve të prindërve. Grup i vogël.',
        "Paediatrician Drita Leka explains the vaccine schedule and answers parents' questions. Small group.",
        'Педијатарката Дрита Лека го објаснува календарот на вакцини и одговара на прашањата на родителите. Мала група.',
      ),
    },
    [u.arta, u.elton],
  );
  await event(
    {
      specialistId: u.elena, capacity: 30, startsAt: at(12 * DAY + 3 * HOUR), endsAt: at(12 * DAY + 4 * HOUR),
      title: t('Alergjitë sezonale të lëkurës', 'Seasonal skin allergies', 'Сезонски алергии на кожата'),
      description: t(
        'Dermatologia Elena Stojanovska flet për skuqjet, kruajtjen dhe kujdesin e përditshëm të lëkurës.',
        'Dermatologist Elena Stojanovska talks about rashes, itching and everyday skin care.',
        'Дерматологот Елена Стојановска зборува за осипи, чешање и секојдневна нега на кожата.',
      ),
    },
    [],
  );
  await event(
    {
      specialistId: u.drita, capacity: 20, startsAt: at(-10 * DAY), endsAt: at(-10 * DAY + HOUR),
      title: t('Ushqyerja e fëmijëve', "Feeding children well", 'Исхрана на децата'),
      description: t(
        'Si të ndërtoni zakone të shëndetshme të të ngrënit që në vitet e para.',
        'How to build healthy eating habits from the first years.',
        'Како да изградите здрави навики за исхрана уште од првите години.',
      ),
    },
    [u.patient, u.arta],
  );
  await event(
    {
      specialistId: u.elena, capacity: 15, startsAt: at(-30 * DAY), endsAt: at(-30 * DAY + HOUR),
      title: t('Lëkura dhe dielli', 'Skin and the sun', 'Кожата и сонцето'),
      description: t(
        'Mbrojtja nga dielli, kremrat SPF dhe kontrolli i nishaneve.',
        'Sun protection, SPF creams and checking moles.',
        'Заштита од сонце, креми со SPF и преглед на бенки.',
      ),
    },
    [u.patient],
  );
  return { live };
}

async function seedFolders(u: Record<string, string>) {
  const cold = await prisma.medicalFolder.create({
    data: {
      patientId: u.patient, doctorId: u.arben, visitDate: at(-45 * DAY), concernCategory: 'RESPIRATORY',
      symptoms: 'Kollë e thatë, temperaturë 38.2 °C dhe lodhje prej 3 ditësh.',
      diagnosis: 'Infeksion viral i rrugëve të sipërme të frymëmarrjes.',
      prescription: 'Paracetamol 500 mg: 1 tabletë çdo 8 orë, për 3 ditë.\nShurup për kollën: 10 ml, 3 herë në ditë.',
      recommendations: 'Pushim dhe shumë lëngje. Telefononi përsëri nëse temperatura zgjat më shumë se 3 ditë.',
      medicalComments: 'Pa shenja pneumonie në auskultim. Saturimi 98%.',
      createdAt: at(-45 * DAY),
      comments: {
        create: [
          { authorId: u.patient, body: 'Faleminderit, doktor! Sot jam shumë më mirë.', createdAt: at(-44 * DAY) },
          { authorId: u.arben, body: 'Më vjen mirë! Vazhdoni me lëngje edhe dy ditë.', createdAt: at(-44 * DAY + 2 * HOUR) },
        ],
      },
    },
  });
  await prisma.medicalFolder.create({
    data: {
      patientId: u.patient, doctorId: u.arben, visitDate: at(-12 * DAY), concernCategory: 'NEUROLOGY',
      symptoms: 'Dhimbje koke e shpeshtë, sidomos në mbrëmje, pas punës para kompjuterit.',
      diagnosis: 'Dhimbje koke nga tensioni.',
      prescription: 'Ibuprofen 400 mg kur nevojitet (jo më shumë se 3 në ditë).',
      recommendations: 'Pushim nga ekrani 5 minuta çdo orë, 7–8 orë gjumë, ujë të mjaftueshëm.',
      medicalComments: 'Nëse dhimbjet vazhdojnë mbi 2 javë, dërgim te neurologu.',
      createdAt: at(-12 * DAY),
    },
  });
  const rash = await prisma.medicalFolder.create({
    data: {
      patientId: u.patient, doctorId: u.elena, visitDate: at(-2 * DAY), concernCategory: 'DERMATOLOGY',
      symptoms: 'Skuqje me kruajtje në krahun e majtë prej një jave.',
      diagnosis: 'Dermatit kontakti.',
      prescription: 'Krem hidrokortizon 1%: dy herë në ditë për 7 ditë.\nLoratadinë 10 mg: 1 tabletë në mbrëmje.',
      recommendations: 'Shmangni sapunët me parfum. Dërgoni një foto nëse skuqja përhapet.',
      createdAt: at(-2 * DAY),
    },
  });
  await prisma.medicalFolder.create({
    data: {
      patientId: u.arta, doctorId: u.arben, visitDate: at(-20 * DAY), concernCategory: 'GASTROENTEROLOGY',
      symptoms: 'Dhimbje stomaku pas ngrënies dhe urth.',
      diagnosis: 'Gastrit.',
      prescription: 'Omeprazol 20 mg: 1 kapsulë në mëngjes për 4 javë.',
      recommendations: 'Vakte të vogla, pa ushqime pikante dhe pa kafe.',
      createdAt: at(-20 * DAY),
    },
  });
  return { cold, rash };
}

async function seedCalls(u: Record<string, string>) {
  const ended = (patientId: string, doctorId: string, startedAt: number, minutes: number, extra: Partial<Prisma.CallUncheckedCreateInput> = {}) =>
    prisma.call.create({
      data: {
        patientId, doctorId, media: 'VIDEO', state: 'ENDED',
        createdAt: at(startedAt), ringingAt: at(startedAt + 3000), answeredAt: at(startedAt + 15_000),
        endedAt: at(startedAt + 15_000 + minutes * MINUTE),
        attempts: { create: { doctorId, outcome: 'ACCEPTED', startedAt: at(startedAt + 3000), endedAt: at(startedAt + 15_000) } },
        ...extra,
      },
    });

  await ended(u.patient, u.arben, -45 * DAY - 2 * HOUR, 9, { feedback: { create: { rating: 5, comment: 'Shumë i sjellshëm dhe i qartë.' } } });
  await ended(u.patient, u.arben, -12 * DAY - 3 * HOUR, 6);
  // Nobody answered: Drita was rung, then the lines were busy.
  await prisma.call.create({
    data: {
      patientId: u.patient, media: 'VIDEO', state: 'UNANSWERED', createdAt: at(-5 * DAY), endedAt: at(-5 * DAY + 50_000),
      attempts: { create: { doctorId: u.drita, outcome: 'NO_ANSWER', startedAt: at(-5 * DAY + 2000), endedAt: at(-5 * DAY + 47_000) } },
    },
  });
  // Elena added Besnik to the call.
  await ended(u.patient, u.elena, -2 * DAY - 4 * HOUR, 12, {
    invites: {
      create: {
        doctorId: u.besnik, invitedById: u.elena, state: 'LEFT',
        createdAt: at(-2 * DAY - 4 * HOUR + 4 * MINUTE), answeredAt: at(-2 * DAY - 4 * HOUR + 5 * MINUTE),
        endedAt: at(-2 * DAY - 4 * HOUR + 10 * MINUTE),
      },
    },
    feedback: { create: { rating: 4, comment: null } },
  });
  await ended(u.arta, u.arben, -20 * DAY - 5 * HOUR, 14);
  await prisma.call.create({
    data: {
      patientId: u.elton, doctorId: u.arben, media: 'AUDIO', state: 'ENDED',
      createdAt: at(-8 * DAY), ringingAt: at(-8 * DAY + 2000), answeredAt: at(-8 * DAY + 9000), endedAt: at(-8 * DAY + 4 * MINUTE),
      attempts: { create: { doctorId: u.arben, outcome: 'ACCEPTED', startedAt: at(-8 * DAY + 2000), endedAt: at(-8 * DAY + 9000) } },
    },
  });
  // Shows the "Temporary block" on a patient.
  await prisma.patientBlock.create({
    data: { patientId: u.elton, doctorId: u.arben, reason: 'Thirrje të përsëritura pa arsye mjekësore.', endsAt: at(2 * DAY) },
  });
}

async function seedNotifications(u: Record<string, string>, ids: { liveEventId: string; coldFolderId: string; rashFolderId: string }) {
  const startOfYear = new Date('2026-01-05T09:00:00Z');
  await prisma.notification.createMany({
    data: [
      { userId: u.patient, type: 'FREE_LINE', params: { doctor: 'Arben Mjeku' }, doctorId: u.arben, createdAt: at(-20 * MINUTE) },
      { userId: u.patient, type: 'EVENT_JOINED', params: { event: t('Konsultë e hapur: gripi dhe ftohja', 'Open consultation: flu and colds', 'Отворена консултација: грип и настинка'), date: formatDate(at(-30 * MINUTE)) }, eventId: ids.liveEventId, createdAt: at(-3 * HOUR) },
      { userId: u.patient, type: 'FOLDER_CREATED', params: { doctor: 'Elena Stojanovska' }, folderId: ids.rashFolderId, createdAt: at(-2 * DAY) },
      {
        userId: u.patient, type: 'ANNOUNCEMENT', url: 'https://www.who.int/news-room/fact-sheets/detail/influenza-(seasonal)', createdAt: at(-4 * DAY), readAt: at(-3 * DAY),
        title: t('Sezoni i gripit', 'Flu season', 'Сезона на грип'),
        body: t('Lexoni këshillat e OBSH-së për gripin sezonal.', "Read the WHO's advice on seasonal flu.", 'Прочитајте ги советите на СЗО за сезонскиот грип.'),
      },
      { userId: u.patient, type: 'FOLDER_CREATED', params: { doctor: 'Arben Mjeku' }, folderId: ids.coldFolderId, createdAt: at(-45 * DAY), readAt: at(-45 * DAY) },
      { userId: u.patient, type: 'SUBSCRIPTION_ACTIVATED', params: { plan: 'Premium', date: '31.12.2027' }, createdAt: startOfYear, readAt: startOfYear },
      { userId: u.arben, type: 'FOLDER_COMMENT', params: { author: 'Patient Demo' }, folderId: ids.coldFolderId, createdAt: at(-44 * DAY), readAt: at(-44 * DAY) },
      {
        userId: u.arben, type: 'ANNOUNCEMENT', createdAt: at(-1 * DAY),
        title: t('Turnet e fundjavës', 'Weekend shifts', 'Викенд смени'),
        body: t('Orari i turneve për fundjavën është gati. Faleminderit për punën!', 'The weekend shift plan is ready. Thanks for your work!', 'Распоредот на смените за викендот е подготвен. Ви благодариме за работата!'),
      },
    ],
  });
}

async function main() {
  const u = await seedUsers();
  await reset();
  await seedInsurance(u);
  await seedLabReports(prisma, u.patient);
  await seedContent();
  const { live } = await seedEvents(u);
  const { cold, rash } = await seedFolders(u);
  await seedCalls(u);
  await seedNotifications(u, { liveEventId: live.id, coldFolderId: cold.id, rashFolderId: rash.id });
  console.log('Seeded demo content. Insurance cards: HEALTH 4021883011230059, FAMILY 5100200030004000; prepaid codes: TH-30-DEMO, TH-90-DEMO.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
