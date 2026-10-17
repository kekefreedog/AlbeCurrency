//! WebAssembly bindings of albe-core.
//!
//! Same operations as the Tauri commands, storage excepted: the web build
//! keeps its data in IndexedDB on the JavaScript side.

use albe_core::{Rate, Settings, Transaction};
use serde::{de::DeserializeOwned, Serialize};
use wasm_bindgen::prelude::*;

fn from_js<T: DeserializeOwned>(value: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(value).map_err(|e| JsError::new(&e.to_string()))
}

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsError> {
    // plain objects and numbers, never Map or BigInt
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|e| JsError::new(&e.to_string()))
}

#[derive(Serialize)]
struct AppState {
    rate: Rate,
    settings: Settings,
}

/// Rate and settings used before anything is stored.
#[wasm_bindgen]
pub fn default_state() -> Result<JsValue, JsError> {
    to_js(&AppState { rate: Rate::default(), settings: Settings::default() })
}

#[wasm_bindgen]
pub fn check_tx(tx: JsValue, tolerance_lbp: f64) -> Result<JsValue, JsError> {
    let tx: Transaction = from_js(tx)?;
    to_js(&tx.verdict(tolerance_lbp as i64))
}

#[wasm_bindgen]
pub fn suggest_change(due_lbp: f64, rate: JsValue, settings: JsValue) -> Result<JsValue, JsError> {
    let rate: Rate = from_js(rate)?;
    let settings: Settings = from_js(settings)?;
    to_js(&albe_core::suggest_change(
        due_lbp as i64,
        &rate,
        &settings.denominations,
        settings.prefer_change,
    ))
}

/// Rate implied by the same total in both currencies, `undefined` if implausible.
#[wasm_bindgen]
pub fn implied_rate(usd_cents: f64, lbp: f64) -> Option<u32> {
    albe_core::implied_rate(usd_cents as i64, lbp as i64)
}

#[wasm_bindgen]
pub fn parse_receipt(text: &str) -> Result<JsValue, JsError> {
    to_js(&albe_core::parse_receipt(text))
}

/// Validated rate from the fetched payloads, `null` when none is usable.
#[wasm_bindgen]
pub fn rate_from_payloads(primary: Option<String>, fallback: Option<String>, now: f64) -> Result<JsValue, JsError> {
    to_js(&albe_core::rate_from_payloads(primary.as_deref(), fallback.as_deref(), now as i64))
}
