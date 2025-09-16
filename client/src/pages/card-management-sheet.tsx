import { useAuth } from '@/hooks/useAuth';

export default function CardManagement() {
  const { user } = useAuth();

  if (!user) {
    return <div>Vui lòng đăng nhập để truy cập trang này.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý thẻ</h1>
        <p className="text-gray-600">Trang quản lý thẻ ngân hàng</p>
      </div>

      <div className="bg-white rounded-lg shadow border p-8 text-center">
        <div className="text-gray-500">
          <h3 className="text-lg font-medium mb-2">Quản lý thẻ</h3>
          <p>Tính năng đang được phát triển</p>
        </div>
      </div>
    </div>
  );
}