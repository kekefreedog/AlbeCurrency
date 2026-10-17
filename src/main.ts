/**
 * Main
 *
 * Entry point: styles, backend selection, routes.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import "@materializecss/materialize/dist/css/materialize.css";
import TransactionPage from "./pages/TransactionPage";
import SettingsPage from "./pages/SettingsPage";
import {loadBackend} from "./backend/index";
import HomePage from "./pages/HomePage";
import "./styles/main.scss";
import App from "./App";

// Start app
const backend = await loadBackend();

const app = new App(backend, document.getElementById("app")!, {
    "": app => new HomePage(app),
    tx: (app, id) => new TransactionPage(app, id === "new" ? null : id),
    settings: app => new SettingsPage(app),
});

await app.start();
