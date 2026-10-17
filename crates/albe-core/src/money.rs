//! Money primitives.
//!
//! Every amount is an integer in the currency's minor unit so there is never
//! any floating point drift:
//! - USD is stored in cents,
//! - LBP is stored in pounds (the piastre is long gone).
//!
//! Comparisons across currencies are done in LBP, which is exact because a
//! rate is an integer number of pounds per dollar.

use serde::{Deserialize, Serialize};

/// Official BDL rate used before the first successful refresh.
pub const DEFAULT_LBP_PER_USD: u32 = 89_500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Currency {
    Usd,
    Lbp,
}

impl Currency {
    /// Number of minor units in one major unit.
    pub fn minor_per_major(self) -> i64 {
        match self {
            Currency::Usd => 100,
            Currency::Lbp => 1,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub currency: Currency,
    /// Amount in minor units (cents for USD, pounds for LBP).
    pub minor: i64,
}

impl Money {
    pub fn usd_cents(cents: i64) -> Self {
        Self { currency: Currency::Usd, minor: cents }
    }

    pub fn usd(dollars: i64) -> Self {
        Self::usd_cents(dollars * 100)
    }

    pub fn lbp(pounds: i64) -> Self {
        Self { currency: Currency::Lbp, minor: pounds }
    }

    /// Exact value in LBP at the given rate.
    pub fn to_lbp(self, rate: &Rate) -> i64 {
        match self.currency {
            Currency::Lbp => self.minor,
            Currency::Usd => self.minor * rate.lbp_per_usd as i64 / 100,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RateSource {
    /// Banque du Liban official rate.
    Bdl,
    /// Rate printed on the receipt.
    Receipt,
    /// Typed by the user for this transaction.
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rate {
    pub lbp_per_usd: u32,
    pub source: RateSource,
    /// Unix timestamp (seconds) of when the rate was obtained, if known.
    pub fetched_at: Option<i64>,
}

impl Rate {
    pub fn new(lbp_per_usd: u32, source: RateSource) -> Self {
        Self { lbp_per_usd, source, fetched_at: None }
    }

    /// Converts LBP to USD cents, rounded to the nearest cent.
    pub fn lbp_to_usd_cents(&self, lbp: i64) -> i64 {
        let rate = self.lbp_per_usd as i64;
        let scaled = lbp * 100;
        // round half away from zero
        if scaled >= 0 {
            (scaled + rate / 2) / rate
        } else {
            (scaled - rate / 2) / rate
        }
    }
}

impl Default for Rate {
    fn default() -> Self {
        Self::new(DEFAULT_LBP_PER_USD, RateSource::Bdl)
    }
}

/// Plausible range for an LBP per USD rate.
pub const RATE_RANGE: std::ops::RangeInclusive<i64> = 1_000..=1_000_000;

/// Rate implied by the same price written in both currencies.
///
/// Used when a receipt (or the user) gives the total in USD and in LBP.
/// Returns `None` when the amounts give an implausible rate.
pub fn implied_rate(usd_cents: i64, lbp: i64) -> Option<u32> {
    if usd_cents <= 0 || lbp <= 0 {
        return None;
    }
    let rate = (lbp * 100 + usd_cents / 2) / usd_cents;
    RATE_RANGE.contains(&rate).then_some(rate as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usd_to_lbp_is_exact() {
        let rate = Rate::default();
        assert_eq!(Money::usd(1).to_lbp(&rate), 89_500);
        assert_eq!(Money::usd_cents(1_250).to_lbp(&rate), 1_118_750);
    }

    #[test]
    fn lbp_to_usd_rounds() {
        let rate = Rate::default();
        assert_eq!(rate.lbp_to_usd_cents(89_500), 100);
        assert_eq!(rate.lbp_to_usd_cents(-179_000), -200);
        assert_eq!(rate.lbp_to_usd_cents(100_000), 112);
    }

    #[test]
    fn implied() {
        assert_eq!(implied_rate(777, 695_415), Some(89_500));
        assert_eq!(implied_rate(1_200, 1_080_000), Some(90_000));
        assert_eq!(implied_rate(1_200, 12), None);
        assert_eq!(implied_rate(0, 1_000), None);
    }
}
