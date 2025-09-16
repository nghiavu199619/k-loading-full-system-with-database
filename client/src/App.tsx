import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

// Layout components
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import { ResponsiveMain } from "@/components/layout/responsive-main";

// Pages
import Dashboard from "@/pages/dashboard";
import AccountManagement from "@/pages/account-management";
import ExpenseManagement from "@/pages/expense-management-new";
import CardManagement from "@/pages/card-management";
import CardManagementOld from "@/pages/card-management-sheet";
import ViaManagement from "@/pages/via-management";
import ThresholdBankManagement from "@/pages/threshold-bank-management";
import PaymentManagement from "@/pages/payment-management";
import TimeTracking from "@/pages/time-tracking";
import EmailManagement from "@/pages/email-management";

import FinancialReport from "@/pages/financial-report";

import ClientManagement from "@/pages/client-management";
import EmployeeManagement from "@/pages/employee-management";
import ActivityLogsNew from "@/pages/activity-logs-new";
import EmployeeLogin from "@/pages/employee-login";
import Welcome from "@/pages/welcome";
import NotFound from "@/pages/not-found";
import SettingsPage from "@/pages/settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import UserProfile from "@/pages/UserProfile";
import AiDevOps from "@/pages/AiDevOps";

import { queryClient } from "@/lib/queryClient";
import { EmployeeAuthProvider } from "@/hooks/useEmployeeAuth";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/useAuth";

function AuthenticatedApp() {
  return (
    <EmployeeAuthProvider>
      <SidebarProvider>
        <TooltipProvider>
          <div className="h-screen bg-background flex">
            <Sidebar />
            {/* Main content area with responsive sidebar margin */}
            <ResponsiveMain>
              <MobileHeader />
              <main className="flex-1 overflow-hidden">
                <ConditionalLayout>
                  <Switch>
                    <Route path="/" component={Welcome} />
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/account-management" component={AccountManagement} />
                    <Route path="/expense-management" component={ExpenseManagement} />
                    <Route path="/card-management" component={CardManagement} />
                    <Route path="/card-management-old" component={CardManagementOld} />
                    <Route path="/via-management" component={ViaManagement} />
                    <Route path="/threshold-management" component={ThresholdBankManagement} />
                    <Route path="/payment-management" component={PaymentManagement} />
                    <Route path="/time-tracking" component={TimeTracking} />
                    <Route path="/email-management" component={EmailManagement} />
                    <Route path="/financial-report" component={FinancialReport} />
                    
                    {/* Reconciliation Report Route */}
                    <Route path="/reconciliation/:clientCode">
                      {(params) => {
                        window.location.href = '/reconciliation-sample.html';
                        return null;
                      }}
                    </Route>

                    <Route path="/client-management" component={ClientManagement} />
                    <Route path="/employee-management" component={EmployeeManagement} />
                    <Route path="/activity-history" component={ActivityLogsNew} />
                    <Route path="/activity-logs" component={ActivityLogsNew} />
                    <Route path="/system-settings" component={SettingsPage} />
                    <Route path="/settings" component={SettingsPage} />

                    <Route path="/profile" component={UserProfile} />
                    <Route path="/ai-devops" component={AiDevOps} />
                    <Route path="/employee-login" component={EmployeeLogin} />
                    
                    {/* Redirect old expense route to account management */}
                    <Route path="/account-expenses">
                      {() => {
                        window.location.href = '/account-management';
                        return null;
                      }}
                    </Route>
                    
                    <Route component={NotFound} />
                  </Switch>
                </ConditionalLayout>
              </main>
            </ResponsiveMain>
          </div>
          <Toaster />
        </TooltipProvider>
      </SidebarProvider>
    </EmployeeAuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <Switch>
      {/* Public routes - Auth pages */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected routes - Main app */}
      <Route>
        {() => {
          if (!isAuthenticated) {
            return <Login />;
          }
          return <AuthenticatedApp />;
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;