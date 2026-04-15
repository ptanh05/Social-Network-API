import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Tên đăng nhập là bắt buộc'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

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

export const postSchema = z.object({
  content: z.string()
    .min(1, 'Nội dung là bắt buộc')
    .max(2000, 'Nội dung tối đa 2000 ký tự'),
  topic_ids: z.array(z.number()).optional(),
});

export const commentSchema = z.object({
  content: z.string()
    .min(1, 'Nội dung bình luận là bắt buộc')
    .max(1000, 'Bình luận tối đa 1000 ký tự'),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
  new_password: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  confirm_password: z.string().min(1, 'Xác nhận mật khẩu là bắt buộc'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirm_password'],
});

export const updateProfileSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{4,20}$/, 'Username: 4-20 ký tự, chỉ a-z, 0-9, dấu gạch dưới')
    .optional(),
  date_of_birth: z.string().optional(),
  avatar_url: z.string().url('URL không hợp lệ').optional().or(z.literal('')),
});

// Inferred types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
