import { create } from 'zustand';
import type {
  DeviceRecord,
  TransportParams,
  Annotation,
  ImportedFile,
  Project,
  DataSummary,
  ReportTemplate,
  CargoType,
  AnomalyType,
} from '@/types';

interface ProjectStore {
  project: Project | null;
  deviceRecords: DeviceRecord[];
  transportParams: TransportParams;
  importedFiles: ImportedFile[];
  dataSummary: DataSummary | null;
  annotations: Annotation[];
  selectedTemplate: ReportTemplate;
  activeAnnotation: Annotation | null;

  setProject: (project: Project) => void;
  setDeviceRecords: (records: DeviceRecord[]) => void;
  addDeviceRecords: (records: DeviceRecord[]) => void;
  setTransportParams: (params: Partial<TransportParams>) => void;
  addImportedFile: (file: ImportedFile) => void;
  updateImportedFile: (id: string, updates: Partial<ImportedFile>) => void;
  removeImportedFile: (id: string) => void;
  setDataSummary: (summary: DataSummary) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setActiveAnnotation: (annotation: Annotation | null) => void;
  setSelectedTemplate: (template: ReportTemplate) => void;
  resetProject: () => void;
  loadDemoData: () => void;
}

const defaultTransportParams: TransportParams = {
  tempLower: -18,
  tempUpper: -15,
  cargoType: 'frozen_meat' as CargoType,
  originPort: '',
  destPort: '',
  loadTime: '',
  unloadTime: '',
};

function generateDemoRecords(): DeviceRecord[] {
  const records: DeviceRecord[] = [];
  const startTime = new Date('2025-06-15T06:00:00');
  const totalMinutes = 48 * 60;

  for (let i = 0; i < totalMinutes; i += 5) {
    const time = new Date(startTime.getTime() + i * 60000);
    let temp = -16.5;
    const hour = time.getHours();

    if (i < 60) {
      temp = -8 + Math.random() * 2;
    } else if (i < 180) {
      temp = -8 + (i - 60) * (-0.05) + Math.random() * 0.5;
    } else if (i > 1200 && i < 1260) {
      temp = -14 + Math.random() * 3;
    } else if (i > 2000 && i < 2100) {
      temp = -12 + Math.random() * 2;
    } else if (i > 2500 && i < 2530) {
      temp = -10 + Math.random() * 2;
    } else {
      temp = -16.5 + Math.sin(i / 120) * 0.8 + (Math.random() - 0.5) * 0.4;
    }

    const doorOpen =
      (i > 1200 && i < 1215) ||
      (i > 2000 && i < 2030) ||
      (i > 2500 && i < 2510) ||
      (i > 2700 && i < 2705);

    records.push({
      timestamp: time.toISOString(),
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round((65 + Math.sin(i / 200) * 10 + Math.random() * 5) * 10) / 10,
      doorOpen,
      latitude: 31.23 + (i / totalMinutes) * 2.5,
      longitude: 121.47 + (i / totalMinutes) * 1.8,
    });
  }

  return records;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  deviceRecords: [],
  transportParams: { ...defaultTransportParams },
  importedFiles: [],
  dataSummary: null,
  annotations: [],
  selectedTemplate: 'customer' as ReportTemplate,
  activeAnnotation: null,

  setProject: (project) => set({ project }),

  setDeviceRecords: (records) => set({ deviceRecords: records }),

  addDeviceRecords: (records) =>
    set((state) => ({ deviceRecords: [...state.deviceRecords, ...records] })),

  setTransportParams: (params) =>
    set((state) => ({
      transportParams: { ...state.transportParams, ...params },
    })),

  addImportedFile: (file) =>
    set((state) => ({ importedFiles: [...state.importedFiles, file] })),

  updateImportedFile: (id, updates) =>
    set((state) => ({
      importedFiles: state.importedFiles.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),

  removeImportedFile: (id) =>
    set((state) => ({
      importedFiles: state.importedFiles.filter((f) => f.id !== id),
    })),

  setDataSummary: (summary) => set({ dataSummary: summary }),

  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),

  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),

  setActiveAnnotation: (annotation) => set({ activeAnnotation: annotation }),

  setSelectedTemplate: (template) => set({ selectedTemplate: template }),

  resetProject: () =>
    set({
      project: null,
      deviceRecords: [],
      transportParams: { ...defaultTransportParams },
      importedFiles: [],
      dataSummary: null,
      annotations: [],
      selectedTemplate: 'customer' as ReportTemplate,
      activeAnnotation: null,
    }),

  loadDemoData: () => {
    const records = generateDemoRecords();
    const project: Project = {
      id: crypto.randomUUID(),
      name: '上海→北京 冻肉运输 #SH-BJ-20250615',
      cargoType: 'frozen_meat' as CargoType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const summary: DataSummary = {
      timeRange: {
        start: records[0].timestamp,
        end: records[records.length - 1].timestamp,
      },
      totalRecords: records.length,
      samplingInterval: '5分钟',
      missingSegments: 2,
      completeness: 99.2,
    };

    const demoAnnotations: Annotation[] = [
      {
        id: crypto.randomUUID(),
        type: 'insufficient_precool' as AnomalyType,
        startTime: records[0].timestamp,
        endTime: records[35].timestamp,
        duration: 180,
        basis: '装车前集装箱预冷仅至-8℃，未达到-15℃要求，导致前3小时温度持续偏高',
      },
      {
        id: crypto.randomUUID(),
        type: 'prolonged_door_open' as AnomalyType,
        startTime: records[240].timestamp,
        endTime: records[243].timestamp,
        duration: 15,
        basis: '中途停靠服务区时开门15分钟，温度上升至-11℃，超出温区上限',
      },
      {
        id: crypto.randomUUID(),
        type: 'yard_power_outage' as AnomalyType,
        startTime: records[400].timestamp,
        endTime: records[420].timestamp,
        duration: 100,
        basis: '堆场等候卸货期间制冷设备断电约100分钟，温度回升至-12℃',
      },
    ];

    set({
      project,
      deviceRecords: records,
      transportParams: {
        tempLower: -18,
        tempUpper: -15,
        cargoType: 'frozen_meat',
        originPort: '上海洋山港',
        destPort: '北京京铁物流园',
        loadTime: '2025-06-15T06:00',
        unloadTime: '2025-06-17T06:00',
      },
      importedFiles: [
        {
          id: crypto.randomUUID(),
          name: 'recool_temp_humidity.csv',
          type: 'temperature',
          status: 'done',
          recordCount: records.length,
        },
        {
          id: crypto.randomUUID(),
          name: 'recool_door_events.csv',
          type: 'door',
          status: 'done',
          recordCount: 8,
        },
        {
          id: crypto.randomUUID(),
          name: 'recool_gps_track.csv',
          type: 'gps',
          status: 'done',
          recordCount: records.length,
        },
      ],
      dataSummary: summary,
      annotations: demoAnnotations,
      selectedTemplate: 'customer' as ReportTemplate,
      activeAnnotation: null,
    });
  },
}));
