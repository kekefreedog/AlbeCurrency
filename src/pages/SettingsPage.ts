/**
 * Settings Page
 *
 * Banknotes shown on the keyboard, tolerance, preferred change currency and
 * default rate.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {openCategoryDialog} from "../components/CategoryDialog";
import {formatBillValue, parseAmount} from "../utils/Format";
import type {Currency, Settings} from "../Types";
import {ALL_NOTES} from "../utils/Notes";
import {escapeHtml} from "../utils/Html";
import RateCard from "../components/RateCard";
import {icon} from "../utils/Icons";
import type {Page} from "../App";
import type App from "../App";
import {t} from "../I18n";

/**
 * Settings Page
 */
export default class SettingsPage implements Page {

    /** Public Parameters
     ******************************************************
     */

    /** @var el Root element */
    public el:HTMLElement;

    /** Private Parameters
     ******************************************************
     */

    /** @var _settings Edited copy of the settings */
    private _settings:Settings;

    /** @var _rateCard Rate card component */
    private _rateCard:RateCard;

    /**
     * Constructor
     *
     * @param _app Application
     */
    constructor(private _app:App) {

        this._settings = structuredClone(_app.state.settings);

        // Layout
        this.el = document.createElement("div");
        this.el.className = "page settings-page";
        this.el.innerHTML = `
            <header class="top-bar">
                <a class="icon-btn" href="#/" aria-label="${t("back")}">${icon("back")}</a>
                <h1 class="top-bar-title">${t("settings")}</h1>
            </header>
            <main class="page-content">
                <div class="rate-slot"></div>

                <fieldset class="form-field animated">
                    <legend>${t("defaultRate")}</legend>
                    <input type="text" id="set-rate" placeholder="${t("defaultRate")}" inputmode="numeric" value="${_app.state.rate.lbp_per_usd}">
                    <label for="set-rate">${t("defaultRate")}</label>
                </fieldset>

                <h2 class="section-title">${t("banknotesUsd")}</h2>
                ${this._renderNotes("usd")}

                <h2 class="section-title">${t("banknotesLbp")}</h2>
                ${this._renderNotes("lbp")}

                <h2 class="section-title">${t("types")}</h2>
                <div class="category-chips settings-categories"></div>

                <h2 class="section-title">${t("preferChange")}</h2>
                <div class="segmented prefer-toggle" role="radiogroup">
                    <button type="button" role="radio" data-currency="usd" aria-checked="${this._settings.prefer_change === "usd"}">$</button>
                    <button type="button" role="radio" data-currency="lbp" aria-checked="${this._settings.prefer_change === "lbp"}">LL</button>
                </div>

                <fieldset class="form-field animated">
                    <legend>${t("tolerance")}</legend>
                    <input type="text" id="set-tolerance" placeholder="${t("tolerance")}" inputmode="numeric" value="${this._settings.tolerance_lbp}">
                    <label for="set-tolerance">${t("tolerance")}</label>
                </fieldset>
                <p class="help-text">${t("toleranceHelp")}</p>
            </main>
            <footer class="bottom-bar">
                <span></span>
                <button type="button" class="btn btn-filled settings-save">${icon("ok")}${t("save")}</button>
            </footer>
        `;

        // Rate card
        this._rateCard = new RateCard(_app);
        this.el.querySelector(".rate-slot")!.append(this._rateCard.el);

        // Banknote toggles
        this.el.querySelectorAll<HTMLButtonElement>(".note-toggle").forEach(button => button.addEventListener("click", () => {

            const pressed = button.getAttribute("aria-pressed") !== "true";
            button.setAttribute("aria-pressed", String(pressed));

        }));

        // Preferred change currency
        this.el.querySelectorAll<HTMLButtonElement>(".prefer-toggle button").forEach(button => button.addEventListener("click", () => {

            this._settings.prefer_change = button.dataset.currency as Currency;
            this.el.querySelectorAll(".prefer-toggle button").forEach(other => other.setAttribute("aria-checked", String(other === button)));

        }));

        this.el.querySelector(".settings-save")!.addEventListener("click", this._save);
        this._renderCategories();

    }

    /** Public Methods
     ******************************************************
     */

    public destroy = ():void => this._rateCard.destroy();

    /** Private Methods
     ******************************************************
     */

    /**
     * Render Categories
     *
     * Tap a type to edit or delete it, "+" to add one.
     */
    private _renderCategories = ():void => {

        const container = this.el.querySelector<HTMLElement>(".settings-categories")!;

        container.innerHTML = this._settings.categories.map((category, index) => `
            <button type="button" class="category-chip" data-index="${index}" style="--chip-color:${escapeHtml(category.color)}" aria-checked="true">
                <span>${escapeHtml(category.emoji)}</span>${escapeHtml(category.name)}
            </button>
        `).join("") + `<button type="button" class="category-chip category-add">${icon("add")}${t("addType")}</button>`;

        // Edit
        container.querySelectorAll<HTMLButtonElement>(".category-chip[data-index]").forEach(chip => chip.addEventListener("click", async() => {

            const index = Number(chip.dataset.index);
            const result = await openCategoryDialog(this._settings.categories[index]);

            if(result?.action === "save")
                this._settings.categories[index] = result.category;
            else if(result?.action === "delete")
                this._settings.categories.splice(index, 1);

            this._renderCategories();

        }));

        // Add
        container.querySelector(".category-add")!.addEventListener("click", async() => {

            const result = await openCategoryDialog(null);

            if(result?.action === "save")
                this._settings.categories.push(result.category);

            this._renderCategories();

        });

    }

    /**
     * Render Notes
     *
     * @param currency Currency of the row
     */
    private _renderNotes = (currency:Currency):string => `
        <div class="note-toggles">
            ${ALL_NOTES[currency].map(value => `
                <button type="button" class="note-toggle ${currency}" data-currency="${currency}" data-value="${value}"
                    aria-pressed="${this._settings.denominations[currency].includes(value)}">
                    ${currency === "usd" ? "$" : ""}${formatBillValue({currency, value})}${currency === "lbp" ? " LL" : ""}
                </button>
            `).join("")}
        </div>
    `;

    /**
     * Save
     */
    private _save = async():Promise<void> => {

        // Banknotes, at least one per currency
        for(const currency of ["usd", "lbp"] as Currency[]){

            const values = [...this.el.querySelectorAll<HTMLButtonElement>(`.note-toggle.${currency}[aria-pressed="true"]`)]
                .map(button => Number(button.dataset.value));

            this._settings.denominations[currency] = values.length ? values : ALL_NOTES[currency];

        }

        // Tolerance
        const tolerance = parseAmount(this.el.querySelector<HTMLInputElement>("#set-tolerance")!.value, "lbp");
        this._settings.tolerance_lbp = Math.max(0, tolerance ?? 0);

        await this._app.backend.setSettings(this._settings);
        this._app.state.settings = this._settings;

        // Default rate, kept as manual when changed by hand
        const rate = parseAmount(this.el.querySelector<HTMLInputElement>("#set-rate")!.value, "lbp");

        if(rate && rate !== this._app.state.rate.lbp_per_usd){

            this._app.state.rate = {lbp_per_usd: rate, source: "manual", fetched_at: Math.floor(Date.now() / 1000)};
            await this._app.backend.setRate(this._app.state.rate);

        }

        this._app.toast(t("settingsSaved"));
        this._app.navigate("/");

    }

}
