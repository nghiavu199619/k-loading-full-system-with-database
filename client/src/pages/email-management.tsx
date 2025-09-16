import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, RefreshCw, Mail, Settings, Eye, Clock, User, Send, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types
interface EmailAccount {
  id: number;
  accountName: string;
  emailAddress: string;
  provider: 'gmail' | 'outlook' | 'yahoo';
  isActive: boolean;
  createdAt: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

interface EmailFolder {
  id: number;
  accountId: number;
  folderName: string;
  folderPath: string;
  unreadCount: number;
  totalCount: number;
}

interface EmailMessage {
  id: number;
  accountId: number;
  folderId: number;
  messageId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  toAddresses: string[];
  body: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  sentAt: string;
}

const EmailManagement = () => {
  const { toast } = useToast();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch email accounts
  const { data: emailAccounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['/api/email-management'],
  });

  // Fetch all folders for all accounts
  const { data: allFolders = [] } = useQuery({
    queryKey: ['/api/email-management/all-folders'],
  });

  // Fetch all messages for display in email list
  const { data: allMessages = [] } = useQuery({
    queryKey: ['/api/email-management/all-messages'],
  });

  // Mutations
  const syncEmailMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const response = await fetch(`/api/email-management/${accountId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-management'] });
      toast({ title: "Thành công", description: "Đã đồng bộ email!" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/email-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-management'] });
      setShowAddAccount(false);
      toast({ title: "Thành công", description: "Đã thêm tài khoản email!" });
    },
  });

  // Filter messages based on search term
  const filteredMessages = allMessages.filter((msg: EmailMessage) => 
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.fromName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.fromAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.body?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'gmail': return 'bg-red-100 text-red-800';
      case 'outlook': return 'bg-blue-100 text-blue-800';
      case 'yahoo': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="h-full">
      <Tabs defaultValue="emails" className="h-full flex flex-col">
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Email Management</h1>
              <p className="text-gray-600">Quản lý email tích hợp với bảo mật AES-256</p>
            </div>
          </div>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="emails">Danh sách Email</TabsTrigger>
            <TabsTrigger value="accounts">Quản lý Tài khoản</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Email List */}
        <TabsContent value="emails" className="flex-1 p-0">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Tìm kiếm email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="outline" className="px-3 py-1">
                {filteredMessages.length} email
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredMessages.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    {searchTerm ? 'Không tìm thấy email phù hợp' : 'Chưa có email nào được đồng bộ'}
                  </CardContent>
                </Card>
              ) : (
                filteredMessages.map((message: EmailMessage) => (
                  <Card 
                    key={message.id} 
                    className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                      !message.isRead ? 'border-blue-200 bg-blue-50/30' : ''
                    }`}
                    onClick={() => setSelectedEmail(message)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="font-medium truncate">
                            {message.subject || '(Không có tiêu đề)'}
                          </div>
                          {!message.isRead && (
                            <Badge variant="secondary" className="shrink-0">Mới</Badge>
                          )}
                          {message.isFlagged && (
                            <Badge variant="destructive" className="shrink-0">Quan trọng</Badge>
                          )}
                          {message.hasAttachments && (
                            <Badge variant="outline" className="shrink-0">📎</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 shrink-0 ml-4">
                          {formatDate(message.receivedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{message.fromName || message.fromAddress}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">
                            {emailAccounts.find((acc: EmailAccount) => acc.id === message.accountId)?.emailAddress}
                          </span>
                        </div>
                      </div>
                      {message.body && (
                        <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                          {message.body.substring(0, 150)}...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Account Management */}
        <TabsContent value="accounts" className="flex-1 p-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Quản lý Tài khoản Email</h2>
              <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Email
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Thêm tài khoản email</DialogTitle>
                    <DialogDescription>
                      Kết nối email Gmail, Outlook hoặc Yahoo với mã hóa AES-256
                    </DialogDescription>
                  </DialogHeader>
                  <AddAccountForm 
                    createAccountMutation={createAccountMutation}
                    setShowAddAccount={setShowAddAccount}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoadingAccounts ? (
                <div className="col-span-full text-center py-8">Đang tải...</div>
              ) : emailAccounts.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  Chưa có tài khoản email
                </div>
              ) : (
                emailAccounts.map((account: EmailAccount) => (
                  <Card key={account.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{account.accountName}</CardTitle>
                        <Badge className={getProviderBadgeColor(account.provider)}>
                          {account.provider}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{account.emailAddress}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Trạng thái:</span>
                          <Badge variant={account.isActive ? "default" : "secondary"}>
                            {account.isActive ? 'Hoạt động' : 'Tạm dừng'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Tự động làm mới:</span>
                          <Badge variant={account.autoRefresh ? "default" : "secondary"}>
                            {account.autoRefresh ? 'Bật' : 'Tắt'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm">Khoảng cách:</span>
                          <span className="text-sm text-gray-600">{account.refreshInterval}s</span>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-gray-500">
                            Tạo: {formatDate(account.createdAt)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncEmailMutation.mutate(account.id)}
                            disabled={syncEmailMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Sync
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedEmail?.subject || '(Không có tiêu đề)'}
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedEmail.fromName || selectedEmail.fromAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(selectedEmail.receivedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selectedEmail.isRead && (
                    <Badge variant="secondary">Chưa đọc</Badge>
                  )}
                  {selectedEmail.isFlagged && (
                    <Badge variant="destructive">Quan trọng</Badge>
                  )}
                  {selectedEmail.hasAttachments && (
                    <Badge variant="outline">Có file đính kèm</Badge>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-96 p-4 border rounded-lg">
                <div className="whitespace-pre-wrap text-sm">
                  {selectedEmail.body || 'Không có nội dung'}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  Đóng
                </Button>
                <Button>
                  <Send className="h-4 w-4 mr-2" />
                  Trả lời
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add Account Form Component
const AddAccountForm = ({ createAccountMutation, setShowAddAccount }: any) => {
  const [formData, setFormData] = useState({
    accountName: '',
    emailAddress: '',
    password: '',
    appPassword: '',
    provider: '' as 'gmail' | 'outlook' | 'yahoo' | '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccountMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="accountName">Tên tài khoản</Label>
        <Input
          id="accountName"
          value={formData.accountName}
          onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
          placeholder="Tên hiển thị cho tài khoản"
          required
        />
      </div>

      <div>
        <Label htmlFor="provider">Nhà cung cấp</Label>
        <Select
          value={formData.provider}
          onValueChange={(value: 'gmail' | 'outlook' | 'yahoo') => 
            setFormData(prev => ({ ...prev, provider: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn nhà cung cấp email" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gmail">Gmail</SelectItem>
            <SelectItem value="outlook">Outlook</SelectItem>
            <SelectItem value="yahoo">Yahoo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="emailAddress">Địa chỉ email</Label>
        <Input
          id="emailAddress"
          type="email"
          value={formData.emailAddress}
          onChange={(e) => setFormData(prev => ({ ...prev, emailAddress: e.target.value }))}
          placeholder="example@email.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Mật khẩu email"
          required
        />
      </div>

      <div>
        <Label htmlFor="appPassword">App Password (Bắt buộc cho Gmail/Outlook)</Label>
        <Input
          id="appPassword"
          type="password"
          value={formData.appPassword}
          onChange={(e) => setFormData(prev => ({ ...prev, appPassword: e.target.value }))}
          placeholder="App password cho Gmail/Outlook"
          required={formData.provider !== 'yahoo'}
        />
        <p className="text-sm text-muted-foreground mt-1">
          {formData.provider === 'gmail' && 'Gmail yêu cầu App Password để kết nối IMAP/SMTP'}
          {formData.provider === 'outlook' && 'Outlook yêu cầu App Password để kết nối IMAP/SMTP'}
          {formData.provider === 'yahoo' && 'Yahoo có thể sử dụng mật khẩu thường hoặc App Password'}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setShowAddAccount(false)}>
          Hủy
        </Button>
        <Button type="submit" disabled={createAccountMutation.isPending}>
          {createAccountMutation.isPending ? 'Đang thêm...' : 'Thêm tài khoản'}
        </Button>
      </div>
    </form>
  );
};

export default EmailManagement;