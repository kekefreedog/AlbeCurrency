/**
 * Rate Card
 *
 * Current default rate, its age and a manual refresh button.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {formatDate, formatLbp} from "../utils/Format";
import type {Rate, RateSource} from "../Types";
import {icon} from "../utils/Icons";
import type App from "../App";
import {t} from "../I18n";

/**
 * Source Label
 */
export const sourceLabel = (source:RateSource):string =>
    source === "bdl" ? t("rateBdl") : source === "receipt" ? t("rateReceipt") : t("rateManual");

/**
 * Rate Card
 */
export default class RateCard {

    /** Public Parameters
     ******************************************************
     */

    /** @var el Root element */
    public el:HTMLElement;

    /** Private Parameters
     ******************************************************
     */

    /** @var _unsubscribe Stop listening to rate changes */
    private _unsubscribe:() => void;

    /**
     * Constructor
     *
     * @param _app Application
     */
    constructor(private _app:App) {

        this.el = document.createElement("section");
        this.el.className = "rate-card";
        this._render(_app.state.rate);
        this._unsubscribe = _app.onRateChange(this._render);

    }

    /** Public Methods
     ******************************************************
     */

    public destroy = ():void => this._unsubscribe();

    /** Private Methods
     ******************************************************
     */

    /**
     * Render
     *
     * @param rate Rate to display
     */
    private _render = (rate:Rate):void => {

        // Content
        this.el.innerHTML = `
            <div class="rate-card-main">
                <span class="rate-card-label">$1 =</span>
                <span class="rate-card-value">${formatLbp(rate.lbp_per_usd)}</span>
            </div>
            <div class="rate-card-meta">
                <span class="source-chip ${rate.source}">${sourceLabel(rate.source)}</span>
                <span>${rate.fetched_at ? t("rateUpdated", {date: formatDate(rate.fetched_at)}) : t("rateNever")}</span>
            </div>
            <button type="button" class="icon-btn rate-card-refresh" aria-label="${t("refreshRate")}">${icon("refresh")}</button>
        `;

        // Manual refresh
        const button = this.el.querySelector<HTMLButtonElement>(".rate-card-refresh")!;

        button.addEventListener("click", async() => {

            button.classList.add("spinning");
            const fresh = await this._app.rates.refresh(true);
            button.classList.remove("spinning");

            this._app.toast(fresh ? t("rateRefreshed", {rate: formatLbp(fresh.lbp_per_usd)}) : t("rateOffline"));

        });

    }

}
