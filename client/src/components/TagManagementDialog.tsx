import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { X, Search, Tag } from 'lucide-react';

interface Client {
  id: number;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  assignedEmployee: string;
  userId: number;
}

interface TagManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTags: string;
  accountId: number;
  onTagsUpdate: (newTags: string) => void;
}

export function TagManagementDialog({ 
  isOpen, 
  onClose, 
  currentTags, 
  accountId, 
  onTagsUpdate 
}: TagManagementDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse current tags when dialog opens
  useEffect(() => {
    if (isOpen && currentTags) {
      const tags = currentTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      setSelectedTags(tags);
    } else if (isOpen) {
      setSelectedTags([]);
    }
  }, [isOpen, currentTags]);

  // Fetch clients owned by current user (director isolation)
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update account tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string) => {
      return apiRequest('PATCH', `/api/ad-accounts/${accountId}`, {
        clientTag: tags
      });
    },
    onSuccess: () => {
      toast({
        title: "Cập nhật thành công",
        description: "Tags khách hàng đã được cập nhật",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
      onTagsUpdate(selectedTags.join(', '));
      onClose();
    },
    onError: (error) => {
      console.error('Error updating tags:', error);
      toast({
        title: "Lỗi cập nhật",
        description: "Không thể cập nhật tags khách hàng",
        variant: "destructive"
      });
    }
  });

  const handleToggleTag = (clientCode: string) => {
    setSelectedTags(prev => {
      if (prev.includes(clientCode)) {
        return prev.filter(tag => tag !== clientCode);
      } else {
        return [...prev, clientCode];
      }
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    const tagsString = selectedTags.join(', ');
    updateTagsMutation.mutate(tagsString);
  };

  const handleClose = () => {
    setSelectedTags([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Quản lý Tag Khách hàng
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Tags Display */}
          <div>
            <Label className="text-sm font-medium">Tags đã chọn:</Label>
            <div className="flex flex-wrap gap-1 mt-2 min-h-[32px] p-2 border rounded">
              {selectedTags.length > 0 ? (
                selectedTags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="flex items-center gap-1"
                  >
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-red-600" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))
              ) : (
                <span className="text-gray-400 text-sm">Chưa có tag nào</span>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div>
            <Label htmlFor="search" className="text-sm font-medium">
              Tìm kiếm khách hàng:
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="search"
                placeholder="Tìm theo tên hoặc mã khách hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Clients List */}
          <div>
            <Label className="text-sm font-medium">Danh sách khách hàng:</Label>
            <div className="mt-2 border rounded max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Đang tải...
                </div>
              ) : filteredClients.length > 0 ? (
                <div className="space-y-1 p-2">
                  {filteredClients.map(client => (
                    <div 
                      key={client.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => handleToggleTag(client.code)}
                    >
                      <Checkbox
                        checked={selectedTags.includes(client.code)}
                        onChange={() => handleToggleTag(client.code)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{client.name}</div>
                        <div className="text-xs text-gray-500">
                          Mã: {client.code}
                          {client.contactPerson && ` • ${client.contactPerson}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? 'Không tìm thấy khách hàng phù hợp' : 'Không có khách hàng nào'}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={updateTagsMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateTagsMutation.isPending}
              className="min-w-[80px]"
            >
              {updateTagsMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Đang lưu...
                </div>
              ) : (
                'Lưu'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}