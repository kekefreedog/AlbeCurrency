//! AlbeCurrency core: everything that does not depend on a platform.

pub mod bills;
pub mod check;
pub mod money;
pub mod rates;
pub mod receipt;
pub mod settings;

pub use bills::{Bill, BillCount, BillCounts, Denominations};
pub use check::{check, suggest_change, Status, Transaction, Verdict, DEFAULT_TOLERANCE_LBP};
pub use money::{implied_rate, Currency, Money, Rate, RateSource, DEFAULT_LBP_PER_USD};
pub use rates::{parse_fallback, parse_primary, rate_from_payloads, FetchedRate, FALLBACK_RATE_URL, PRIMARY_RATE_URL};
pub use receipt::{parse_receipt, ReceiptGuess};
pub use settings::{default_categories, Category, Settings};
