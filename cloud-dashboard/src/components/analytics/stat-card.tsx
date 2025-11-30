import { Minus, TrendDown, TrendUp } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel = '전 기간 대비',
  icon: Icon,
}: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const TrendIcon = isPositive ? TrendUp : isNegative ? TrendDown : Minus;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-black">{value}</p>
          </div>
          {Icon && (
            <div className="rounded-md bg-gray-100 p-2">
              <Icon size={20} className="text-gray-600" weight="duotone" />
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-4 flex items-center gap-1 text-sm">
            <TrendIcon
              size={16}
              className={cn(
                isPositive && 'text-green-500',
                isNegative && 'text-red-500',
                !isPositive && !isNegative && 'text-gray-400'
              )}
            />
            <span
              className={cn(
                'font-medium',
                isPositive && 'text-green-600',
                isNegative && 'text-red-600',
                !isPositive && !isNegative && 'text-gray-500'
              )}
            >
              {isPositive && '+'}
              {change}%
            </span>
            <span className="text-gray-500">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
