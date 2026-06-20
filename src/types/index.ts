export type CargoType = 'frozen_meat' | 'vaccine_raw' | 'seafood' | 'other';

export type AnomalyType =
  | 'insufficient_precool'
  | 'yard_power_outage'
  | 'door_seal_check'
  | 'prolonged_door_open'
  | 'equipment_false_alarm';

export type ReportTemplate = 'customer' | 'internal_ops' | 'claims';

export type FileStatus = 'pending' | 'parsing' | 'done' | 'error';

export interface DeviceRecord {
  timestamp: string;
  temperature: number;
  humidity: number;
  doorOpen: boolean;
  latitude: number;
  longitude: number;
}

export interface TransportParams {
  tempLower: number;
  tempUpper: number;
  cargoType: CargoType;
  originPort: string;
  destPort: string;
  loadTime: string;
  unloadTime: string;
}

export interface Annotation {
  id: string;
  type: AnomalyType;
  startTime: string;
  endTime: string;
  duration: number;
  basis: string;
}

export interface ReportData {
  templateType: ReportTemplate;
  exceedDuration: number;
  maxDeviation: number;
  anomalyCount: number;
  responsibilityStage: string;
  recommendations: string;
}

export interface ImportedFile {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'door' | 'gps';
  status: FileStatus;
  recordCount: number;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  cargoType: CargoType;
  createdAt: string;
  updatedAt: string;
}

export interface DataSummary {
  timeRange: { start: string; end: string };
  totalRecords: number;
  samplingInterval: string;
  missingSegments: number;
  completeness: number;
}

export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  frozen_meat: '冷冻肉类',
  vaccine_raw: '疫苗原料',
  seafood: '高价值海鲜',
  other: '其他',
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  insufficient_precool: '预冷不足',
  yard_power_outage: '堆场断电',
  door_seal_check: '门封检查',
  prolonged_door_open: '长时间开门',
  equipment_false_alarm: '设备误报',
};

export const ANOMALY_TYPE_COLORS: Record<AnomalyType, string> = {
  insufficient_precool: '#FF8C00',
  yard_power_outage: '#FF3366',
  door_seal_check: '#FFD700',
  prolonged_door_open: '#FF6B35',
  equipment_false_alarm: '#9B59B6',
};

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  customer: '客户版',
  internal_ops: '内部运营版',
  claims: '理赔沟通版',
};

export const REPORT_TEMPLATE_DESC: Record<ReportTemplate, string> = {
  customer: '面向客户，侧重温控达标情况与品质保障，措辞专业温和',
  internal_ops: '面向内部运营，侧重异常根因分析与流程改进建议',
  claims: '面向理赔沟通，侧重责任界定、超限证据与损失评估',
};
