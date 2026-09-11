import React from "react";
import PdfVerificationViewer from "@/components/PdfVerificationViewer";

export const metadata = {
  title: "西濃運輸運賃タリフ PDF解析・確認画面 | 路線便タリフアプリ",
  description:
    "西濃運輸実タリフPDFの内容を表示し、抽出データと正しさ確認結果をまとめて確認する画面",
};

export default function PdfVerifyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <PdfVerificationViewer />
    </main>
  );
}
