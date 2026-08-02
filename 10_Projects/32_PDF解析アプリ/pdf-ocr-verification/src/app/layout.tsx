import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF・OCR精度検証ツール",
  description: "PDFの文字抽出およびOCR精度の検証ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}
