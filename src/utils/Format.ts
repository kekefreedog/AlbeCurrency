/**
 * Format
 *
 * Display helpers for USD and LBP amounts, using the Lebanese habits
 * ("$12.50", "1,074,000 LL", "100k").
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {Bill, BillCounts, Currency, Money} from "../Types";

const GROUPING = new Intl.NumberFormat("en-US");

/**
 * Format Usd
 *
 * @param cents Amount in cents
 * @return "$12.50", or "$12" when there are no cents
 */
export const formatUsd = (cents:number):string => {

    // Prepare parts
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    const whole = GROUPING.format(Math.floor(abs / 100));
    const rest = abs % 100;

    // Return result
    return rest ? `${sign}$${whole}.${String(rest).padStart(2, "0")}` : `${sign}$${whole}`;

};

/**
 * Format Lbp
 *
 * @param pounds Amount in LBP
 * @return "1,074,000 LL"
 */
export const formatLbp = (pounds:number):string => `${GROUPING.format(Math.round(pounds))} LL`;

/**
 * Format Money
 */
export const formatMoney = (money:Money):string =>
    money.currency === "usd" ? formatUsd(money.minor) : formatLbp(money.minor);

/**
 * Format Bill Label
 *
 * @param bill Banknote
 * @return Short label for a keyboard key: "20", "100k", "1k"
 */
export const formatBillValue = (bill:Bill):string => {

    // Large LBP notes are shortened
    if(bill.currency === "lbp" && bill.value >= 1000)
        return `${GROUPING.format(bill.value / 1000)}k`;

    return GROUPING.format(bill.value);

};

/**
 * Currency Symbol
 */
export const currencySymbol = (currency:Currency):string => currency === "usd" ? "$" : "LL";

/**
 * Sum Of Currency
 *
 * @param counts Banknote counts
 * @param currency Currency to sum
 * @return Sum in minor units (cents for USD)
 */
export const sumOf = (counts:BillCounts, currency:Currency):number => counts
    .filter(entry => entry.bill.currency === currency)
    .reduce((sum, entry) => sum + entry.bill.value * entry.count * (currency === "usd" ? 100 : 1), 0);

/**
 * Format Counts
 *
 * @param counts Banknote counts
 * @return "2 × $20 · 1 × 100k LL", or "—" when empty
 */
export const formatCounts = (counts:BillCounts):string => counts.length
    ? counts.map(entry => `${entry.count} × ${entry.bill.currency === "usd" ? "$" : ""}${formatBillValue(entry.bill)}${entry.bill.currency === "lbp" ? " LL" : ""}`).join(" · ")
    : "—";

/**
 * Format Date
 *
 * @param seconds Unix timestamp in seconds
 */
export const formatDate = (seconds:number):string => new Date(seconds * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

/**
 * Parse Amount
 *
 * Read a typed amount, accepting "12.5", "12,50" and "1,074,000".
 *
 * @param input Raw text
 * @param currency Currency of the amount
 * @return Minor units, or null when unreadable
 */
export const parseAmount = (input:string, currency:Currency):number|null => {

    // Clean input
    let text = input.replace(/[\s$]|LL|LBP/gi, "");

    if(!text)
        return null;

    // Decimal separator is the last "." or "," followed by 1 or 2 digits
    const decimal = /[.,](\d{1,2})$/.exec(text);
    let cents = 0;

    if(decimal && currency === "usd"){

        cents = Number(decimal[1].padEnd(2, "0"));
        text = text.slice(0, decimal.index);

    }

    // Remove thousands separators
    const whole = Number(text.replace(/[.,]/g, ""));

    if(!Number.isFinite(whole))
        return null;

    // Return result
    return currency === "usd" ? whole * 100 + cents : whole;

};
