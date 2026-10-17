/**
 * Change Suggestion
 *
 * The ideal change drawn as small banknotes with their count.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {formatBillValue} from "../utils/Format";
import type {BillCounts} from "../Types";
import {billArtUrl} from "./BillArt";
import {t} from "../I18n";

/**
 * Render Change Suggestion
 *
 * @param counts Ideal change
 * @return Markup, empty when nothing is due
 */
export const renderChangeSuggestion = (counts:BillCounts):string => counts.length ? `
    <div class="change-suggestion">
        <span class="change-suggestion-title">${t("suggestion")}</span>
        <div class="change-suggestion-notes">
            ${counts.map(({bill, count}) => `
                <span class="mini-note ${bill.currency}">
                    <span class="mini-note-art" style="background-image:${billArtUrl(bill).replace(/"/g, "&quot;")}"></span>
                    <span class="mini-note-text">
                        <strong>${count > 1 ? `${count} × ` : ""}${bill.currency === "usd" ? "$" : ""}${formatBillValue(bill)}${bill.currency === "lbp" ? " LL" : ""}</strong>
                    </span>
                </span>
            `).join("")}
        </div>
    </div>
` : "";
