import type { CatalogResult } from '../shared/catalog';

export type InputFormat = 'json' | 'csv';
export type SystemStatus = {
  payment: {
    ready: boolean;
    blockers: string[];
    sellerAddress: string | null;
    servicePriceLovelace: string;
    network: string;
    asset: string;
  };
  model: { available: boolean; model: string };
};
export type Mandate = {
  serviceCapLovelace: string;
  feeCapLovelace: string;
  totalCapLovelace: string;
  expiresAt: string;
  maxActions: 1;
};
export type PaymentIntent = {
  intentId: string;
  inputHash: string;
  status: string;
  reason: string | null;
  transaction: string | null;
  explorerUrl: string | null;
  servicePriceLovelace: string | null;
  networkFeeLovelace: string | null;
  facilitatorFeeLovelace: string | null;
  sellerNetLovelace: string | null;
  receipt: Record<string, unknown> | null;
  events: { at: string; decision: string; detail: string }[];
};
export type Job = {
  id: string;
  inputHash: string;
  status: 'blocked' | 'quoted' | 'payment_pending' | 'processing' | 'complete' | 'failed' | 'receipt_unresolved';
  result?: CatalogResult;
  error?: string;
  payment?: PaymentIntent;
  sourceInput?: string;
  sourceFormat?: InputFormat;
  events: { at: string; stage: string; message: string }[];
  createdAt: string;
};

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof value?.error === 'string' ? value.error : value?.error?.message;
    const error = new Error(message || `Request failed (${response.status}). Please try again.`);
    Object.assign(error, { details: value?.issues || value?.error?.issues || [] });
    throw error;
  }
  return value as T;
}

export const api = {
  status: () => request<SystemStatus>('/api/status'),
  sample: () => request<{ input: string; format: InputFormat }>('/api/sample'),
  review: (input: string, format: InputFormat) => request<{ result: CatalogResult }>('/api/review', { input, format }),
  start: (input: string, format: InputFormat, mandate: Mandate) => request<{ job: Job }>('/api/jobs', { input, format, mandate }),
  job: (id: string) => request<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}`),
  reconcile: (id: string) => request<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}/reconcile`, {}),
};
