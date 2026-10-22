import type { AppData, Hotline } from './model';

// 按用户给出的 MainActivity.kt 中热线清单保留；实际受理范围以当地部门为准。
export const builtInHotlines: Hotline[] = [
  ['消费者维权','12315','原 12358、12331、12330 均整合至市场监管 12315'],
  ['政务服务热线','12345','受理大部分的问题、咨询'],
  ['文化旅游投诉','12318','全国号码保留，多地话务并入 12345'],
  ['生态环境投诉','12369','部分地区已接入 12345，噪音、污水、废气、工地扰民'],
  ['安全生产隐患举报','12350',''],
  ['交通运输投诉','12328',''],
  ['快递问题投诉','12305',''],
  ['税务违法举报','12366','偷税漏税、违规开票'],
  ['公安民警违法违纪全国举报热线','12389',''],
  ['中央网信办网上违法和不良信息举报','12377',''],
  ['骚扰/诈骗信息、个人信息泄露举报','12321',''],
  ['间谍、危害国家安全举报','12339',''],
  ['法律援助、免费法律咨询','12348',''],
  ['工会职工帮扶调解','12351','总工会热线，调解欠薪劳资纠纷，非官方劳动执法专线'],
  ['社保/劳资咨询投诉','12333','欠薪维权优先拨打本号码，人社劳动监察法定渠道'],
  ['公积金业务投诉咨询','12329',''],
  ['妇联维权、妇女儿童求助','12338',''],
  ['电力、能源、乱收费投诉','12398',''],
  ['纪检监察举报','12388','公职人员违纪、腐败、不作为'],
  ['干部选人用人违规举报','12380','组织部专线'],
  ['检察服务热线','12309','受理控告申诉、法律咨询、国家赔偿等'],
  ['防震减灾求助','12322','部分地区归并 12345，无法接通就打 12345'],
  ['烟草违规举报','12313',''],
  ['残联服务维权','12385',''],
  ['证券金融违规举报','12386',''],
].map(([duty,phone,remark],i) => ({ id: `hotline_${i+1}`, duty,phone,remark }));

export const defaultData = (): AppData => ({
  format: 'jiashitong-pwa', version: 1,
  contacts: [], // 公开发行版不内置家人的私人号码。
  emergencies: [],
  safety: { name: '',phone: '',message: '我一切平安，请放心！' },
  importantDays: [],
  hotlines: builtInHotlines.map(x=>({...x})),
  contactScale: 120,
  hotlineScale: 120,
  courseData: { courses: [], rules: [], meetings: [] },
});
const KEY = 'jiashitong_pwa_v1';
export const isAppData = (d: unknown): d is AppData => {
  if (!d || typeof d !== 'object') return false;
  const x = d as Partial<AppData>;
  return x.format === 'jiashitong-pwa' && x.version === 1 && Array.isArray(x.contacts) &&
    Array.isArray(x.emergencies) && Array.isArray(x.importantDays) && Array.isArray(x.hotlines) &&
    !!x.safety && typeof x.safety.name === 'string' && !!x.courseData && Array.isArray(x.courseData.courses) &&
    Array.isArray(x.courseData.rules) && Array.isArray(x.courseData.meetings);
};
export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const result: unknown = JSON.parse(raw);
    return isAppData(result) ? { ...defaultData(), ...result } : defaultData();
  } catch { return defaultData(); }
};
export const saveData = (data: AppData): boolean => {
  try { localStorage.setItem(KEY,JSON.stringify(data)); return true; }
  catch { return false; }
};
export const exportJson = (data: AppData) => {
  const contents = JSON.stringify({...data, exportedAt: new Date().toISOString()},null,2);
  const blob = new Blob([contents],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `家事通PWA备份_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};
export const parseImport = async (file: File): Promise<AppData> => {
  if (file.size > 2_000_000) throw new Error('备份文件超过 2MB，暂不支持');
  const parsed: unknown = JSON.parse(await file.text());
  if (!isAppData(parsed)) throw new Error('不是家事通 PWA 0.1 格式的完整备份。安卓备份暂不支持直接全量恢复。');
  // 避免未知数据结构造成程序崩溃。
  const x = parsed as AppData;
  const checkArray = (xs: unknown[], keys: string[]) => xs.length <= 10000 && xs.every(item => item && typeof item==='object' && keys.every(k => typeof (item as Record<string,unknown>)[k] === 'string'));
  if (!checkArray(x.contacts,['id','name','phone','longPhone']) || !checkArray(x.emergencies,['id','name','phone','relation']) ||
      !checkArray(x.hotlines,['id','duty','phone','remark']) || !checkArray(x.importantDays,['id','title','category','calendarType']) ||
      !checkArray(x.courseData.courses,['id','name']) || !checkArray(x.courseData.rules,['id','courseId']) ||
      !checkArray(x.courseData.meetings,['id','courseId','startsAt','status'])) throw new Error('备份数据结构异常');
  return {...defaultData(),...x};
};
