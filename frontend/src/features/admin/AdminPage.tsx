import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { reportsApi } from '../../services/reports';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'dismissed'>('pending');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['admin-reports', activeTab],
      queryFn: ({ pageParam }) => reportsApi.getReports(activeTab, pageParam),
      getNextPageParam: (last) => last.next_cursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'resolved' | 'dismissed' }) =>
      reportsApi.updateReport(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  const allReports = data?.pages.flatMap((p) => p.reports) ?? [];

  const handleResolve = (id: number, status: 'resolved' | 'dismissed') => {
    resolveMutation.mutate({ id, status });
  };

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-5xl">🔒</span>
        <p className="text-gray-500 dark:text-gray-400">Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🛡️</span>
        <h1 className="text-2xl font-bold dark:text-white">Quản lý báo cáo</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
        {(['pending', 'resolved', 'dismissed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'pending' ? 'Chờ duyệt' : tab === 'resolved' ? 'Đã xử lý' : 'Đã bỏ qua'}
          </button>
        ))}
      </div>

      {/* Report list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {isError && (
        <p className="text-center text-red-500 py-8">Không tải được báo cáo. Vui lòng thử lại.</p>
      )}

      {!isLoading && allReports.length === 0 && (
        <div className="text-center text-gray-400 py-12 flex flex-col items-center gap-2">
          <span className="text-4xl">📭</span>
          <p>Không có báo cáo nào</p>
        </div>
      )}

      <div className="space-y-3">
        {allReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onResolve={handleResolve}
            isResolving={resolveMutation.isPending}
          />
        ))}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
          >
            {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Report card ────────────────────────────────────────────────────────────────
interface ReportCardProps {
  report: {
    id: number;
    target_type: string;
    target_id: number;
    reason: string;
    status: string;
    created_at: string;
    reporter: { id: number; username: string };
    content?: string | null;
  };
  onResolve: (id: number, status: 'resolved' | 'dismissed') => void;
  isResolving: boolean;
}

function ReportCard({ report, onResolve, isResolving }: ReportCardProps) {
  const targetLabel: Record<string, string> = {
    post: 'Bài viết',
    comment: 'Bình luận',
    user: 'Người dùng',
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    dismissed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  const statusLabel: Record<string, string> = {
    pending: 'Chờ duyệt',
    resolved: 'Đã xử lý',
    dismissed: 'Đã bỏ qua',
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}p trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h trước`;
    return `${Math.floor(hrs / 24)}d trước`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[report.status]}`}>
              {statusLabel[report.status]}
            </span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {targetLabel[report.target_type] ?? report.target_type} #{report.target_id}
            </span>
            <span className="text-xs text-gray-400">bởi @{report.reporter.username}</span>
            <span className="text-xs text-gray-400">{timeAgo(report.created_at)}</span>
          </div>
        </div>

        {report.status === 'pending' && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onResolve(report.id, 'resolved')}
              disabled={isResolving}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
            >
              Xử lý
            </button>
            <button
              onClick={() => onResolve(report.id, 'dismissed')}
              disabled={isResolving}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-xs rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              Bỏ qua
            </button>
          </div>
        )}
      </div>

      {/* Content preview */}
      {report.content && (
        <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 border border-gray-100 dark:border-dark-border">
          <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Nội dung bị báo cáo</p>
          <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3 whitespace-pre-wrap">
            {report.content}
          </p>
        </div>
      )}

      {/* Reason */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Lý do báo cáo</p>
        <p className="text-sm text-gray-700 dark:text-gray-200">{report.reason}</p>
      </div>
    </motion.div>
  );
}
