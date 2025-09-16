import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface Employee {
  id: number;
  username: string;
  fullName: string;
  role: {
    id: number;
    name: string;
    permissions: string[];
  };
}

interface EmployeeAuthContextType {
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (token: string, employee: Employee) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('employee_token')
  );
  
  const [employee, setEmployee] = useState<Employee | null>(() => {
    const stored = localStorage.getItem('employee_info');
    return stored ? JSON.parse(stored) : null;
  });

  // Verify token with server
  const { data: verifiedEmployee, isLoading, error } = useQuery({
    queryKey: ['/api/auth/employee/me'],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/auth/employee/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Authentication failed');
      }
      
      const data = await response.json();
      return data.employee;
    },
  });

  // Update employee info when verified
  useEffect(() => {
    if (verifiedEmployee) {
      setEmployee(verifiedEmployee);
      localStorage.setItem('employee_info', JSON.stringify(verifiedEmployee));
    }
  }, [verifiedEmployee]);

  // Clear auth if verification fails
  useEffect(() => {
    if (error && token) {
      logout();
    }
  }, [error, token]);

  const login = (newToken: string, newEmployee: Employee) => {
    setToken(newToken);
    setEmployee(newEmployee);
    localStorage.setItem('employee_token', newToken);
    localStorage.setItem('employee_info', JSON.stringify(newEmployee));
  };

  const logout = () => {
    setToken(null);
    setEmployee(null);
    localStorage.removeItem('employee_token');
    localStorage.removeItem('employee_info');
  };

  const hasPermission = (permission: string) => {
    if (!employee) return false;
    return employee.role.permissions.includes(permission);
  };

  const value: EmployeeAuthContextType = {
    employee,
    isAuthenticated: !!employee && !!token,
    isLoading,
    token,
    login,
    logout,
    hasPermission,
  };

  return (
    <EmployeeAuthContext.Provider value={value}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
}