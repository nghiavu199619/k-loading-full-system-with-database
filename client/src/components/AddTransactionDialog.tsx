import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownToLine, ArrowUpFromLine, Plus, Calendar, DollarSign, User, FileText, CreditCard, Building } from 'lucide-react';

// Schema cho giao dịch nạp tiền
const depositSchema = z.object({
  date: z.string().min(1, 'Vui lòng chọn ngày'),
  amount: z.string().min(1, 'Vui lòng nhập số tiền'),
  currency: z.string().min(1, 'Vui lòng chọn đơn vị tiền tệ'),
  customerCode: z.string().min(1, 'Vui lòng nhập mã khách hàng'),
  note: z.string().optional(),
  accountId: z.string().min(1, 'Vui lòng nhập số tài khoản được nạp'),
  accountName: z.string().min(1, 'Vui lòng nhập tên tài khoản được nạp'),
});

// Schema cho giao dịch hoàn tiền
const refundSchema = z.object({
  date: z.string().min(1, 'Vui lòng chọn ngày'),
  amount: z.string().min(1, 'Vui lòng nhập số tiền'),
  currency: z.string().min(1, 'Vui lòng chọn đơn vị tiền tệ'),
  customerCode: z.string().min(1, 'Vui lòng nhập mã khách hàng'),
  note: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositSchema>;
type RefundFormData = z.infer<typeof refundSchema>;

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: DepositFormData | RefundFormData, type: 'deposit' | 'refund') => void;
}

const currencies = ['VND', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF'];

// Types for API data
interface Client {
  id: number;
  name: string;
  code: string;
}

interface SystemSettings {
  accountSettings: {
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    phoneSms: string;
    accountName: string;
    note: string;
  }[];
}

export function AddTransactionDialog({ open, onOpenChange, onAddTransaction }: AddTransactionDialogProps) {
  const [selectedType, setSelectedType] = useState<'deposit' | 'refund' | null>(null);

  // Fetch clients data
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: open,
  });

  // Fetch system settings for account settings
  const { data: systemSettings } = useQuery<SystemSettings>({
    queryKey: ['/api/settings'],
    enabled: open,
  });

  const depositForm = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: '',
      currency: 'VND',
      customerCode: '',
      note: '',
      accountId: '',
      accountName: '',
    },
  });

  // Handle account selection and auto-fill account name
  const handleAccountSelection = (accountNumber: string, form: any) => {
    const selectedAccount = systemSettings?.accountSettings?.find(
      account => account.accountNumber === accountNumber
    );
    
    form.setValue('accountId', accountNumber);
    if (selectedAccount) {
      form.setValue('accountName', selectedAccount.accountName || selectedAccount.accountHolder);
    }
  };

  const refundForm = useForm<RefundFormData>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: '',
      currency: 'VND',
      customerCode: '',
      note: '',
    },
  });

  const resetAndClose = () => {
    setSelectedType(null);
    depositForm.reset();
    refundForm.reset();
    onOpenChange(false);
  };

  const onDepositSubmit = (data: DepositFormData) => {
    onAddTransaction(data, 'deposit');
    resetAndClose();
  };

  const onRefundSubmit = (data: RefundFormData) => {
    onAddTransaction(data, 'refund');
    resetAndClose();
  };

  const formatAmount = (value: string) => {
    // Remove all non-digit characters except dots and commas
    const cleanValue = value.replace(/[^\d.,]/g, '');
    // Format with Vietnamese number format
    const parts = cleanValue.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl font-bold">
            <Plus className="h-6 w-6 text-blue-600" />
            <span>Thêm giao dịch mới</span>
          </DialogTitle>
          <DialogDescription>
            Chọn loại giao dịch bạn muốn thêm vào hệ thống
          </DialogDescription>
        </DialogHeader>

        {!selectedType ? (
          // Transaction Type Selection
          <div className="space-y-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deposit Card */}
              <Card 
                className="cursor-pointer border-2 hover:border-green-300 hover:shadow-lg transition-all duration-200 group"
                onClick={() => setSelectedType('deposit')}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <ArrowDownToLine className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Giao dịch nạp tiền</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Thêm giao dịch nạp tiền vào tài khoản của khách hàng
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                      NGÀY • SỐ TIỀN • TIỀN TỆ • MÃ KHÁCH • NOTE • SỐ TK • TÊN TK
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Refund Card */}
              <Card 
                className="cursor-pointer border-2 hover:border-orange-300 hover:shadow-lg transition-all duration-200 group"
                onClick={() => setSelectedType('refund')}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <ArrowUpFromLine className="h-8 w-8 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Giao dịch hoàn tiền</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Thêm giao dịch hoàn tiền cho khách hàng
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                      NGÀY • SỐ TIỀN • TIỀN TỆ • MÃ KHÁCH • NOTE
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
            </div>
          </div>
        ) : selectedType === 'deposit' ? (
          // Deposit Transaction Form
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <ArrowDownToLine className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">Giao dịch nạp tiền</h3>
              </div>
              <Button variant="ghost" onClick={() => setSelectedType(null)} className="text-sm">
                ← Quay lại
              </Button>
            </div>

            <Form {...depositForm}>
              <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <FormField
                    control={depositForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Ngày</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount */}
                  <FormField
                    control={depositForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Số tiền</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="VD: 1,000,000"
                            {...field}
                            onChange={(e) => {
                              const formatted = formatAmount(e.target.value);
                              field.onChange(formatted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Currency */}
                  <FormField
                    control={depositForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Đơn vị tiền tệ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn tiền tệ" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Code */}
                  <FormField
                    control={depositForm.control}
                    name="customerCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Mã khách hàng</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn khách hàng" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.code}>
                                {client.code} - {client.name}
                              </SelectItem>
                            )) || []}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Account ID */}
                  <FormField
                    control={depositForm.control}
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4" />
                          <span>Số TK được nạp</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => handleAccountSelection(value, depositForm)} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn số tài khoản" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {systemSettings?.accountSettings?.map((account, index) => (
                              <SelectItem key={index} value={account.accountNumber}>
                                {account.bankCode} - {account.accountNumber} ({account.accountHolder})
                              </SelectItem>
                            )) || []}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Account Name */}
                  <FormField
                    control={depositForm.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Building className="h-4 w-4" />
                          <span>Tên TK được nạp</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Tự động điền khi chọn STK" 
                            {...field} 
                            readOnly
                            className="bg-gray-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Note */}
                <FormField
                  control={depositForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Ghi chú</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ghi chú về giao dịch (không bắt buộc)"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetAndClose}>
                    Hủy
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                    Thêm giao dịch nạp tiền
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : (
          // Refund Transaction Form
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <ArrowUpFromLine className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold">Giao dịch hoàn tiền</h3>
              </div>
              <Button variant="ghost" onClick={() => setSelectedType(null)} className="text-sm">
                ← Quay lại
              </Button>
            </div>

            <Form {...refundForm}>
              <form onSubmit={refundForm.handleSubmit(onRefundSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <FormField
                    control={refundForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Ngày</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount */}
                  <FormField
                    control={refundForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Số tiền</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="VD: 1,000,000"
                            {...field}
                            onChange={(e) => {
                              const formatted = formatAmount(e.target.value);
                              field.onChange(formatted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Currency */}
                  <FormField
                    control={refundForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Đơn vị tiền tệ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn tiền tệ" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Code */}
                  <FormField
                    control={refundForm.control}
                    name="customerCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Mã khách hàng</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn khách hàng" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.code}>
                                {client.code} - {client.name}
                              </SelectItem>
                            )) || []}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Note */}
                <FormField
                  control={refundForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Ghi chú</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ghi chú về giao dịch (không bắt buộc)"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetAndClose}>
                    Hủy
                  </Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                    <ArrowUpFromLine className="h-4 w-4 mr-2" />
                    Thêm giao dịch hoàn tiền
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}