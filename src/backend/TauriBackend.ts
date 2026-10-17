/**
 * Tauri Backend
 *
 * Native backend: albe-core and SQLite behind Tauri commands.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {AppState, BillCounts, Rate, ReceiptGuess, Settings, Transaction, TxItem, Verdict} from "../Types";
import {invoke} from "@tauri-apps/api/core";
import type Backend from "./Backend";

/**
 * Tauri Backend
 */
export default class TauriBackend implements Backend {

    /** Public Methods
     ******************************************************
     */

    public getState = ():Promise<AppState> => invoke("get_state");

    public applyRate = (primary:string|null, fallback:string|null):Promise<Rate|null> => invoke("apply_rate", {primary, fallback});

    public setRate = (rate:Rate):Promise<void> => invoke("set_rate", {rate});

    public setSettings = (settings:Settings):Promise<void> => invoke("set_settings", {settings});

    public listTx = ():Promise<TxItem[]> => invoke("list_tx");

    public saveTx = (tx:Transaction):Promise<TxItem> => invoke("save_tx", {tx});

    public deleteTx = (id:string):Promise<void> => invoke("delete_tx", {id});

    public checkTx = (tx:Transaction):Promise<Verdict> => invoke("check_tx", {tx});

    public suggestChange = (dueLbp:number, rate:Rate):Promise<BillCounts> => invoke("suggest_change", {dueLbp, rate});

    public parseReceipt = (text:string):Promise<ReceiptGuess> => invoke("parse_receipt", {text});

    public impliedRate = (usdCents:number, lbp:number):Promise<number|null> => invoke("implied_rate", {usdCents, lbp});

}
