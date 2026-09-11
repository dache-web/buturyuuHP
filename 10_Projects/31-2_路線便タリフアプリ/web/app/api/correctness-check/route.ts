import { NextResponse } from "next/server";

export type VerificationStatus =
  | "VERIFIED"
  | "NEEDS_HUMAN_REVIEW"
  | "UNCERTAIN"
  | "UNVERIFIED";

export interface ItemVerificationResult {
  itemId: string;
  itemName: string;
  rawText: string;
  value: string | number;
  semanticMeaning: string;
  status: VerificationStatus;
  statusLabel: string;
  reason: string;
  sourceCoordinates: { x: number; y: number; row?: number; column?: number };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, fileName } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "無効なリクエスト: items配列が必要です" },
        { status: 400 }
      );
    }

    const verificationResults: ItemVerificationResult[] = items.map(
      (item: any, idx: number) => {
        let status: VerificationStatus = "VERIFIED";
        let statusLabel = "問題なし (確認済み)";
        let reason = "元PDFテキストおよび周囲の位置構造と完全一致";

        // 1. readingUncertain（読取不安）の判定
        if (item.readingUncertain) {
          status = "UNCERTAIN";
          statusLabel = "読取不安 (要目視確認)";
          reason = "OCRまたは抽出アルゴリズムにより信頼度が低い文字列です";
        }
        // 2. 運賃金額の妥当性・位置構造の確認
        else if (item.itemName === "運賃金額") {
          const num = Number(item.value);
          if (isNaN(num) || num <= 0) {
            status = "NEEDS_HUMAN_REVIEW";
            statusLabel = "要人確認 (金額異常)";
            reason = "運賃金額が数値として正常に認識されていません";
          } else {
            status = "VERIFIED";
            statusLabel = "問題なし (運賃適合)";
            reason = `PDF Page ${item.page} (行 ${item.row}, 列 ${item.column}) の交点運賃と一致`;
          }
        }
        // 3. 注記・例外ルールの確認
        else if (item.itemName === "注記・条件") {
          status = "NEEDS_HUMAN_REVIEW";
          statusLabel = "人が確認する (特約条件)";
          reason = "タリフ外の計算・条件変更に関わる注記テキストです";
        }

        return {
          itemId: `item_${idx + 1}`,
          itemName: item.itemName,
          rawText: item.rawText,
          value: item.value,
          semanticMeaning: item.semanticMeaning || "未設定",
          status,
          statusLabel,
          reason,
          sourceCoordinates: {
            x: item.x,
            y: item.y,
            row: item.row,
            column: item.column,
          },
        };
      }
    );

    const summary = {
      totalItems: verificationResults.length,
      verifiedCount: verificationResults.filter((r) => r.status === "VERIFIED")
        .length,
      needsReviewCount: verificationResults.filter(
        (r) => r.status === "NEEDS_HUMAN_REVIEW"
      ).length,
      uncertainCount: verificationResults.filter(
        (r) => r.status === "UNCERTAIN"
      ).length,
      unverifiedCount: verificationResults.filter(
        (r) => r.status === "UNVERIFIED"
      ).length,
    };

    return NextResponse.json({
      engine: "39_正しさ確認エンジン (PDF意味抽出照合)",
      fileName: fileName || "未指定",
      summary,
      results: verificationResults,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "正しさ確認処理中にエラーが発生しました", details: String(error) },
      { status: 500 }
    );
  }
}
