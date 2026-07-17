export const getCustomSortKey = (val: any, useCustomSorting?: boolean): any => {
  if (!useCustomSorting || typeof val !== 'string') return val;

  const trimmedVal = val.trim();
  if (!trimmedVal) return val;

  const normalizeYear = (y?: string): string => {
    if (!y) return '00';
    const trimmed = y.trim().replace(/^['`]/, '');
    if (trimmed.length === 2) {
      return '20' + trimmed;
    }
    return trimmed;
  };

  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  };

  const monthListRegexStr =
    'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

  // 1. Month with Year (e.g. "Jan 2024" or "2024 Jan" or "2024-Jan" or "Jan-24")
  const yearMatch = trimmedVal.match(/\b(?:20|19)?\d{2}\b/);
  const monthMatch = trimmedVal.match(
    new RegExp(`\\b(${monthListRegexStr})\\b`, 'i'),
  );

  if (monthMatch) {
    const mName = monthMatch[1].toLowerCase();
    let yearStr = '00';
    if (yearMatch) {
      yearStr = normalizeYear(yearMatch[0]);
    }
    return `${yearStr}-${monthNames[mName]}`;
  }

  // 2. Quarter with Year (e.g. "Q1 2024", "2024 Q1", "2024-Q1", "Q1-24")
  const quarterMatch = trimmedVal.match(/\bQ([1-4])\b/i);
  if (quarterMatch) {
    let yearStr = '00';
    if (yearMatch) {
      yearStr = normalizeYear(yearMatch[0]);
    }
    return `${yearStr}-Q${quarterMatch[1]}`;
  }

  // 3. Half with Year (e.g. "H1 2024", "2024 H1", "H1-24", "1st Half 25")
  const halfMatch =
    trimmedVal.match(/\bH([1-2])\b/i) ||
    trimmedVal.match(/\b([1-2])(st|nd)\s+Half\b/i);
  if (halfMatch) {
    const halfNum = halfMatch[1] || halfMatch[2];
    let yearStr = '00';
    if (yearMatch) {
      yearStr = normalizeYear(yearMatch[0]);
    }
    return `${yearStr}-H${halfNum}`;
  }

  // 4. Week with Year (e.g. "W1 2024", "Week 1 2024", "2024 W01", "Week 5", "W52-2024")
  const weekMatch = trimmedVal.match(/\b(?:W|Week)\s*(\d{1,2})\b/i);
  if (weekMatch) {
    const weekNum = weekMatch[1].padStart(2, '0');
    let yearStr = '00';
    if (yearMatch) {
      yearStr = normalizeYear(yearMatch[0]);
    }
    return `${yearStr}-W${weekNum}`;
  }

  // 5. Season with Year (e.g. "Spring 2024", "2024 Spring", "Spring-24")
  const seasonNames: Record<string, string> = {
    spring: '01',
    summer: '02',
    fall: '03',
    autumn: '03',
    winter: '04',
  };
  const seasonMatch = trimmedVal.match(
    /\b(spring|summer|fall|autumn|winter)\b/i,
  );
  if (seasonMatch) {
    const sName = seasonMatch[1].toLowerCase();
    let yearStr = '00';
    if (yearMatch) {
      yearStr = normalizeYear(yearMatch[0]);
    }
    return `${yearStr}-${seasonNames[sName]}`;
  }

  // 6. Day of Week (e.g. "Monday", "Mon", etc.)
  const dayNames: Record<string, string> = {
    mon: '1',
    tue: '2',
    wed: '3',
    thu: '4',
    fri: '5',
    sat: '6',
    sun: '7',
    monday: '1',
    tuesday: '2',
    wednesday: '3',
    thursday: '4',
    friday: '5',
    saturday: '6',
    sunday: '7',
  };
  const dayMatch = trimmedVal.match(
    /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i,
  );
  if (dayMatch) {
    return dayNames[dayMatch[1].toLowerCase()];
  }

  // 7. Check if it is a standard ISO date or parseable date string (e.g. "2024-01-01")
  if (trimmedVal.length >= 6 && !/^\d+$/.test(trimmedVal)) {
    const parsedTimestamp = Date.parse(trimmedVal);
    if (!isNaN(parsedTimestamp)) {
      try {
        return new Date(parsedTimestamp).toISOString();
      } catch (e) {
        // Ignore error and fall back
      }
    }
  }

  // 8. Pure 4-digit Year (e.g. "2024")
  if (/^\b\d{4}\b$/.test(trimmedVal)) {
    return trimmedVal;
  }

  return val;
};

const rx = /(\d+)|(\D+)/g;
const rd = /\d/;
const rz = /^0/;
export const naturalSort = (as: any, bs: any): number => {
  if (bs !== null && as === null) return -1;
  if (as !== null && bs === null) return 1;

  if (typeof as === 'number' && Number.isNaN(as)) return -1;
  if (typeof bs === 'number' && Number.isNaN(bs)) return 1;

  const nas = Number(as);
  const nbs = Number(bs);
  if (nas < nbs) return -1;
  if (nas > nbs) return 1;

  if (typeof as === 'number' && typeof bs !== 'number') return -1;
  if (typeof bs === 'number' && typeof as !== 'number') return 1;
  if (typeof as === 'number' && typeof bs === 'number') return 0;

  if (Number.isNaN(nbs) && !Number.isNaN(nas)) return -1;
  if (Number.isNaN(nas) && !Number.isNaN(nbs)) return 1;

  let a = String(as);
  let b = String(bs);
  if (a === b) return 0;
  if (!rd.test(a) || !rd.test(b)) return a > b ? 1 : -1;

  const matchA = a.match(rx) || [];
  const matchB = b.match(rx) || [];
  const aArr = [...matchA];
  const bArr = [...matchB];

  while (aArr.length && bArr.length) {
    const a1 = aArr.shift()!;
    const b1 = bArr.shift()!;
    if (a1 !== b1) {
      if (rd.test(a1) && rd.test(b1)) {
        return Number(a1.replace(rz, '.0')) - Number(b1.replace(rz, '.0'));
      }
      return a1 > b1 ? 1 : -1;
    }
  }
  return aArr.length - bArr.length;
};
