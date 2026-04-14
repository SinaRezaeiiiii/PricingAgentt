/**
 * Performance optimization utilities for handling large datasets
 * - Sampling: Reduces point count for charts from 10k+ to manageable ~1000 points
 * - Caching: Memoized results for expensive operations
 */

import { PartData, ClusterData } from "@/data/mockData";

const CHART_MAX_POINTS = 1000; // Maximum sensible points for chart rendering
const CHART_SAMPLE_CACHE = new Map<string, unknown[]>();

/**
 * Sample large datasets for chart rendering while preserving data distribution.
 * Uses stratified sampling with cost-range bucketing.
 * 
 * For 10k points → ~1000 representative points
 * For 100k points → ~1000 representative points
 */
export function sampleDataForChart<T extends { "Landed Cost"?: number; [key: string]: unknown }>(
  data: T[],
  cacheKey?: string
): T[] {
  if (data.length <= CHART_MAX_POINTS) {
    return data;
  }

  // Check cache
  if (cacheKey && CHART_SAMPLE_CACHE.has(cacheKey)) {
    return (CHART_SAMPLE_CACHE.get(cacheKey) as T[]) || data;
  }

  const samplingRate = Math.max(1, Math.ceil(data.length / CHART_MAX_POINTS));
  
  // Sort by cost to preserve distribution
  const sorted = [...data].sort((a, b) => {
    const costA = (a["Landed Cost"] as number) || 0;
    const costB = (b["Landed Cost"] as number) || 0;
    return costA - costB;
  });

  // Stratified sampling: take every Nth point
  const sampled = sorted.filter((_, idx) => idx % samplingRate === 0);

  // Cache result
  if (cacheKey) {
    CHART_SAMPLE_CACHE.set(cacheKey, sampled);
  }

  return sampled;
}

/**
 * Clear chart sampling cache (call after data updates)
 */
export function clearChartCache() {
  CHART_SAMPLE_CACHE.clear();
}

/**
 * Safely aggregate large arrays in chunks to prevent blocking
 */
export function aggregateData<T, R>(
  data: T[],
  aggregateFn: (chunk: T[]) => R,
  chunkSize = 1000
): R[] {
  const results: R[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    results.push(aggregateFn(chunk));
  }
  return results;
}

/**
 * Memoize expensive computations with simple cache
 */
export function memoize<T extends (...args: any[]) => any>(fn: T, maxSize = 50): T {
  const cache = new Map<string, any>();

  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    // Limit cache size
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  }) as T;
}

/**
 * Estimate rendering time for data
 */
export function getDataRenderComplexity(dataLength: number): "low" | "medium" | "high" {
  if (dataLength < 500) return "low";
  if (dataLength < 5000) return "medium";
  return "high";
}

/**
 * Debounce state update callbacks
 */
export function debounceCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay = 300
): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  }) as T;
}
