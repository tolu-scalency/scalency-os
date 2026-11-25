"use client";

// A phone number box with a country code picker in front. The value it gives back is
// the full international number, e.g. "+447700900123", or "" while there are no digits.
// The country starts from the form's setting, else the visitor's time zone, else the UK.

import { useEffect, useMemo, useState, type CSSProperties } from "react";

/** Dialling codes by country (ISO 3166 two-letter code). */
export const DIAL: Record<string, string> = {
  GB: "44", US: "1", CA: "1", IE: "353", NG: "234", GH: "233", KE: "254", ZA: "27", AU: "61", NZ: "64",
  AE: "971", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", IN: "91", PK: "92", BD: "880", LK: "94",
  FR: "33", DE: "49", ES: "34", IT: "39", PT: "351", NL: "31", BE: "32", LU: "352", CH: "41", AT: "43",
  SE: "46", NO: "47", DK: "45", FI: "358", IS: "354", PL: "48", CZ: "420", SK: "421", HU: "36", RO: "40",
  BG: "359", GR: "30", CY: "357", MT: "356", HR: "385", SI: "386", RS: "381", BA: "387", ME: "382", MK: "389",
  AL: "355", EE: "372", LV: "371", LT: "370", UA: "380", MD: "373", BY: "375", RU: "7", TR: "90", IL: "972",
  JO: "962", LB: "961", EG: "20", MA: "212", DZ: "213", TN: "216", LY: "218", SN: "221", CI: "225", CM: "237",
  ET: "251", UG: "256", TZ: "255", RW: "250", ZM: "260", ZW: "263", BW: "267", NA: "264", MW: "265", MZ: "258",
  AO: "244", CD: "243", CG: "242", GA: "241", BJ: "229", TG: "228", BF: "226", ML: "223", NE: "227", SL: "232",
  LR: "231", GM: "220", GN: "224", MU: "230", SC: "248", SD: "249", SO: "252", DJ: "253", ER: "291", SS: "211",
  CN: "86", HK: "852", MO: "853", TW: "886", JP: "81", KR: "82", SG: "65", MY: "60", ID: "62", PH: "63",
  TH: "66", VN: "84", KH: "855", LA: "856", MM: "95", NP: "977", BT: "975", MV: "960", AF: "93", IR: "98",
  IQ: "964", SY: "963", YE: "967", KZ: "7", UZ: "998", KG: "996", TJ: "992", TM: "993", AZ: "994", GE: "995",
  AM: "374", MN: "976", MX: "52", BR: "55", AR: "54", CL: "56", CO: "57", PE: "51", VE: "58", EC: "593",
  BO: "591", PY: "595", UY: "598", GY: "592", SR: "597", CR: "506", PA: "507", GT: "502", HN: "504", SV: "503",
  NI: "505", BZ: "501", CU: "53", DO: "1", JM: "1", TT: "1", BB: "1", BS: "1", HT: "509", PR: "1",
  FJ: "679", PG: "675",
};

/** Countries where the leading 0 is part of the number and must be kept. */
const KEEP_ZERO = new Set(["IT", "SM", "VA"]);

const ZONE_COUNTRY: Record<string, string> = {
  "Europe/London": "GB", "Europe/Dublin": "IE", "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA", "Asia/Dubai": "AE", "Asia/Kolkata": "IN", "Asia/Karachi": "PK", "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES",
  "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Lisbon": "PT", "Asia/Singapore": "SG",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
};

export function guessCountry(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone];
    if (zone.startsWith("America/")) return "US";
  } catch {}
  return "GB";
}

const flag = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** Country names in English, sorted, with the UK and the default first. */
function useCountries(first: string) {
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames(["en-GB"], { type: "region" });
    } catch {}
    const all = Object.keys(DIAL).map((iso) => ({ iso, name: names?.of(iso) ?? iso, dial: DIAL[iso] }));
    all.sort((a, b) => a.name.localeCompare(b.name));
    const top = [first, "GB", "US"].filter((x, i, a) => DIAL[x] && a.indexOf(x) === i);
    return [...top.map((iso) => all.find((c) => c.iso === iso)!), ...all.filter((c) => !top.includes(c.iso))];
  }, [first]);
}

/** Split a stored "+447700900123" back into a country and the rest, preferring the current country. */
function split(value: string, current: string): { iso: string; national: string } {
  const v = value.replace(/[^\d+]/g, "");
  if (!v.startsWith("+")) return { iso: current, national: value };
  const digits = v.slice(1);
  if (DIAL[current] && digits.startsWith(DIAL[current])) return { iso: current, national: digits.slice(DIAL[current].length) };
  const match = Object.entries(DIAL)
    .filter(([, d]) => digits.startsWith(d))
    .sort((a, b) => b[1].length - a[1].length)[0];
  return match ? { iso: match[0], national: digits.slice(match[1].length) } : { iso: current, national: value };
}

export function combine(iso: string, national: string): string {
  let n = national.replace(/[^\d]/g, "");
  if (!n) return "";
  if (national.trim().startsWith("+")) return "+" + n; // they typed a full international number
  if (n.startsWith("00")) return "+" + n.slice(2);
  if (n.startsWith("0") && !KEEP_ZERO.has(iso)) n = n.replace(/^0+/, "");
  return `+${DIAL[iso] ?? "44"}${n}`;
}

export function PhoneInput({
  value,
  onChange,
  country,
  placeholder,
  readOnly,
  style,
  selectStyle,
  autoComplete = "tel-national",
  name,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Starting country (ISO code). Empty: guess from the visitor's time zone. */
  country?: string;
  placeholder?: string;
  readOnly?: boolean;
  style: CSSProperties;
  selectStyle?: CSSProperties;
  autoComplete?: string;
  name?: string;
  className?: string;
}) {
  const [iso, setIso] = useState(country && DIAL[country] ? country : "GB");
  const [national, setNational] = useState(() => split(value, iso).national);
  const countries = useCountries(iso);

  useEffect(() => {
    if (country && DIAL[country]) return;
    const g = guessCountry();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the visitor's time zone is only known in the browser
    if (!value) setIso(g);
  }, [country, value]);

  function pick(next: string) {
    setIso(next);
    if (national) onChange(combine(next, national));
  }

  return (
    <span style={{ display: "flex", gap: 8, width: "100%" }}>
      <span style={{ position: "relative", flex: "0 0 auto" }}>
        <select
          aria-label="Country code"
          className={className}
          value={iso}
          disabled={readOnly}
          onChange={(e) => pick(e.target.value)}
          style={{ ...style, ...selectStyle, width: 112, paddingRight: 26, appearance: "none", WebkitAppearance: "none", cursor: readOnly ? "default" : "pointer", color: "transparent" }}
        >
          {countries.map((c) => (
            <option key={c.iso} value={c.iso} style={{ color: "#0b2447" }}>
              {flag(c.iso)} {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        {/* The closed picker shows just the flag and code. */}
        <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 26px 0 12px", pointerEvents: "none", fontSize: 15, color: style.color }}>
          <span>{flag(iso)}</span>
          <span>+{DIAL[iso]}</span>
        </span>
        <span aria-hidden style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, opacity: 0.6, pointerEvents: "none", color: style.color }}>▼</span>
      </span>
      <input
        type="tel"
        inputMode="tel"
        className={className}
        name={name}
        autoComplete={autoComplete}
        value={national}
        placeholder={placeholder || (iso === "GB" ? "07700 900123" : "Phone number")}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        onChange={(e) => {
          const raw = e.target.value.slice(0, 25);
          // Someone pasted a full "+234…" number: switch the country to match.
          if (raw.trim().startsWith("+")) {
            const s = split(raw, iso);
            if (s.iso !== iso && s.national !== raw) {
              setIso(s.iso);
              setNational(s.national);
              onChange(combine(s.iso, s.national));
              return;
            }
          }
          setNational(raw);
          onChange(combine(iso, raw));
        }}
        style={{ ...style, flex: 1, minWidth: 0 }}
      />
    </span>
  );
}
