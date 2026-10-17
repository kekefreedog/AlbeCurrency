/**
 * Ocr
 *
 * Turn a receipt photo into raw text. Extraction of the totals and rate is
 * done by albe-core (parse_receipt), the same on every platform.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

/**
 * Recognize
 *
 * @param image Photo of the receipt
 * @return Recognized text
 */
export const recognize = async(image:Blob):Promise<string> => {

    // Engine is wired in the OCR step (native plugin, tesseract.js on web)
    void image;

    throw new Error("OCR not available yet");

};
