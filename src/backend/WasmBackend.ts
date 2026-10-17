/**
 * Wasm Backend
 *
 * Web / PWA backend: albe-core compiled to WebAssembly, data in IndexedDB.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {AppState, BillCounts, Rate, ReceiptGuess, Settings, Transaction, TxItem, Verdict} from "../Types";
import init, * as core from "../wasm/pkg/albe_wasm.js";
import {openDB, type IDBPDatabase} from "idb";
import type Backend from "./Backend";

const DB_NAME = "albe";
const DB_VERSION = 1;
const KEY_RATE = "rate";
const KEY_SETTINGS = "settings";

/**
 * Wasm Backend
 */
export default class WasmBackend implements Backend {

    /** Public Static Methods
     ******************************************************
     */

    /**
     * Create
     *
     * @return Backend with the WASM module loaded and the database open
     */
    public static create = async():Promise<WasmBackend> => {

        // Load core
        await init();

        // Open database
        const db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {

                db.createObjectStore("tx", {keyPath: "id"}).createIndex("created_at", "created_at");
                db.createObjectStore("kv");

            },
        });

        // Ask the browser not to evict the history
        navigator.storage?.persist?.().catch(() => false);

        return new WasmBackend(db);

    }

    /**
     * Constructor
     *
     * @param _db IndexedDB database
     */
    private constructor(private _db:IDBPDatabase) {}

    /** Public Methods
     ******************************************************
     */

    public getState = async():Promise<AppState> => {

        // Defaults from the core, then stored values
        const state = core.default_state() as AppState;
        const rate = await this._db.get("kv", KEY_RATE) as Rate|undefined;
        const settings = await this._db.get("kv", KEY_SETTINGS) as Partial<Settings>|undefined;

        return {
            rate: rate ?? state.rate,
            settings: {...state.settings, ...settings},
        };

    }

    public applyRate = async(primary:string|null, fallback:string|null):Promise<Rate|null> => {

        const rate = core.rate_from_payloads(primary ?? undefined, fallback ?? undefined, Math.floor(Date.now() / 1000)) as Rate|null;

        if(rate)
            await this._db.put("kv", rate, KEY_RATE);

        return rate;

    }

    public setRate = async(rate:Rate):Promise<void> => {

        await this._db.put("kv", rate, KEY_RATE);

    }

    public setSettings = async(settings:Settings):Promise<void> => {

        await this._db.put("kv", settings, KEY_SETTINGS);

    }

    public listTx = async():Promise<TxItem[]> => {

        // Newest first
        const list = (await this._db.getAllFromIndex("tx", "created_at") as (Transaction & {merchant?:string|null})[])
            .reverse()
            .map(({merchant, ...tx}) => ({...tx, label: tx.label ?? merchant ?? null, category: tx.category ?? null}));
        const tolerance = (await this.getState()).settings.tolerance_lbp;

        return list.map(tx => ({tx, verdict: core.check_tx(tx, tolerance) as Verdict}));

    }

    public saveTx = async(tx:Transaction):Promise<TxItem> => {

        await this._db.put("tx", tx);

        return {tx, verdict: await this.checkTx(tx)};

    }

    public deleteTx = async(id:string):Promise<void> => {

        await this._db.delete("tx", id);

    }

    public checkTx = async(tx:Transaction):Promise<Verdict> =>
        core.check_tx(tx, (await this.getState()).settings.tolerance_lbp) as Verdict;

    public suggestChange = async(dueLbp:number, rate:Rate):Promise<BillCounts> =>
        core.suggest_change(dueLbp, rate, (await this.getState()).settings) as BillCounts;

    public parseReceipt = async(text:string):Promise<ReceiptGuess> => core.parse_receipt(text) as ReceiptGuess;

    public impliedRate = async(usdCents:number, lbp:number):Promise<number|null> => core.implied_rate(usdCents, lbp) ?? null;

}
