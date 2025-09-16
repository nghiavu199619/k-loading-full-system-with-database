import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';

interface ExpenseData {
  month: string;
  amount: number;
}

interface ExpenseChartProps {
  data: ExpenseData[];
  title?: string;
}

export function ExpenseChart({ data, title = "Xu hướng chi tiêu theo tháng" }: ExpenseChartProps) {
  const maxAmount = useMemo(() => {
    return Math.max(...data.map(d => d.amount));
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <div className="flex space-x-2">
          <button className="text-sm text-primary hover:bg-primary/10 px-3 py-1 rounded">
            6 tháng
          </button>
          <button className="text-sm text-muted-foreground hover:bg-muted px-3 py-1 rounded">
            1 năm
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{item.month}</span>
                <span className="text-sm text-muted-foreground currency">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
