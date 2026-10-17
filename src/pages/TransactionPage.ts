/**
 * Transaction Page
 *
 * One screen for a payment: the receipt on top, a live summary, then a
 * single banknote keyboard switching between "I give" and "I get back".
 * The verdict updates on every key tap.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {formatLbp, formatMoney, formatUsd, parseAmount, sumOf} from "../utils/Format";
import type {BillCounts, Category, Currency, Rate, Transaction, Verdict} from "../Types";
import {renderChangeSuggestion} from "../components/ChangeSuggestion";
import {openCategoryDialog} from "../components/CategoryDialog";
import BillKeyboard from "../components/BillKeyboard";
import {sourceLabel} from "../components/RateCard";
import {escapeHtml} from "../utils/Html";
import {recognize} from "../services/Ocr";
import {icon} from "../utils/Icons";
import type {Page} from "../App";
import type App from "../App";
import {t} from "../I18n";

type Side = "paid"|"returned";

/**
 * Transaction Page
 */
export default class TransactionPage implements Page {

    /** Public Parameters
     ******************************************************
     */

    /** @var el Root element */
    public el:HTMLElement;

    /** Private Parameters
     ******************************************************
     */

    /** @var _tx Draft transaction */
    private _tx:Transaction;

    /** @var _isNew Not saved yet */
    private _isNew:boolean;

    /** @var _side Counts edited by the keyboard */
    private _side:Side = "paid";

    /** @var _keyboard Banknote keyboard */
    private _keyboard:BillKeyboard|null = null;

    /** @var _texts Totals as typed, per currency */
    private _texts:Record<Currency, string> = {usd: "", lbp: ""};

    /** @var _typed Totals typed by the user; the others are computed */
    private _typed:Record<Currency, boolean> = {usd: false, lbp: false};

    /** @var _refreshId Ignore stale async refreshes */
    private _refreshId = 0;

    /**
     * Constructor
     *
     * @param _app Application
     * @param id Transaction to open, null for a new one
     */
    constructor(private _app:App, id:string|null) {

        this._isNew = id === null;
        this._tx = this._newDraft();

        // Layout
        this.el = document.createElement("div");
        this.el.className = "page tx-page";
        this.el.innerHTML = `
            <header class="top-bar">
                <a class="icon-btn" href="#/" aria-label="${t("back")}">${icon("back")}</a>
                <h1 class="top-bar-title">${this._isNew ? t("newTx") : "…"}</h1>
                <button type="button" class="icon-btn tx-delete" aria-label="${t("delete")}" ${this._isNew ? "hidden" : ""}>${icon("delete")}</button>
            </header>
            <main class="page-content tx-content"></main>
            <footer class="bottom-bar">
                <button type="button" class="btn btn-filled tx-save">${icon("ok")}${t("save")}</button>
            </footer>
        `;

        // Events
        this.el.querySelector(".tx-save")!.addEventListener("click", this._onSave);
        this.el.querySelector(".tx-delete")!.addEventListener("click", this._onDelete);

        // Load or start
        if(id === null)
            this._render();
        else
            this._load(id);

    }

    /** Private Methods | Init
     ******************************************************
     */

    /**
     * New Draft
     */
    private _newDraft = ():Transaction => ({
        id: crypto.randomUUID(),
        created_at: Math.floor(Date.now() / 1000),
        label: null,
        category: null,
        total: {currency: "usd", minor: 0},
        rate: {...this._app.state.rate},
        paid: [],
        returned: [],
    });

    /**
     * Load
     *
     * @param id Transaction id
     */
    private _load = async(id:string):Promise<void> => {

        const item = (await this._app.backend.listTx()).find(entry => entry.tx.id === id);

        // Unknown id
        if(!item){

            this._app.navigate("/");

            return;

        }

        // Show the change side, it is what is checked
        this._tx = item.tx;
        this._setTypedTotal(item.tx.total.currency, item.tx.total.minor);
        this._side = item.tx.returned.length ? "returned" : "paid";
        this.el.querySelector(".top-bar-title")!.textContent = item.tx.label || formatMoney(item.tx.total);
        this._render();

    }

    /** Private Methods | Rendering
     ******************************************************
     */

    /**
     * Render
     */
    private _render = ():void => {

        const content = this.el.querySelector<HTMLElement>(".tx-content")!;

        // Layout
        content.innerHTML = `
            <section class="ticket-card">
                <div class="total-row">
                    ${this._renderTotalField("usd")}
                    ${this._renderTotalField("lbp")}
                    <button type="button" class="icon-btn scan-btn" aria-label="${t("scan")}">${icon("camera")}</button>
                    <input type="file" class="scan-input" accept="image/*" capture="environment" hidden>
                </div>
                <div class="scan-progress progress" hidden><div class="indeterminate"></div></div>
                <div class="ticket-meta">
                    <label class="rate-inline">
                        <span>$1 =</span>
                        <input type="text" id="tx-rate" inputmode="numeric" autocomplete="off" value="${this._tx.rate.lbp_per_usd}" aria-label="${t("rate")}">
                        <span>LL</span>
                    </label>
                    <button type="button" class="source-chip ${this._tx.rate.source}" title="${t("useBdl")}">${sourceLabel(this._tx.rate.source)}</button>
                </div>
                <input type="text" id="tx-label" class="label-inline" placeholder="${t("label")}" autocomplete="off" value="${escapeHtml(this._tx.label ?? "")}">
                <div class="category-chips" role="radiogroup" aria-label="${t("type")}"></div>
            </section>

            <section class="summary-card"></section>

            <div class="segmented side-toggle" role="tablist">
                <button type="button" role="tab" data-side="paid" aria-selected="${this._side === "paid"}">
                    <span>${t("modePaid")}</span><small class="side-total" data-side="paid"></small>
                </button>
                <button type="button" role="tab" data-side="returned" aria-selected="${this._side === "returned"}">
                    <span>${t("modeReturned")}</span><small class="side-total" data-side="returned"></small>
                </button>
            </div>
        `;

        // Keyboard
        this._keyboard = new BillKeyboard(this._app.state.settings.denominations, this._tx[this._side], counts => {

            this._tx[this._side] = counts;
            this._refresh();

        });
        this._keyboard.el.classList.add(`side-${this._side}`);
        content.append(this._keyboard.el);

        this._bindTicket(content);
        this._bindSides(content);
        this._renderCategories();
        this._updateDerived();
        this._refresh();

    }

    /**
     * Render Categories
     *
     * Type chips; the selected type tints the whole screen.
     */
    private _renderCategories = ():void => {

        const container = this.el.querySelector<HTMLElement>(".category-chips");

        if(!container)
            return;

        // Chips
        container.innerHTML = this._app.state.settings.categories.map(category => `
            <button type="button" class="category-chip" role="radio" data-id="${escapeHtml(category.id)}"
                style="--chip-color:${escapeHtml(category.color)}" aria-checked="${category.id === this._tx.category}">
                <span>${escapeHtml(category.emoji)}</span>${escapeHtml(category.name)}
            </button>
        `).join("") + `<button type="button" class="category-chip category-add" aria-label="${t("newType")}">${icon("add")}${t("newTypeShort")}</button>`;

        // Select / unselect
        container.querySelectorAll<HTMLButtonElement>(".category-chip[data-id]").forEach(chip => chip.addEventListener("click", () => {

            this._tx.category = this._tx.category === chip.dataset.id ? null : chip.dataset.id!;
            this._renderCategories();

        }));

        // New type
        container.querySelector(".category-add")!.addEventListener("click", async() => {

            const result = await openCategoryDialog(null);

            if(result?.action !== "save")
                return;

            await this._addCategory(result.category);
            this._tx.category = result.category.id;
            this._renderCategories();

        });

        this._applyAccent();

    }

    /**
     * Apply Accent
     *
     * Tint the screen with the colour of the selected type.
     */
    private _applyAccent = ():void => {

        const category = this._category();

        if(category)
            this.el.style.setProperty("--tx-accent", category.color);
        else
            this.el.style.removeProperty("--tx-accent");

    }

    /**
     * Render Total Field
     *
     * @param currency Currency of the field
     */
    private _renderTotalField = (currency:Currency):string => {

        const label = t(currency === "usd" ? "totalUsd" : "totalLbp");

        return `
            <fieldset class="form-field animated total-field" data-currency="${currency}">
                <legend>${label}</legend>
                <input type="text" id="tx-total-${currency}" placeholder="${label}" inputmode="${currency === "usd" ? "decimal" : "numeric"}" autocomplete="off" value="${escapeHtml(this._texts[currency])}">
                <label for="tx-total-${currency}">${label}</label>
            </fieldset>
        `;

    }

    /**
     * Update Derived
     *
     * Fill the total that was not typed with its conversion at the current rate.
     */
    private _updateDerived = ():void => {

        const rate = this._tx.rate.lbp_per_usd;
        const {currency, minor} = this._tx.total;

        for(const target of ["usd", "lbp"] as Currency[]){

            const field = this.el.querySelector<HTMLElement>(`.total-field[data-currency="${target}"]`);
            const input = field?.querySelector("input");

            if(!field || !input)
                continue;

            field.classList.toggle("derived", !this._typed[target]);

            // Typed fields keep the user's text
            if(this._typed[target])
                continue;

            // Converted value, empty when nothing to convert
            let value = "";

            if(minor && rate && currency !== target)
                value = target === "lbp"
                    ? plainLbp(Math.round(minor * rate / 100))
                    : plainUsd(Math.round(minor * 100 / rate));

            input.value = value;

        }

    }

    /**
     * Refresh
     *
     * Ask the core for the verdict and ideal change, then update the summary.
     */
    private _refresh = async():Promise<void> => {

        const id = ++this._refreshId;

        // Verdict and suggestion
        const verdict = await this._app.backend.checkTx(this._tx);
        const suggestion = verdict.due_change_lbp > 0 && this._tx.paid.length
            ? await this._app.backend.suggestChange(verdict.due_change_lbp, this._tx.rate)
            : [];

        // A newer refresh started meanwhile
        if(id !== this._refreshId)
            return;

        this._updateSummary(verdict, suggestion);
        this._updateSideTotals();

    }

    /**
     * Update Summary
     *
     * @param verdict Verdict from the core
     * @param suggestion Ideal change
     */
    private _updateSummary = (verdict:Verdict, suggestion:BillCounts):void => {

        const card = this.el.querySelector(".summary-card");

        if(!card)
            return;

        // Nothing typed yet
        if(!this._tx.total.minor){

            card.innerHTML = `<p class="summary-empty">${icon("receipt")}<span>${t("totalRequired")}</span></p>`;

            return;

        }

        // Rows
        const rows:[string, string, string?][] = [[t("toPay"), this._both(verdict.total_lbp)]];

        if(this._tx.paid.length){

            rows.push([t("given"), this._givenText(this._tx.paid)]);
            rows.push(verdict.due_change_lbp < 0
                ? [t("remaining"), this._both(-verdict.due_change_lbp), "warn"]
                : [t("expectedChange"), this._both(verdict.due_change_lbp), "strong"]);


        }

        if(this._tx.returned.length)
            rows.push([t("returned"), this._givenText(this._tx.returned)]);

        // Status once there is something to judge
        const judged = this._tx.paid.length && (this._tx.returned.length || verdict.status === "underpaid" || verdict.due_change_lbp === 0);

        // Ideal change until the right change is counted
        const showSuggestion = this._tx.paid.length && verdict.due_change_lbp > 0 && verdict.status !== "ok";

        card.innerHTML = rows.map(([label, value, kind = ""]) => `
            <div class="summary-row ${kind}"><span>${label}</span><span>${value}</span></div>
        `).join("") + (showSuggestion ? renderChangeSuggestion(suggestion) : "") + (judged ? this._statusLine(verdict) : "");

    }

    /**
     * Update Side Totals
     */
    private _updateSideTotals = ():void => {

        this.el.querySelectorAll<HTMLElement>(".side-total").forEach(small => {

            small.textContent = this._givenText(this._tx[small.dataset.side as Side]);

        });

    }

    /** Private Methods | Events
     ******************************************************
     */

    /**
     * Bind Ticket
     *
     * @param content Page content
     */
    private _bindTicket = (content:HTMLElement):void => {

        // Totals: typing one computes the other, typing both gives the rate
        content.querySelectorAll<HTMLElement>(".total-field").forEach(field => {

            const currency = field.dataset.currency as Currency;
            const input = field.querySelector("input")!;

            // A computed value is replaced as soon as the user types
            input.addEventListener("focus", () => {

                if(!this._typed[currency])
                    input.select();

            });

            input.addEventListener("input", () => {

                this._texts[currency] = input.value;
                this._typed[currency] = input.value.trim() !== "";
                this._applyTotals();

            });

        });

        // Rate typed by hand
        content.querySelector<HTMLInputElement>("#tx-rate")!.addEventListener("input", event => {

            const value = parseAmount((event.target as HTMLInputElement).value, "lbp");
            this._untypeLbpIfBoth();
            this._setRate({lbp_per_usd: value ?? 0, source: "manual", fetched_at: null});

        });

        // Chip resets to the BDL rate
        content.querySelector(".ticket-meta .source-chip")!.addEventListener("click", () => {

            this._untypeLbpIfBoth();
            this._setRate({...this._app.state.rate});

        });

        // Merchant
        content.querySelector<HTMLInputElement>("#tx-label")!.addEventListener("input", event => {

            this._tx.label = (event.target as HTMLInputElement).value.trim() || null;

        });

        // Scan
        const fileInput = content.querySelector<HTMLInputElement>(".scan-input")!;

        content.querySelector(".scan-btn")!.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {

            const file = fileInput.files?.[0];
            fileInput.value = "";

            if(file)
                this._scan(file);

        });

    }

    /**
     * Bind Sides
     *
     * Switch the keyboard between "I give" and "I get back".
     *
     * @param content Page content
     */
    private _bindSides = (content:HTMLElement):void => {

        content.querySelectorAll<HTMLButtonElement>(".side-toggle button").forEach(button => button.addEventListener("click", () => {

            this._side = button.dataset.side as Side;

            content.querySelectorAll(".side-toggle button").forEach(other => other.setAttribute("aria-selected", String(other === button)));
            this._keyboard?.el.classList.toggle("side-paid", this._side === "paid");
            this._keyboard?.el.classList.toggle("side-returned", this._side === "returned");
            this._keyboard?.setCounts(this._tx[this._side]);

        }));

    }

    /**
     * On Save
     */
    private _onSave = async():Promise<void> => {

        if(!this._validate())
            return;

        await this._app.backend.saveTx(this._tx);
        this._app.toast(t("saved"));
        this._app.navigate("/");

    }

    /**
     * On Delete
     */
    private _onDelete = async():Promise<void> => {

        await this._app.backend.deleteTx(this._tx.id);
        this._app.toast(t("deleted"));
        this._app.navigate("/");

    }

    /**
     * Scan
     *
     * OCR the receipt photo, then let the core extract total and rate.
     *
     * @param file Photo of the receipt
     */
    private _scan = async(file:File):Promise<void> => {

        const progress = this.el.querySelector<HTMLElement>(".scan-progress");
        progress?.removeAttribute("hidden");
        this._app.toast(t("scanning"));

        try {

            // Read and parse
            const guess = await this._app.backend.parseReceipt(await recognize(file));

            if(guess.total_usd_cents === null && guess.total_lbp === null)
                throw new Error("no total");

            // Shop name as label, unless one was typed
            if(guess.merchant && !this._tx.label)
                this._tx.label = guess.merchant;

            // Rate printed on the receipt (or deduced from both totals)
            if(guess.rate)
                this._tx.rate = {lbp_per_usd: guess.rate, source: "receipt", fetched_at: null};

            // Totals found, USD is the reference since prices are set in dollars
            this._typed = {usd: false, lbp: false};
            this._texts = {usd: "", lbp: ""};

            if(guess.total_lbp !== null)
                this._setTypedTotal("lbp", guess.total_lbp);

            if(guess.total_usd_cents !== null)
                this._setTypedTotal("usd", guess.total_usd_cents);

            this._app.toast(t("scanFound", {total: formatMoney(this._tx.total)}));
            this._render();

        }catch{

            this._app.toast(t("scanFailed"));

        }finally{

            progress?.setAttribute("hidden", "");

        }

    }

    /** Private Methods | Utilities
     ******************************************************
     */

    /**
     * Set Rate
     *
     * @param rate New transaction rate
     */
    private _setRate = (rate:Rate, updateInput:boolean = true):void => {

        this._tx.rate = rate;

        // Rate field, unless the user is typing in it
        const input = this.el.querySelector<HTMLInputElement>("#tx-rate");

        if(input && updateInput && document.activeElement !== input)
            input.value = String(rate.lbp_per_usd);

        // Source chip
        const chip = this.el.querySelector(".ticket-meta .source-chip");

        if(chip){

            chip.className = `source-chip ${rate.source}`;
            chip.textContent = sourceLabel(rate.source);

        }

        this._updateDerived();
        this._refresh();

    }

    /**
     * Apply Totals
     *
     * USD is the reference total when typed. When both are typed the rate of
     * the receipt is deduced from them.
     */
    private _applyTotals = async():Promise<void> => {

        const usd = this._typed.usd ? parseAmount(this._texts.usd, "usd") : null;
        const lbp = this._typed.lbp ? parseAmount(this._texts.lbp, "lbp") : null;

        // Total
        if(usd)
            this._tx.total = {currency: "usd", minor: usd};
        else if(lbp)
            this._tx.total = {currency: "lbp", minor: lbp};
        else
            this._tx.total = {currency: "usd", minor: 0};

        // Both totals: rate of the receipt
        if(usd && lbp){

            const rate = await this._app.backend.impliedRate(usd, lbp);

            if(rate){

                this._setRate({lbp_per_usd: rate, source: "receipt", fetched_at: null});

                return;

            }

        }

        this._updateDerived();
        this._refresh();

    }

    /**
     * Set Typed Total
     *
     * @param currency Currency of the total
     * @param minor Amount in minor units
     */
    private _setTypedTotal = (currency:Currency, minor:number):void => {

        this._typed[currency] = minor > 0;
        this._texts[currency] = minor > 0 ? (currency === "usd" ? plainUsd(minor) : plainLbp(minor)) : "";

        // Reference total stays USD when both are known
        if(currency === "usd" || !this._typed.usd)
            this._tx.total = {currency, minor};

    }

    /**
     * Untype Lbp If Both
     *
     * When the rate is changed by hand, the LL total becomes computed again.
     */
    private _untypeLbpIfBoth = ():void => {

        if(!this._typed.usd || !this._typed.lbp)
            return;

        this._typed.lbp = false;
        this._texts.lbp = "";
        this._tx.total = {currency: "usd", minor: parseAmount(this._texts.usd, "usd") ?? 0};

    }

    private _validate = ():boolean => {

        if(this._tx.total.minor <= 0){

            this._app.toast(t("totalRequired"));

            return false;

        }

        if(this._tx.rate.lbp_per_usd <= 0){

            this._app.toast(t("rateRequired"));

            return false;

        }

        return true;

    }

    private _category = ():Category|null =>
        this._app.state.settings.categories.find(category => category.id === this._tx.category) ?? null;

    /**
     * Add Category
     *
     * @param category New type, saved in the settings
     */
    private _addCategory = async(category:Category):Promise<void> => {

        const settings = {...this._app.state.settings, categories: [...this._app.state.settings.categories, category]};

        await this._app.backend.setSettings(settings);
        this._app.state.settings = settings;

    }

    private _toUsdCents = (lbp:number):number =>
        this._tx.rate.lbp_per_usd ? Math.round(lbp * 100 / this._tx.rate.lbp_per_usd) : 0;

    /** Both currencies: "$8 · 716,000 LL" */
    private _both = (lbp:number):string => `${formatUsd(this._toUsdCents(lbp))} · ${formatLbp(lbp)}`;

    /** Per currency sums of counted notes */
    private _givenText = (counts:BillCounts):string => {

        const usd = sumOf(counts, "usd");
        const lbp = sumOf(counts, "lbp");
        const parts = [usd ? formatUsd(usd) : "", lbp ? formatLbp(lbp) : ""].filter(Boolean);

        return parts.length ? parts.join(" + ") : "—";

    }

    private _statusText = (verdict:Verdict):string => {

        const vars = {
            usd: formatUsd(Math.abs(verdict.gap_usd_cents)),
            lbp: formatLbp(Math.abs(verdict.gap_lbp)),
        };

        switch(verdict.status){
            case "ok":
                return t("statusOk");
            case "missing":
                return t("statusMissing", vars);
            case "surplus":
                return t("statusSurplus", vars);
            default:
                return t("statusUnderpaid", {
                    usd: formatUsd(Math.abs(verdict.due_change_usd_cents)),
                    lbp: formatLbp(Math.abs(verdict.due_change_lbp)),
                });
        }

    }

    private _statusLine = (verdict:Verdict):string =>
        `<div class="status-line ${verdict.status}">${icon(verdict.status === "ok" ? "ok" : "warning")}<span>${this._statusText(verdict)}</span></div>`;

}

/**
 * Plain Usd
 *
 * @param cents Amount in cents
 * @return "12" or "12.50", as typed in a field
 */
const plainUsd = (cents:number):string => cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100);

/**
 * Plain Lbp
 *
 * @param pounds Amount in LBP
 * @return "1,074,000"
 */
const plainLbp = (pounds:number):string => new Intl.NumberFormat("en-US").format(pounds);
