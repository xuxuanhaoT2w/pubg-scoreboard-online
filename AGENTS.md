# AGENTS.md — 开黑计分板（PUBG）

## 项目概览
**桌面网页版** PUBG 固定车队局后零和记账工具，支持**多人实时协同**：队员各自在自己设备上
填写本局击杀/吃鸡，网页通过 Supabase Realtime 即时同步，全员看到同一份结算与累计总分。
击杀分 + 吃鸡分，每局严格零和，总分跨局累计，适合一晚上连续录入多局。

- **技术栈**：Vite 7 + React 19 + TypeScript 5（strict）+ Tailwind CSS 3，Express 作 dev/静态服务
- **数据层**：Supabase（Postgres + Realtime）。前端用 **anon key 直连**读写并订阅
  Postgres 变更；无登录，安全靠不可猜的房间 UUID + RLS（anon 公开策略）
- **凭据**：`COZE_SUPABASE_URL` / `COZE_SUPABASE_ANON_KEY` 由 `server/supabase-config.ts`
  解析（process.env → dotenv → Python `coze_workload_identity`），经 `GET /api/supabase-config`
  安全下发给前端（service_role key 永不下发）
- **构建**：`pnpm build`（`scripts/build.sh`，tsup 编译 server + Vite 构建到 dist）
- **包管理**：仅 pnpm

## 常用命令
- 开发：`pnpm dev`（`scripts/dev.sh`，tsx watch + Vite 中间件，端口取 `$DEPLOY_RUN_PORT`）
- 构建：`pnpm build`；启动：`pnpm start`
- 检查：`pnpm ts-check`（tsc）、`pnpm lint --quiet`
- 表结构：改 `src/storage/database/shared/schema.ts`（drizzle）→ `coze-coding-ai db upgrade`
  （该目录是 db CLI 的模型文件，已在 tsconfig exclude，不参与应用 tsc）

## 目录结构
```
├── public/                     # manifest.webmanifest / sw.js(离线 App Shell，仅 PROD 注册) / icons
├── server/
│   ├── server.ts               # Express 入口（错误处理器必须 4 参数 (err,req,res,next)）
│   ├── vite.ts                 # Vite 中间件：必须 loadConfigFromFile + configFile:false（防 Refresh 双注入）
│   ├── supabase-config.ts      # 解析 Supabase URL/anon key（env→dotenv→python workload identity）
│   └── routes/index.ts         # /api/health、/api/supabase-config 等
├── src/
│   ├── main.tsx                # 入口：Provider 嵌套 + Tab 路由；未进房间→Lobby，支持 ?join=房码 自动加入
│   ├── index.css               # Tailwind + 字体(fonts.googleapis.cn) + 战术风组件类
│   ├── lib/
│   │   ├── types.ts            # Player / Game / PlayerStats（playedAt 为 ISO 字符串）
│   │   ├── scoring.ts          # scoreGame(participantIds,kills,winnerIds) + computeStats(players,games)
│   │   ├── supabase.ts         # 前端 Supabase 客户端 + 房间/队员/对局/草稿 CRUD + subscribeRoom
│   │   └── format.ts           # 分数/时间格式化（接受 string|number|Date）
│   ├── store/app-store.tsx     # 房间制 Context：建房/加入/退出、身份(meId)、实时订阅自动重拉
│   ├── components/
│   │   ├── nav-bar.tsx         # 顶部导航（排行榜/历史/设置 + 主行动「记一局」），props { active, onChange }
│   │   ├── identity-bar.tsx    # 「我是谁」选择条（高亮自己那行）
│   │   ├── toast.tsx           # 全局轻提示（API: toast.success/error/info，非 callable）
│   │   └── confirm-dialog.tsx  # Promise 式二次确认
│   └── pages/
│       ├── lobby-page.tsx      # 入口：创建房间 / 输入6位房码加入
│       ├── record-page.tsx     # 协同记一局：表格填击杀(<input type=number> + ±按钮)/勾吃鸡，
│       │                       # 数据来自共享草稿 drafts 表，右侧 sticky 实时零和预览+累计榜；连录
│       ├── leaderboard-page.tsx# 总分排行（computeStats 派生）
│       ├── history-page.tsx    # 历史明细网格 + 删除（二次确认，云端删除自动回滚）
│       └── settings-page.tsx   # 房间码/邀请链接/复制、队员管理、JSON 导出、退出房间、规则
└── src/storage/database/shared/schema.ts  # drizzle 表定义（rooms/players/games/drafts + health_check）
```

## 数据表（Supabase）
- `rooms(id uuid, name, join_code varchar(8) 唯一房码, created_at)`
- `players(id, room_id FK cascade, name, created_at)`
- `games(id, room_id FK cascade, data jsonb[整局 participantIds/kills/winnerIds/scores], played_at)`
- `drafts(id, room_id FK cascade 唯一, payload jsonb[当前进行中一局的共享草稿], updated_by, updated_at)`
- 四表均 `ENABLE ROW LEVEL SECURITY` + anon 公开 SELECT/INSERT/UPDATE/DELETE 策略，
  并加入 `supabase_realtime` publication（前端 postgres_changes 订阅）

## 核心业务规则（改代码前必读）
1. **击杀分**：n 人参战时，每人头击杀者 `+(n-1)`、其余每人 `-1`；
   玩家 i 击杀分 = `kills[i]*n - 总击杀`。
2. **吃鸡分**：w 人吃鸡（`0 < w < n`）时，吃鸡者 `+5*(n-w)`，未吃鸡者 `-5*w`；
   全员/无人吃鸡不触发。
3. **零和**：每局 scores 之和恒为 0。总分/总击杀/吃鸡次数全部由 games 实时派生
   （`computeStats`），删局即回滚，不存冗余累计值。
4. **协同草稿**：记一局改的是 `drafts` 单行 JSON（participantIds/kills/winnerIds），
   全员实时共享；更新走 **函数式 updater**（`updateDraft(prev => next)`，基于 draftRef
   最新值合并），降低多人同时填写时整包覆盖风险。保存时 commitGame：插入 games 后
   把草稿重置（保留参战人员、击杀清零），便于连录下一局。
5. **删除队员**：有对局记录时禁止（store 抛错，UI 提示先删相关对局）。

## 关键工程注意事项
- **Vite 配置加载**：`server/vite.ts` 禁止直接 `import viteConfig from '../vite.config'`
  （tsx 与 Vite 各加载一次 → react 插件双实例、Refresh 前置代码重复注入
  `inWebWorker already declared`）。必须 `loadConfigFromFile` + `configFile:false`。
- **插件版本**：`@vitejs/plugin-react` 锁定 **v4.x**（peer 支持 vite 7）；v6 需 vite 8，勿升。
- **Express 错误处理器**：必须 4 参数 `(err, req, res, next)`。
- **React 状态纪律**：禁止在 setState updater 内调用其他 setState；副作用放 updater 外。
- **计分函数签名**：`scoreGame(participantIds, kills, winnerIds): Record<id,number>`；
  `computeStats(players, games): PlayerStats[]`（按总分排序）。
- **toast 用法**：`const toast = useToast()` 后调用 `toast.success/error/info(msg)`，
  不要 `toast(msg)`（对象不可调用）。
- **字段 snake_case**：Supabase 列名全 snake_case；应用层 Player/Game 用 camelCase，
  在 `supabase.ts` 的 rowTo* 里映射。
- **字体/资源**：第三方字体走 `fonts.googleapis.cn`（CN 域），`index.css` 顶部 @import。
- **PWA**：SW 仅生产注册（`import.meta.env.DEV` 判断）。
- **桌面交互**：击杀用 `<input type="number" class="kill-input">` 键盘录入 + ±按钮微调；
  宽屏布局 max-w-6xl，录入页右侧结算预览 lg:sticky。

## 设计规范
暗色军事电竞风（PUBG 信号黄 `#f5a623` + 哑光炭黑、Oswald HUD 数字、斜切角战术卡片、
顶部导航），详见根目录 `DESIGN.md`，UI 改动前先读。
