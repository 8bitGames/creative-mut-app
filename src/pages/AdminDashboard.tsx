/**
 * Admin Dashboard Page
 * Local analytics dashboard for session and payment statistics
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  DollarSign,
  Users,
  CheckCircle,
  TrendingUp,
  Clock,
  Image,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DashboardStats {
  todaySessions: number;
  todayRevenue: number;
  todaySuccessRate: number;
  totalSessions: number;
  totalRevenue: number;
  totalSuccessRate: number;
  popularFrames: Array<{ frame: string; count: number }>;
  recentSessions: Array<{
    session_id: string;
    start_time: number;
    duration_seconds: number;
    frame_selected: string;
    payment_status: string;
    amount: number;
  }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; sessions: number }>;
}

export function AdminDashboard() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadStats = async () => {
    setLoading(true);
    try {
      // @ts-ignore - Electron API
      if (window.electron?.analytics) {
        // @ts-ignore
        const result = await window.electron.analytics.getDashboardStats();
        if (result.success) {
          setStats(result.stats);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'declined': case 'error': return 'text-red-600';
      case 'cancelled': case 'timeout': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '결제완료';
      case 'declined': return '거절';
      case 'cancelled': return '취소';
      case 'timeout': return '시간초과';
      case 'error': return '오류';
      case 'N/A': return '미결제';
      default: return status;
    }
  };

  return (
    <motion.div
      className="fullscreen bg-gray-100 text-gray-900 p-6 overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScreen('idle')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Button>
          <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Today's Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">오늘 세션</p>
                  <p className="text-2xl font-bold">{stats.todaySessions}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">오늘 매출</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.todayRevenue)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">오늘 성공률</p>
                  <p className="text-2xl font-bold">{stats.todaySuccessRate}%</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Total Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 세션</p>
                  <p className="text-xl font-bold">{stats.totalSessions}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 매출</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 성공률</p>
                  <p className="text-xl font-bold">{stats.totalSuccessRate}%</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Popular Frames & Daily Revenue */}
          <div className="grid grid-cols-2 gap-4">
            {/* Popular Frames */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Image className="w-4 h-4" />
                인기 프레임
              </h3>
              {stats.popularFrames.length > 0 ? (
                <div className="space-y-2">
                  {stats.popularFrames.map((frame, index) => (
                    <div key={frame.frame} className="flex justify-between items-center">
                      <span className="text-sm">
                        {index + 1}. {frame.frame}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        {frame.count}회
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">데이터 없음</p>
              )}
            </Card>

            {/* Daily Revenue */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                일별 매출 (최근 7일)
              </h3>
              {stats.dailyRevenue.length > 0 ? (
                <div className="space-y-2">
                  {stats.dailyRevenue.map((day) => (
                    <div key={day.date} className="flex justify-between items-center">
                      <span className="text-sm">{day.date}</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(day.revenue)} ({day.sessions}건)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">데이터 없음</p>
              )}
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              최근 세션
            </h3>
            {stats.recentSessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">시간</th>
                      <th className="text-left py-2 px-2">세션 ID</th>
                      <th className="text-left py-2 px-2">프레임</th>
                      <th className="text-left py-2 px-2">소요시간</th>
                      <th className="text-left py-2 px-2">결제상태</th>
                      <th className="text-right py-2 px-2">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSessions.map((session) => (
                      <tr key={session.session_id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">{formatTime(session.start_time)}</td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {session.session_id.substring(0, 16)}...
                        </td>
                        <td className="py-2 px-2">{session.frame_selected}</td>
                        <td className="py-2 px-2">{formatDuration(session.duration_seconds)}</td>
                        <td className={`py-2 px-2 font-medium ${getStatusColor(session.payment_status)}`}>
                          {getStatusText(session.payment_status)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {session.amount > 0 ? formatCurrency(session.amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">최근 세션 없음</p>
            )}
          </Card>

          {/* Hourly Distribution */}
          {stats.hourlyDistribution.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">시간대별 이용량 (오늘)</h3>
              <div className="flex items-end gap-1 h-32">
                {Array.from({ length: 24 }, (_, hour) => {
                  const data = stats.hourlyDistribution.find(h => h.hour === hour);
                  const count = data?.count || 0;
                  const maxCount = Math.max(...stats.hourlyDistribution.map(h => h.count), 1);
                  const height = (count / maxCount) * 100;

                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                        title={`${hour}시: ${count}건`}
                      />
                      {hour % 4 === 0 && (
                        <span className="text-xs text-gray-400 mt-1">{hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          데이터를 불러올 수 없습니다.
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-400">
        Press F12 to exit dashboard • ESC to return to idle screen
      </div>
    </motion.div>
  );
}
