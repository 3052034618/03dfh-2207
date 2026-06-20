import type {
  MergedRecord,
  TransportParams,
  Annotation,
  ReportTemplate,
  AnomalyType,
} from '@/types';
import { ANOMALY_TYPE_LABELS, REPORT_TEMPLATE_LABELS, CARGO_TYPE_LABELS } from '@/types';

function formatDuration(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return '0分钟';
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeExceedDuration(records: MergedRecord[], params: TransportParams): number {
  let minutes = 0;
  const tempRecords = records.filter((r) => r.temperature !== undefined);
  for (let i = 1; i < tempRecords.length; i++) {
    const t = tempRecords[i].temperature!;
    if (t > params.tempUpper || t < params.tempLower) {
      const gap =
        (new Date(tempRecords[i].timestamp).getTime() -
          new Date(tempRecords[i - 1].timestamp).getTime()) /
        60000;
      minutes += gap;
    }
  }
  return Math.round(Math.max(0, minutes));
}

function computeMaxDeviation(records: MergedRecord[], params: TransportParams): number {
  let maxDev = 0;
  for (const r of records) {
    if (r.temperature === undefined) continue;
    if (r.temperature > params.tempUpper) {
      maxDev = Math.max(maxDev, r.temperature - params.tempUpper);
    } else if (r.temperature < params.tempLower) {
      maxDev = Math.max(maxDev, params.tempLower - r.temperature);
    }
  }
  return Math.round(maxDev * 10) / 10;
}

function computeResponsibilityStage(annotations: Annotation[]): string {
  const typeCount: Record<string, number> = {};
  for (const a of annotations) {
    typeCount[a.type] = (typeCount[a.type] || 0) + a.duration;
  }

  const entries = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '暂无异常标注，无法判定';

  const topType = entries[0][0] as AnomalyType;
  const stageMap: Record<AnomalyType, string> = {
    insufficient_precool: '装车预冷阶段',
    yard_power_outage: '堆场等候阶段',
    door_seal_check: '运输中转阶段',
    prolonged_door_open: '中途停靠/交接阶段',
    equipment_false_alarm: '设备维护阶段',
  };
  return stageMap[topType] || '综合判定';
}

function generateRecommendations(
  annotations: Annotation[],
  template: ReportTemplate
): string {
  if (!annotations.length) return '未检测到异常，温控表现良好，建议继续保持当前操作规范。';

  const types = new Set(annotations.map((a) => a.type));
  const recs: string[] = [];

  if (types.has('insufficient_precool')) {
    recs.push(
      template === 'customer'
        ? '建议加强装车前预冷流程管控，确保集装箱温度达标后方可装货。'
        : '装车预冷不达标是本次主要异常原因，需强化预冷SOP，建议预冷温度确认纳入发车检查清单。'
    );
  }
  if (types.has('yard_power_outage')) {
    recs.push(
      template === 'customer'
        ? '堆场等候期间已加强供电保障措施，后续将缩短堆场等待时间。'
        : '堆场断电暴露备用电源不足问题，建议增配移动发电设备，堆场超30分钟等候自动上报机制。'
    );
  }
  if (types.has('door_seal_check')) {
    recs.push(
      template === 'customer'
        ? '已安排门封条专项检查，确保密封性能满足运输要求。'
        : '门封异常需排查条老化/损坏原因，建议每批次运输前增加门封气密性测试。'
    );
  }
  if (types.has('prolonged_door_open')) {
    recs.push(
      template === 'customer'
        ? '已优化中途停靠操作规范，减少开门时长。'
        : '长时间开门主要发生在中途停靠，建议设定开门超时5分钟预警，司机培训加强。'
    );
  }
  if (types.has('equipment_false_alarm')) {
    recs.push(
      template === 'customer'
        ? '已对设备进行校验，确认温度传感器精度恢复正常。'
        : '设备误报需排查传感器故障，建议制定季度校验计划，异常数据自动标记待复核。'
    );
  }

  return recs.join('\n');
}

export function generateReport(
  records: MergedRecord[],
  params: TransportParams,
  annotations: Annotation[],
  template: ReportTemplate
): string {
  const exceedDuration = computeExceedDuration(records, params);
  const maxDeviation = computeMaxDeviation(records, params);
  const anomalyCount = annotations.length;
  const responsibilityStage = computeResponsibilityStage(annotations);
  const recommendations = generateRecommendations(annotations, template);

  const templateLabel = REPORT_TEMPLATE_LABELS[template];
  const cargoLabel = CARGO_TYPE_LABELS[params.cargoType];

  const titleMap: Record<ReportTemplate, string> = {
    customer: '冷链运输温控质量报告',
    internal_ops: '温控复盘运营分析报告',
    claims: '冷链运输异常理赔沟通函',
  };

  const lines: string[] = [];

  lines.push('═'.repeat(50));
  lines.push(`  ${titleMap[template]}`);
  lines.push(`  报告类型：${templateLabel}`);
  lines.push('═'.repeat(50));
  lines.push('');

  lines.push('【基本信息】');
  lines.push(`  货品类型：${cargoLabel}`);
  lines.push(`  温区要求：${params.tempLower}℃ ~ ${params.tempUpper}℃`);
  lines.push(`  起运地：${params.originPort || '未填写'}`);
  lines.push(`  目的地：${params.destPort || '未填写'}`);
  if (params.loadTime) lines.push(`  装车时间：${formatTime(params.loadTime)}`);
  if (params.unloadTime) lines.push(`  卸货时间：${formatTime(params.unloadTime)}`);
  lines.push('');

  if (records.length > 0) {
    const tempCount = records.filter((r) => r.temperature !== undefined).length;
    lines.push('【运输时间范围】');
    lines.push(`  起始：${formatTime(records[0].timestamp)}`);
    lines.push(`  终止：${formatTime(records[records.length - 1].timestamp)}`);
    lines.push(`  合并时间点数：${records.length} 个`);
    lines.push(`  有效温度采样点：${tempCount} 个`);
    lines.push('');
  }

  lines.push('【关键指标】');
  lines.push(`  超限总时长：${formatDuration(exceedDuration)}`);
  lines.push(`  最大偏差值：${maxDeviation}℃`);
  lines.push(`  异常标注数：${anomalyCount} 次`);
  lines.push(`  责任阶段：${responsibilityStage}`);
  lines.push('');

  if (annotations.length > 0) {
    lines.push('【异常详情】');
    for (let i = 0; i < annotations.length; i++) {
      const a = annotations[i];
      lines.push(`  ${i + 1}. ${ANOMALY_TYPE_LABELS[a.type]}`);
      lines.push(`     时间段：${formatTime(a.startTime)} — ${formatTime(a.endTime)}`);
      lines.push(`     持续时长：${formatDuration(a.duration)}`);
      lines.push(`     判定依据：${a.basis}`);
      lines.push('');
    }
  }

  lines.push('【处理建议】');
  lines.push(`  ${recommendations.replace(/\n/g, '\n  ')}`);
  lines.push('');
  lines.push('─'.repeat(50));
  lines.push(`  报告生成时间：${formatTime(new Date().toISOString())}`);
  lines.push(`  本报告由冷链温控复盘工具自动生成`);
  lines.push('─'.repeat(50));

  return lines.join('\n');
}

export function getReportMetrics(
  records: MergedRecord[],
  params: TransportParams,
  annotations: Annotation[]
) {
  return {
    exceedDuration: computeExceedDuration(records, params),
    maxDeviation: computeMaxDeviation(records, params),
    anomalyCount: annotations.length,
    responsibilityStage: computeResponsibilityStage(annotations),
  };
}
