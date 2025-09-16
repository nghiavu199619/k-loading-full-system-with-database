/**
 * Vietnamese Number Formatting Utilities
 * Converts between UI display format and raw database format
 */

type RawToUIOptions = {
  decimals?: number;            // số chữ số thập phân muốn hiển thị
  keepZeroDecimals?: boolean;   // có hiển thị 0 thập phân hay không
  locale?: string;              // mặc định 'vi-VN'
};

type UiToRawOptions = {
  allowShorthand?: boolean;     // "3k", "2.5m", "2,5 triệu", "1.2b", "1 ty"
  allowScientific?: boolean;    // "1e6", "2.5E3"
  returnNumber?: boolean;       // true => number, false => string "ASCII"
  maxDecimals?: number;         // giới hạn số thập phân khi parse (ví dụ 6)
  strict?: boolean;             // true => ít suy đoán hơn, dễ phát hiện nhập sai
  onUnsafeInteger?: 'string' | 'number' | 'error'; // integer > MAX_SAFE_INTEGER
};

// ===== Helpers =====
const toNumberSafe = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// bỏ ký hiệu tiền/tách chữ nhưng giữ ., , (), -, +, e/E, k/m/b, tr/ty
const stripCurrencyAndSpace = (s: string) =>
  s.replace(/[^\d.,()\-\+eEkKmMbBtrịeuieuynagh\p{L}]/gu, '') // giữ chữ cái để còn "tr", "ty", "tỷ"
   .replace(/\s+/g, ''); // bỏ khoảng trắng

// accent-insensitive
const normalizeAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Enhanced format detection patterns
const isVNInteger = (s: string) => /^\d{1,3}(\.\d{3})+$/.test(s); // 49.000.000
const isVNDecimal = (s: string) => /^\d{1,3}(\.\d{3})*,\d{1,12}$/.test(s) || /^\d+,\d{1,12}$/.test(s); // 1.234,56 / 0,36
const isUSInteger = (s: string) => /^\d{1,3}(,\d{3})+$/.test(s); // 49,000,000
const isUSDecimal = (s: string) => /^\d{1,3}(,\d{3})*\.\d{1,12}$/.test(s) || /^\d+\.\d{1,12}$/.test(s); // 1,234.56 / 0.36

// thousands check (nhóm 3 số)
const hasValidThousandsPattern = (parts: string[]) =>
  parts.length > 1 && parts.slice(1).every(p => p.length === 3);

// rounding safe
const roundTo = (n: number, d: number) =>
  d >= 0 ? Number(Math.round((n + Number.EPSILON) * Math.pow(10, d)) / Math.pow(10, d)) : n;

// Intl cache
const NF_CACHE = new Map<string, Intl.NumberFormat>();
const getNF = (locale: string, min: number, max: number) => {
  const key = `${locale}|${min}|${max}`;
  let nf = NF_CACHE.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    NF_CACHE.set(key, nf);
  }
  return nf!;
};

/**
 * Convert raw database value to UI display format (Vietnamese)
 */
export function rawToUI(value: unknown, options: RawToUIOptions = {}): string {
  const { decimals, keepZeroDecimals, locale = 'vi-VN' } = options;
  const n = toNumberSafe(value);
  if (n === null) return '';

  // Bảo vệ integer lớn vượt MAX_SAFE_INTEGER: format qua string để khỏi mất độ chính xác
  if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) {
    const s = String(n);
    // format thủ công theo locale vi-VN cho integer lớn
    const neg = s.startsWith('-');
    const digits = neg ? s.slice(1) : s;
    const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + withDots;
  }

  const min = keepZeroDecimals ? (decimals ?? 0) : 0;
  const max = decimals ?? 20;
  const nf = getNF(locale, min, max);
  return nf.format(n);
}

/**
 * Convert UI input to raw database format (VN/US/mixed → ASCII số)
 */
export function uiToRaw(input: unknown, options: UiToRawOptions = {}): number | string {
  const {
    allowShorthand = true,
    allowScientific = true,
    returnNumber = true,
    maxDecimals = 12,
    strict = false,
    onUnsafeInteger = 'string',
  } = options;

  if (input === null || input === undefined) return returnNumber ? 0 : '';

  let s = String(input).trim();
  if (!s) return returnNumber ? 0 : '';

  // trailing minus: "49,36-" -> "-49,36"
  if (s.endsWith('-') && !s.startsWith('-')) s = '-' + s.slice(0, -1);

  // Âm dạng ngoặc (kế toán)
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }

  // Bóc ký hiệu tiền + khoảng trắng, giữ lại chữ để nhận dạng suffix tiếng Việt
  s = stripCurrencyAndSpace(s);
  s = normalizeAccents(s).toLowerCase();

  // ===== Shorthand (k, m, b | nghin/ngan, tr/trieu, ty/tỷ, bn) =====
  if (allowShorthand) {
    // ghép số + suffix
    const shMatch = s.match(/^(\d+(?:[.,]\d+)?)(k|nghin|ngan|nghìn|m|tr|trieu|triệu|b|bn|ty|tỷ|tyr|tỳ)$/i);
    if (shMatch) {
      const numPart = shMatch[1].replace(',', '.');
      const unit = shMatch[2];
      let factor = 1;
      if (/(k|nghin|ngan|nghìn)/.test(unit)) factor = 1e3;
      else if (/(m|tr|trieu|triệu)/.test(unit)) factor = 1e6;
      else if (/(b|bn|ty|tỷ|tyr|tỳ)/.test(unit)) factor = 1e9;

      let n = parseFloat(numPart) * factor;
      n = negative ? -n : n;
      if (maxDecimals >= 0) n = roundTo(n, Math.min(maxDecimals, 12));
      if (!returnNumber) return String(n);
      // unsafe integer?
      if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) {
        if (onUnsafeInteger === 'error') throw new Error('Unsafe integer magnitude');
        if (onUnsafeInteger === 'string') return String(n);
      }
      return n;
    }
  }

  // ===== Scientific notation =====
  if (allowScientific && /^-?\d+(\.\d+)?e[+\-]?\d+$/i.test((negative ? '-' : '') + s)) {
    let n = Number((negative ? '-' : '') + s);
    if (!Number.isFinite(n)) n = 0;
    if (maxDecimals >= 0 && !Number.isInteger(n)) n = roundTo(n, Math.min(maxDecimals, 12));
    if (!returnNumber) return String(n);
    if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) {
      if (onUnsafeInteger === 'error') throw new Error('Unsafe integer magnitude');
      if (onUnsafeInteger === 'string') return String(n);
    }
    return n;
  }

  // ===== Phân nhánh định dạng =====

  
  if (isVNDecimal(s)) {
    s = s.replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"

  } else if (isVNInteger(s)) {
    s = s.replace(/\./g, '');                   // "1.234.567" -> "1234567"

  } else if (isUSDecimal(s)) {
    s = s.replace(/,/g, '');                    // "1,234.56" -> "1234.56"

  } else if (isUSInteger(s)) {
    s = s.replace(/,/g, '');                    // "1,234,567" -> "1234567"

  } else {
    // Hỗn hợp: quyết định theo dấu xuất hiện cuối cùng là thập phân
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');

    const removeAll = (ch: string, str: string) => str.split(ch).join('');

    if (hasDot && hasComma) {
      const lastComma = s.lastIndexOf(',');
      const lastDot   = s.lastIndexOf('.');
      const decimalIsComma = lastComma > lastDot;

      if (decimalIsComma) {
        // ',' là thập phân → '.' là nghìn
        const [intPartWithDots, decPart] = s.split(/,(?=[^,]*$)/); // tách tại comma cuối
        const onlyDigitsInt = intPartWithDots.replace(/\./g, '');
        s = onlyDigitsInt + '.' + decPart;
      } else {
        // '.' là thập phân → ',' là nghìn
        const intPartWithCommas = s.substring(0, lastDot).replace(/,/g, '');
        const decPart = s.substring(lastDot + 1);
        s = intPartWithCommas + '.' + decPart;
      }
    } else if (hasComma && !hasDot) {
      const parts = s.split(',');
      // strict: chỉ coi là thập phân khi phần sau không có đúng 3 chữ số
      if (parts.length === 2 && (strict ? parts[1].length !== 3 : parts[1].length > 0 && parts[1].length <= 12)) {
        s = parts[0].replace(/\./g, '') + '.' + parts[1];  // 0,36 / 49,36
      } else if (hasValidThousandsPattern(parts)) {
        s = removeAll(',', s);                             // 49,000,000
      } else {
        // mơ hồ → ưu tiên thập phân VN
        const head = parts.slice(0, -1).join('');
        const tail = parts[parts.length - 1] ?? '';
        s = head.replace(/\./g, '') + '.' + tail;
      }
    } else if (hasDot && !hasComma) {
      const parts = s.split('.');
      if (parts.length === 2 && (strict ? parts[1].length !== 3 : parts[1].length > 0 && parts[1].length <= 12)) {
        // 49.36 / 0.36 → thập phân → giữ nguyên
      } else if (hasValidThousandsPattern(parts)) {
        s = removeAll('.', s); // 49.000.000
      } else {
        // mơ hồ → giữ nguyên (coi là thập phân)
      }
    }
    // nếu không có dot/comma → raw
  }

  // ===== Kết quả =====
  let n = Number(s);
  if (!Number.isFinite(n)) n = 0;
  if (negative) n = -n;

  if (maxDecimals >= 0 && !Number.isInteger(n)) {
    n = roundTo(n, Math.min(maxDecimals, 12));
  }

  if (!returnNumber) return String(n);

  // bảo vệ integer rất lớn
  if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) {
    if (onUnsafeInteger === 'error') throw new Error('Unsafe integer magnitude');
    if (onUnsafeInteger === 'string') return String(negative ? -BigInt(String(Math.abs(n))) : BigInt(String(Math.abs(n))));
  }

  return n;
}

/**
 * Validate Vietnamese number format
 */
export function isValidVietnameseNumber(input: unknown): boolean {
  if (input === null || input === undefined) return false;
  let s = String(input).trim();
  if (!s) return false;

  if (s.endsWith('-') && !s.startsWith('-')) s = '-' + s.slice(0, -1);
  s = s.replace(/^\((.*)\)$/, '-$1'); // ngoặc → âm
  s = stripCurrencyAndSpace(s);
  s = normalizeAccents(s).toLowerCase();

  return (
    isVNInteger(s) || isVNDecimal(s) ||
    isUSInteger(s) || isUSDecimal(s) ||
    /^-?\d+(\.\d+)?$/.test(s) ||                 // raw decimal
    /^-?\d+([.,]\d+)?(k|nghin|ngan|nghìn|m|tr|trieu|triệu|b|bn|ty|tỷ|tyr|tỳ)$/.test(s) || // shorthand
    /^-?\d+(\.\d+)?e[+\-]?\d+$/i.test(s)         // scientific
  );
}

/**
 * Smart parser (trả về kết quả + lý do)
 */
export function smartParseVietnamese(input: unknown) {
  try {
    const raw = uiToRaw(input, { returnNumber: true });
    const ok = typeof raw === 'number' && Number.isFinite(raw);
    return ok
      ? { ok: true, value: raw as number, warning: null }
      : { ok: false, reason: 'invalid_number', raw: String(input ?? '') };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'parse_error', raw: String(input ?? '') };
  }
}

/**
 * Smart Vietnamese format detection and conversion
 */
export function convertToVietnameseFormat(value: string | number, options: RawToUIOptions = {}): string {
  if (value === null || value === undefined || value === '') return '';
  const parsed = uiToRaw(value, { returnNumber: true }) as number;
  if (!Number.isFinite(parsed)) return '';
  return rawToUI(parsed, options);
}