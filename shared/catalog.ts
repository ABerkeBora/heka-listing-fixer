/** Public catalog contract. Payment status is deliberately separate from result status. */
export const CATALOG_SCHEMA = 'listing-v1' as const;
export const CATALOG_LANGUAGE = 'en' as const;
export const SOURCE_FIELDS = ['sku', 'title', 'description', 'price', 'currency', 'manufacturer', 'safety', 'certification', 'sourceUrl', 'sourceText'] as const;
export type SourceField = typeof SOURCE_FIELDS[number];
export type SourceProduct = Record<SourceField, string>;
export interface CatalogInput {
  schema: typeof CATALOG_SCHEMA;
  language: typeof CATALOG_LANGUAGE;
  products: SourceProduct[];
  sample?: boolean;
}
export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'review';
  row?: number;
}
export interface FieldDiff {
  field: string;
  before: string;
  after: string;
  source: { row: number; field: string; url: string; parts?: { field: string; text: string }[] };
  reason: string;
}
export interface CheckedProduct {
  sku: string;
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  manufacturer: string;
  safety: string;
  certification: string;
  sourceUrl: string;
  status: 'ready' | 'needs_source' | 'review';
  issues: ValidationIssue[];
  diffs: FieldDiff[];
  source: SourceProduct;
}
export interface ModelReport {
  provider: 'ollama';
  model: string;
  called: boolean;
  acceptedEdits: number;
  rejectedEdits: number;
  durationMs: number;
}
export interface CatalogResult {
  inputHash: string;
  schema: typeof CATALOG_SCHEMA;
  language: typeof CATALOG_LANGUAGE;
  mode: 'source_review' | 'model_checked';
  products: CheckedProduct[];
  summary: { total: number; ready: number; needsSource: number; review: number; changes: number };
  model: ModelReport | null;
  createdAt: string;
}
export interface SourcePart {
  sourceField: 'title' | 'description' | 'sourceText';
  text: string;
}
export interface CatalogDraft {
  edits: { sku: string; field: 'title' | 'description'; parts: SourcePart[] }[];
}
