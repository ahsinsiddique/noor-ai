export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px", lineHeight: 1.6 }}>
      <h1>Quran AI Tutor — API</h1>
      <p>
        This is the backend for the Quran AI Tutor mobile app. The mobile client
        (Expo / React Native) lives in <code>artifacts/quran-ai-tutor/</code>.
      </p>
      <p>Health check: <a href="/api/health">/api/health</a></p>
    </main>
  );
}
