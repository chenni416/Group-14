import { GitBranch, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  'AI 從會議紀錄自動拆解任務',
  '依成員專長與負載推薦負責人',
  '一鍵產生 Claude Code 可用的 Prompt',
];

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Demo：假裝連接 GitHub，等一下下就直接進入主頁
  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => navigate('/'), 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-gray-900">taskline</span>
            <span className="block text-[11px] text-gray-600">NYCU ATLAB</span>
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">歡迎使用 Taskline</h1>
        <p className="mt-2 text-sm text-gray-500">AI 輔助團隊執行規劃系統，從會議紀錄到交付。</p>

        <ul className="mt-6 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
              {f}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-sm font-medium text-white transition-colors duration-150 hover:bg-neutral-700 disabled:cursor-wait disabled:bg-neutral-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              正在連接 GitHub…
            </>
          ) : (
            <>
              <GitBranch className="h-4 w-4" strokeWidth={2} />
              以 GitHub 登入
            </>
          )}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          第一次使用？以 GitHub 登入即會自動建立帳號
        </p>
      </div>
    </div>
  );
}