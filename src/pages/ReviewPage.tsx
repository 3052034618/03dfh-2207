import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  Line,
  Scatter,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import {
  LineChart,
  Tag,
  Clock,
  Edit3,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { Annotation, AnomalyType } from '@/types';
import { ANOMALY_TYPE_LABELS, ANOMALY_TYPE_COLORS } from '@/types';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function formatTs(ts: string) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

const ANOMALY_TYPES = Object.keys(ANOMALY_TYPE_LABELS) as AnomalyType[];

function AnnotationModal({
  onSave,
  onCancel,
}: {
  onSave: (type: AnomalyType, basis: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<AnomalyType>('insufficient_precool');
  const [basis, setBasis] = useState('');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1A2838] border border-[#243447] rounded-lg p-5 w-[360px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono text-[#E8EDF2]">新增异常标注</h3>
          <button onClick={onCancel} className="text-[#5A6B7C] hover:text-[#E8EDF2]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs text-[#8899AA] mb-1">异常类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AnomalyType)}
          className="select-field mb-3"
        >
          {ANOMALY_TYPES.map((t) => (
            <option key={t} value={t}>
              {ANOMALY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <label className="block text-xs text-[#8899AA] mb-1">判定依据</label>
        <textarea
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
          className="input-field h-20 resize-none mb-4"
          placeholder="请输入异常判定依据..."
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">取消</button>
          <button
            onClick={() => onSave(type, basis)}
            disabled={!basis.trim()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5 inline mr-1" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChartData {
  timestamp: string;
  temperature: number;
  humidity: number;
  doorOpen: boolean;
  index: number;
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const deviceRecords = useProjectStore((s) => s.deviceRecords);
  const transportParams = useProjectStore((s) => s.transportParams);
  const annotations = useProjectStore((s) => s.annotations);
  const addAnnotation = useProjectStore((s) => s.addAnnotation);
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);
  const removeAnnotation = useProjectStore((s) => s.removeAnnotation);
  const setActiveAnnotation = useProjectStore((s) => s.setActiveAnnotation);

  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<AnomalyType>('insufficient_precool');
  const [editBasis, setEditBasis] = useState('');

  const { tempUpper, tempLower } = transportParams;

  const chartData: ChartData[] = deviceRecords.map((r, i) => ({
    ...r,
    index: i,
  }));

  const doorPoints = chartData.filter((d) => d.doorOpen).map((d) => ({ ...d, y: -20 }));

  const handleChartClick = useCallback(
    (e: any) => {
      if (!e?.activePayload?.[0]?.payload?.index !== undefined) return;
      const idx = e.activePayload[0].payload.index as number;
      if (selectionStart === null) {
        setSelectionStart(idx);
        setSelectionEnd(null);
      } else if (selectionEnd === null) {
        const end = idx < selectionStart ? selectionStart : idx;
        const start = idx < selectionStart ? idx : selectionStart;
        setSelectionStart(start);
        setSelectionEnd(end);
        setShowModal(true);
      } else {
        setSelectionStart(idx);
        setSelectionEnd(null);
        setShowModal(false);
      }
    },
    [selectionStart, selectionEnd]
  );

  const handleSaveAnnotation = (type: AnomalyType, basis: string) => {
    if (selectionStart === null || selectionEnd === null) return;
    const startTs = deviceRecords[selectionStart].timestamp;
    const endTs = deviceRecords[selectionEnd].timestamp;
    const duration = Math.round(
      (new Date(endTs).getTime() - new Date(startTs).getTime()) / 60000
    );
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      type,
      startTime: startTs,
      endTime: endTs,
      duration,
      basis: basis.trim(),
    };
    addAnnotation(annotation);
    setSelectionStart(null);
    setSelectionEnd(null);
    setShowModal(false);
  };

  const handleCancelAnnotation = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setShowModal(false);
  };

  const startEdit = (a: Annotation) => {
    setEditingId(a.id);
    setEditType(a.type);
    setEditBasis(a.basis);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    updateAnnotation(id, { type: editType, basis: editBasis });
    setEditingId(null);
  };

  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    const isAnomaly =
      payload.temperature > tempUpper || payload.temperature < tempLower;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isAnomaly ? 3 : 2}
        fill={isAnomaly ? '#FF3366' : '#00D4FF'}
        stroke="none"
      />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload as ChartData;
    return (
      <div className="bg-[#1A2838] border border-[#243447] rounded p-2 text-xs">
        <p className="text-[#8899AA]">{formatTs(d.timestamp)}</p>
        <p className="text-[#00D4FF]">温度: {d.temperature}℃</p>
        <p className="text-[#0AFFCE]">湿度: {d.humidity}%</p>
        <p className={d.doorOpen ? 'text-[#FF3366]' : 'text-[#5A6B7C]'}>
          门状态: {d.doorOpen ? '开启' : '关闭'}
        </p>
      </div>
    );
  };

  const selectionStartTs =
    selectionStart !== null ? deviceRecords[selectionStart]?.timestamp : undefined;
  const selectionEndTs =
    selectionEnd !== null ? deviceRecords[selectionEnd]?.timestamp : undefined;

  return (
    <div className="flex h-full relative">
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <LineChart className="w-4 h-4 text-[#00D4FF]" />
          <h2 className="text-sm font-mono text-[#E8EDF2]">温控时序复盘</h2>
          {selectionStart !== null && selectionEnd === null && (
            <span className="badge-info">已选起点，请点击终点</span>
          )}
        </div>

        <div className="flex-1 bg-[#0F1923] rounded-lg border border-[#243447] p-3 relative min-h-0">
          {showModal && (
            <AnnotationModal
              onSave={handleSaveAnnotation}
              onCancel={handleCancelAnnotation}
            />
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              onClick={handleChartClick}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#1C2D40" strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTs}
                stroke="#5A6B7C"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#5A6B7C"
                tick={{ fontSize: 10 }}
                domain={['auto', 'auto']}
                label={{
                  value: '℃',
                  position: 'insideTopLeft',
                  fill: '#5A6B7C',
                  fontSize: 10,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceArea
                y1={tempLower}
                y2={tempUpper}
                fill="#0AFFCE"
                fillOpacity={0.05}
              />
              <ReferenceLine
                y={tempUpper}
                stroke="#FF3366"
                strokeDasharray="6 3"
                label={{ value: `${tempUpper}℃`, fill: '#FF3366', fontSize: 10 }}
              />
              <ReferenceLine
                y={tempLower}
                stroke="#FF8C00"
                strokeDasharray="6 3"
                label={{ value: `${tempLower}℃`, fill: '#FF8C00', fontSize: 10 }}
              />
              {annotations.map((a) => (
                <ReferenceArea
                  key={a.id}
                  x1={a.startTime}
                  x2={a.endTime}
                  fill={ANOMALY_TYPE_COLORS[a.type]}
                  fillOpacity={0.15}
                  stroke={ANOMALY_TYPE_COLORS[a.type]}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              ))}
              {selectionStartTs && selectionEndTs && !showModal && (
                <ReferenceArea
                  x1={selectionStartTs}
                  x2={selectionEndTs}
                  fill="#00D4FF"
                  fillOpacity={0.1}
                  stroke="#00D4FF"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                />
              )}
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#00D4FF"
                strokeWidth={1.5}
                dot={renderDot}
                activeDot={{ r: 4, fill: '#00D4FF' }}
                name="温度"
              />
              <Scatter
                data={doorPoints}
                dataKey="y"
                fill="#FF3366"
                shape="circle"
                r={3}
                name="开门"
              />
              <Brush
                dataKey="timestamp"
                tickFormatter={formatTs}
                stroke="#243447"
                fill="#0A1219"
                height={30}
                travellerWidth={4}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-3">
          <button onClick={() => navigate('/import')} className="btn-secondary">
            ← 返回导入
          </button>
          <button
            onClick={() => navigate('/report')}
            disabled={annotations.length === 0}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            生成报告 →
          </button>
        </div>
      </div>

      <div className="w-[320px] bg-[#0A1219] border-l border-[#1C2D40] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1C2D40]">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-mono text-[#E8EDF2]">异常标注</h3>
            <span className="badge-info">{annotations.length}</span>
          </div>
          <button
            onClick={() => {
              setSelectionStart(null);
              setSelectionEnd(null);
              setShowModal(false);
            }}
            className="text-[#5A6B7C] hover:text-[#00D4FF]"
            title="重置选区"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {annotations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[#5A6B7C] text-xs">
              <AlertTriangle className="w-6 h-6 mb-2" />
              <span>点击图表选择时间范围</span>
              <span>添加异常标注</span>
            </div>
          )}
          {annotations.map((a) => (
            <div
              key={a.id}
              className="bg-[#1A2838] border border-[#243447] rounded-lg p-3"
              onMouseEnter={() => setActiveAnnotation(a)}
              onMouseLeave={() => setActiveAnnotation(null)}
            >
              {editingId === a.id ? (
                <>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AnomalyType)}
                    className="select-field mb-2"
                  >
                    {ANOMALY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ANOMALY_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={editBasis}
                    onChange={(e) => setEditBasis(e.target.value)}
                    className="input-field h-14 resize-none mb-2"
                  />
                  <div className="flex gap-1 justify-end">
                    <button onClick={cancelEdit} className="btn-secondary text-xs py-1 px-2">
                      <X className="w-3 h-3" />
                    </button>
                    <button onClick={() => saveEdit(a.id)} className="btn-primary text-xs py-1 px-2">
                      <Save className="w-3 h-3" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ANOMALY_TYPE_COLORS[a.type] }}
                    />
                    <span className="text-xs font-medium text-[#E8EDF2]">
                      {ANOMALY_TYPE_LABELS[a.type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#5A6B7C] mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTs(a.startTime)} ~ {formatTs(a.endTime)}</span>
                  </div>
                  <div className="text-[10px] text-[#8899AA] mb-1.5">
                    持续 {formatDuration(a.duration)}
                  </div>
                  <p className="text-[10px] text-[#8899AA] line-clamp-2 mb-2">{a.basis}</p>
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => startEdit(a)}
                      className="text-[#5A6B7C] hover:text-[#00D4FF] p-1"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeAnnotation(a.id)}
                      className="text-[#5A6B7C] hover:text-[#FF3366] p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
