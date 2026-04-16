import { z } from 'zod';
// ─── Auth Schemas ────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
    username: z
        .string()
        .regex(/^[a-zA-Z0-9_]{4,20}$/, 'Username: 4-20 ký tự, chỉ a-z, 0-9, dấu gạch dưới')
        .min(4, 'Username tối thiểu 4 ký tự')
        .max(20, 'Username tối đa 20 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    date_of_birth: z.string().optional(),
});
export const loginSchema = z.object({
    username: z.string().min(1, 'Username là bắt buộc'),
    password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});
export const refreshTokenSchema = z.object({
    refresh_token: z.string().min(1, 'refresh_token là bắt buộc'),
});
// ─── User Schemas ────────────────────────────────────────────────────────────────
export const updateMeSchema = z.object({
    username: z
        .string()
        .regex(/^[a-zA-Z0-9_]{4,20}$/, 'Username: 4-20 ký tự, chỉ a-z, 0-9, dấu gạch dưới')
        .optional(),
    date_of_birth: z.string().optional(),
    avatar_url: z.string().url('URL không hợp lệ').optional().or(z.literal('')),
});
export const changePasswordSchema = z.object({
    current_password: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
    new_password: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
});
// ─── Post Schemas ────────────────────────────────────────────────────────────────
export const createPostSchema = z.object({
    content: z
        .string()
        .min(1, 'Nội dung là bắt buộc')
        .max(5000, 'Nội dung tối đa 5000 ký tự'),
    topic_ids: z.array(z.number()).optional(),
});
export const updatePostSchema = z.object({
    content: z
        .string()
        .min(1, 'Nội dung là bắt buộc')
        .max(5000, 'Nội dung tối đa 5000 ký tự')
        .optional(),
    topic_ids: z.array(z.number()).optional(),
});
export const createCommentSchema = z.object({
    content: z
        .string()
        .min(1, 'Nội dung bình luận là bắt buộc')
        .max(1000, 'Bình luận tối đa 1000 ký tự'),
    parent_id: z.number().optional(),
});
// ─── Preference Schemas ─────────────────────────────────────────────────────────
export const updatePreferencesSchema = z.object({
    topic_ids: z.array(z.number()),
});
// ─── Report Schemas ─────────────────────────────────────────────────────────────
export const createReportSchema = z.object({
    target_type: z.enum(['post', 'comment', 'user']),
    target_id: z.number().positive(),
    reason: z
        .string()
        .min(5, 'Lý do báo cáo tối thiểu 5 ký tự')
        .max(1000, 'Lý do tối đa 1000 ký tự'),
});
export const resolveReportSchema = z.object({
    status: z.enum(['resolved', 'dismissed']),
});
