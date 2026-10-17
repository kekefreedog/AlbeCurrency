/**
 * Category Dialog
 *
 * Create or edit a transaction type: emoji, name and colour.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {escapeHtml} from "../utils/Html";
import type {Category} from "../Types";
import {t} from "../I18n";

/** Colours offered for a type */
export const CATEGORY_COLORS = [
    "#2e7d32", "#00838f", "#1565c0", "#5e35b1", "#8e24aa", "#c2185b",
    "#c62828", "#ef6c00", "#f9a825", "#6d4c41", "#37474f", "#546e7a",
];

/** Result of the dialog */
export type CategoryDialogResult = {action:"save", category:Category}|{action:"delete"}|null;

/**
 * Open Category Dialog
 *
 * @param category Type to edit, null to create one
 * @return Saved type, deletion request or null when cancelled
 */
export const openCategoryDialog = (category:Category|null):Promise<CategoryDialogResult> => new Promise(resolve => {

    // Draft
    const draft:Category = category ? {...category} : {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        name: "",
        emoji: "🏷️",
        color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
    };

    // Dialog
    const dialog = document.createElement("dialog");
    dialog.className = "modal category-dialog";
    dialog.innerHTML = `
        <form method="dialog">
            <div class="modal-header"><h5>${t(category ? "editType" : "newType")}</h5></div>
            <div class="modal-content">
                <div class="category-name-row">
                    <input type="text" class="category-emoji" maxlength="8" value="${escapeHtml(draft.emoji)}" aria-label="${t("typeEmoji")}">
                    <fieldset class="form-field animated">
                        <legend>${t("typeName")}</legend>
                        <input type="text" id="category-name" placeholder="${t("typeName")}" autocomplete="off" required value="${escapeHtml(draft.name)}">
                        <label for="category-name">${t("typeName")}</label>
                    </fieldset>
                </div>
                <div class="color-swatches" role="radiogroup" aria-label="${t("typeColor")}">
                    ${CATEGORY_COLORS.map(color => `
                        <button type="button" class="color-swatch" role="radio" data-color="${color}" style="--swatch:${color}" aria-checked="${color === draft.color}" aria-label="${color}"></button>
                    `).join("")}
                </div>
            </div>
            <div class="modal-footer">
                ${category ? `<button type="button" class="btn text category-delete">${t("delete")}</button>` : ""}
                <span class="modal-footer-spacer"></span>
                <button type="button" class="btn text category-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-filled">${t("save")}</button>
            </div>
        </form>
    `;
    document.body.append(dialog);

    let result:CategoryDialogResult = null;

    // Colours
    dialog.querySelectorAll<HTMLButtonElement>(".color-swatch").forEach(swatch => swatch.addEventListener("click", () => {

        draft.color = swatch.dataset.color!;
        dialog.querySelectorAll(".color-swatch").forEach(other => other.setAttribute("aria-checked", String(other === swatch)));

    }));

    // Actions
    dialog.querySelector(".category-cancel")!.addEventListener("click", () => dialog.close());

    dialog.querySelector(".category-delete")?.addEventListener("click", () => {

        result = {action: "delete"};
        dialog.close();

    });

    dialog.querySelector("form")!.addEventListener("submit", () => {

        draft.name = dialog.querySelector<HTMLInputElement>("#category-name")!.value.trim();
        draft.emoji = dialog.querySelector<HTMLInputElement>(".category-emoji")!.value.trim() || "🏷️";

        if(draft.name)
            result = {action: "save", category: draft};

    });

    // Close
    dialog.addEventListener("close", () => {

        dialog.remove();
        resolve(result);

    });

    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("#category-name")!.focus();

});
