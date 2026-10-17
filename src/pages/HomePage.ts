/**
 * Home Page
 *
 * Rate card and transaction history.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {formatDate, formatLbp, formatMoney, formatUsd} from "../utils/Format";
import RateCard from "../components/RateCard";
import {escapeHtml} from "../utils/Html";
import type {TxItem} from "../Types";
import type App from "../App";
import type {Page} from "../App";
import {icon} from "../utils/Icons";
import {t} from "../I18n";

/**
 * Home Page
 */
export default class HomePage implements Page {

    /** Public Parameters
     ******************************************************
     */

    /** @var el Root element */
    public el:HTMLElement;

    /** Private Parameters
     ******************************************************
     */

    /** @var _rateCard Rate card component */
    private _rateCard:RateCard;

    /**
     * Constructor
     *
     * @param _app Application
     */
    constructor(private _app:App) {

        // Layout
        this.el = document.createElement("div");
        this.el.className = "page home-page";
        this.el.innerHTML = `
            <header class="top-bar">
                <h1 class="top-bar-title">${t("appName")}</h1>
                <a class="icon-btn" href="#/settings" aria-label="${t("settings")}">${icon("settings")}</a>
            </header>
            <main class="page-content">
                <div class="rate-slot"></div>
                <h2 class="section-title">${t("history")}</h2>
                <div class="history"></div>
            </main>
            <a class="fab" href="#/tx/new" aria-label="${t("newTx")}">${icon("add")}</a>
        `;

        // Rate card
        this._rateCard = new RateCard(_app);
        this.el.querySelector(".rate-slot")!.append(this._rateCard.el);

        // History
        this._loadHistory();

    }

    /** Public Methods
     ******************************************************
     */

    public destroy = ():void => this._rateCard.destroy();

    /** Private Methods
     ******************************************************
     */

    /**
     * Load History
     */
    private _loadHistory = async():Promise<void> => {

        const list = this.el.querySelector(".history")!;
        const items = await this._app.backend.listTx();

        // Empty state
        if(!items.length){

            list.innerHTML = `<p class="empty-state">${icon("receipt")}<span>${t("emptyHistory")}</span></p>`;

            return;

        }

        list.innerHTML = items.map(this._renderItem).join("");

    }

    /**
     * Render Item
     *
     * @param item Transaction and its verdict
     */
    private _renderItem = ({tx, verdict}:TxItem):string => {

        // Type of the transaction
        const category = this._app.state.settings.categories.find(entry => entry.id === tx.category);
        const accent = category ? ` style="--item-accent:${escapeHtml(category.color)}"` : "";

        // Status line
        const ok = verdict.status === "ok";
        const status = ok ? t("statusOk") : `${formatUsd(verdict.gap_usd_cents)} · ${formatLbp(verdict.gap_lbp)}`;
        const sub = [category?.name, formatDate(tx.created_at)].filter(Boolean).join(" · ");

        // Return markup
        return `
            <a class="history-item ${verdict.status}${category ? " has-type" : ""}" href="#/tx/${encodeURIComponent(tx.id)}"${accent}>
                <span class="history-avatar">${category ? escapeHtml(category.emoji) : icon("receipt")}</span>
                <span class="history-main">
                    <span class="history-title">${escapeHtml(tx.label || formatMoney(tx.total))}</span>
                    <span class="history-sub">${escapeHtml(sub)}</span>
                    <span class="history-status">${icon(ok ? "ok" : "warning")}${status}</span>
                </span>
                <span class="history-amount">${formatMoney(tx.total)}</span>
            </a>
        `;

    }

}

