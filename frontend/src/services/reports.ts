import { api } from '../lib/api';

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type ReportTargetType = 'post' | 'comment' | 'user';

export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter: { id: number; username: string; email: string };
  content?: string | null;
}

export interface PaginatedReports {
  reports: Report[];
  next_cursor: string | null;
}

export interface CreateReportBody {
  target_type: ReportTargetType;
  target_id: number;
  reason: string;
}

export const reportsApi = {
  createReport: async (body: CreateReportBody): Promise<Report> => {
    const res = await api.post<Report>('/reports', body);
    return res.data;
  },

  getReports: async (status = 'pending', cursor?: string, limit = 20): Promise<PaginatedReports> => {
    const params: Record<string, string> = { status, limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const res = await api.get<PaginatedReports>('/reports', { params });
    return res.data;
  },

  updateReport: async (reportId: number, status: 'resolved' | 'dismissed'): Promise<Report> => {
    const res = await api.put<Report>(`/reports/${reportId}`, { status });
    return res.data;
  },
};
