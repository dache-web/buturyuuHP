import React from "react";
import PdfVerificationViewer from "@/components/PdfVerificationViewer";

export const metadata = {
  title: "西濃実PDF表示 ＆ 解析連携・正しさ確認 | 路線便タリフアプリ",
  description:
    "西濃運輸実タリフPDFを表示し、既存PDF解析アプリの抽出結果と正しさ確認エンジンの照合判定を同時目視確認する統合環境",
};

export default function PdfVerifyPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <PdfVerificationViewer />
      </div>
    </main>
  );
}
