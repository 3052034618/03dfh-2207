import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FileText,
  Settings,
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  Target,
  Printer,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { REPORT_TEMPLATE_LABELS, REPORT_TEMPLATE_DESC } from '@/types';
import type { ReportTemplate } from '@/types';
import { getReportMetrics, generateReport } from '@/utils/reportEngine';

const TEMPLATE_ACCENTS: Record<ReportTemplate, string> = {
  customer: '#00D4FF',
  internal_ops: '#0AFFCE',
  claims: '#FF8C00',
};

const TEMPLATE_ICONS: Record<ReportTemplate, React.ElementType> = {
  customer: FileText,
  internal_ops: Settings,
  claims: Shield,
};

function formatExceedDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const mergedRecords = useProjectStore((s) => s.mergedRecords);
  const transportParams = useProjectStore((s) => s.transportParams);
  const annotations = useProjectStore((s) => s.annotations);
  const selectedTemplate = useProjectStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useProjectStore((s) => s.setSelectedTemplate);

  const metrics = getReportMetrics(mergedRecords, transportParams, annotations);
  const reportText = generateReport(mergedRecords, transportParams, annotations, selectedTemplate);

  const templates: ReportTemplate[] = ['customer', 'internal_ops', 'claims'];

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: '#1A2838', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`温控复盘报告_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#0F1923] p-6 space-y-6">
      <button
        onClick={() => navigate('/review')}
        className="flex items-center gap-2 text-[#5A6B7C] hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        返回复盘标注
      </button>

      <section>
        <h2 className="text-white text-lg font-semibold mb-4">选择报告模板</h2>
        <div className="grid grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const Icon = TEMPLATE_ICONS[tpl];
            const accent = TEMPLATE_ACCENTS[tpl];
            const selected = selectedTemplate === tpl;
            return (
              <button
                key={tpl}
                onClick={() => setSelectedTemplate(tpl)}
                className="relative bg-[#1A2838] rounded-lg p-5 text-left transition-all cursor-pointer"
                style={{
                  border: `2px solid ${selected ? accent : '#243447'}`,
                  boxShadow: selected ? `0 0 20px ${accent}40, 0 0 40px ${accent}20` : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon size={24} style={{ color: accent }} />
                  <span
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: selected ? accent : '#5A6B7C',
                      backgroundColor: selected ? accent : 'transparent',
                    }}
                  >
                    {selected && <span className="w-2 h-2 rounded-full bg-[#0F1923]" />}
                  </span>
                </div>
                <div className="text-white font-medium mb-1">
                  {REPORT_TEMPLATE_LABELS[tpl]}
                </div>
                <div className="text-xs text-[#5A6B7C] leading-relaxed">
                  {REPORT_TEMPLATE_DESC[tpl]}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-white text-lg font-semibold mb-4">关键指标概览</h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            icon={Clock}
            label="超限总时长"
            value={formatExceedDuration(metrics.exceedDuration)}
            valueColor="#FF3366"
          />
          <MetricCard
            icon={TrendingUp}
            label="最大偏差值"
            value={`${metrics.maxDeviation}℃`}
            valueColor="#FF8C00"
          />
          <MetricCard
            icon={AlertTriangle}
            label="异常标注数"
            value={`${metrics.anomalyCount}次`}
            valueColor="#FF8C00"
          />
          <MetricCard
            icon={Target}
            label="责任阶段"
            value={metrics.responsibilityStage}
            valueColor="#00D4FF"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">报告预览</h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[#1A2838] border border-[#243447] text-[#5A6B7C] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Printer size={14} />
              打印
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-[#1A2838] border border-[#243447] text-[#5A6B7C] hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Download size={14} />
              导出PDF
            </button>
          </div>
        </div>
        <div className="bg-[#0A1219] border border-[#243447] rounded-lg p-6">
          <div
            ref={reportRef}
            className="bg-[#1A2838] rounded-lg p-8 font-mono text-sm text-white whitespace-pre-wrap leading-relaxed"
          >
            {reportText}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="bg-[#1A2838] border border-[#243447] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-[#5A6B7C]" />
        <span className="text-xs text-[#5A6B7C]">{label}</span>
      </div>
      <div className="text-2xl font-mono font-bold" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
