/**
 * Bill Keyboard
 *
 * The "piano": one row of banknote keys per currency. A tap adds a note, a
 * long press removes one, each key shows how many notes were counted.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {Bill, BillCounts, Currency, Denominations} from "../Types";
import {formatBillValue} from "../utils/Format";
import {billArtUrl} from "./BillArt";
import {tap} from "../services/Haptics";
import {icon} from "../utils/Icons";
import {t} from "../I18n";

const LONG_PRESS_MS = 450;

/**
 * Add Count
 *
 * @param counts Current counts
 * @param bill Banknote to change
 * @param delta Notes to add, negative to remove
 * @return New counts, sorted like albe-core, without zeros
 */
export const addCount = (counts:BillCounts, bill:Bill, delta:number):BillCounts => {

    // Compute next count
    const current = counts.find(entry => sameBill(entry.bill, bill))?.count ?? 0;
    const next = Math.max(0, current + delta);

    // Rebuild list
    const result = counts.filter(entry => !sameBill(entry.bill, bill));

    if(next > 0)
        result.push({bill, count: next});

    // Return sorted result (USD first, then by value)
    return result.sort((a, b) => currencyRank(a.bill) - currencyRank(b.bill) || a.bill.value - b.bill.value);

};

const sameBill = (a:Bill, b:Bill):boolean => a.currency === b.currency && a.value === b.value;

const currencyRank = (bill:Bill):number => bill.currency === "usd" ? 0 : 1;

/**
 * Bill Keyboard
 */
export default class BillKeyboard {

    /** Public Parameters
     ******************************************************
     */

    /** @var el Root element */
    public el:HTMLElement;

    /** Private Parameters
     ******************************************************
     */

    /** @var _timer Long press timer */
    private _timer:number|null = null;

    /** @var _longPressed The current press already removed a note */
    private _longPressed = false;

    /** @var _minusPressed The current press started on the "−" button */
    private _minusPressed = false;

    /**
     * Constructor
     *
     * @param _denominations Banknotes to display
     * @param _counts Initial counts
     * @param _onChange Called with the new counts after each change
     */
    constructor(
        private _denominations:Denominations,
        private _counts:BillCounts,
        private _onChange:(counts:BillCounts) => void,
    ) {

        this.el = document.createElement("div");
        this.el.className = "bill-keyboard";
        this._render();

    }

    /** Public Methods
     ******************************************************
     */

    /**
     * Set Counts
     *
     * @param counts Counts to display
     */
    public setCounts = (counts:BillCounts):void => {

        this._counts = counts;
        this._updateBadges();

    }

    /** Private Methods | Rendering
     ******************************************************
     */

    /**
     * Render
     */
    private _render = ():void => {

        // Rows
        this.el.innerHTML = `
            ${this._renderRow("usd", this._denominations.usd)}
            ${this._renderRow("lbp", this._denominations.lbp)}
            <div class="keyboard-footer">
                <span class="keyboard-hint">${t("keyboardHint")}</span>
                <button type="button" class="btn text keyboard-clear">${icon("undo")}${t("clear")}</button>
            </div>
        `;

        // Keys, each with its banknote art
        this.el.querySelectorAll<HTMLButtonElement>(".bill-key").forEach(key => {

            key.style.backgroundImage = billArtUrl(this._billOf(key));
            this._bindKey(key);

        });

        // Clear
        this.el.querySelector(".keyboard-clear")?.addEventListener("click", () => {

            tap(true);
            this._emit([]);

        });

        this._updateBadges();

    }

    /**
     * Render Row
     *
     * @param currency Row currency
     * @param values Face values, ascending
     */
    private _renderRow = (currency:Currency, values:number[]):string => `
        <div class="keyboard-row ${currency}">
            <span class="keyboard-row-label">${currency === "usd" ? "$" : "LL"}</span>
            <div class="keyboard-keys">
                ${[...values].sort((a, b) => a - b).map(value => `
                    <button type="button" class="bill-key" data-currency="${currency}" data-value="${value}"
                        aria-label="${value} ${currency === "usd" ? "dollars" : "livres"}">
                        <span class="bill-count"></span>
                        <span class="bill-minus" aria-hidden="true">−</span>
                        <span class="bill-label">
                            <span class="bill-value">${formatBillValue({currency, value})}</span>
                            <span class="bill-unit">${currency === "usd" ? "$" : "LL"}</span>
                        </span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    /**
     * Update Badges
     */
    private _updateBadges = ():void => {

        this.el.querySelectorAll<HTMLButtonElement>(".bill-key").forEach(key => {

            // Read count of this key
            const bill = this._billOf(key);
            const count = this._counts.find(entry => sameBill(entry.bill, bill))?.count ?? 0;

            // Display
            key.classList.toggle("active", count > 0);
            key.querySelector(".bill-count")!.textContent = count ? `×${count}` : "";

        });

    }

    /** Private Methods | Events
     ******************************************************
     */

    /**
     * Bind Key
     *
     * Tap adds a note. The "−" button of a counted key, or a long press,
     * removes one.
     *
     * @param key Key element
     */
    private _bindKey = (key:HTMLButtonElement):void => {

        const bill = this._billOf(key);

        // Start press
        key.addEventListener("pointerdown", event => {

            this._longPressed = false;
            this._minusPressed = (event.target as Element).closest(".bill-minus") !== null;
            this._clearTimer();

            // The minus button acts on release, no long press needed
            if(this._minusPressed)
                return;

            this._timer = window.setTimeout(() => {

                this._longPressed = true;
                this._remove(key, bill);

            }, LONG_PRESS_MS);

        });

        // End press
        key.addEventListener("pointerup", () => {

            this._clearTimer();

            if(this._minusPressed)
                this._remove(key, bill);
            else if(!this._longPressed){

                tap();
                this._change(bill, 1);

            }

            this._minusPressed = false;

        });

        // Cancelled press
        key.addEventListener("pointerleave", this._clearTimer);
        key.addEventListener("pointercancel", this._clearTimer);
        key.addEventListener("contextmenu", event => event.preventDefault());

        // Keyboard access: Enter/Space add, Backspace/Delete remove
        key.addEventListener("keydown", event => {

            if(event.key === "Enter" || event.key === " "){

                event.preventDefault();
                this._change(bill, 1);

            }else if(event.key === "Backspace" || event.key === "Delete"){

                event.preventDefault();
                this._change(bill, -1);

            }

        });

    }

    /** Private Methods | Utilities
     ******************************************************
     */

    private _clearTimer = ():void => {

        if(this._timer !== null)
            window.clearTimeout(this._timer);

        this._timer = null;

    }

    private _billOf = (key:HTMLElement):Bill => ({
        currency: key.dataset.currency as Currency,
        value: Number(key.dataset.value),
    });

    /**
     * Remove
     *
     * @param key Key element, animated
     * @param bill Banknote to remove one of
     */
    private _remove = (key:HTMLElement, bill:Bill):void => {

        tap(true);
        this._change(bill, -1);
        key.classList.add("removed");
        window.setTimeout(() => key.classList.remove("removed"), 250);

    }

    private _change = (bill:Bill, delta:number):void => this._emit(addCount(this._counts, bill, delta));

    private _emit = (counts:BillCounts):void => {

        this.setCounts(counts);
        this._onChange(counts);

    }

}
