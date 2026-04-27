export interface Ayah {
  number: number;
  arabic: string;
  translation: string;
  transliteration: string;
}

export interface Surah {
  id: number;
  name: string;
  arabicName: string;
  meaning: string;
  totalAyahs: number;
  ayahs: Ayah[];
}

export const surahs: Surah[] = [
  {
    id: 1,
    name: "Al-Fatiha",
    arabicName: "الفاتحة",
    meaning: "The Opening",
    totalAyahs: 7,
    ayahs: [
      {
        number: 1,
        arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
        transliteration: "Bismillahir-rahmanir-rahim",
      },
      {
        number: 2,
        arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        translation: "All praise is due to Allah, Lord of the worlds.",
        transliteration: "Alhamdu lillahi rabbil-'alamin",
      },
      {
        number: 3,
        arabic: "الرَّحْمَٰنِ الرَّحِيمِ",
        translation: "The Entirely Merciful, the Especially Merciful.",
        transliteration: "Ar-rahmanir-rahim",
      },
      {
        number: 4,
        arabic: "مَالِكِ يَوْمِ الدِّينِ",
        translation: "Sovereign of the Day of Recompense.",
        transliteration: "Maliki yawmid-din",
      },
      {
        number: 5,
        arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
        translation: "It is You we worship and You we ask for help.",
        transliteration: "Iyyaka na'budu wa iyyaka nasta'in",
      },
      {
        number: 6,
        arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
        translation: "Guide us to the straight path.",
        transliteration: "Ihdinas-siratal-mustaqim",
      },
      {
        number: 7,
        arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
        translation: "The path of those upon whom You have bestowed favor, not of those who have earned anger or of those who are astray.",
        transliteration: "Siratal-ladhina an'amta 'alayhim ghayril-maghdubi 'alayhim wa lad-dallin",
      },
    ],
  },
  {
    id: 112,
    name: "Al-Ikhlas",
    arabicName: "الإخلاص",
    meaning: "The Sincerity",
    totalAyahs: 4,
    ayahs: [
      {
        number: 1,
        arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ",
        translation: "Say, 'He is Allah, [who is] One.'",
        transliteration: "Qul huwa Allahu ahad",
      },
      {
        number: 2,
        arabic: "اللَّهُ الصَّمَدُ",
        translation: "Allah, the Eternal Refuge.",
        transliteration: "Allahus-samad",
      },
      {
        number: 3,
        arabic: "لَمْ يَلِدْ وَلَمْ يُولَدْ",
        translation: "He neither begets nor is born.",
        transliteration: "Lam yalid wa lam yulad",
      },
      {
        number: 4,
        arabic: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ",
        translation: "Nor is there to Him any equivalent.",
        transliteration: "Wa lam yakun lahu kufuwan ahad",
      },
    ],
  },
];

export const quizQuestions = [
  {
    id: 1,
    surahId: 1,
    question: "What is the meaning of 'Al-Fatiha'?",
    options: ["The Opening", "The Light", "The Truth", "The Mercy"],
    correctIndex: 0,
  },
  {
    id: 2,
    surahId: 1,
    question: "How many verses (ayahs) does Surah Al-Fatiha have?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
  },
  {
    id: 3,
    surahId: 1,
    question: "What does 'Alhamdu lillahi rabbil-alamin' translate to?",
    options: [
      "Guide us to the straight path",
      "In the name of Allah, the Merciful",
      "All praise is due to Allah, Lord of the worlds",
      "It is You we worship",
    ],
    correctIndex: 2,
  },
  {
    id: 4,
    surahId: 1,
    question: "Which ayah of Al-Fatiha asks for guidance to the straight path?",
    options: ["Ayah 3", "Ayah 5", "Ayah 6", "Ayah 7"],
    correctIndex: 2,
  },
  {
    id: 5,
    surahId: 112,
    question: "What is the meaning of 'Al-Ikhlas'?",
    options: ["The Light", "The Sincerity", "The Opening", "The Throne"],
    correctIndex: 1,
  },
];
