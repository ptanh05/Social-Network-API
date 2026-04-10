// Token refresh is handled automatically by the axios interceptor in lib/api.ts.
// This hook is provided for any additional refresh logic if needed.
export function useRefreshToken() {
  // The refresh token logic is managed by the axios interceptor.
  // When a 401 is received, the interceptor automatically:
  // 1. Attempts to refresh the token using /auth/refresh
  // 2. Updates sessionStorage with new tokens
  // 3. Retries the original request
  // 4. Redirects to login if refresh fails
}