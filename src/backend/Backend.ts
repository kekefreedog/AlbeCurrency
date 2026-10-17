/**
 * Backend
 *
 * Contract implemented by the native (Tauri) and web (WASM) backends.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {AppState, BillCounts, Rate, ReceiptGuess, Settings, Transaction, TxItem, Verdict} from "../Types";

export default interface Backend {

    /** Cached rate and settings */
    getState():Promise<AppState>;

    /** Validate fetched rate payloads, cache and return the rate if valid */
    applyRate(primary:string|null, fallback:string|null):Promise<Rate|null>;

    /** Replace the cached default rate */
    setRate(rate:Rate):Promise<void>;

    setSettings(settings:Settings):Promise<void>;

    /** History, newest first */
    listTx():Promise<TxItem[]>;

    saveTx(tx:Transaction):Promise<TxItem>;

    deleteTx(id:string):Promise<void>;

    checkTx(tx:Transaction):Promise<Verdict>;

    suggestChange(dueLbp:number, rate:Rate):Promise<BillCounts>;

    parseReceipt(text:string):Promise<ReceiptGuess>;

    /** Rate implied by the same total in both currencies, null if implausible */
    impliedRate(usdCents:number, lbp:number):Promise<number|null>;

}
