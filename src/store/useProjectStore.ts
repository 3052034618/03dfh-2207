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
  MergedRecord,
} from '@/types';
import { mergeRecordsByTimestamp, computeDataSummary } from '@/utils/parsers';

interface ProjectStore {
  project: Project | null;
  deviceRecords: DeviceRecord[];
  mergedRecords: MergedRecord[];
  transportParams: TransportParams;
  importedFiles: ImportedFile[];
  dataSummary: DataSummary | null;
  annotations: Annotation[];
  selectedTemplate: ReportTemplate;
  activeAnnotation: Annotation | null;

  setProject: (project: Project) => void;
  setDeviceRecords: (records: DeviceRecord[]) => void;
  addDeviceRecords: (records: DeviceRecord[]) => void;
  removeRecordsByFileId: (fileId: string) => void;
  setTransportParams: (params: Partial<TransportParams>) => void;
  addImportedFile: (file: ImportedFile) => void;
  updateImportedFile: (id: string, updates: Partial<ImportedFile>) => void;
  removeImportedFile: (id: string) => void;
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

function refreshMerged(records: DeviceRecord[]) {
  const merged = mergeRecordsByTimestamp(records);
  const summary = computeDataSummary(records);
  return { mergedRecords: merged, dataSummary: summary };
}

function generateDemoRecords(): DeviceRecord[] {
  const records: DeviceRecord[] = [];
  const startTime = new Date('2025-06-15T06:00:00');
  const totalMinutes = 48 * 60;
  const tempFileId = 'demo-temp-file';
  const doorFileId = 'demo-door-file';
  const gpsFileId = 'demo-gps-file';

  for (let i = 0; i < totalMinutes; i += 5) {
    const time = new Date(startTime.getTime() + i * 60000);
    let temp = -16.5;

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

    records.push({
      id: crypto.randomUUID(),
      fileId: tempFileId,
      timestamp: time.toISOString(),
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round((65 + Math.sin(i / 200) * 10 + Math.random() * 5) * 10) / 10,
    });

    const doorOpen =
      (i > 1200 && i < 1215) ||
      (i > 2000 && i < 2030) ||
      (i > 2500 && i < 2510) ||
      (i > 2700 && i < 2705);

    if (doorOpen || i % 25 === 0) {
      records.push({
        id: crypto.randomUUID(),
        fileId: doorFileId,
        timestamp: time.toISOString(),
        doorOpen,
      });
    }

    if (i % 10 === 0) {
      records.push({
        id: crypto.randomUUID(),
        fileId: gpsFileId,
        timestamp: time.toISOString(),
        latitude: 31.23 + (i / totalMinutes) * 2.5,
        longitude: 121.47 + (i / totalMinutes) * 1.8,
      });
    }
  }

  return records;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  deviceRecords: [],
  mergedRecords: [],
  transportParams: { ...defaultTransportParams },
  importedFiles: [],
  dataSummary: null,
  annotations: [],
  selectedTemplate: 'customer' as ReportTemplate,
  activeAnnotation: null,

  setProject: (project) => set({ project }),

  setDeviceRecords: (records) => {
    const { mergedRecords, dataSummary } = refreshMerged(records);
    set({ deviceRecords: records, mergedRecords, dataSummary });
  },

  addDeviceRecords: (records) => {
    const all = [...get().deviceRecords, ...records];
    const { mergedRecords, dataSummary } = refreshMerged(all);
    set({ deviceRecords: all, mergedRecords, dataSummary });
  },

  removeRecordsByFileId: (fileId) => {
    const all = get().deviceRecords.filter((r) => r.fileId !== fileId);
    const { mergedRecords, dataSummary } = refreshMerged(all);
    set({ deviceRecords: all, mergedRecords, dataSummary });
  },

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

  removeImportedFile: (id) => {
    const state = get();
    const remaining = state.importedFiles.filter((f) => f.id !== id);
    const remainingRecords = state.deviceRecords.filter((r) => r.fileId !== id);
    const { mergedRecords, dataSummary } = refreshMerged(remainingRecords);
    set({
      importedFiles: remaining,
      deviceRecords: remainingRecords,
      mergedRecords,
      dataSummary,
    });
  },

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
      mergedRecords: [],
      transportParams: { ...defaultTransportParams },
      importedFiles: [],
      dataSummary: null,
      annotations: [],
      selectedTemplate: 'customer' as ReportTemplate,
      activeAnnotation: null,
    }),

  loadDemoData: () => {
    const records = generateDemoRecords();
    const { mergedRecords, dataSummary } = refreshMerged(records);
    const project: Project = {
      id: crypto.randomUUID(),
      name: '上海→北京 冻肉运输 #SH-BJ-20250615',
      cargoType: 'frozen_meat' as CargoType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const firstWithTemp = mergedRecords.find((r) => r.temperature !== undefined);
    const startTs = firstWithTemp ? firstWithTemp.timestamp : mergedRecords[0]?.timestamp;

    const demoAnnotations: Annotation[] = [
      {
        id: crypto.randomUUID(),
        type: 'insufficient_precool' as AnomalyType,
        startTime: startTs,
        endTime: mergedRecords[35]?.timestamp || startTs,
        duration: 180,
        basis: '装车前集装箱预冷仅至-8℃，未达到-15℃要求，导致前3小时温度持续偏高',
      },
      {
        id: crypto.randomUUID(),
        type: 'prolonged_door_open' as AnomalyType,
        startTime: mergedRecords[240]?.timestamp || startTs,
        endTime: mergedRecords[243]?.timestamp || startTs,
        duration: 15,
        basis: '中途停靠服务区时开门15分钟，温度上升至-11℃，超出温区上限',
      },
      {
        id: crypto.randomUUID(),
        type: 'yard_power_outage' as AnomalyType,
        startTime: mergedRecords[400]?.timestamp || startTs,
        endTime: mergedRecords[420]?.timestamp || startTs,
        duration: 100,
        basis: '堆场等候卸货期间制冷设备断电约100分钟，温度回升至-12℃',
      },
    ];

    const tempFileId = 'demo-temp-file';
    const doorFileId = 'demo-door-file';
    const gpsFileId = 'demo-gps-file';

    set({
      project,
      deviceRecords: records,
      mergedRecords,
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
          id: tempFileId,
          name: 'recool_temp_humidity.csv',
          type: 'temperature',
          status: 'done',
          recordCount: records.filter((r) => r.fileId === tempFileId).length,
        },
        {
          id: doorFileId,
          name: 'recool_door_events.csv',
          type: 'door',
          status: 'done',
          recordCount: records.filter((r) => r.fileId === doorFileId).length,
        },
        {
          id: gpsFileId,
          name: 'recool_gps_track.csv',
          type: 'gps',
          status: 'done',
          recordCount: records.filter((r) => r.fileId === gpsFileId).length,
        },
      ],
      dataSummary,
      annotations: demoAnnotations,
      selectedTemplate: 'customer' as ReportTemplate,
      activeAnnotation: null,
    });
  },
}));
