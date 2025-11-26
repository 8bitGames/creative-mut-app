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
  RefreshCw,
  XCircle,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Database
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
    // Cancellation-related fields
    approval_number?: string;
    sales_date?: string;
    sales_time?: string;
    transaction_media?: string;
    card_number?: string;
  }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; sessions: number }>;
}

interface FlowStatistics {
  sessionsStarted: number;
  frameSelected: number;
  recordingCompleted: number;
  processingCompleted: number;
  paymentAttempted: number;
  paymentApproved: number;
  printCompleted: number;
  frameSelectionRate: number;
  recordingCompletionRate: number;
  processingCompletionRate: number;
  paymentAttemptRate: number;
  paymentSuccessRate: number;
  printCompletionRate: number;
  overallConversionRate: number;
  dropOffPoints: Array<{
    step: string;
    dropped: number;
    dropRate: number;
  }>;
}

export function AdminDashboard() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [flowStats, setFlowStats] = useState<FlowStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [insertingSampleData, setInsertingSampleData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      // @ts-ignore - Electron API
      if (window.electron?.analytics) {
        // @ts-ignore
        const [dashboardResult, flowResult] = await Promise.all([
          window.electron.analytics.getDashboardStats(),
          window.electron.analytics.getFlowStatistics(),
        ]);

        if (dashboardResult.success) {
          setStats(dashboardResult.stats);
          setLastUpdated(new Date());
        }

        if (flowResult.success) {
          setFlowStats(flowResult.stats);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertSampleData = async () => {
    if (!confirm('기존 데이터를 삭제하고 100개의 샘플 데이터를 삽입하시겠습니까?')) {
      return;
    }

    setInsertingSampleData(true);
    try {
      // @ts-ignore - Electron API
      if (window.electron?.analytics?.insertSampleData) {
        // @ts-ignore
        const result = await window.electron.analytics.insertSampleData();
        if (result.success) {
          alert(`샘플 데이터가 삽입되었습니다!\n\n세션 시작: ${result.stats.sessionsStarted}\n프레임 선택: ${result.stats.frameSelected}\n녹화 완료: ${result.stats.recordingCompleted}\n처리 완료: ${result.stats.processingCompleted}\n결제 시도: ${result.stats.paymentAttempted}\n결제 승인: ${result.stats.paymentApproved}\n인쇄 완료: ${result.stats.printCompleted}`);
          await loadStats();
        } else {
          alert('샘플 데이터 삽입에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Failed to insert sample data:', error);
      alert('샘플 데이터 삽입 중 오류가 발생했습니다.');
    } finally {
      setInsertingSampleData(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Handle payment cancellation (무카드 취소)
   */
  const handleCancelPayment = async (session: DashboardStats['recentSessions'][0]) => {
    // Validate required fields for cancellation
    if (!session.approval_number || !session.sales_date || !session.sales_time || !session.transaction_media) {
      setCancelError('취소에 필요한 정보가 부족합니다. (승인번호, 매출일, 매출시간 필요)');
      setTimeout(() => setCancelError(null), 5000);
      return;
    }

    if (!confirm(`${session.amount.toLocaleString()}원 결제를 취소하시겠습니까?\n\n승인번호: ${session.approval_number}\n카드번호: ${session.card_number || 'N/A'}`)) {
      return;
    }

    setCancellingSessionId(session.session_id);
    setCancelError(null);

    try {
      // @ts-ignore - Electron API
      if (window.electron?.payment?.cancelTransaction) {
        // Map transaction_media to transactionType
        // '1' IC → '1', '2' RF/MS → '2', '3' RF(무서명) → '2'
        const transactionType = session.transaction_media === '3' ? '2' : session.transaction_media;

        // @ts-ignore
        const result = await window.electron.payment.cancelTransaction({
          approvalNumber: session.approval_number,
          originalDate: session.sales_date,
          originalTime: session.sales_time,
          amount: session.amount,
          transactionType: transactionType,
        });

        if (result.success) {
          alert('결제가 성공적으로 취소되었습니다.');
          // Reload stats to reflect the cancellation
          await loadStats();
        } else {
          setCancelError(result.error || '결제 취소에 실패했습니다.');
          setTimeout(() => setCancelError(null), 5000);
        }
      } else {
        setCancelError('결제 취소 기능을 사용할 수 없습니다.');
        setTimeout(() => setCancelError(null), 5000);
      }
    } catch (error) {
      console.error('Cancel payment error:', error);
      setCancelError('결제 취소 중 오류가 발생했습니다.');
      setTimeout(() => setCancelError(null), 5000);
    } finally {
      setCancellingSessionId(null);
    }
  };

  /**
   * Check if a session can be cancelled
   */
  const canCancelPayment = (session: DashboardStats['recentSessions'][0]) => {
    return (
      session.payment_status === 'approved' &&
      session.approval_number &&
      session.sales_date &&
      session.sales_time &&
      session.transaction_media
    );
  };

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
            className="flex items-center gap-2 bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
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
            onClick={handleInsertSampleData}
            disabled={insertingSampleData}
            className="flex items-center gap-2 bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
          >
            {insertingSampleData ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            샘플 데이터
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
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

          {/* Flow Statistics - User Journey Funnel */}
          {flowStats && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                사용자 여정 분석
                <span className="text-xs font-normal text-gray-500 ml-2">(전체 기간)</span>
              </h3>

              {/* Vertical Step Flow */}
              <div className="flex flex-col items-center">
                {/* Step 1: Session Start */}
                <div className="w-full max-w-md">
                  <div className="bg-blue-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <span className="font-medium">세션 시작</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.sessionsStarted}</span>
                      <span className="text-sm ml-1">명</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.sessionsStarted > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.sessionsStarted - flowStats.frameSelected > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.sessionsStarted - flowStats.frameSelected} 이탈
                      </span>
                    )}
                  </div>
                )}

                {/* Step 2: Frame Selected */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(60, flowStats.frameSelectionRate)}%` }}>
                  <div className="bg-green-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Image className="w-5 h-5" />
                      <span className="font-medium">프레임 선택</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.frameSelected}</span>
                      <span className="text-sm ml-1">({flowStats.frameSelectionRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.frameSelected > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.frameSelected - flowStats.recordingCompleted > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.frameSelected - flowStats.recordingCompleted} 이탈
                      </span>
                    )}
                  </div>
                )}

                {/* Step 3: Recording Completed */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(50, flowStats.sessionsStarted > 0 ? (flowStats.recordingCompleted / flowStats.sessionsStarted) * 100 : 0)}%` }}>
                  <div className="bg-teal-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <span className="font-medium">녹화 완료</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.recordingCompleted}</span>
                      <span className="text-sm ml-1">({flowStats.recordingCompletionRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.recordingCompleted > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.recordingCompleted - flowStats.processingCompleted > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.recordingCompleted - flowStats.processingCompleted} 이탈
                      </span>
                    )}
                  </div>
                )}

                {/* Step 4: Processing Completed */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(40, flowStats.sessionsStarted > 0 ? (flowStats.processingCompleted / flowStats.sessionsStarted) * 100 : 0)}%` }}>
                  <div className="bg-indigo-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      <span className="font-medium">처리 완료</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.processingCompleted}</span>
                      <span className="text-sm ml-1">({flowStats.processingCompletionRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.processingCompleted > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.processingCompleted - flowStats.paymentAttempted > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.processingCompleted - flowStats.paymentAttempted} 이탈
                      </span>
                    )}
                  </div>
                )}

                {/* Step 5: Payment Attempted */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(35, flowStats.sessionsStarted > 0 ? (flowStats.paymentAttempted / flowStats.sessionsStarted) * 100 : 0)}%` }}>
                  <div className="bg-yellow-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-medium">결제 시도</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.paymentAttempted}</span>
                      <span className="text-sm ml-1">({flowStats.paymentAttemptRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.paymentAttempted > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.paymentAttempted - flowStats.paymentApproved > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.paymentAttempted - flowStats.paymentApproved} 결제 실패
                      </span>
                    )}
                  </div>
                )}

                {/* Step 6: Payment Approved */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(30, flowStats.sessionsStarted > 0 ? (flowStats.paymentApproved / flowStats.sessionsStarted) * 100 : 0)}%` }}>
                  <div className="bg-orange-500 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">결제 승인</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.paymentApproved}</span>
                      <span className="text-sm ml-1">({flowStats.paymentSuccessRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow with drop-off */}
                {flowStats.paymentApproved > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                    {flowStats.paymentApproved - flowStats.printCompleted > 0 && (
                      <span className="text-xs text-red-500 font-medium">
                        -{flowStats.paymentApproved - flowStats.printCompleted} 인쇄 실패
                      </span>
                    )}
                  </div>
                )}

                {/* Step 7: Print Completed */}
                <div className="w-full max-w-md" style={{ width: `${Math.max(25, flowStats.overallConversionRate)}%` }}>
                  <div className="bg-purple-600 text-white rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">인쇄 완료</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{flowStats.printCompleted}</span>
                      <span className="text-sm ml-1">({flowStats.printCompletionRate}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{flowStats.overallConversionRate}%</div>
                  <div className="text-xs text-gray-500">전체 전환율</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{flowStats.sessionsStarted}</div>
                  <div className="text-xs text-gray-500">총 시작</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{flowStats.printCompleted}</div>
                  <div className="text-xs text-gray-500">완료</div>
                </div>
              </div>

              {/* Biggest Drop-off */}
              {flowStats.dropOffPoints.some(d => d.dropped > 0) && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    주요 이탈 구간
                  </h4>
                  <div className="bg-red-50 rounded-lg p-3">
                    {(() => {
                      const biggest = flowStats.dropOffPoints.filter(d => d.dropped > 0).sort((a, b) => b.dropped - a.dropped)[0];
                      return biggest ? (
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-red-700">{biggest.step}</span>
                          <span className="text-red-600 font-bold">-{biggest.dropped}명 ({biggest.dropRate}% 이탈)</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </Card>
          )}

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                최근 세션
              </h3>
              {cancelError && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                  {cancelError}
                </div>
              )}
            </div>
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
                      <th className="text-left py-2 px-2">승인번호</th>
                      <th className="text-right py-2 px-2">금액</th>
                      <th className="text-center py-2 px-2">관리</th>
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
                        <td className="py-2 px-2 font-mono text-xs">
                          {session.approval_number || '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {session.amount > 0 ? formatCurrency(session.amount) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {canCancelPayment(session) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 h-7 px-2"
                              onClick={() => handleCancelPayment(session)}
                              disabled={cancellingSessionId === session.session_id}
                            >
                              {cancellingSessionId === session.session_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  취소
                                </>
                              )}
                            </Button>
                          ) : session.payment_status === 'cancelled' ? (
                            <span className="text-xs text-gray-400">취소됨</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
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
