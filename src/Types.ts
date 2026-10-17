/**
 * Types
 *
 * Mirror of the albe-core serde models exchanged with the backends.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

export type Currency = "usd"|"lbp";

export type RateSource = "bdl"|"receipt"|"manual";

export type Status = "ok"|"missing"|"surplus"|"underpaid";

export interface Money {
    currency:Currency;
    /** Cents for USD, pounds for LBP */
    minor:number;
}

export interface Rate {
    lbp_per_usd:number;
    source:RateSource;
    /** Unix timestamp in seconds */
    fetched_at:number|null;
}

export interface Bill {
    currency:Currency;
    /** Face value in major units */
    value:number;
}

export interface BillCount {
    bill:Bill;
    count:number;
}

export type BillCounts = BillCount[];

export interface Denominations {
    usd:number[];
    lbp:number[];
}

export interface Category {
    id:string;
    name:string;
    emoji:string;
    /** Hex colour tinting the transaction */
    color:string;
}

export interface Settings {
    denominations:Denominations;
    tolerance_lbp:number;
    prefer_change:Currency;
    categories:Category[];
}

export interface Transaction {
    id:string;
    /** Unix timestamp in seconds */
    created_at:number;
    /** What the transaction was for */
    label:string|null;
    /** Category id */
    category:string|null;
    total:Money;
    rate:Rate;
    paid:BillCounts;
    returned:BillCounts;
}

export interface Verdict {
    status:Status;
    total_lbp:number;
    paid_lbp:number;
    due_change_lbp:number;
    returned_lbp:number;
    gap_lbp:number;
    gap_usd_cents:number;
    due_change_usd_cents:number;
}

export interface ReceiptGuess {
    total_usd_cents:number|null;
    total_lbp:number|null;
    rate:number|null;
    rate_inferred:boolean;
    merchant:string|null;
}

export interface TxItem {
    tx:Transaction;
    verdict:Verdict;
}

export interface AppState {
    rate:Rate;
    settings:Settings;
}
