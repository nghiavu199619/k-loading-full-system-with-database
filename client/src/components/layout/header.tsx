import { Bell, ChartLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";

export function Header() {
  const { isConnected } = useWebSocket();

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <ChartLine className="text-primary h-8 w-8" />
              <h1 className="text-xl font-bold text-foreground">KAG Financial</h1>
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                Ver 6
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-secondary animate-pulse' : 'bg-destructive'
                  }`} 
                />
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
              <span>•</span>
              <span>3 người đang online</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                2
              </Badge>
            </Button>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">A</span>
              </div>
              <span className="text-sm font-medium">Admin KAG</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
