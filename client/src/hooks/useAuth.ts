import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { AuthUser } from "@shared/schema";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Check if user has a valid token
  const token = localStorage.getItem('k_loading_token');

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      
      const data = await response.json();
      return data.user;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: () => {
      localStorage.removeItem('k_loading_token');
      queryClient.clear();
      setLocation('/login');
    },
    onError: () => {
      // Even if logout fails, clear local data
      localStorage.removeItem('k_loading_token');
      queryClient.clear();
      setLocation('/login');
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;

  // Check if authentication failed (401 error)
  const isAuthError = error && error.message.includes('401');

  // Auto-redirect to login if not authenticated (use useEffect to avoid state updates during render)
  React.useEffect(() => {
    if (isAuthError || (!isLoading && !isAuthenticated && token)) {
      localStorage.removeItem('k_loading_token');
      setLocation('/login');
    }
  }, [isAuthError, isLoading, isAuthenticated, token, setLocation]);

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}

// Hook for protected routes
export function useRequireAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    setLocation('/login');
    return { user: null, isLoading: false };
  }

  return { user, isLoading };
}