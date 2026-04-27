export const runtime = "nodejs";
// Cache surah list for a day — it never changes.
export const revalidate = 86400;

export async function GET() {
  try {
    const r = await fetch("https://api.alquran.cloud/v1/surah", {
      next: { revalidate: 86400 },
    });
    if (!r.ok) throw new Error("Quran API unavailable");
    const data = (await r.json()) as {
      data: Array<{
        number: number;
        name: string;
        englishName: string;
        englishNameTranslation: string;
        numberOfAyahs: number;
        revelationType: string;
      }>;
    };
    return Response.json({ surahs: data.data });
  } catch {
    return Response.json({ error: "Quran API unavailable" }, { status: 503 });
  }
}
