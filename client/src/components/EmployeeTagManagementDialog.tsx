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
import { X, Search, Users } from 'lucide-react';

interface Employee {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  position: string;
  status: string;
  userId: number;
}

interface EmployeeTagManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTags: string;
  recordId: number;
  recordType: 'card' | 'via';
  onTagsUpdate: (newTags: string) => void;
}

export function EmployeeTagManagementDialog({ 
  isOpen, 
  onClose, 
  currentTags, 
  recordId, 
  recordType,
  onTagsUpdate 
}: EmployeeTagManagementDialogProps) {
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

  // Fetch employees from current director
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Filter employees based on search term
  const filteredEmployees = employees.filter(employee =>
    employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update record tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string) => {
      const endpoint = recordType === 'card' 
        ? `/api/card-management/${recordId}`
        : `/api/via-management/${recordId}`;
      
      const fieldName = recordType === 'card' ? 'assignedEmployee' : 'phanChoNV';
      
      return apiRequest('PATCH', endpoint, {
        [fieldName]: tags
      });
    },
    onSuccess: () => {
      toast({
        title: "Cập nhật thành công",
        description: `Tags nhân viên cho ${recordType === 'card' ? 'thẻ' : 'via'} đã được cập nhật`,
      });
      
      const queryKey = recordType === 'card' 
        ? ['/api/card-management']
        : ['/api/via-management'];
      
      queryClient.invalidateQueries({ queryKey });
      onTagsUpdate(selectedTags.join(', '));
      onClose();
    },
    onError: (error) => {
      console.error('Error updating employee tags:', error);
      toast({
        title: "Lỗi cập nhật",
        description: `Không thể cập nhật tags nhân viên cho ${recordType === 'card' ? 'thẻ' : 'via'}`,
        variant: "destructive"
      });
    }
  });

  const handleToggleTag = (employeeName: string) => {
    setSelectedTags(prev => {
      if (prev.includes(employeeName)) {
        return prev.filter(tag => tag !== employeeName);
      } else {
        return [...prev, employeeName];
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
            <Users className="w-5 h-5" />
            Gắn Tag Nhân viên {recordType === 'card' ? '- Thẻ' : '- Via'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search employees */}
          <div>
            <Label htmlFor="employee-search">Tìm nhân viên</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="employee-search"
                placeholder="Tìm theo tên, username, phòng ban..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Selected tags display */}
          {selectedTags.length > 0 && (
            <div>
              <Label>Nhân viên đã chọn ({selectedTags.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Employee list */}
          <div>
            <Label>Danh sách nhân viên</Label>
            <div className="border rounded-md max-h-64 overflow-y-auto mt-2">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Đang tải danh sách nhân viên...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? 'Không tìm thấy nhân viên nào' : 'Chưa có nhân viên nào'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredEmployees.map(employee => (
                    <div 
                      key={employee.id} 
                      className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => handleToggleTag(employee.fullName)}
                    >
                      <Checkbox 
                        checked={selectedTags.includes(employee.fullName)}
                        onChange={() => handleToggleTag(employee.fullName)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{employee.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {employee.username} • {employee.department} • {employee.position}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.role === 'director' && '👑 Giám đốc'}
                          {employee.role === 'manager' && '📋 Quản lý'}
                          {employee.role === 'employee' && '👤 Nhân viên'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateTagsMutation.isPending}
            >
              {updateTagsMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}