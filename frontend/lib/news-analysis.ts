import type { NewsRankingItem } from "@/lib/api";

export type PendingNewsAnalysis = {
  id: string;
  input: string;
  createdAt: string;
};

const pendingNewsAnalysisStorageKey = "cryptorisk.pendingNewsAnalysis";

export function buildNewsAnalysisInput(item: Pick<NewsRankingItem, "title" | "content" | "published_at" | "date" | "risk_type" | "risk_level" | "risk_score" | "coins" | "summary" | "evidence" | "source_url">) {
  return item.content?.trim() || item.summary?.trim() || item.title.trim();
}

export function writePendingNewsAnalysisInput(input: string) {
  if (typeof window === "undefined") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const pending: PendingNewsAnalysis = {
    id: `pending-news-${Date.now()}`,
    input: trimmed,
    createdAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(pendingNewsAnalysisStorageKey, JSON.stringify(pending));
  return pending;
}

export function readPendingNewsAnalysisInput() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(pendingNewsAnalysisStorageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingNewsAnalysis;
    return parsed.input?.trim() ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingNewsAnalysisInput() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(pendingNewsAnalysisStorageKey);
}
