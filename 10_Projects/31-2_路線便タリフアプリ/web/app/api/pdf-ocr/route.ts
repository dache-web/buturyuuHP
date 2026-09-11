import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 西濃実PDFの探索候補ディレクトリ
const CANDIDATE_DIRS = [
  path.resolve(process.cwd(), "../32_PDF解析アプリ/pdf-ocr-verification/test_pdfs"),
  path.resolve(process.cwd(), "../32_PDF解析アプリ/pdf-ocr-verification/public/test_pdfs"),
  path.resolve(process.cwd(), "../32_PDF解析アプリ/pdf-import-web/test_pdfs"),
];

function getPdfDirectory(): string | null {
  for (const dir of CANDIDATE_DIRS) {
    if (fs.existsSync(dir)) {
      const pdfs = fs.readdirSync(dir).filter((f) => f.endsWith(".pdf") || f.endsWith(".PDF"));
      if (pdfs.length > 0) return dir;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pdfName = searchParams.get("name");
  const streamMode = searchParams.get("stream");

  try {
    const pdfDir = getPdfDirectory();

    if (!pdfDir) {
      return NextResponse.json(
        { error: "西濃実PDFディレクトリが見つかりません", candidateDirs: CANDIDATE_DIRS },
        { status: 404 }
      );
    }

    const files = fs
      .readdirSync(pdfDir)
      .filter((f) => f.endsWith(".pdf") || f.endsWith(".PDF"));

    if (!pdfName) {
      return NextResponse.json({ files, pdfDir });
    }

    const targetPath = path.join(pdfDir, pdfName);
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { error: `指定されたPDFファイルが存在しません: ${pdfName}` },
        { status: 404 }
      );
    }

    if (streamMode === "true") {
      const fileBuffer = fs.readFileSync(targetPath);
      return new Response(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(pdfName)}"`,
        },
      });
    }

    // PDFの抽出データ（32_PDF解析アプリの抽出結果スキーマ）
    const extractionData = {
      fileId: pdfName,
      fileName: pdfName,
      pageCount: 1,
      items: [
        {
          fileId: pdfName,
          page: 1,
          itemName: "距離列見出し",
          rawText: "50km",
          value: "50km",
          x: 0.35,
          y: 0.08,
          width: 0.12,
          height: 0.04,
          row: 1,
          column: 2,
          readingUncertain: false,
          semanticMeaning: "着地地帯区分 (岐阜・大垣・各務原)",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "地域名",
          rawText: "岐阜",
          value: "岐阜県岐阜市",
          x: 0.35,
          y: 0.13,
          width: 0.08,
          height: 0.03,
          row: 2,
          column: 2,
          readingUncertain: false,
          semanticMeaning: "対象都道府県・都市",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "重量行見出し",
          rawText: "10kg",
          value: 10,
          x: 0.08,
          y: 0.25,
          width: 0.06,
          height: 0.03,
          row: 4,
          column: 1,
          readingUncertain: false,
          semanticMeaning: "運賃重量上限 (10kg以下)",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "運賃金額",
          rawText: "1,230",
          value: 1230,
          x: 0.35,
          y: 0.25,
          width: 0.08,
          height: 0.03,
          row: 4,
          column: 2,
          readingUncertain: false,
          semanticMeaning: "基本運賃候補",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "重量行見出し",
          rawText: "20kg",
          value: 20,
          x: 0.08,
          y: 0.35,
          width: 0.06,
          height: 0.03,
          row: 5,
          column: 1,
          readingUncertain: false,
          semanticMeaning: "運賃重量上限 (20kg以下)",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "運賃金額",
          rawText: "1,450",
          value: 1450,
          x: 0.35,
          y: 0.35,
          width: 0.08,
          height: 0.03,
          row: 5,
          column: 2,
          readingUncertain: false,
          semanticMeaning: "基本運賃候補",
        },
        {
          fileId: pdfName,
          page: 1,
          itemName: "注記・条件",
          rawText: "1m3＝280kg換算・企業宛限定",
          value: "VOL_280_COMMERCIAL_ONLY",
          x: 0.08,
          y: 0.85,
          width: 0.5,
          height: 0.04,
          row: 10,
          column: 1,
          readingUncertain: true,
          semanticMeaning: "西濃容積換算ルール・商業宛制限",
        },
      ],
    };

    return NextResponse.json(extractionData);
  } catch (error) {
    return NextResponse.json(
      { error: "PDF処理中にエラーが発生しました", details: String(error) },
      { status: 500 }
    );
  }
}
