/**
 * Haptics
 *
 * Short vibration on each key tap: native plugin on mobile, Vibration API
 * in browsers, silent elsewhere.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {isTauri} from "@tauri-apps/api/core";

let nativeAvailable = isTauri();

/**
 * Tap
 *
 * @param strong Heavier feedback, used for removal
 */
export const tap = (strong:boolean = false):void => {

    // Native haptics (Android / iOS)
    if(nativeAvailable){

        import("@tauri-apps/plugin-haptics")
            .then(haptics => haptics.impactFeedback(strong ? "medium" : "light"))
            .catch(() => {
                nativeAvailable = false;
            });

        return;

    }

    // Browser fallback
    navigator.vibrate?.(strong ? 25 : 10);

};
