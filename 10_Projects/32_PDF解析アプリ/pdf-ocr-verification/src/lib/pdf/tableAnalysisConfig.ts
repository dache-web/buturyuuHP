export const TableAnalysisConfig = {
  // Y coordinate tolerance ratio relative to font height
  rowYToleranceRatio: 0.4,
  
  // X coordinate tolerance in points for column alignment
  columnXTolerance: 18,
  
  // Minimum rows required to consider as a table
  minimumRows: 3,
  
  // Minimum columns required to consider as a table
  minimumColumns: 2,
  
  // Minimum score required to classify as a table_candidate
  minimumTableScore: 60,
  
  // Maximum length of text to be considered "short" (common in table cells)
  shortTextMaxLength: 12,
  
  // Ratio of rows that must share similar column X-starts
  minimumRepeatedColumnRatio: 0.5,
};
