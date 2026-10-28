export function normalize(value: string) {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

type Intent = {
  id: string;
  label: string;
  query: RegExp;
  activity: RegExp;
  suggestions?: string[];
};

const intents: Intent[] = [
  {
    id: "combat",
    label: "Единоборства",
    query: /^(?:борьб|борот|единобор|самооборон|драт)/u,
    activity:
      /дзюдо|самбо|бокс|айкидо|рукопаш|кудо|каратэ|мма|mma|единоборств|тхэквондо|боев.{0,8}искусств/u,
    suggestions: [
      "judo",
      "aikido",
      "sambo",
      "kudo",
      "mma",
      "karate",
      "boxing",
      "handfight",
      "taekwondo",
    ],
  },
  {
    id: "judo",
    label: "Дзюдо",
    query: /^(?:дзюдо|judo)$/u,
    activity: /дзюдо/u,
  },
  {
    id: "sambo",
    label: "Самбо",
    query: /^самбо/u,
    activity: /самбо/u,
    suggestions: ["judo", "kudo", "handfight", "mma"],
  },
  { id: "kudo", label: "Кудо", query: /^кудо$/u, activity: /кудо/u },
  { id: "aikido", label: "Айкидо", query: /^айкидо/u, activity: /айкидо/u },
  {
    id: "mma",
    label: "ММА",
    query: /^(?:мма|mma)$/u,
    activity: /мма|mma|смешанн.{0,5}единоборств/u,
  },
  { id: "karate", label: "Каратэ", query: /^карат/u, activity: /карат/u },
  {
    id: "boxing",
    label: "Бокс",
    query: /^(?:бокс|boxing)/u,
    activity: /бокс/u,
  },
  {
    id: "handfight",
    label: "Рукопашный бой",
    query: /^рукопаш/u,
    activity: /рукопаш/u,
  },
  {
    id: "taekwondo",
    label: "Тхэквондо",
    query: /^(?:тхэквондо|тэквондо|тхеквондо)/u,
    activity: /тхэквондо/u,
  },
  {
    id: "singing",
    label: "Вокал",
    query:
      /^(?:петь|пою|поют|пение|пения|пением|спеть|вокал\p{L}*|вакал\p{L}*|песн\p{L}*|пев\p{L}*)$/u,
    activity:
      /вокал|хор(?:$|[^\p{L}]|ов)|песн|проснись и пой|cover version|фолк|a cappella|а капелла/u,
  },
  {
    id: "guitar",
    label: "Гитара",
    query: /^(?:гитар|электрогитар|guitar)/u,
    activity: /гитар|акустического рока/u,
  },
  {
    id: "drums",
    label: "Барабаны",
    query: /^(?:барабан|ударн|drums)/u,
    activity: /барабан|ударн/u,
  },
  {
    id: "dance",
    label: "Танцы",
    query: /^(?:танц|хореограф|dance)/u,
    activity:
      /танц|хореограф|хип-хоп|брейк|high heels|хайхилс|frame up|jazz funk|k-pop|contemp|латина/u,
  },
  {
    id: "drawing",
    label: "Рисование",
    query: /^(?:рисова|рисун|живопис|худож|скетч|изо$)/u,
    activity: /рисун|рисова|живопис|худож|скетч|изо|арт-дизайн/u,
  },
  {
    id: "theatre",
    label: "Театр",
    query: /^(?:театр|актер|сцен|выступ)/u,
    activity: /театр|актер|шоу-театр/u,
  },
  {
    id: "fitness",
    label: "Фитнес и тренировки",
    query: /^(?:фитнес|трениров|качал|тренажер|спорт|тренирова|накачать)/u,
    activity:
      /фитнес|тренажер|тренинг|атлет|гимнаст|офп|пауэрлифт|stretch|стретч|растяж|пилатес/u,
  },
  {
    id: "yoga",
    label: "Йога",
    query: /^(?:йог|хатха)/u,
    activity: /йога|хатха/u,
  },
  {
    id: "english",
    label: "Английский язык",
    query: /^(?:англий|english)/u,
    activity: /англий/u,
  },
  {
    id: "japanese",
    label: "Японский язык",
    query: /^япон/u,
    activity: /япон/u,
  },
  { id: "chess", label: "Шахматы", query: /^шахмат/u, activity: /шахмат/u },
  {
    id: "volunteering",
    label: "Волонтёрство",
    query: /^(?:волонтер|добровол|помогать)/u,
    activity: /доброволь|московский добрый|люди для людей/u,
  },
  {
    id: "psychology",
    label: "Психология",
    query: /^(?:психолог|саморазвит)/u,
    activity: /психолог|саморазвит|арт-терапия/u,
  },
  {
    id: "communication",
    label: "Общение",
    query: /^(?:общат|общени|друз|познаком)/u,
    activity: /общени|общайся|лидерск|мастер общения/u,
  },
  {
    id: "music",
    label: "Музыка",
    query: /^(?:музык|music)/u,
    activity:
      /музык|гитар|вокал|дидже|диджей|барабан|хор(?:$|[^\p{L}]|ов)|ударн|рок-групп|песн/u,
    suggestions: ["singing", "guitar", "drums"],
  },
  {
    id: "robotics",
    label: "Робототехника",
    query: /^робот/u,
    activity: /робот/u,
  },
  {
    id: "drones",
    label: "Дроны",
    query: /^(?:дрон|квадрокоптер)/u,
    activity: /дрон/u,
  },
  {
    id: "3d",
    label: "3D-моделирование",
    query: /^(?:3d|3д|моделирован)/u,
    activity: /3d|3д/u,
  },
  {
    id: "esports",
    label: "Киберспорт",
    query: /^(?:киберспорт|esports)/u,
    activity: /киберспорт/u,
  },
  {
    id: "media",
    label: "Медиа и съёмка",
    query: /^(?:снимат|съем|фотограф|фото|медиа|видео|монтаж|смм|smm)/u,
    activity: /фото|медиа|видео|монтаж|смм/u,
  },
  {
    id: "games",
    label: "Настольные игры",
    query: /^(?:настол|игротек|игры$)/u,
    activity: /настол|игротек/u,
  },
  {
    id: "coworking",
    label: "Коворкинг",
    query: /^коворкинг/u,
    activity: /коворкинг/u,
  },
];

const filler = new Set([
  "я",
  "мы",
  "мне",
  "меня",
  "мой",
  "моя",
  "мое",
  "хочу",
  "хочется",
  "хотел",
  "хотела",
  "бы",
  "буду",
  "можно",
  "нужно",
  "ищу",
  "найти",
  "найди",
  "покажи",
  "хотим",
  "заниматься",
  "заниматся",
  "занятия",
  "занятие",
  "занятиями",
  "учиться",
  "научиться",
  "учить",
  "научится",
  "попробовать",
  "научите",
  "где",
  "есть",
  "клуб",
  "клубе",
  "клубы",
  "секция",
  "секции",
  "студия",
  "студии",
  "для",
  "в",
  "во",
  "на",
  "по",
  "и",
  "или",
  "с",
  "а",
  "как",
  "язык",
  "языка",
  "языке",
  "начать",
]);

export function analyzeSearch(query: string) {
  const tokens = normalize(query).match(/[\p{L}\p{N}+-]+/gu) || [];
  const terms = tokens.filter((token) => !filler.has(token));
  if (
    terms.length > 1 &&
    terms.some((term) => /^(?:гитар|барабан|настол|шахмат|игротек)/u.test(term))
  ) {
    const index = terms.indexOf("играть");
    if (index >= 0) terms.splice(index, 1);
  }
  return terms.map((term) => ({
    term,
    intent: intents.find((intent) => intent.query.test(term)),
  }));
}

export function matchesSearch(
  query: string,
  text: string,
  activities: string[],
) {
  const analysis = analyzeSearch(query);
  if (!analysis.length)
    return (
      !normalize(query) ||
      normalize(query)
        .split(/\s+/)
        .every((term) => filler.has(term))
    );
  const normalizedText = normalize(text);
  return analysis.every(({ term, intent }) =>
    intent
      ? activities.some((activity) => intent.activity.test(normalize(activity)))
      : normalizedText.includes(term),
  );
}

export function matchingActivities(query: string, activities: string[]) {
  if (!normalize(query)) return activities;
  const analysis = analyzeSearch(query);
  if (!analysis.length) return activities;
  return activities.filter((activity) =>
    analysis.some(({ term, intent }) =>
      intent
        ? intent.activity.test(normalize(activity))
        : normalize(activity).includes(term),
    ),
  );
}

export function activitySuggestions(
  query: string,
  availablePlaces: { activities: string[] }[],
) {
  const analysis = analyzeSearch(query);
  const recognized = analysis
    .map((item) => item.intent)
    .filter((intent): intent is Intent => Boolean(intent));
  const ids = [
    ...new Set(
      recognized.flatMap((intent) => intent.suggestions || [intent.id]),
    ),
  ];
  return ids
    .map((id) => {
      const intent = intents.find((item) => item.id === id)!;
      const count = availablePlaces.filter((place) =>
        place.activities.some((activity) =>
          intent.activity.test(normalize(activity)),
        ),
      ).length;
      return { id, label: intent.label, count };
    })
    .filter((suggestion) => suggestion.count > 0);
}

export function interpretedInterests(query: string) {
  return [
    ...new Set(
      analyzeSearch(query).flatMap((item) =>
        item.intent ? [item.intent.label] : [],
      ),
    ),
  ];
}
