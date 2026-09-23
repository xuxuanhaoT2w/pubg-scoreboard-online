type AssetBinding = { fetch(request: Request): Promise<Response> };

interface WorkerEnv {
  ASSETS?: AssetBinding;
  COZE_SUPABASE_URL?: string;
  COZE_SUPABASE_ANON_KEY?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function serveApp(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.ASSETS) return new Response('Static asset binding is not configured', { status: 500 });
  const direct = await env.ASSETS.fetch(request);
  if (direct.status !== 404) return direct;
  const fallback = new URL(request.url);
  fallback.pathname = '/index.html';
  return env.ASSETS.fetch(new Request(fallback, request));
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    if (url.pathname === '/api/supabase-config') {
      if (!env.COZE_SUPABASE_URL || !env.COZE_SUPABASE_ANON_KEY) {
        return json({ enabled: false, message: '实时同步服务未配置（Supabase 未开通）' }, 503);
      }
      return json({ enabled: true, url: env.COZE_SUPABASE_URL, anonKey: env.COZE_SUPABASE_ANON_KEY });
    }
    return serveApp(request, env);
  },
};

export default worker;
