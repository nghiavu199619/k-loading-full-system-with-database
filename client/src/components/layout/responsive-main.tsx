import React, { useEffect, useState, useMemo } from "react";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface ResponsiveMainProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveMain({ children, className }: ResponsiveMainProps) {
  const { collapsed } = useSidebarContext();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  // Handle window resize safely
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate margin-left with memo for performance
  const marginLeft = useMemo(() => {
    if (!isDesktop) return "0";
    return collapsed ? "4rem" : "16rem";
  }, [collapsed, isDesktop]);

  if (process.env.NODE_ENV === "development") {
    console.log("🔧 ResponsiveMain", { collapsed, isDesktop, marginLeft });
  }

  return (
    <div
      className={cn("flex-1 flex flex-col overflow-hidden", className)}
      style={{
        marginLeft,
        transition: "margin-left 300ms ease-in-out",
      }}
    >
      {children}
    </div>
  );
}
