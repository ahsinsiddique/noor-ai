export const runtime = "nodejs";
export const revalidate = 86400;

const ALLOWED_EDITIONS = new Set([
  "en.asad", "en.sahih", "en.pickthall",
  "ur.maududi", "ur.jalandhry",
  "fr.hamidullah",
  "tr.diyanet", "tr.yazir",
  "id.indonesian",
  "de.bubenheim",
  "es.cortes",
  "bn.bengali",
  "ru.kuliev",
]);

interface RouteParams {
  params: Promise<{ surah: string; number: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { surah, number } = await params;
  const url = new URL(req.url);
  const rawEdition = url.searchParams.get("edition") ?? "en.asad";
  const edition = ALLOWED_EDITIONS.has(rawEdition) ? rawEdition : "en.asad";

  try {
    const [arRes, transRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${number}/ar.alafasy`, {
        next: { revalidate: 86400 },
      }),
      fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${number}/${edition}`, {
        next: { revalidate: 86400 },
      }),
    ]);

    if (!arRes.ok || !transRes.ok) throw new Error("Ayah not found");

    const [arData, transData] = (await Promise.all([arRes.json(), transRes.json()])) as [
      {
        data: {
          number: number;
          text: string;
          audio: string;
          surah: { name: string; englishName: string; numberOfAyahs: number };
          numberInSurah: number;
        };
      },
      { data: { text: string } },
    ];

    return Response.json({
      ayah: {
        arabic: arData.data.text,
        translation: transData.data.text,
        numberInSurah: arData.data.numberInSurah,
        globalNumber: arData.data.number,
        surahName: arData.data.surah.englishName,
        surahArabic: arData.data.surah.name,
        totalAyahs: arData.data.surah.numberOfAyahs,
        audioUrl:
          arData.data.audio ??
          `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${arData.data.number}.mp3`,
      },
    });
  } catch {
    return Response.json({ error: "Ayah not found" }, { status: 404 });
  }
}
