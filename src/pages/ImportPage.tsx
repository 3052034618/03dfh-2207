import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Database,
  Plus,
  Zap,
  Thermometer,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import type { ImportedFile, CargoType } from '@/types';
import { CARGO_TYPE_LABELS } from '@/types';
import {
  parseCSV,
  parseExcel,
  readFileAsText,
  readFileAsArrayBuffer,
  computeDataSummary,
} from '@/utils/parsers';

function detectFileType(filename: string): ImportedFile['type'] {
  const lower = filename.toLowerCase();
  if (lower.includes('door')) return 'door';
  if (lower.includes('gps')) return 'gps';
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls'))
    return 'temperature';
  return 'temperature';
}

function statusBadge(status: ImportedFile['status']) {
  switch (status) {
    case 'done':
      return <span className="badge-success"><CheckCircle className="w-3 h-3 mr-1" />完成</span>;
    case 'parsing':
      return <span className="badge-info"><Clock className="w-3 h-3 mr-1 animate-pulse" />解析中</span>;
    case 'error':
      return <span className="badge-danger"><AlertCircle className="w-3 h-3 mr-1" />错误</span>;
    default:
      return <span className="badge-warning"><Clock className="w-3 h-3 mr-1" />等待</span>;
  }
}

function fileTypeIcon(type: ImportedFile['type']) {
  switch (type) {
    case 'door':
      return <FileText className="w-4 h-4 text-[#FF8C00]" />;
    case 'gps':
      return <FileText className="w-4 h-4 text-[#9B59B6]" />;
    default:
      return <FileSpreadsheet className="w-4 h-4 text-[#00D4FF]" />;
  }
}

const FILE_TYPE_LABELS: Record<ImportedFile['type'], string> = {
  temperature: '温湿度',
  humidity: '湿度',
  door: '门开关',
  gps: 'GPS轨迹',
};

export default function ImportPage() {
  const navigate = useNavigate();
  const {
    project,
    deviceRecords,
    transportParams,
    importedFiles,
    dataSummary,
    setProject,
    setTransportParams,
    addImportedFile,
    updateImportedFile,
    removeImportedFile,
    setDataSummary,
    setDeviceRecords,
    loadDemoData,
  } = useProjectStore();

  const [projectName, setProjectName] = useState(project?.name ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateProject = useCallback(() => {
    if (!projectName.trim()) return;
    setProject({
      id: crypto.randomUUID(),
      name: projectName.trim(),
      cargoType: transportParams.cargoType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [projectName, transportParams.cargoType, setProject]);

  const handleLoadDemo = useCallback(() => {
    loadDemoData();
    navigate('/review');
  }, [loadDemoData, navigate]);

  const processFile = useCallback(
    async (file: File) => {
      const fileType = detectFileType(file.name);
      const fileId = crypto.randomUUID();

      const importedFile: ImportedFile = {
        id: fileId,
        name: file.name,
        type: fileType,
        status: 'parsing',
        recordCount: 0,
      };
      addImportedFile(importedFile);

      try {
        let records;

        if (file.name.endsWith('.csv')) {
          const text = await readFileAsText(file);
          records = parseCSV(text);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const buffer = await readFileAsArrayBuffer(file);
          records = parseExcel(buffer);
        } else {
          updateImportedFile(fileId, {
            status: 'error',
            error: '不支持的文件格式',
          });
          return;
        }

        if (!records.length) {
          updateImportedFile(fileId, {
            status: 'error',
            error: '未能解析出有效记录',
          });
          return;
        }

        updateImportedFile(fileId, {
          status: 'done',
          recordCount: records.length,
        });

        setDeviceRecords([...deviceRecords, ...records]);

        const allRecords = [...deviceRecords, ...records];
        const summary = computeDataSummary(allRecords);
        if (summary) setDataSummary(summary);
      } catch {
        updateImportedFile(fileId, {
          status: 'error',
          error: '文件解析失败',
        });
      }
    },
    [deviceRecords, addImportedFile, updateImportedFile, setDeviceRecords, setDataSummary]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach(processFile);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const handleDeleteFile = useCallback(
    (id: string) => {
      removeImportedFile(id);
    },
    [removeImportedFile]
  );

  const canProceed = deviceRecords.length > 0;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-[#00D4FF]" />
            <h2 className="font-mono text-base font-medium text-[#E8EDF2]">项目名称</h2>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="输入项目名称，例如：上海→北京 冻肉运输 #SH-BJ-20250615"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <button className="btn-primary flex items-center gap-1.5" onClick={handleCreateProject}>
              <Plus className="w-4 h-4" />
              创建项目
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={handleLoadDemo}>
              <Zap className="w-4 h-4" />
              加载演示数据
            </button>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-[#00D4FF]" />
            <h2 className="font-mono text-base font-medium text-[#E8EDF2]">文件上传</h2>
          </div>

          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${
                isDragging
                  ? 'border-[#00D4FF] bg-[#00D4FF]/5'
                  : 'border-[#243447] hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-[#00D4FF]' : 'text-[#5A6B7C]'}`} />
            <p className="text-sm text-[#8899AA] mb-1">
              拖拽文件到此处，或 <span className="text-[#00D4FF]">点击上传</span>
            </p>
            <p className="text-xs text-[#5A6B7C]">支持 CSV、XLSX、XLS 格式</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              multiple
              onChange={handleFileInput}
            />
          </div>

          {importedFiles.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#243447]">
                    <th className="text-left py-2 px-3 text-[#5A6B7C] font-medium">文件名</th>
                    <th className="text-left py-2 px-3 text-[#5A6B7C] font-medium">类型</th>
                    <th className="text-left py-2 px-3 text-[#5A6B7C] font-medium">状态</th>
                    <th className="text-right py-2 px-3 text-[#5A6B7C] font-medium">记录数</th>
                    <th className="text-right py-2 px-3 text-[#5A6B7C] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {importedFiles.map((f) => (
                    <tr key={f.id} className="border-b border-[#243447]/50 hover:bg-[#1C2D40]/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {fileTypeIcon(f.type)}
                          <span className="text-[#E8EDF2] truncate max-w-[240px]">{f.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#8899AA]">{FILE_TYPE_LABELS[f.type]}</td>
                      <td className="py-2.5 px-3">{statusBadge(f.status)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#8899AA]">
                        {f.recordCount > 0 ? f.recordCount.toLocaleString() : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          className="p-1 rounded hover:bg-[#FF3366]/10 text-[#5A6B7C] hover:text-[#FF3366] transition-colors"
                          onClick={() => handleDeleteFile(f.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-[#00D4FF]" />
            <h2 className="font-mono text-base font-medium text-[#E8EDF2]">运输参数</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-mono text-[#5A6B7C] uppercase tracking-wider">温区参数</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">温度下限 (℃)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={transportParams.tempLower}
                    onChange={(e) => setTransportParams({ tempLower: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">温度上限 (℃)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={transportParams.tempUpper}
                    onChange={(e) => setTransportParams({ tempUpper: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-mono text-[#5A6B7C] uppercase tracking-wider">货品信息</h3>
              <div>
                <label className="text-xs text-[#8899AA] mb-1 block">货品类型</label>
                <select
                  className="select-field"
                  value={transportParams.cargoType}
                  onChange={(e) => setTransportParams({ cargoType: e.target.value as CargoType })}
                >
                  {(Object.entries(CARGO_TYPE_LABELS) as [CargoType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-mono text-[#5A6B7C] uppercase tracking-wider">运输节点</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">始发港/站</label>
                  <input
                    type="text"
                    className="input-field"
                    value={transportParams.originPort}
                    onChange={(e) => setTransportParams({ originPort: e.target.value })}
                    placeholder="例：上海洋山港"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">目的港/站</label>
                  <input
                    type="text"
                    className="input-field"
                    value={transportParams.destPort}
                    onChange={(e) => setTransportParams({ destPort: e.target.value })}
                    placeholder="例：北京京铁物流园"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">装车时间</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={transportParams.loadTime}
                    onChange={(e) => setTransportParams({ loadTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8899AA] mb-1 block">卸车时间</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={transportParams.unloadTime}
                    onChange={(e) => setTransportParams({ unloadTime: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {dataSummary && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#00D4FF]" />
              <h2 className="font-mono text-base font-medium text-[#E8EDF2]">数据概览</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="text-xs text-[#5A6B7C] mb-2">时间范围</div>
                <div className="font-mono text-sm text-[#E8EDF2]">
                  {new Date(dataSummary.timeRange.start).toLocaleDateString('zh-CN')}
                </div>
                <div className="font-mono text-xs text-[#8899AA]">
                  → {new Date(dataSummary.timeRange.end).toLocaleDateString('zh-CN')}
                </div>
              </div>

              <div className="card p-4">
                <div className="text-xs text-[#5A6B7C] mb-2">总记录数</div>
                <div className="font-mono text-2xl text-[#00D4FF]">
                  {dataSummary.totalRecords.toLocaleString()}
                </div>
              </div>

              <div className="card p-4">
                <div className="text-xs text-[#5A6B7C] mb-2">采样间隔</div>
                <div className="font-mono text-2xl text-[#E8EDF2]">{dataSummary.samplingInterval}</div>
              </div>

              <div className="card p-4">
                <div className="text-xs text-[#5A6B7C] mb-2">数据完整度</div>
                <div className="font-mono text-2xl text-[#0AFFCE]">{dataSummary.completeness}%</div>
                <div className="mt-2 h-1.5 bg-[#0F1923] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0AFFCE] rounded-full transition-all duration-500"
                    style={{ width: `${dataSummary.completeness}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="flex justify-end pb-6">
          <button
            className={`
              px-6 py-3 rounded-lg font-mono text-sm font-medium transition-all duration-200
              ${
                canProceed
                  ? 'bg-[#00D4FF] text-[#0F1923] hover:bg-[#00D4FF]/80 glow-accent'
                  : 'bg-[#1A2838] text-[#5A6B7C] cursor-not-allowed border border-[#243447]'
              }
            `}
            disabled={!canProceed}
            onClick={() => canProceed && navigate('/review')}
          >
            进入复盘标注 →
          </button>
        </div>
      </div>
    </div>
  );
}
