'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatusData {
  status: string;
  count: number;
  [key: string]: string | number;
}

interface StatusBreakdownChartProps {
  data: StatusData[];
}

const COLORS: Record<string, string> = {
  completed: '#22c55e',
  processing: '#eab308',
  failed: '#ef4444',
  cancelled: '#9ca3af',
  started: '#3b82f6',
  capturing: '#6366f1',
};

export function StatusBreakdownChart({ data }: StatusBreakdownChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">세션 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-gray-500">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">세션 상태</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="status"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.status] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `${value} (${((value / total) * 100).toFixed(1)}%)`,
                  '세션',
                ]}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const statusLabels: Record<string, string> = {
                    completed: '완료',
                    processing: '처리중',
                    failed: '실패',
                    cancelled: '취소됨',
                    started: '시작됨',
                    capturing: '촬영중',
                  };
                  return statusLabels[value] || value;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
