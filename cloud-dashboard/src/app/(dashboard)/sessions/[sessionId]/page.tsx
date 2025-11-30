import {
  CaretLeft,
  CheckCircle,
  Clock,
  CreditCard,
  Image as ImageIcon,
  QrCode,
  Spinner,
  VideoCamera,
  Warning,
  XCircle,
} from '@phosphor-icons/react/dist/ssr';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/actions/sessions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

const statusStyles = {
  completed: { badge: 'bg-green-100 text-green-700', icon: CheckCircle },
  processing: { badge: 'bg-blue-100 text-blue-700', icon: Spinner },
  failed: { badge: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { badge: 'bg-gray-100 text-gray-700', icon: XCircle },
  started: { badge: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

export default async function SessionDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    notFound();
  }

  // Cast session fields to their expected types for rendering
  const videoUrl = session.processedVideoUrl as string | null;
  const thumbUrl = session.thumbnailUrl as string | null;
  const qrUrl = session.qrCodeUrl as string | null;
  const rawImages = session.rawImagesUrl as string[] | null;
  const sessionMetadata = session.metadata as Record<string, unknown> | null;

  const status = (session.status as keyof typeof statusStyles) || 'started';
  const styles = statusStyles[status] || statusStyles.started;
  const StatusIcon = styles.icon;

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCurrency = (amount: string | null, currency: string | null) => {
    if (!amount) return '-';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency || 'KRW',
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sessions">
              <CaretLeft size={20} />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-black font-mono">{session.sessionCode}</h1>
              <Badge className={cn('rounded-full', styles.badge)}>
                <StatusIcon size={14} className="mr-1" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">Session ID: {session.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock size={20} />
                타임라인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">시작</span>
                <span>{formatDate(session.startedAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">완료</span>
                <span>{formatDate(session.completedAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">처리 시간</span>
                <span>{formatDuration(session.processingTimeMs)}</span>
              </div>
              {session.processingMode && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">처리 모드</span>
                  <Badge variant="outline">{session.processingMode}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <VideoCamera size={20} />
                미디어
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Thumbnail */}
              {thumbUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">썸네일</p>
                  <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={thumbUrl}
                      alt="세션 썸네일"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Video URL */}
              {videoUrl && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">처리된 영상</span>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    영상 보기
                  </a>
                </div>
              )}

              {/* QR Code */}
              {qrUrl && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <QrCode size={16} />
                    QR 코드
                  </span>
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    QR 보기
                  </a>
                </div>
              )}

              {/* Raw Images Count */}
              {rawImages && rawImages.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <ImageIcon size={16} />
                    원본 이미지
                  </span>
                  <span>{rawImages.length}장</span>
                </div>
              )}

              {/* No media */}
              {!thumbUrl && !videoUrl && !qrUrl && (
                <div className="py-8 text-center text-gray-400">미디어가 없습니다</div>
              )}
            </CardContent>
          </Card>

          {/* Error Message */}
          {session.errorMessage && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <Warning size={20} />
                  오류
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-red-200">
                  {session.errorMessage}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard size={20} />
                결제
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">금액</span>
                <span className="font-semibold">
                  {formatCurrency(session.paymentAmount, session.currency)}
                </span>
              </div>
              {session.approvalNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">승인번호</span>
                  <span className="font-mono">{session.approvalNumber}</span>
                </div>
              )}
              {session.cardNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">카드</span>
                  <span className="font-mono">{session.cardNumber}</span>
                </div>
              )}
              {session.salesDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">판매일자</span>
                  <span>{session.salesDate}</span>
                </div>
              )}
              {session.transactionMedia && (
                <div className="flex justify-between">
                  <span className="text-gray-500">결제수단</span>
                  <span>{session.transactionMedia}</span>
                </div>
              )}
              {!session.paymentAmount && (
                <div className="py-4 text-center text-gray-400">결제 기록이 없습니다</div>
              )}
            </CardContent>
          </Card>

          {/* Session Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">상세 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">기기 ID</span>
                <Link
                  href={`/machines/${session.machineId}`}
                  className="text-blue-600 hover:underline font-mono"
                >
                  {session.machineId.slice(0, 8)}...
                </Link>
              </div>
              {session.frameId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">프레임</span>
                  <span>{session.frameId}</span>
                </div>
              )}
              {session.deliveryMethod && (
                <div className="flex justify-between">
                  <span className="text-gray-500">전달 방식</span>
                  <Badge variant="outline">{session.deliveryMethod}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          {sessionMetadata && Object.keys(sessionMetadata).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">메타데이터</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded">
                    {JSON.stringify(sessionMetadata, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
