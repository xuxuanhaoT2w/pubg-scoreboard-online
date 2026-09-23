import { Router } from 'express';
import { getSupabaseConfig } from '../supabase-config';

const router = Router();

// API 路由示例
router.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from Express + Vite!',
    timestamp: new Date().toISOString(),
  });
});

router.post('/api/data', (req, res) => {
  const requestData = req.body;
  res.json({
    success: true,
    data: requestData,
    receivedAt: new Date().toISOString(),
  });
});

// 健康检查接口
router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.COZE_PROJECT_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Supabase 公开配置：前端用 anon key 直连读写 + 订阅实时变更
// anon key 受 RLS 保护，只能配合公开策略访问房间数据，安全上靠不可猜的房间 UUID 隔离
router.get('/api/supabase-config', (req, res) => {
  try {
    const { url, anonKey } = getSupabaseConfig();
    res.json({ enabled: true, url, anonKey });
  } catch {
    res.status(503).json({
      enabled: false,
      message: '实时同步服务未配置（Supabase 未开通）',
    });
  }
});

export default router;
