import { NextResponse } from "next/server";
import { fetchTariffData } from "@/lib/gasClient";

export async function GET() {
  try {
    const data = await fetchTariffData();
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    let errorMessage = "GASからのデータ取得に失敗しました。";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
