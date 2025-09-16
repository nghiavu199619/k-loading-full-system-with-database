import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, Database, Palette, BarChart3, HardDrive, Shield, 
  Plus, Edit, Trash2, Download, RefreshCw, Users, DollarSign, CreditCard 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SystemSettings {
  statusOptions: string[];
  noteCards: string[];
  bankSettings: {code: string; name: string; logo?: string}[];
  accountSettings: {bankCode: string; accountNumber: string; accountHolder: string; phoneSms: string; accountName: string; note: string}[];
  partners: string[];
  ttExOptions: string[]; // ✅ Added TT EX options
  currencyOptions: string[]; // ✅ Added currency options for Tiền Tốt
  currencySettings: {
    primaryCurrency: string;
    secondaryCurrencies: string[];
    exchangeRates: { [key: string]: number };
    displayFormat: 'symbol' | 'code' | 'both';
    decimalPlaces: number;
    thousandSeparator: string;
    decimalSeparator: string;
  };
}

interface StatsBadgeConfig {
  id: string;
  name: string;
  enabled: boolean;
  query: string;
  color: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("columns");

  // State for editing
  const [editingStatus, setEditingStatus] = React.useState<string | null>(null);
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [editingBank, setEditingBank] = React.useState<{code: string; name: string; logo?: string} | null>(null);
  const [editingAccount, setEditingAccount] = React.useState<{bankCode: string; accountNumber: string; accountHolder: string; phoneSms: string; accountName: string; note: string} | null>(null);
  const [editingPartner, setEditingPartner] = React.useState<string | null>(null);
  const [editingTtEx, setEditingTtEx] = React.useState<string | null>(null); // ✅ Added TT EX editing state
  const [editingCurrency, setEditingCurrency] = React.useState<string | null>(null); // ✅ Added Currency editing state
  
  // New item values
  const [newStatusValue, setNewStatusValue] = React.useState("");
  const [newNoteValue, setNewNoteValue] = React.useState("");
  const [newBankValue, setNewBankValue] = React.useState({code: "", name: "", logo: ""});
  const [newAccountValue, setNewAccountValue] = React.useState({bankCode: "", accountNumber: "", accountHolder: "", phoneSms: "", accountName: "", note: ""});
  const [newPartnerValue, setNewPartnerValue] = React.useState("");
  const [newTtExValue, setNewTtExValue] = React.useState(""); // ✅ Added TT EX new value state
  const [newCurrencyCode, setNewCurrencyCode] = React.useState(""); // Currency code (USD, VND...)
  const [newCurrencySymbol, setNewCurrencySymbol] = React.useState(""); // Currency symbol ($, ₫...)
  
  // Currency settings state (for System tab)
  const [newSystemCurrencyCode, setNewSystemCurrencyCode] = React.useState("");
  const [newExchangeRate, setNewExchangeRate] = React.useState("");

  // Fetch settings
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/settings'],
    staleTime: 30000,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SystemSettings>) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('k_loading_token') || localStorage.getItem('auth_token') || localStorage.getItem('employee_token')}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ad-accounts'] });
      toast({ title: 'Cài đặt đã được cập nhật - Các dropdown sẽ tự động cập nhật' });
    },
    onError: (error: any) => {
      console.error('❌ Settings update error:', error);
      toast({ 
        title: 'Lỗi cập nhật cài đặt', 
        description: error?.message || 'Vui lòng thử lại',
        variant: 'destructive' 
      });
    },
  });

  const handleStatusUpdate = (field: keyof SystemSettings, value: any) => {
    updateSettingsMutation.mutate({ [field]: value });
  };

  // Status functions
  const addStatusOption = () => {
    if (!newStatusValue.trim()) return;
    const currentOptions = settings?.statusOptions || [];
    handleStatusUpdate('statusOptions', [...currentOptions, newStatusValue.trim()]);
    setNewStatusValue('');
  };

  const removeStatusOption = (index: number) => {
    const currentOptions = settings?.statusOptions || [];
    const updated = currentOptions.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('statusOptions', updated);
  };

  const updateStatusOption = (index: number, value: string) => {
    const currentOptions = settings?.statusOptions || [];
    const updated = [...currentOptions];
    updated[index] = value;
    handleStatusUpdate('statusOptions', updated);
    setEditingStatus(null);
  };

  // Note card functions
  const addNoteCard = () => {
    if (!newNoteValue.trim()) return;
    const current = settings?.noteCards || [];
    handleStatusUpdate('noteCards', [...current, newNoteValue.trim()]);
    setNewNoteValue('');
  };

  const removeNoteCard = (index: number) => {
    const current = settings?.noteCards || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('noteCards', updated);
  };

  const updateNoteCard = (index: number, value: string) => {
    const current = settings?.noteCards || [];
    const updated = [...current];
    updated[index] = value;
    handleStatusUpdate('noteCards', updated);
    setEditingNote(null);
  };

  // Bank settings functions
  const addBankSetting = () => {
    if (!newBankValue.code.trim() || !newBankValue.name.trim()) return;
    const current = settings?.bankSettings || [];
    handleStatusUpdate('bankSettings', [...current, {
      code: newBankValue.code.trim().toUpperCase(),
      name: newBankValue.name.trim(),
      logo: newBankValue.logo.trim() || newBankValue.code.trim().toLowerCase()
    }]);
    setNewBankValue({code: "", name: "", logo: ""});
  };

  const removeBankSetting = (index: number) => {
    const current = settings?.bankSettings || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('bankSettings', updated);
  };

  const updateBankSetting = (index: number, field: 'code' | 'name' | 'logo', value: string) => {
    const current = settings?.bankSettings || [];
    const updated = [...current];
    updated[index] = {...updated[index], [field]: value};
    handleStatusUpdate('bankSettings', updated);
    setEditingBank(null);
  };

  // Account settings functions
  const addAccountSetting = () => {
    if (!newAccountValue.bankCode.trim() || !newAccountValue.accountNumber.trim() || !newAccountValue.accountHolder.trim()) return;
    const current = settings?.accountSettings || [];
    handleStatusUpdate('accountSettings', [...current, {
      bankCode: newAccountValue.bankCode.trim(),
      accountNumber: newAccountValue.accountNumber.trim(),
      accountHolder: newAccountValue.accountHolder.trim(),
      phoneSms: newAccountValue.phoneSms.trim(),
      accountName: newAccountValue.accountName.trim(),
      note: newAccountValue.note.trim()
    }]);
    setNewAccountValue({bankCode: "", accountNumber: "", accountHolder: "", phoneSms: "", accountName: "", note: ""});
  };

  const removeAccountSetting = (index: number) => {
    const current = settings?.accountSettings || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('accountSettings', updated);
  };

  const updateAccountSetting = (index: number, field: 'bankCode' | 'accountNumber' | 'accountHolder' | 'phoneSms' | 'accountName' | 'note', value: string) => {
    const current = settings?.accountSettings || [];
    const updated = [...current];
    updated[index] = {...updated[index], [field]: value};
    handleStatusUpdate('accountSettings', updated);
    setEditingAccount(null);
  };

  // Partner functions
  const addPartner = () => {
    if (!newPartnerValue.trim()) return;
    const current = settings?.partners || [];
    handleStatusUpdate('partners', [...current, newPartnerValue.trim()]);
    setNewPartnerValue('');
  };

  const removePartner = (index: number) => {
    const current = settings?.partners || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('partners', updated);
  };

  const updatePartner = (index: number, value: string) => {
    const current = settings?.partners || [];
    const updated = [...current];
    updated[index] = value;
    handleStatusUpdate('partners', updated);
    setEditingPartner(null);
  };

  // TT EX functions
  const addTtEx = () => {
    if (!newTtExValue.trim()) return;
    const current = settings?.ttExOptions || [];
    handleStatusUpdate('ttExOptions', [...current, newTtExValue.trim()]);
    setNewTtExValue('');
  };

  const removeTtEx = (index: number) => {
    const current = settings?.ttExOptions || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('ttExOptions', updated);
  };

  const updateTtEx = (index: number, value: string) => {
    const current = settings?.ttExOptions || [];
    const updated = [...current];
    updated[index] = value;
    handleStatusUpdate('ttExOptions', updated);
    setEditingTtEx(null);
  };

  // Currency Options management functions (for Tiền Tốt tab)
  const addCurrencyOption = () => {
    if (!newCurrencyCode.trim() || !newCurrencySymbol.trim()) return;
    const current = settings?.currencyOptions || [];
    const newOption = {
      code: newCurrencyCode.trim().toUpperCase(),
      symbol: newCurrencySymbol.trim()
    };
    handleStatusUpdate('currencyOptions', [...current, newOption]);
    setNewCurrencyCode('');
    setNewCurrencySymbol('');
  };

  const removeCurrencyOption = (index: number) => {
    const current = settings?.currencyOptions || [];
    const updated = current.filter((_: any, i: number) => i !== index);
    handleStatusUpdate('currencyOptions', updated);
  };

  const updateCurrencyOption = (index: number, field: 'code' | 'symbol', value: string) => {
    const current = settings?.currencyOptions || [];
    const updated = [...current];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    handleStatusUpdate('currencyOptions', updated);
    setEditingCurrency(null);
  };

  // Currency management functions
  const addCurrency = () => {
    if (!newCurrencyCode.trim() || !newExchangeRate.trim()) return;
    const current = settings?.currencySettings || {
      primaryCurrency: 'VND',
      secondaryCurrencies: [],
      exchangeRates: {},
      displayFormat: 'symbol',
      decimalPlaces: 0,
      thousandSeparator: ',',
      decimalSeparator: '.'
    };
    
    const updatedSettings = {
      ...current,
      secondaryCurrencies: [...current.secondaryCurrencies, newCurrencyCode.trim().toUpperCase()],
      exchangeRates: {
        ...current.exchangeRates,
        [newCurrencyCode.trim().toUpperCase()]: parseFloat(newExchangeRate)
      }
    };
    
    handleStatusUpdate('currencySettings', updatedSettings);
    setNewCurrencyCode('');
    setNewExchangeRate('');
  };

  const removeCurrency = (currencyCode: string) => {
    const current = settings?.currencySettings || {
      primaryCurrency: 'VND',
      secondaryCurrencies: [],
      exchangeRates: {},
      displayFormat: 'symbol',
      decimalPlaces: 0,
      thousandSeparator: ',',
      decimalSeparator: '.'
    };
    
    const updatedSettings = {
      ...current,
      secondaryCurrencies: current.secondaryCurrencies.filter(c => c !== currencyCode),
      exchangeRates: Object.fromEntries(
        Object.entries(current.exchangeRates).filter(([key]) => key !== currencyCode)
      )
    };
    
    handleStatusUpdate('currencySettings', updatedSettings);
  };

  const updateCurrencyFormat = (field: string, value: any) => {
    const current = settings?.currencySettings || {
      primaryCurrency: 'VND',
      secondaryCurrencies: [],
      exchangeRates: {},
      displayFormat: 'symbol',
      decimalPlaces: 0,
      thousandSeparator: ',',
      decimalSeparator: '.'
    };
    
    const updatedSettings = {
      ...current,
      [field]: value
    };
    
    handleStatusUpdate('currencySettings', updatedSettings);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Cài đặt hệ thống</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Cài đặt hệ thống</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="columns">
            <Palette className="h-4 w-4 mr-2" />
            Cài đặt cột
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Thống kê
          </TabsTrigger>
          <TabsTrigger value="system">
            <Database className="h-4 w-4 mr-2" />
            Hệ thống
          </TabsTrigger>
        </TabsList>

        {/* Column Settings - Table Format */}
        <TabsContent value="columns" className="space-y-6">
          {/* Trạng thái tài khoản Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Trạng thái tài khoản</span>
              </CardTitle>
              <CardDescription>
                Quản lý các lựa chọn trạng thái cho tài khoản quảng cáo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Thêm trạng thái mới..."
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStatusOption()}
                  className="flex-1"
                />
                <Button onClick={addStatusOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Tên trạng thái</div>
                    <div className="col-span-3">Loại</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.statusOptions?.map((status: string, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-6">
                          {editingStatus === status ? (
                            <Input 
                              defaultValue={status}
                              onBlur={(e) => updateStatusOption(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateStatusOption(index, e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{status}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline" className="text-xs">
                            {status === 'Hoạt động' ? 'Hoạt động' : 
                             status === 'Tạm dừng' ? 'Tạm dừng' : 'Khác'}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingStatus(status)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeStatusOption(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note thẻ Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Note thẻ</span>
              </CardTitle>
              <CardDescription>
                Ghi chú cho các loại thẻ thanh toán
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Thêm note thẻ mới..."
                  value={newNoteValue}
                  onChange={(e) => setNewNoteValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNoteCard()}
                  className="flex-1"
                />
                <Button onClick={addNoteCard}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Tên note</div>
                    <div className="col-span-3">Nhóm</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.noteCards?.map((note: string, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-6">
                          {editingNote === note ? (
                            <Input 
                              defaultValue={note}
                              onBlur={(e) => updateNoteCard(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateNoteCard(index, e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{note}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline" className="text-xs">
                            {note.includes('KAG') ? 'KAG' : 
                             note.includes('HDG') ? 'HDG' : 'Khác'}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingNote(note)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeNoteCard(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Settings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Cài đặt Ngân hàng</span>
              </CardTitle>
              <CardDescription>
                Danh sách ngân hàng và thông tin logo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Input 
                  placeholder="Mã ngân hàng (VD: ACB)"
                  value={newBankValue.code}
                  onChange={(e) => setNewBankValue(prev => ({...prev, code: e.target.value}))}
                  className="flex-1"
                />
                <Input 
                  placeholder="Tên ngân hàng đầy đủ"
                  value={newBankValue.name}
                  onChange={(e) => setNewBankValue(prev => ({...prev, name: e.target.value}))}
                  className="flex-1"
                />
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Logo (tùy chọn)"
                    value={newBankValue.logo}
                    onChange={(e) => setNewBankValue(prev => ({...prev, logo: e.target.value}))}
                    className="flex-1"
                  />
                  <Button onClick={addBankSetting}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-2">Mã NH</div>
                    <div className="col-span-6">Tên đầy đủ</div>
                    <div className="col-span-1">Logo</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.bankSettings?.map((bank: {code: string; name: string; logo?: string}, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-2">
                          {editingBank && editingBank.code === bank.code ? (
                            <Input 
                              defaultValue={bank.code}
                              onBlur={(e) => updateBankSetting(index, 'code', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateBankSetting(index, 'code', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <Badge variant="outline" className="font-mono text-xs">
                              {bank.code}
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-6">
                          {editingBank && editingBank.code === bank.code ? (
                            <Input 
                              defaultValue={bank.name}
                              onBlur={(e) => updateBankSetting(index, 'name', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateBankSetting(index, 'name', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                            />
                          ) : (
                            <span className="font-medium">{bank.name}</span>
                          )}
                        </div>
                        <div className="col-span-1">
                          <Badge variant="secondary" className="text-xs">
                            {bank.logo || bank.code.toLowerCase()}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingBank(bank)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeBankSetting(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Cài Đặt STK</span>
              </CardTitle>
              <CardDescription>
                Danh sách số tài khoản ngân hàng và thông tin liên quan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={newAccountValue.bankCode}
                    onValueChange={(value) => setNewAccountValue(prev => ({...prev, bankCode: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn NH" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings?.bankSettings?.map((bank: {code: string; name: string}) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      )) || []}
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Số tài khoản"
                    value={newAccountValue.accountNumber}
                    onChange={(e) => setNewAccountValue(prev => ({...prev, accountNumber: e.target.value}))}
                  />
                  <Input 
                    placeholder="Chủ tài khoản"
                    value={newAccountValue.accountHolder}
                    onChange={(e) => setNewAccountValue(prev => ({...prev, accountHolder: e.target.value}))}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Input 
                    placeholder="Phone SMS"
                    value={newAccountValue.phoneSms}
                    onChange={(e) => setNewAccountValue(prev => ({...prev, phoneSms: e.target.value}))}
                  />
                  <Input 
                    placeholder="Tài khoản"
                    value={newAccountValue.accountName}
                    onChange={(e) => setNewAccountValue(prev => ({...prev, accountName: e.target.value}))}
                  />
                  <Input 
                    placeholder="Ghi chú"
                    value={newAccountValue.note}
                    onChange={(e) => setNewAccountValue(prev => ({...prev, note: e.target.value}))}
                  />
                  <Button onClick={addAccountSetting}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-1">Mã NH</div>
                    <div className="col-span-2">STK</div>
                    <div className="col-span-2">Chủ TK</div>
                    <div className="col-span-1">Phone SMS</div>
                    <div className="col-span-2">Tài khoản</div>
                    <div className="col-span-1">Note</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.accountSettings?.map((account: {bankCode: string; accountNumber: string; accountHolder: string; phoneSms: string; accountName: string; note: string}, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-1">
                          {editingAccount && editingAccount.bankCode === account.bankCode && editingAccount.accountNumber === account.accountNumber ? (
                            <Select
                              defaultValue={account.bankCode}
                              onValueChange={(value) => updateAccountSetting(index, 'bankCode', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {settings?.bankSettings?.map((bank: {code: string; name: string}) => (
                                  <SelectItem key={bank.code} value={bank.code}>
                                    {bank.code}
                                  </SelectItem>
                                )) || []}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="font-mono text-xs">
                              {account.bankCode}
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-2">
                          {editingAccount && editingAccount.bankCode === account.bankCode && editingAccount.accountNumber === account.accountNumber ? (
                            <Input 
                              defaultValue={account.accountNumber}
                              onBlur={(e) => updateAccountSetting(index, 'accountNumber', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateAccountSetting(index, 'accountNumber', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono text-sm">{account.accountNumber}</span>
                          )}
                        </div>
                        <div className="col-span-2">
                          {editingAccount && editingAccount.bankCode === account.bankCode && editingAccount.accountNumber === account.accountNumber ? (
                            <Input 
                              defaultValue={account.accountHolder}
                              onBlur={(e) => updateAccountSetting(index, 'accountHolder', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateAccountSetting(index, 'accountHolder', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                            />
                          ) : (
                            <span className="font-medium">{account.accountHolder}</span>
                          )}
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm">{account.phoneSms}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm">{account.accountName}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-xs text-gray-500">{account.note}</span>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingAccount(account)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeAccountSetting(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Đối tác Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Đối tác</span>
              </CardTitle>
              <CardDescription>
                Danh sách đối tác/nhóm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Thêm đối tác mới..."
                  value={newPartnerValue}
                  onChange={(e) => setNewPartnerValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPartner()}
                  className="flex-1"
                />
                <Button onClick={addPartner}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Tên đối tác</div>
                    <div className="col-span-3">Loại</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.partners?.map((partner: string, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-6">
                          {editingPartner === partner ? (
                            <Input 
                              defaultValue={partner}
                              onBlur={(e) => updatePartner(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updatePartner(index, e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{partner}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline" className="text-xs">
                            Đối tác
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingPartner(partner)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removePartner(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tiền Tốt Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Tiền Tốt</span>
              </CardTitle>
              <CardDescription>
                Danh sách các loại tiền và ký hiệu tiền
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Input 
                  placeholder="Mã tiền (VND, USD...)"
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCurrencyOption()}
                  className="w-48"
                />
                <Input 
                  placeholder="Ký hiệu (₫, $...)"
                  value={newCurrencySymbol}
                  onChange={(e) => setNewCurrencySymbol(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCurrencyOption()}
                  className="w-32"
                />
                <div className="flex-1"></div>
                <Button onClick={addCurrencyOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Mã tiền</div>
                    <div className="col-span-3">Ký hiệu</div>
                    <div className="col-span-3">Loại</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.currencyOptions?.map((currency: any, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-3">
                          {editingCurrency === `${index}-code` ? (
                            <Input 
                              defaultValue={currency?.code || currency}
                              onBlur={(e) => updateCurrencyOption(index, 'code', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateCurrencyOption(index, 'code', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{currency?.code || currency}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          {editingCurrency === `${index}-symbol` ? (
                            <Input 
                              defaultValue={currency?.symbol || ''}
                              onBlur={(e) => updateCurrencyOption(index, 'symbol', e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateCurrencyOption(index, 'symbol', e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-lg">{currency?.symbol || ''}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline" className="text-xs">
                            Tiền tệ
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingCurrency(`${index}-code`)}
                            title="Sửa mã tiền"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingCurrency(`${index}-symbol`)}
                            title="Sửa ký hiệu"
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeCurrencyOption(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TT EX Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>TT EX</span>
              </CardTitle>
              <CardDescription>
                Danh sách tình trạng TT EX
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Thêm trạng thái TT EX mới..."
                  value={newTtExValue}
                  onChange={(e) => setNewTtExValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTtEx()}
                  className="flex-1"
                />
                <Button onClick={addTtEx}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Tên trạng thái</div>
                    <div className="col-span-3">Loại</div>
                    <div className="col-span-2">Thao tác</div>
                  </div>
                </div>
                <div className="divide-y">
                  {settings?.ttExOptions?.map((ttEx: string, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                        <div className="col-span-6">
                          {editingTtEx === ttEx ? (
                            <Input 
                              defaultValue={ttEx}
                              onBlur={(e) => updateTtEx(index, e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  updateTtEx(index, e.currentTarget.value);
                                }
                              }}
                              className="w-full"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{ttEx}</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline" className="text-xs">
                            TT EX
                          </Badge>
                        </div>
                        <div className="col-span-2 flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingTtEx(ttEx)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeTtEx(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Currency Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Cài đặt tiền tệ</span>
              </CardTitle>
              <CardDescription>
                Quản lý tiền tệ chính, phụ và tỷ giá hối đoái
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Currency */}
              <div>
                <h3 className="text-lg font-medium mb-4">Tiền tệ chính</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tiền tệ chính</label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={settings?.currencySettings?.primaryCurrency || 'VND'}
                      onChange={(e) => updateCurrencyFormat('primaryCurrency', e.target.value)}
                    >
                      <option value="VND">VND - Việt Nam Đồng</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Định dạng hiển thị</label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={settings?.currencySettings?.displayFormat || 'symbol'}
                      onChange={(e) => updateCurrencyFormat('displayFormat', e.target.value)}
                    >
                      <option value="symbol">Ký hiệu (₫, $, €)</option>
                      <option value="code">Mã tiền tệ (VND, USD, EUR)</option>
                      <option value="both">Cả hai (₫ VND, $ USD)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Format Settings */}
              <div>
                <h3 className="text-lg font-medium mb-4">Định dạng số</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Số chữ số thập phân</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="4"
                      className="w-full p-2 border rounded-lg"
                      value={settings?.currencySettings?.decimalPlaces || 0}
                      onChange={(e) => updateCurrencyFormat('decimalPlaces', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Dấu phân cách hàng nghìn</label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={settings?.currencySettings?.thousandSeparator || ','}
                      onChange={(e) => updateCurrencyFormat('thousandSeparator', e.target.value)}
                    >
                      <option value=",">Dấu phẩy (,)</option>
                      <option value=".">Dấu chấm (.)</option>
                      <option value=" ">Khoảng trắng ( )</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Dấu thập phân</label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={settings?.currencySettings?.decimalSeparator || '.'}
                      onChange={(e) => updateCurrencyFormat('decimalSeparator', e.target.value)}
                    >
                      <option value=".">Dấu chấm (.)</option>
                      <option value=",">Dấu phẩy (,)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Secondary Currencies */}
              <div>
                <h3 className="text-lg font-medium mb-4">Tiền tệ phụ & Tỷ giá</h3>
                <div className="flex space-x-2 mb-4">
                  <Input 
                    placeholder="Mã tiền tệ (VD: USD, EUR)"
                    value={newCurrencyCode}
                    onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Input 
                    placeholder="Tỷ giá (VD: 24000)"
                    type="number"
                    step="0.01"
                    value={newExchangeRate}
                    onChange={(e) => setNewExchangeRate(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={addCurrency}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm
                  </Button>
                </div>
                
                <div className="border rounded-lg">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                    <div className="grid grid-cols-12 gap-4 font-medium text-sm">
                      <div className="col-span-1">#</div>
                      <div className="col-span-4">Tiền tệ</div>
                      <div className="col-span-4">Tỷ giá (1 {settings?.currencySettings?.primaryCurrency || 'VND'})</div>
                      <div className="col-span-3">Thao tác</div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {(settings?.currencySettings?.secondaryCurrencies || []).map((currency: string, index: number) => (
                      <div key={index} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-1 text-sm text-gray-600">
                            {index + 1}
                          </div>
                          <div className="col-span-4">
                            <Badge variant="secondary">{currency}</Badge>
                          </div>
                          <div className="col-span-4 text-sm">
                            {(settings?.currencySettings?.exchangeRates?.[currency] || 0).toLocaleString('vi-VN')}
                          </div>
                          <div className="col-span-3 flex space-x-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeCurrency(currency)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )) || []}
                    {(!settings?.currencySettings?.secondaryCurrencies || settings.currencySettings.secondaryCurrencies.length === 0) && (
                      <div className="px-4 py-8 text-center text-gray-500">
                        Chưa có tiền tệ phụ nào được thêm
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-lg font-medium mb-4">Xem trước</h3>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Số lớn:</span>
                      <span className="ml-2">
                        {(1234567.89).toLocaleString('vi-VN', {
                          minimumFractionDigits: settings?.currencySettings?.decimalPlaces || 0,
                          maximumFractionDigits: settings?.currencySettings?.decimalPlaces || 0,
                        })} {settings?.currencySettings?.primaryCurrency || 'VND'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Số nhỏ:</span>
                      <span className="ml-2">
                        {(123.45).toLocaleString('vi-VN', {
                          minimumFractionDigits: settings?.currencySettings?.decimalPlaces || 0,
                          maximumFractionDigits: settings?.currencySettings?.decimalPlaces || 0,
                        })} {settings?.currencySettings?.primaryCurrency || 'VND'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình thống kê</CardTitle>
              <CardDescription>
                Tùy chỉnh các badges thống kê hiển thị trên dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <BarChart3 className="h-4 w-4" />
                <AlertDescription>
                  Tính năng này đang được phát triển
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cài đặt hệ thống</CardTitle>
              <CardDescription>
                Cấu hình và bảo trì hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  Tính năng này đang được phát triển
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}