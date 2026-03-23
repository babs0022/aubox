const stripLeadingZeros = (value: string): string => {
  const normalized = value.replace(/^0+/, "");
  return normalized === "" ? "0" : normalized;
};

const multiplyDecimalStringByInt = (value: string, multiplier: number): string => {
  let carry = 0;
  let result = "";

  for (let i = value.length - 1; i >= 0; i -= 1) {
    const digit = Number(value[i]);
    const product = digit * multiplier + carry;
    result = String(product % 10) + result;
    carry = Math.floor(product / 10);
  }

  while (carry > 0) {
    result = String(carry % 10) + result;
    carry = Math.floor(carry / 10);
  }

  return stripLeadingZeros(result);
};

const addIntToDecimalString = (value: string, addend: number): string => {
  let carry = addend;
  let result = "";

  for (let i = value.length - 1; i >= 0; i -= 1) {
    const digit = Number(value[i]);
    const sum = digit + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }

  while (carry > 0) {
    result = String(carry % 10) + result;
    carry = Math.floor(carry / 10);
  }

  return stripLeadingZeros(result);
};

const hexToDecimalString = (value: string): string | null => {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }

  let result = "0";
  for (const char of value.slice(2)) {
    const nibble = parseInt(char, 16);
    if (Number.isNaN(nibble)) {
      return null;
    }
    result = multiplyDecimalStringByInt(result, 16);
    result = addIntToDecimalString(result, nibble);
  }

  return stripLeadingZeros(result);
};

const formatIntegerString = (value: string): string => {
  return stripLeadingZeros(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const shortenAddress = (value: string, left: number = 6, right: number = 4): string => {
  if (!value || value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
};

export const formatTimestamp = (value: string | number | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const formatHexInteger = (hex: string | null | undefined): string => {
  if (!hex || typeof hex !== "string") return "N/A";
  const parsed = hexToDecimalString(hex);
  if (parsed === null) return hex;
  return formatIntegerString(parsed);
};

export const formatHexTokenAmount = (
  hex: string | null | undefined,
  decimals: number = 18,
  symbol: string = "TOKEN"
): string => {
  if (!hex || typeof hex !== "string") return "N/A";
  const parsed = hexToDecimalString(hex);
  if (parsed === null) return hex;

  const safeDecimals = Math.max(0, Math.floor(decimals));
  const padded = parsed.padStart(safeDecimals + 1, "0");
  const whole = safeDecimals === 0 ? padded : padded.slice(0, -safeDecimals);
  const fractionRaw = safeDecimals === 0 ? "" : padded.slice(-safeDecimals);
  const fraction = fractionRaw.replace(/0+$/, "").slice(0, 6);

  if (!fraction) {
    return `${formatIntegerString(whole)} ${symbol}`;
  }

  return `${formatIntegerString(whole)}.${fraction} ${symbol}`;
};

export const formatOnchainValue = (value: string): string => {
  if (!value) return "N/A";

  if (value.startsWith("0x")) {
    return `${formatHexTokenAmount(value, 18, "units")} (raw ${value})`;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber.toLocaleString();
  }

  return value;
};
