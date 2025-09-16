interface AutoSaveStatusProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  pendingCount?: number;
  className?: string;
}

export function AutoSaveStatus({ status, pendingCount = 0, className = '' }: AutoSaveStatusProps) {
  if (status === 'idle') return null;

  const statusConfig = {
    saving: {
      bgColor: 'bg-blue-500',
      text: 'Đang lưu...',
      icon: (
        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
      )
    },
    saved: {
      bgColor: 'bg-green-500',
      text: 'Đã lưu',
      icon: <span className="mr-2">✅</span>
    },
    error: {
      bgColor: 'bg-red-500',
      text: 'Lỗi lưu',
      icon: <span className="mr-2">❌</span>
    }
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`${config.bgColor} text-white px-3 py-2 rounded-md text-sm flex items-center`}>
        {config.icon}
        {config.text}
        {pendingCount > 0 && status === 'saving' && (
          <span className="ml-1">({pendingCount})</span>
        )}
      </div>
    </div>
  );
}