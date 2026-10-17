/**
 * Vite Config
 *
 * Build of the web UI shared by Tauri (Android, iOS, desktop) and the PWA.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {defineConfig} from "vite";

// Host given by `tauri android dev` / `tauri ios dev` for physical devices
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    clearScreen: false,
    server: {
        port: 5173,
        strictPort: true,
        host: host || false,
        hmr: host ? {protocol: "ws", host, port: 5174} : undefined,
        watch: {ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**"]},
    },
    envPrefix: ["VITE_", "TAURI_ENV_"],
    build: {
        target: "es2022",
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
});
