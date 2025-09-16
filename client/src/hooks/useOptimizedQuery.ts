// Optimized React Query hook for Handsontable data loading
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useRef, useMemo } from 'react';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: readonly unknown[];
  url: string;
  transform?: (data: any) => T;
}

// In-memory cache for transformed data to prevent expensive re-computations
const transformCache = new Map<string, any>();

export function useOptimizedQuery<T = any>({
  queryKey,
  url,
  transform,
  ...options
}: OptimizedQueryOptions<T>) {
  // Create stable cache key for transformations
  const cacheKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  
  // Memoized transform function to prevent recreation
  const memoizedTransform = useCallback((data: any) => {
    if (!transform) return data;
    
    // Check transform cache first
    const cached = transformCache.get(cacheKey + JSON.stringify(data));
    if (cached) {
      console.log('🚀 Transform cache hit for:', cacheKey);
      return cached;
    }
    
    // Apply transformation and cache result
    const transformed = transform(data);
    transformCache.set(cacheKey + JSON.stringify(data), transformed);
    
    // Limit cache size to prevent memory issues
    if (transformCache.size > 100) {
      const firstKey = transformCache.keys().next().value;
      transformCache.delete(firstKey);
    }
    
    return transformed;
  }, [transform, cacheKey]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return memoizedTransform(data);
    },
    // Optimized defaults for Handsontable
    staleTime: 30000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...options,
  });
}