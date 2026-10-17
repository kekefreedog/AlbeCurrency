/**
 * Html
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

/**
 * Escape Html
 *
 * @param text Untrusted text (merchant names come from OCR or typing)
 * @return Text safe to inject in markup and attributes
 */
export const escapeHtml = (text:string):string => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
