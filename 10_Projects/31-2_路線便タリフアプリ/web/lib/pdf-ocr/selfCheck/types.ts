export type SelfCheckStatus = "normal" | "warning" | "error";

export interface SelfCheckMetrics {
  readCount: number;          // 1. 読取件数
  preConversionCount: number; // 2. 変換前件数
  postConversionCount: number;// 3. 変換後件数
  emptyCount: number;         // 4. 空欄件数
  duplicateCount: number;     // 5. 重複件数
  unprocessedCount: number;   // 6. 未処理件数
  isZeroCountError: boolean;  // 7. 0件異常フラグ
  countMismatch: number;      // 8. 件数差異
  plannedSaveCount: number;   // 9. 保存予定件数
  displayCount: number;       // 10. 表示件数
}

export interface SelfCheckResult {
  status: SelfCheckStatus;
  statusLabel: string;        // "正常" | "注意" | "異常"
  summaryMessage: string;
  metrics: SelfCheckMetrics;
  details?: string[];
  timestamp: string;
}

