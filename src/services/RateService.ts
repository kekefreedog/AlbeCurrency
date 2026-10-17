/**
 * Rate Service
 *
 * Refresh the official rate whenever the network is available. The webview
 * fetches the payloads (both sources allow CORS) and the Rust core validates
 * and caches them, so offline the last rate stays in use.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type Backend from "../backend/Backend";
import type {Rate} from "../Types";

const PRIMARY_URL = "https://open.er-api.com/v6/latest/USD";
const FALLBACK_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json";
const TIMEOUT_MS = 8000;
const MIN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Rate Service
 */
export default class RateService {

    /** Private Parameters
     ******************************************************
     */

    /** @var _lastAttempt Time of the last refresh attempt */
    private _lastAttempt = 0;

    /** @var _pending Refresh in progress */
    private _pending:Promise<Rate|null>|null = null;

    /**
     * Constructor
     *
     * @param _backend Backend that validates and caches the rate
     * @param _onRate Called with each newly cached rate
     */
    constructor(private _backend:Backend, private _onRate:(rate:Rate) => void) {}

    /** Public Methods
     ******************************************************
     */

    /**
     * Watch
     *
     * Refresh now, when coming back online and when the app returns to the
     * foreground (at most once an hour).
     */
    public watch = ():void => {

        this.refresh();

        window.addEventListener("online", () => this.refresh(true));

        document.addEventListener("visibilitychange", () => {

            if(document.visibilityState === "visible")
                this.refresh();

        });

    }

    /**
     * Refresh
     *
     * @param force Ignore the minimum interval
     * @return New rate, or null when offline or invalid
     */
    public refresh = (force:boolean = false):Promise<Rate|null> => {

        // Skip when offline or too recent
        if(!navigator.onLine || (!force && Date.now() - this._lastAttempt < MIN_INTERVAL_MS))
            return Promise.resolve(null);

        // Share a refresh already running
        if(this._pending)
            return this._pending;

        this._lastAttempt = Date.now();

        this._pending = this._fetchRate().finally(() => {
            this._pending = null;
        });

        return this._pending;

    }

    /** Private Methods
     ******************************************************
     */

    /**
     * Fetch Rate
     */
    private _fetchRate = async():Promise<Rate|null> => {

        // Primary source, fallback only when needed
        const primary = await this._fetchText(PRIMARY_URL);
        let rate = primary ? await this._backend.applyRate(primary, null) : null;

        if(!rate){

            const fallback = await this._fetchText(FALLBACK_URL);

            if(fallback)
                rate = await this._backend.applyRate(null, fallback);

        }

        // Notify
        if(rate)
            this._onRate(rate);

        return rate;

    }

    /**
     * Fetch Text
     *
     * @param url Source URL
     * @return Body, or null on any failure
     */
    private _fetchText = async(url:string):Promise<string|null> => {

        try {

            const response = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store"});

            return response.ok ? await response.text() : null;

        }catch{

            return null;

        }

    }

}
