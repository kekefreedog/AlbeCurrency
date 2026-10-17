/**
 * Backend Loader
 *
 * Pick the native backend inside Tauri, the WASM one in a browser.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {isTauri} from "@tauri-apps/api/core";
import type Backend from "./Backend";

/**
 * Load Backend
 *
 * @return Backend matching the current runtime
 */
export const loadBackend = async():Promise<Backend> => {

    // Native shell
    if(isTauri()){

        const {default: TauriBackend} = await import("./TauriBackend");

        return new TauriBackend();

    }

    // Browser / PWA
    const {default: WasmBackend} = await import("./WasmBackend");

    return WasmBackend.create();

};
