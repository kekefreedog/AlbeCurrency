/**
 * Notes
 *
 * Banknotes that can be shown on the keyboard.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {Currency, Denominations} from "../Types";

/** Notes in use (1,000 LL no longer circulates in practice) */
export const ALL_NOTES:Record<Currency, number[]> = {
    usd: [1, 2, 5, 10, 20, 50, 100],
    lbp: [5000, 10000, 20000, 50000, 100000],
};

/**
 * Keep Known Notes
 *
 * @param denominations Stored banknotes, possibly from an older version
 * @return Banknotes restricted to the notes in use
 */
export const keepKnownNotes = (denominations:Denominations):Denominations => ({
    usd: denominations.usd.filter(value => ALL_NOTES.usd.includes(value)),
    lbp: denominations.lbp.filter(value => ALL_NOTES.lbp.includes(value)),
});
