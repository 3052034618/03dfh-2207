import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DeviceRecord } from '@/types';

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

function mapRowToRecord(
  row: Record<string, unknown>,
  timestampKey: string,
  tempKey: string | null,
  humidityKey: string | null,
  doorKey: string | null,
  latKey: string | null,
  lngKey: string | null
): DeviceRecord {
  return {
    timestamp: parseTimestamp(row[timestampKey]),
    temperature: tempKey ? Number(row[tempKey]) || 0 : 0,
    humidity: humidityKey ? Number(row[humidityKey]) || 0 : 0,
    doorOpen: doorKey ? parseBoolean(row[doorKey]) : false,
    latitude: latKey ? Number(row[latKey]) || 0 : 0,
    longitude: lngKey ? Number(row[lngKey]) || 0 : 0,
  };
}

export function parseCSV(content: string): DeviceRecord[] {
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
    mapRowToRecord(row, timestampKey, tempKey, humidityKey, doorKey, latKey, lngKey)
  );
}

export function parseExcel(buffer: ArrayBuffer): DeviceRecord[] {
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
    mapRowToRecord(row, timestampKey, tempKey, humidityKey, doorKey, latKey, lngKey)
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

export function computeDataSummary(records: DeviceRecord[]) {
  if (!records.length) return null;

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let missingSegments = 0;
  const avgIntervalMs =
    (new Date(sorted[sorted.length - 1].timestamp).getTime() -
      new Date(sorted[0].timestamp).getTime()) /
    (sorted.length - 1);

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
  const completeness = totalExpectedSpan > 0 ? Math.min(100, (actualSpan / totalExpectedSpan) * 100) : 100;

  const intervalMinutes = Math.round(avgIntervalMs / 60000);
  const intervalStr =
    intervalMinutes >= 60
      ? `${Math.floor(intervalMinutes / 60)}小时${intervalMinutes % 60 ? intervalMinutes % 60 + '分钟' : ''}`
      : `${intervalMinutes}分钟`;

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
