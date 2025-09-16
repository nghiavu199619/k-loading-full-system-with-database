import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ResponsiveMain } from "@/components/layout/responsive-main";
import { AccountHandsontable } from "@/components/spreadsheets/account-handsontable";
import { useHasPermission } from "@/hooks/usePermissions";

// Clean account management interface - optimized layout
export default function AccountManagement() {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission('account-management', 'edit');

  // ✅ TAB SWITCHING DATA REFRESH: Invalidate cache when component mounts
  useEffect(() => {
    console.log('🔄 ACCOUNT TAB ACTIVATED - Invalidating all cached data');
    queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    queryClient.invalidateQueries({ queryKey: ['/api/account-expenses'] });
  }, [queryClient]);

  return (
    <ResponsiveMain className="absolute inset-0 overflow-hidden">
      <AccountHandsontable canEdit={canEdit} />
    </ResponsiveMain>
  );
}