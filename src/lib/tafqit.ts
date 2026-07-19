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
    parts.push(UNITS_MASCULINE[remainder]);
  } else if (remainder < 20) {
    parts.push(TEENS[remainder]);
  } else {
    const tens = Math.floor(remainder / 10) * 10;
    const units = remainder % 10;
    if (units === 0) {
      parts.push(TENS[tens]);
    } else {
      parts.push(`${UNITS_MASCULINE[units]} و ${TENS[tens]}`);
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
    parts.push(rWord);
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
  // n is a pure multiple of 1000: the last spoken word is ألف/آلاف/ألفاً, after
  // which the counted currency noun is مضاف إليه and always takes the SINGULAR
  // form ("أحد عشر ألفاً دينار أردني", never "...ديناراً أردنياً"). Return a
  // value outside the plural (3-10) and accusative (11-99) ranges so
  // buildCurrencyString selects the singular.
  // (The wording of the thousands themselves above 99,999 -- e.g. "مائة ألف" --
  // is out of range for any real kindergarten amount and left as-is.)
  return 1000;
}

interface CurrencyNounForms {
  singular: string;
  dual: string;
  plural: string;
  accusative: string;
}

/**
 * Applies Arabic numeral-noun agreement (1=bare singular, 2=bare dual,
 * 3-10=plural, 11-99=singular accusative, 100+=singular) to build a
 * currency phrase. Shared by dinar and fils since the grammar rule is
 * identical for both, only the noun forms differ.
 */
function buildCurrencyString(n: number, forms: CurrencyNounForms): string {
  if (n === 0) return "";
  if (n === 1) return forms.singular;
  if (n === 2) return forms.dual;

  const words = numberToWords(n);
  const lastSegment = getLastSegment(n);

  if (lastSegment >= 3 && lastSegment <= 10) {
    return `${words} ${forms.plural}`;
  } else if (lastSegment >= 11 && lastSegment <= 99) {
    return `${words} ${forms.accusative}`;
  }
  // hundreds, thousands, etc. — مضاف إليه, uses the singular noun form
  return `${words} ${forms.singular}`;
}

function buildDinarString(n: number): string {
  return buildCurrencyString(n, {
    singular: "دينار أردني",
    dual: "ديناران أردنيان",
    plural: "دنانير أردنية",
    accusative: "ديناراً أردنياً",
  });
}

function buildFilString(n: number): string {
  return buildCurrencyString(n, {
    singular: "فلس",
    dual: "فلسان",
    plural: "فلوس",
    accusative: "فلساً",
  });
}

/**
 * Splits an amount into a non-negative whole-dinar part and a 0-999 fils
 * part, carrying into the dinar part if rounding pushes fils to 1000.
 * Exported so callers (e.g. the receipt PDF's dinar/fils boxes) share this
 * math instead of re-deriving it and risking the two copies drifting apart.
 */
export function splitDinarFils(absAmount: number): { dinars: number; fils: number } {
  const dinars = Math.floor(absAmount);
  const fils = Math.round((absAmount - dinars) * 1000);
  if (fils === 1000) {
    return { dinars: dinars + 1, fils: 0 };
  }
  return { dinars, fils };
}

/**
 * Converts a Jordanian Dinar amount to Arabic words. Jordanian fils are
 * thousandths of a dinar (3 decimal places), not cents.
 *
 * @param amount - The amount in Jordanian Dinars (e.g. 500.50)
 * @returns Arabic words representation
 *
 * @example
 * numberToArabicWords(500.050)  // "خمسمائة دينار أردني و خمسون فلساً"
 * numberToArabicWords(1250.00)  // "ألف و مئتان و خمسون ديناراً أردنياً"
 * numberToArabicWords(0.025)    // "خمسة و عشرون فلساً"
 * numberToArabicWords(1500.750) // "ألف و خمسمائة دينار أردني و سبعمائة و خمسون فلساً"
 */
export function numberToArabicWords(amount: number): string {
  if (amount < 0) {
    return `سالب ${numberToArabicWords(-amount)}`;
  }

  const { dinars, fils } = splitDinarFils(amount);

  const dinarWords = buildDinarString(dinars);
  const filWords = buildFilString(fils);

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

/**
 * Formats an amount as a readable numeric string with dinar and fils.
 * Example: 500.050 → "500 دينار و 50 فلس"
 */
export function formatDinarAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const { dinars, fils } = splitDinarFils(Math.abs(amount));

  if (fils > 0) {
    return `${sign}${dinars} دينار و ${fils} فلس`;
  }
  return `${sign}${dinars} دينار`;
}
