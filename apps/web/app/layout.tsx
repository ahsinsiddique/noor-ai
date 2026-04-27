import type { ReactNode } from "react";

export const metadata = {
  title: "Quran AI Tutor — API",
  description: "Backend for the Quran AI Tutor mobile app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
