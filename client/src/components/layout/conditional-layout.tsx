import { useLocation } from "wouter";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const [location] = useLocation();
  
  // Spreadsheet pages get full width without additional padding or containers
  if (location === '/account-expenses' || location === '/account-management') {
    return (
      <>
        {/* Mobile header space only */}
        <div className="lg:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
          <h1 className="text-lg font-semibold">
            {location === '/account-expenses' ? 'Chi phí tài khoản' : 'Quản lý tài khoản'}
          </h1>
        </div>
        
        {/* Direct children without any wrapper divs */}
        {children}
      </>
    );
  }
  
  // Regular pages with padding and max-width
  return (
    <div className="h-full overflow-auto">
      <div className="lg:hidden h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
        <h1 className="text-lg font-semibold">KAG Financial</h1>
      </div>
      <div className="h-full">
        {children}
      </div>
    </div>
  );
}