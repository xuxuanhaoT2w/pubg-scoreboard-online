/**
 * GitHub Pages 没有服务端运行时，因此使用 Supabase 的公开 publishable key。
 * 此类 key 会随前端资源发给浏览器，访问权限由 Supabase 的 RLS 策略控制。
 */
export const publicSupabaseConfig = {
  url: 'https://ltwrqzqfjppmjqpbfboj.supabase.co',
  publishableKey: 'sb_publishable_dBAU7UAhRH51kkRD1s1EoA_8pLnPagy',
};
