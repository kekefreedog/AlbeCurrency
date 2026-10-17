//! Parsing of the online rate sources.
//!
//! The BDL website sits behind a bot challenge, so the official rate is read
//! from open.er-api.com which publishes it (89 500) and allows CORS, meaning
//! the web build can call it directly. A CDN mirror is used as fallback.

use serde::Deserialize;

use crate::money::{Rate, RateSource};

/// Primary source, returns the official BDL rate.
pub const PRIMARY_RATE_URL: &str = "https://open.er-api.com/v6/latest/USD";
/// Fallback source, daily snapshot served by jsDelivr.
pub const FALLBACK_RATE_URL: &str =
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json";

/// Plausible range, protects against a broken or hostile payload.
const RANGE: std::ops::RangeInclusive<f64> = 10_000.0..=1_000_000.0;

#[derive(Deserialize)]
struct ErApi {
    result: String,
    time_last_update_unix: Option<i64>,
    rates: std::collections::HashMap<String, f64>,
}

#[derive(Deserialize)]
struct Fallback {
    usd: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FetchedRate {
    pub lbp_per_usd: u32,
    /// Unix timestamp of the source's last update, if given.
    pub updated_at: Option<i64>,
}

fn checked(value: f64) -> Option<u32> {
    RANGE.contains(&value).then(|| value.round() as u32)
}

pub fn parse_primary(json: &str) -> Option<FetchedRate> {
    let data: ErApi = serde_json::from_str(json).ok()?;
    if data.result != "success" {
        return None;
    }
    Some(FetchedRate {
        lbp_per_usd: checked(*data.rates.get("LBP")?)?,
        updated_at: data.time_last_update_unix,
    })
}

pub fn parse_fallback(json: &str) -> Option<FetchedRate> {
    let data: Fallback = serde_json::from_str(json).ok()?;
    Some(FetchedRate {
        lbp_per_usd: checked(*data.usd.get("lbp")?)?,
        updated_at: None,
    })
}

/// Builds the official rate from whichever payload is valid, primary first.
///
/// `now` is the Unix time used when the source does not give its own date.
pub fn rate_from_payloads(primary: Option<&str>, fallback: Option<&str>, now: i64) -> Option<Rate> {
    let fetched = primary
        .and_then(parse_primary)
        .or_else(|| fallback.and_then(parse_fallback))?;
    Some(Rate {
        lbp_per_usd: fetched.lbp_per_usd,
        source: RateSource::Bdl,
        fetched_at: Some(fetched.updated_at.unwrap_or(now)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn primary() {
        let json = r#"{"result":"success","time_last_update_unix":1792195352,"rates":{"USD":1,"LBP":89500}}"#;
        assert_eq!(
            parse_primary(json),
            Some(FetchedRate { lbp_per_usd: 89_500, updated_at: Some(1_792_195_352) })
        );
    }

    #[test]
    fn primary_error_or_absurd() {
        assert_eq!(parse_primary(r#"{"result":"error","rates":{}}"#), None);
        assert_eq!(parse_primary(r#"{"result":"success","rates":{"LBP":1507.5}}"#), None);
        assert_eq!(parse_primary("<html>"), None);
    }

    #[test]
    fn fallback() {
        let json = r#"{"date":"2026-10-16","usd":{"eur":0.9,"lbp":89774.07967201}}"#;
        assert_eq!(parse_fallback(json).map(|r| r.lbp_per_usd), Some(89_774));
    }

    #[test]
    fn payloads_fall_back() {
        let fallback = r#"{"usd":{"lbp":89600}}"#;
        let rate = rate_from_payloads(Some("oops"), Some(fallback), 42).unwrap();
        assert_eq!(rate.lbp_per_usd, 89_600);
        assert_eq!(rate.fetched_at, Some(42));
        assert!(rate_from_payloads(None, None, 0).is_none());
    }
}
