//! User settings shared by every platform.

use serde::{Deserialize, Serialize};

use crate::bills::Denominations;
use crate::check::DEFAULT_TOLERANCE_LBP;
use crate::money::Currency;

/// Type of a transaction, with its emoji and accent colour.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub emoji: String,
    /// CSS colour (hex) used to tint the transaction.
    pub color: String,
}

impl Category {
    fn new(id: &str, name: &str, emoji: &str, color: &str) -> Self {
        Self { id: id.into(), name: name.into(), emoji: emoji.into(), color: color.into() }
    }
}

/// Types offered on first launch, the user can edit or add more.
pub fn default_categories() -> Vec<Category> {
    vec![
        Category::new("groceries", "Courses", "🛒", "#2e7d32"),
        Category::new("restaurant", "Resto", "🍽️", "#c62828"),
        Category::new("cafe", "Café", "☕", "#6d4c41"),
        Category::new("transport", "Transport", "🚕", "#f9a825"),
        Category::new("fuel", "Essence", "⛽", "#37474f"),
        Category::new("pharmacy", "Pharmacie", "💊", "#00838f"),
        Category::new("shopping", "Shopping", "🛍️", "#8e24aa"),
        Category::new("other", "Autre", "📌", "#546e7a"),
    ]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Banknotes shown on the keyboard.
    pub denominations: Denominations,
    /// Gap accepted between due and returned change, in LBP.
    pub tolerance_lbp: i64,
    /// Currency favoured by the change suggestion.
    pub prefer_change: Currency,
    /// Transaction types.
    pub categories: Vec<Category>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            denominations: Denominations::default(),
            tolerance_lbp: DEFAULT_TOLERANCE_LBP,
            prefer_change: Currency::Usd,
            categories: default_categories(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_fields_use_defaults() {
        let s: Settings = serde_json::from_str(r#"{"tolerance_lbp":1000}"#).unwrap();
        assert_eq!(s.tolerance_lbp, 1_000);
        assert_eq!(s.denominations, Denominations::default());
        assert_eq!(s.categories.len(), default_categories().len());
    }
}
