// Token management utilities
export const updateTokenInStorage = (newToken: string) => {
  // Clear old tokens
  localStorage.removeItem('k_loading_token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('employee_token');
  
  // Set new token
  localStorage.setItem('k_loading_token', newToken);
  console.log('🔑 Token updated in localStorage');
};

export const getCurrentToken = () => {
  return localStorage.getItem('k_loading_token') || 
         localStorage.getItem('auth_token') || 
         localStorage.getItem('employee_token');
};

export const clearAllTokens = () => {
  localStorage.removeItem('k_loading_token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('employee_token');
  console.log('🗑️ All tokens cleared');
};

// Auto-update with new token if needed
export const refreshTokenIfNeeded = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        updateTokenInStorage(data.token);
        return data.token;
      }
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  
  return null;
};