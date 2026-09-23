import { execSync } from 'node:child_process';

interface SupabaseCreds {
  url: string;
  anonKey: string;
}

let cached: SupabaseCreds | null = null;

/**
 * 获取 Supabase 公开配置（URL + anon key），提供给前端直连读写与 Realtime。
 * 解析顺序：process.env → .env(dotenv) → Python coze_workload_identity。
 * anon key 受 RLS 约束，安全上靠不可猜的房间 UUID 隔离。
 */
export function getSupabaseConfig(): SupabaseCreds {
  if (cached) return cached;

  let url = process.env.COZE_SUPABASE_URL;
  let anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    try {
      const pythonCode = `
try:
    from coze_workload_identity import Client
    c = Client()
    vs = c.get_project_env_vars()
    c.close()
    for v in vs:
        print(f"{v.key}={v.value}")
except Exception as e:
    print(f"# Error: {e}", file=__import__('sys').stderr)
`;
      const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      for (const line of output.split('\n')) {
        const idx = line.indexOf('=');
        if (idx <= 0 || line.startsWith('#')) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key === 'COZE_SUPABASE_URL' && !url) url = value;
        if (key === 'COZE_SUPABASE_ANON_KEY' && !anonKey) anonKey = value;
      }
    } catch {
      // workload identity 不可用时返回空
    }
  }

  if (!url || !anonKey) {
    throw new Error('Supabase 凭据未配置');
  }
  cached = { url, anonKey };
  return cached;
}
