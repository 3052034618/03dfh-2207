import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload,
  LineChart,
  FileText,
  Snowflake,
  Database,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';

const NAV_ITEMS = [
  { path: '/import', label: '导入记录', icon: Upload },
  { path: '/review', label: '复盘标注', icon: LineChart },
  { path: '/report', label: '报告生成', icon: FileText },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const project = useProjectStore((s) => s.project);
  const deviceRecords = useProjectStore((s) => s.deviceRecords);

  const currentIdx = NAV_ITEMS.findIndex((item) => item.path === location.pathname);
  const canNavigate = (path: string) => {
    if (path === '/import') return true;
    if (path === '/review') return deviceRecords.length > 0;
    if (path === '/report') return deviceRecords.length > 0;
    return false;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F1923]">
      <nav className="w-[72px] flex flex-col items-center py-4 bg-[#0A1219] border-r border-[#1C2D40]">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-10 h-10 rounded-lg bg-[#00D4FF]/10 flex items-center justify-center mb-1">
            <Snowflake className="w-5 h-5 text-[#00D4FF]" />
          </div>
          <span className="text-[8px] text-[#5A6B7C] font-mono tracking-wider">COLD</span>
          <span className="text-[8px] text-[#5A6B7C] font-mono tracking-wider">REVIEW</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = location.pathname === item.path;
            const disabled = !canNavigate(item.path);
            const completed = currentIdx > idx;

            return (
              <button
                key={item.path}
                onClick={() => !disabled && navigate(item.path)}
                disabled={disabled}
                className={`
                  relative w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-[#00D4FF]/15 text-[#00D4FF] glow-accent'
                    : completed
                    ? 'text-[#0AFFCE] hover:bg-[#1C2D40]/50'
                    : disabled
                    ? 'text-[#2A3A4A] cursor-not-allowed'
                    : 'text-[#5A6B7C] hover:bg-[#1C2D40]/50 hover:text-[#8899AA]'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[9px] leading-none">{item.label}</span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#00D4FF] rounded-r" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-[#1C2D40] flex items-center justify-center mb-2">
            <Database className="w-4 h-4 text-[#5A6B7C]" />
          </div>
          {project && (
            <div className="text-[8px] text-[#5A6B7C] text-center leading-tight px-1 max-w-[64px] truncate">
              {project.name.substring(0, 6)}
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col">
        {project && (
          <header className="h-12 flex items-center justify-between px-6 bg-[#0A1219]/80 border-b border-[#1C2D40] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-mono font-medium text-[#E8EDF2] tracking-tight truncate max-w-[500px]">
                {project.name}
              </h1>
              <span className="badge-info">{deviceRecords.length} 条记录</span>
            </div>
            <div className="flex items-center gap-2">
              {NAV_ITEMS.map((item, idx) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-1 text-xs ${
                    idx < currentIdx
                      ? 'text-[#0AFFCE]'
                      : idx === currentIdx
                      ? 'text-[#00D4FF]'
                      : 'text-[#5A6B7C]'
                  }`}
                >
                  {idx > 0 && <span className="text-[#243447] mx-1">›</span>}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </header>
        )}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
