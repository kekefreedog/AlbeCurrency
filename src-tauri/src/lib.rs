//! AlbeCurrency native shell.
//!
//! Exposes albe-core to the web UI through Tauri commands and persists the
//! history, the cached rate and the settings in SQLite.

mod store;

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use albe_core::{
    rate_from_payloads, BillCounts, ReceiptGuess, Rate, Settings, Transaction, Verdict,
};
use serde::Serialize;
use tauri::{Manager, State};

use store::{Store, StoreResult};

type Db<'a> = State<'a, Mutex<Store>>;

#[derive(Serialize)]
struct AppState {
    rate: Rate,
    settings: Settings,
}

#[derive(Serialize)]
struct TxItem {
    tx: Transaction,
    verdict: Verdict,
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs() as i64)
}

fn lock<'a>(db: &'a Db) -> StoreResult<std::sync::MutexGuard<'a, Store>> {
    db.lock().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_state(db: Db) -> StoreResult<AppState> {
    let store = lock(&db)?;
    Ok(AppState { rate: store.rate()?, settings: store.settings()? })
}

/// Validates the payloads fetched by the webview and caches the rate.
#[tauri::command]
fn apply_rate(db: Db, primary: Option<String>, fallback: Option<String>) -> StoreResult<Option<Rate>> {
    let rate = rate_from_payloads(primary.as_deref(), fallback.as_deref(), now());
    if let Some(rate) = &rate {
        lock(&db)?.set_rate(rate)?;
    }
    Ok(rate)
}

#[tauri::command]
fn set_rate(db: Db, rate: Rate) -> StoreResult<()> {
    lock(&db)?.set_rate(&rate)
}

#[tauri::command]
fn set_settings(db: Db, settings: Settings) -> StoreResult<()> {
    lock(&db)?.set_settings(&settings)
}

#[tauri::command]
fn list_tx(db: Db) -> StoreResult<Vec<TxItem>> {
    let store = lock(&db)?;
    let tolerance = store.settings()?.tolerance_lbp;
    Ok(store
        .list()?
        .into_iter()
        .map(|tx| TxItem { verdict: tx.verdict(tolerance), tx })
        .collect())
}

#[tauri::command]
fn save_tx(db: Db, tx: Transaction) -> StoreResult<TxItem> {
    let store = lock(&db)?;
    store.save(&tx)?;
    Ok(TxItem { verdict: tx.verdict(store.settings()?.tolerance_lbp), tx })
}

#[tauri::command]
fn delete_tx(db: Db, id: String) -> StoreResult<()> {
    lock(&db)?.delete(&id)
}

#[tauri::command]
fn check_tx(db: Db, tx: Transaction) -> StoreResult<Verdict> {
    Ok(tx.verdict(lock(&db)?.settings()?.tolerance_lbp))
}

#[tauri::command]
fn suggest_change(db: Db, due_lbp: i64, rate: Rate) -> StoreResult<BillCounts> {
    let settings = lock(&db)?.settings()?;
    Ok(albe_core::suggest_change(due_lbp, &rate, &settings.denominations, settings.prefer_change))
}

#[tauri::command]
fn implied_rate(usd_cents: i64, lbp: i64) -> Option<u32> {
    albe_core::implied_rate(usd_cents, lbp)
}

#[tauri::command]
fn parse_receipt(text: String) -> ReceiptGuess {
    albe_core::parse_receipt(&text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_haptics::init());

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let store = Store::open(&dir.join("albe.sqlite3"))?;
            app.manage(Mutex::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            apply_rate,
            set_rate,
            set_settings,
            list_tx,
            save_tx,
            delete_tx,
            check_tx,
            suggest_change,
            implied_rate,
            parse_receipt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
