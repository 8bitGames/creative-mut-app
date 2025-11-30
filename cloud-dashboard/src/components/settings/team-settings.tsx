'use client';

import { Trash, UserPlus } from '@phosphor-icons/react';
import { useState } from 'react';
import { inviteTeamMember, removeMember, updateMemberRole } from '@/actions/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | null;
}

interface TeamSettingsProps {
  members: TeamMember[];
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export function TeamSettings({ members }: TeamSettingsProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setMessage(null);

    try {
      const result = await inviteTeamMember(email, role);
      setMessage(result.message);
      setEmail('');
    } catch (_error) {
      setMessage('초대 전송에 실패했습니다');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      await updateMemberRole(memberId, newRole);
    } catch (_error) {
      alert('역할 변경에 실패했습니다');
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('이 멤버를 삭제하시겠습니까?')) return;

    try {
      await removeMember(memberId);
    } catch (_error) {
      alert('멤버 삭제에 실패했습니다');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>팀원 초대</CardTitle>
          <CardDescription>조직에 새 멤버를 추가합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">이메일 주소</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div className="w-40 space-y-2">
              <Label htmlFor="role">역할</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="operator">운영자</SelectItem>
                  <SelectItem value="viewer">뷰어</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting}>
                <UserPlus size={16} className="mr-2" />
                {inviting ? '초대 중...' : '초대'}
              </Button>
            </div>
          </form>
          {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>팀 멤버</CardTitle>
          <CardDescription>조직에 {members.length}명의 멤버가 있습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div>
                    <p className="font-medium">사용자 {member.userId.slice(0, 8)}...</p>
                    <p className="text-sm text-gray-500">
                      가입일:{' '}
                      {member.createdAt
                        ? new Date(member.createdAt).toLocaleDateString('ko-KR')
                        : '알 수 없음'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {member.role === 'owner' ? (
                    <Badge className={roleColors.owner}>소유자</Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">관리자</SelectItem>
                        <SelectItem value="operator">운영자</SelectItem>
                        <SelectItem value="viewer">뷰어</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {member.role !== 'owner' && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(member.id)}>
                      <Trash size={16} className="text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="py-4 text-center text-gray-500">아직 팀 멤버가 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>역할 권한</CardTitle>
          <CardDescription>각 역할별 권한 안내</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <Badge className={roleColors.owner}>소유자</Badge>
              <span className="text-gray-600">전체 접근, 결제, 조직 삭제</span>
            </div>
            <div className="flex gap-4">
              <Badge className={roleColors.admin}>관리자</Badge>
              <span className="text-gray-600">기기, 팀, 위치, 설정 관리</span>
            </div>
            <div className="flex gap-4">
              <Badge className={roleColors.operator}>운영자</Badge>
              <span className="text-gray-600">기기 및 세션 조회 및 관리</span>
            </div>
            <div className="flex gap-4">
              <Badge className={roleColors.viewer}>뷰어</Badge>
              <span className="text-gray-600">읽기 전용 접근</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
