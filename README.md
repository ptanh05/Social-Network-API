# SocialNet — Mạng xã hội

Ứng dụng mạng xã hội với bảng tin cá nhân, khám phá bài viết, tương tác và thông báo.

## Kiến trúc

```
Social-Network-API/
├── api/                        # Backend — Express + TypeScript
│   ├── index.js                 # Vercel entry (re-export từ dist/)
│   ├── dist/                    # Compiled JS (do not edit trực tiếp)
│   ├── src/
│   │   ├── index.ts             # Tất cả API routes + middleware + auth
│   │   ├── types/index.ts       # Prisma client + Auth types
│   │   ├── lib/                 # bcrypt, jwt, utils
│   │   ├── db/index.ts          # DB schema SQL
│   │   ├── middleware/           # rateLimit, validate, auth
│   │   ├── routes/              # (reserved cho tương lai)
│   │   └── validators/          # Schema validation
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── prisma.config.ts     # Prisma config
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                    # Frontend — React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx              # Routing + providers
│   │   ├── features/
│   │   │   ├── admin/            # AdminPage — quản lý reports
│   │   │   ├── auth/             # LoginPage, RegisterPage
│   │   │   ├── bookmarks/        # BookmarksPage
│   │   │   ├── explore/         # ExplorePage (topic filter)
│   │   │   ├── feed/             # FeedPage, CreatePostForm, PostCard
│   │   │   ├── notifications/    # NotificationsPage
│   │   │   ├── posts/            # PostDetailPage, CommentItem
│   │   │   ├── profile/          # ProfilePage (followers/following tabs)
│   │   │   ├── search/           # SearchPage
│   │   │   └── settings/         # SettingsPage
│   │   ├── components/
│   │   │   ├── layout/           # Navbar, Sidebar, BottomNav, MainLayout
│   │   │   └── ui/               # Avatar, TopicBadge, TopicSelector, Skeleton, Toast, NotificationBell
│   │   ├── context/              # AuthContext, ThemeContext, ToastContext
│   │   ├── hooks/                # useInfiniteScroll, useRefreshToken
│   │   ├── services/             # API client + typed endpoints
│   │   └── validators/           # Zod schemas + useFormValidator hook
│   └── vite.config.ts
│
├── vercel.json                 # Vercel routing + CORS headers
└── .env                        # Biến môi trường
```

## Tính năng

### Người dùng
- Đăng ký / Đăng nhập (JWT access + refresh token)
- Tạo, chỉnh sửa, xóa bài viết với topics & hashtags
- Thích / Bỏ thích bài viết
- Bình luận bài viết
- Follow / Unfollow người dùng
- Bookmark bài viết
- Tìm kiếm bài viết và người dùng
- Trang cá nhân với thống kê (posts, followers, following)
- Chỉnh sửa profile (username, ngày sinh, avatar)
- Đổi mật khẩu / Xóa tài khoản
- Preferences — chọn topics yêu thích để cá nhân hóa bảng tin

### Báo cáo & Quản trị
- Báo cáo bài viết (nút "⋯" → modal báo cáo)
- Trang Admin (`/admin`) — xem, xử lý/bỏ qua reports
- Icon 🛡️ admin trên Navbar, Sidebar, mobile menu

### Giao diện
- Dark mode / Light mode
- Responsive mobile (bottom nav + sidebar)
- Infinite scroll cursor-based
- Toast notifications
- Loading skeletons
- Toggle show/hide password (login/register)

### Backend
- PostgreSQL (Neon) — Prisma ORM
- JWT authentication (access: 10 phút, refresh: 7 ngày)
- Input validation với Zod
- Rate limiting (chống spam)
- Manual CORS — không dùng package ngoài
- 10 topics mặc định

## Cài đặt

### 1. Cài dependencies

```bash
# Root
cd api && npm install
cd ../frontend && npm install
```

### 2. Biến môi trường

**`.env`** (root project):

```env
# Database — Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# JWT
SECRET_KEY=your-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10

# Frontend
VITE_API_BASE_URL=https://your-domain.vercel.app/api/v1
```

### 3. Chạy local

```bash
# Backend (port 3001)
cd api
npm run dev

# Frontend (port 5173)
cd frontend
npm run dev
```

> Vite proxy tự động chuyển `/api/*` → `http://localhost:3001`

### 4. Deploy lên Vercel

1. Kết nối GitHub repo → Vercel Dashboard
2. Thêm Environment Variables trên Vercel:

| Name | Value | Environments |
|------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` | Production, Preview, Development |
| `SECRET_KEY` | `chuỗi bí mật ≥32 ký tự` | Production, Preview, Development |
| `ALGORITHM` | `HS256` | Production, Preview, Development |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10` | Production, Preview, Development |
| `VITE_API_BASE_URL` | `https://your-project.vercel.app/api/v1` | Production |

Vercel tự nhận `vercel.json` và build:
- Backend: `cd api && npm install && npm run build` → `prisma generate + tsc` → `api/index.js`
- Frontend: `cd frontend && npm install && npm run build` → `vite build`
- Rewrite: `/api/(.*)` → `api/index.js`, `/*` → `frontend/dist/index.html`

## API Reference

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/auth/register` | Đăng ký |
| POST | `/api/v1/auth/login` | Đăng nhập → access + refresh token |
| POST | `/api/v1/auth/refresh` | Làm mới access token |
| POST | `/api/v1/auth/logout` | Đăng xuất (revoke refresh tokens) |

### Users
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/users/me` | Thông tin user hiện tại |
| PUT | `/api/v1/users/me` | Cập nhật profile |
| DELETE | `/api/v1/users/me` | Xóa tài khoản |
| GET | `/api/v1/users/{id}` | User theo ID |
| GET | `/api/v1/users/{id}/profile` | Profile + thống kê |
| GET | `/api/v1/users/{id}/posts/` | Bài viết của user |
| GET | `/api/v1/users/search?q=` | Tìm kiếm users |
| POST | `/api/v1/users/me/change-password` | Đổi mật khẩu |

### Posts
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/posts/feed` | Bảng tin (có feed score) |
| GET | `/api/v1/posts/explore` | Khám phá (lọc topic, cursor pagination) |
| GET | `/api/v1/posts/search?q=` | Tìm kiếm bài viết |
| GET | `/api/v1/posts/trending/hashtags` | Hashtags trending |
| GET | `/api/v1/posts/{id}` | Chi tiết bài viết |
| POST | `/api/v1/posts/` | Tạo bài viết |
| PUT | `/api/v1/posts/{id}` | Chỉnh sửa bài viết |
| DELETE | `/api/v1/posts/{id}` | Xóa bài viết |
| GET | `/api/v1/posts/{id}/comments/` | Danh sách bình luận |
| POST | `/api/v1/posts/{id}/comments/` | Tạo bình luận |

### Likes
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/likes/posts/{id}/like/` | Thích |
| DELETE | `/api/v1/likes/posts/{id}/like/` | Bỏ thích |
| GET | `/api/v1/likes/posts/{id}/status/` | Trạng thái thích |

### Follows
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/follows/users/{id}/follow/` | Follow |
| DELETE | `/api/v1/follows/users/{id}/follow/` | Unfollow |
| GET | `/api/v1/follows/users/{id}/followers/` | Danh sách followers |
| GET | `/api/v1/follows/users/{id}/following/` | Danh sách following |
| GET | `/api/v1/follows/users/{id}/status/` | Trạng thái follow |

### Topics
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/topics/` | Danh sách 10 topics mặc định |

### Notifications
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/notifications/` | Danh sách thông báo |
| GET | `/api/v1/notifications/unread-count` | Số thông báo chưa đọc |
| PUT | `/api/v1/notifications/{id}/read` | Đánh dấu đã đọc |
| PUT | `/api/v1/notifications/read-all` | Đánh dấu tất cả đã đọc |

### Bookmarks
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/bookmarks/` | Danh sách bookmark |
| POST | `/api/v1/bookmarks/posts/{id}/` | Bookmark bài viết |
| DELETE | `/api/v1/bookmarks/posts/{id}/` | Bỏ bookmark |

### Preferences
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/preferences/users/me/preferences` | Lấy topics yêu thích |
| PUT | `/api/v1/preferences/users/me/preferences` | Cập nhật topics yêu thích |

### Reports
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/reports/` | Gửi báo cáo (user) |
| GET | `/api/v1/reports/` | Danh sách reports (admin) |
| PUT | `/api/v1/reports/{id}` | Xử lý / bỏ qua report (admin) |

## Công nghệ

### Backend
| Công nghệ | Mô tả |
|-----------|-------|
| Express | HTTP server |
| TypeScript | Type safety |
| Prisma v7 + pg | Database ORM + connection pool |
| JWT (jsonwebtoken) | Access + refresh token |
| bcryptjs | Password hashing |
| Zod | Schema validation |

### Frontend
| Công nghệ | Mô tả |
|-----------|-------|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| React Router v6 | Routing |
| React Query v5 | Data fetching + caching |
| Axios | HTTP client |
| Zod | Form validation |

### Infrastructure
| Công nghệ | Mô tả |
|-----------|-------|
| Vercel | Hosting (serverless + CDN) |
| Neon PostgreSQL | Database |
| Prisma Migrate | Schema migrations |

## Các bước tiếp theo

- [ ] Upload ảnh bài viết + avatar (S3 presigned URL)
- [ ] Real-time notifications (SSE/WebSocket — chưa hoạt động trên serverless)
- [ ] Refresh token rotation
- [ ] Swagger API documentation
- [ ] Infinite scroll cho profile posts
