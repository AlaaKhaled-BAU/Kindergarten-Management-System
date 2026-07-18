export interface TafqitResult {
  words: string;
  amount: number;
}

const UNITS_MASCULINE: Record<number, string> = {
  1: "واحد",
  2: "اثنان",
  3: "ثلاثة",
  4: "أربعة",
  5: "خمسة",
  6: "ستة",
  7: "سبعة",
  8: "ثمانية",
  9: "تسعة",
};

const UNITS_FEMININE: Record<number, string> = {
  1: "واحدة",
  2: "اثنتان",
  3: "ثلاث",
  4: "أربع",
  5: "خمس",
  6: "ست",
  7: "سبع",
  8: "ثمان",
  9: "تسع",
};

const TEENS: Record<number, string> = {
  10: "عشرة",
  11: "أحد عشر",
  12: "اثنا عشر",
  13: "ثلاثة عشر",
  14: "أربعة عشر",
  15: "خمسة عشر",
  16: "ستة عشر",
  17: "سبعة عشر",
  18: "ثمانية عشر",
  19: "تسعة عشر",
};

const TENS: Record<number, string> = {
  20: "عشرون",
  30: "ثلاثون",
  40: "أربعون",
  50: "خمسون",
  60: "ستون",
  70: "سبعون",
  80: "ثمانون",
  90: "تسعون",
};

const HUNDREDS: Record<number, string> = {
  100: "مائة",
  200: "مئتان",
  300: "ثلاثمائة",
  400: "أربعمائة",
  500: "خمسمائة",
  600: "ستمائة",
  700: "سبعمائة",
  800: "ثمانمائة",
  900: "تسعمائة",
};

/**
 * Converts a whole number (0-999) to Arabic words.
 * Uses masculine form (suits دينار which is masculine).
 */
function convertHundreds(n: number): string {
  if (n === 0) return "";

  const parts: string[] = [];

  const hundreds = Math.floor(n / 100) * 100;
  if (hundreds > 0) {
    parts.push(HUNDREDS[hundreds]);
  }

  const remainder = n % 100;
  if (remainder === 0) return parts.join(" و ");

  if (remainder < 10) {
    if (parts.length > 0) {
      parts.push(UNITS_MASCULINE[remainder]);
    } else {
      parts.push(UNITS_MASCULINE[remainder]);
    }
  } else if (remainder < 20) {
    if (parts.length > 0) {
      parts.push(TEENS[remainder]);
    } else {
      parts.push(TEENS[remainder]);
    }
  } else {
    const tens = Math.floor(remainder / 10) * 10;
    const units = remainder % 10;
    if (units === 0) {
      if (parts.length > 0) {
        parts.push(TENS[tens]);
      } else {
        parts.push(TENS[tens]);
      }
    } else {
      const unitWord = UNITS_MASCULINE[units];
      const tenWord = TENS[tens];
      if (parts.length > 0) {
        parts.push(`${unitWord} و ${tenWord}`);
      } else {
        parts.push(`${unitWord} و ${tenWord}`);
      }
    }
  }

  return parts.join(" و ");
}

/**
 * Converts a whole number (0-999999) to Arabic words with proper thousands handling.
 */
function numberToWords(n: number): string {
  if (n === 0) return "صفر";

  const parts: string[] = [];

  const thousands = Math.floor(n / 1000);
  const remainder = n % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push("ألف");
    } else if (thousands === 2) {
      parts.push("ألفان");
    } else if (thousands <= 10) {
      // 3-10 thousands: use feminine form with ألف (masculine)
      const tWord = UNITS_FEMININE[thousands];
      parts.push(`${tWord} آلاف`);
    } else if (thousands < 100) {
      // 11-99 thousands: number + ألفاً
      const tWord = convertHundreds(thousands);
      parts.push(`${tWord} ألفاً`);
    } else if (thousands < 1000) {
      const tWord = convertHundreds(thousands);
      // Check last segment of the thousands word to decide form
      const lastThree = thousands % 1000;
      if (lastThree === 0) {
        parts.push(`${tWord} ألف`);
      } else if (lastThree <= 10) {
        parts.push(`${tWord} ألف`);
      } else {
        parts.push(`${tWord} ألفاً`);
      }
    }
  }

  if (remainder > 0) {
    const rWord = convertHundreds(remainder);
    if (parts.length > 0) {
      parts.push(rWord);
    } else {
      parts.push(rWord);
    }
  }

  return parts.join(" و ");
}

/**
 * Returns the last numeric segment before the currency word,
 * which determines the grammatical case of the currency noun.
 * E.g., for 1250 (ألف و مئتان و خمسون), the last segment is 50.
 * For 500 (خمسمائة), the last segment is 500.
 */
function getLastSegment(n: number): number {
  if (n === 0) return 0;
  const remainder = n % 1000;
  if (remainder > 0) {
    // Within the last thousand group, we need the last sub-segment
    if (remainder % 100 === 0) return remainder; // exact hundreds
    return remainder % 100; // 1-99
  }
  // n is multiple of 1000
  const thousands = n / 1000;
  if (thousands <= 10) return n; // 1000-10000: treat as single segment
  const lastThousandRemainder = thousands % 100;
  if (lastThousandRemainder === 0) return 100; // exact hundred thousand
  return lastThousandRemainder;
}

/**
 * Converts a Jordanian Dinar amount to Arabic words.
 *
 * @param amount - The amount in Jordanian Dinars (e.g. 500.50)
 * @returns Arabic words representation
 *
 * @example
 * numberToArabicWords(500.50)  // "خمسمائة دينار أردني و خمسون فلساً"
 * numberToArabicWords(1250.00) // "ألف و مئتان و خمسون ديناراً أردنياً فقط"
 * numberToArabicWords(0.25)    // "خمسة و عشرون فلساً"
 * numberToArabicWords(1500.75) // "ألف و خمسمائة دينار أردني و خمسة و سبعون فلساً"
 */
export function numberToArabicWords(amount: number): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  const dinarWords = buildDinarString(integerPart);
  const filWords = buildFilString(decimalPart);

  if (dinarWords && filWords) {
    return `${dinarWords} و ${filWords}`;
  } else if (dinarWords) {
    return dinarWords;
  } else if (filWords) {
    return filWords;
  } else {
    return "صفر";
  }
}

function buildDinarString(n: number): string {
  if (n === 0) return "";

  const words = numberToWords(n);
  const lastSegment = getLastSegment(n);

  // Determine currency suffix based on last numeric segment
  // 1: singular, 2: dual, 3-10: plural, 11-99: singular accusative, 100+: singular genitive
  if (n === 1) {
    return `${words} دينار أردني`;
  } else if (n === 2) {
    return `${words} ديناران أردنيان`;
  } else if (lastSegment >= 3 && lastSegment <= 10) {
    return `${words} دنانير أردنية`;
  } else if (lastSegment >= 11 && lastSegment <= 99) {
    return `${words} ديناراً أردنياً`;
  } else {
    // hundreds, thousands, etc. — مضاف إليه
    return `${words} دينار أردني`;
  }
}

function buildFilString(n: number): string {
  if (n === 0) return "";

  const words = numberToWords(n);

  if (n === 1) {
    return `${words} فلس`;
  } else if (n === 2) {
    return `${words} فلسان`;
  } else if (n >= 3 && n <= 10) {
    return `${words} فلوس`;
  } else {
    // 11-99: singular accusative تمييز
    return `${words} فلساً`;
  }
}

/**
 * Formats an amount as a readable string with dinar and fils.
 * Example: 500.50 → "500 دينار و 50 فلس"
 */
export function formatDinarAmount(amount: number): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  if (decimalPart > 0) {
    return `${integerPart} دينار و ${decimalPart} فلس`;
  }
  return `${integerPart} دينار`;
}
