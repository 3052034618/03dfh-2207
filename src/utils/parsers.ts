import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DeviceRecord, MergedRecord, ImportedFile } from '@/types';

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\s_\-]+/g, '_')
    .replace(/[()（）]/g, '')
    .trim();
}

const TIMESTAMP_KEYS = [
  'timestamp',
  'time',
  '时间',
  '时间戳',
  'datetime',
  'date_time',
  'record_time',
];

const TEMP_KEYS = [
  'temperature',
  'temp',
  '温度',
  '舱温',
  'set_temp',
  'supply_air_temp',
  'return_air_temp',
];

const HUMIDITY_KEYS = ['humidity', 'hum', '湿度', 'rh', 'relative_humidity'];

const DOOR_KEYS = ['door', 'door_open', 'door_status', '门开关', '门状态', 'door_state'];

const LAT_KEYS = ['latitude', 'lat', '纬度', 'gps_lat'];
const LNG_KEYS = ['longitude', 'lng', 'lon', '经度', 'gps_lon', 'gps_lng'];

function findKey(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.indexOf(normalizeHeader(c));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function parseTimestamp(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
      return d.toISOString();
    }
    return new Date(val).toISOString();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
    const cnMatch = val.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日]?\s*(\d{1,2})?[:]?(\d{1,2})?[:]?(\d{1,2})?/);
    if (cnMatch) {
      const [, y, mo, d2, h = '0', mi = '0', s = '0'] = cnMatch;
      return new Date(+y, +mo - 1, +d2, +h, +mi, +s).toISOString();
    }
  }
  return new Date().toISOString();
}

function parseBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === '开' || lower === 'open' || lower === 'yes';
  }
  return false;
}

function toNullableNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function mapRowToRecord(
  row: Record<string, unknown>,
  timestampKey: string,
  tempKey: string | null,
  humidityKey: string | null,
  doorKey: string | null,
  latKey: string | null,
  lngKey: string | null,
  fileId: string,
  fileType: ImportedFile['type']
): DeviceRecord {
  const record: DeviceRecord = {
    id: crypto.randomUUID(),
    fileId,
    timestamp: parseTimestamp(row[timestampKey]),
  };

  if ((fileType === 'temperature' || fileType === 'humidity') && tempKey) {
    const t = toNullableNumber(row[tempKey]);
    if (t !== undefined) record.temperature = t;
  }
  if ((fileType === 'temperature' || fileType === 'humidity') && humidityKey) {
    const h = toNullableNumber(row[humidityKey]);
    if (h !== undefined) record.humidity = h;
  }
  if (fileType === 'door' && doorKey) {
    record.doorOpen = parseBoolean(row[doorKey]);
  }
  if (fileType === 'gps' && latKey && lngKey) {
    const lat = toNullableNumber(row[latKey]);
    const lng = toNullableNumber(row[lngKey]);
    if (lat !== undefined) record.latitude = lat;
    if (lng !== undefined) record.longitude = lng;
  }

  if (tempKey && record.temperature === undefined && (fileType === 'temperature' || fileType === 'humidity')) {
    const t = toNullableNumber(row[tempKey]);
    if (t !== undefined) record.temperature = t;
  }

  return record;
}

export function parseCSV(
  content: string,
  fileId: string,
  fileType: ImportedFile['type']
): DeviceRecord[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (!result.data.length || !result.meta.fields) return [];

  const headers = result.meta.fields;
  const timestampKey = findKey(headers, TIMESTAMP_KEYS);
  if (!timestampKey) return [];

  const tempKey = findKey(headers, TEMP_KEYS);
  const humidityKey = findKey(headers, HUMIDITY_KEYS);
  const doorKey = findKey(headers, DOOR_KEYS);
  const latKey = findKey(headers, LAT_KEYS);
  const lngKey = findKey(headers, LNG_KEYS);

  return result.data.map((row) =>
    mapRowToRecord(row, timestampKey, tempKey, humidityKey, doorKey, latKey, lngKey, fileId, fileType)
  );
}

export function parseExcel(
  buffer: ArrayBuffer,
  fileId: string,
  fileType: ImportedFile['type']
): DeviceRecord[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (!data.length) return [];

  const headers = Object.keys(data[0]);
  const timestampKey = findKey(headers, TIMESTAMP_KEYS);
  if (!timestampKey) return [];

  const tempKey = findKey(headers, TEMP_KEYS);
  const humidityKey = findKey(headers, HUMIDITY_KEYS);
  const doorKey = findKey(headers, DOOR_KEYS);
  const latKey = findKey(headers, LAT_KEYS);
  const lngKey = findKey(headers, LNG_KEYS);

  return data.map((row) =>
    mapRowToRecord(row, timestampKey, tempKey, humidityKey, doorKey, latKey, lngKey, fileId, fileType)
  );
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function mergeRecordsByTimestamp(records: DeviceRecord[]): MergedRecord[] {
  const map = new Map<string, MergedRecord>();

  for (const r of records) {
    const existing = map.get(r.timestamp);
    if (existing) {
      if (r.temperature !== undefined) existing.temperature = r.temperature;
      if (r.humidity !== undefined) existing.humidity = r.humidity;
      if (r.doorOpen !== undefined) existing.doorOpen = r.doorOpen;
      if (r.latitude !== undefined) existing.latitude = r.latitude;
      if (r.longitude !== undefined) existing.longitude = r.longitude;
    } else {
      map.set(r.timestamp, {
        timestamp: r.timestamp,
        temperature: r.temperature,
        humidity: r.humidity,
        doorOpen: r.doorOpen,
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function computeDataSummary(records: DeviceRecord[]) {
  if (!records.length) return null;

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let missingSegments = 0;
  let avgIntervalMs: number;
  let intervalStr: string;
  let completeness: number;

  if (sorted.length === 1) {
    avgIntervalMs = 0;
    intervalStr = '单条记录';
    completeness = 100;
  } else {
    avgIntervalMs =
      (new Date(sorted[sorted.length - 1].timestamp).getTime() -
        new Date(sorted[0].timestamp).getTime()) /
      (sorted.length - 1);

    if (!isFinite(avgIntervalMs) || avgIntervalMs <= 0) {
      avgIntervalMs = 0;
      intervalStr = '时间戳异常';
      completeness = 100;
    } else {
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          new Date(sorted[i].timestamp).getTime() -
          new Date(sorted[i - 1].timestamp).getTime();
        if (gap > avgIntervalMs * 3) missingSegments++;
      }

      const totalExpectedSpan =
        new Date(sorted[sorted.length - 1].timestamp).getTime() -
        new Date(sorted[0].timestamp).getTime();
      const actualSpan = (sorted.length - 1) * avgIntervalMs;
      completeness = totalExpectedSpan > 0 ? Math.min(100, (actualSpan / totalExpectedSpan) * 100) : 100;

      const intervalMinutes = Math.round(avgIntervalMs / 60000);
      if (intervalMinutes >= 60) {
        const h = Math.floor(intervalMinutes / 60);
        const m = intervalMinutes % 60;
        intervalStr = m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
      } else if (intervalMinutes >= 1) {
        intervalStr = `${intervalMinutes}分钟`;
      } else {
        const intervalSeconds = Math.round(avgIntervalMs / 1000);
        intervalStr = intervalSeconds > 0 ? `${intervalSeconds}秒` : '即时';
      }
    }
  }

  return {
    timeRange: {
      start: sorted[0].timestamp,
      end: sorted[sorted.length - 1].timestamp,
    },
    totalRecords: sorted.length,
    samplingInterval: intervalStr,
    missingSegments,
    completeness: Math.round(completeness * 10) / 10,
  };
}
