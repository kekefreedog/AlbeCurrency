//! Extraction of totals and rate from raw OCR text of a receipt.
//!
//! The OCR (ML Kit, Apple Vision or tesseract.js) only returns text. All the
//! heuristics live here so every platform behaves the same way.

use std::sync::OnceLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::money::{implied_rate, Currency, Money, RATE_RANGE};

/// Without currency marker, amounts at or above this are read as LBP.
const LBP_THRESHOLD: i64 = 10_000;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReceiptGuess {
    pub total_usd_cents: Option<i64>,
    pub total_lbp: Option<i64>,
    pub rate: Option<u32>,
    /// True when the rate was deduced from the two totals, not printed.
    pub rate_inferred: bool,
    /// Shop name, usually the first text line of the receipt.
    pub merchant: Option<String>,
}

impl ReceiptGuess {
    /// Total to use by default, USD first since it is the reference price.
    pub fn best_total(&self) -> Option<Money> {
        self.total_usd_cents
            .map(Money::usd_cents)
            .or(self.total_lbp.map(Money::lbp))
    }
}

/// An amount found in the text, in hundredths of a major unit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Amount {
    hundredths: i64,
    has_decimals: bool,
}

impl Amount {
    fn whole(self) -> i64 {
        self.hundredths / 100
    }
}

fn number_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\d{1,3}(?:[ ,.'’]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?").unwrap()
    })
}

fn total_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)total|amount\s*due|net\s*(?:à|a)\s*payer|à\s*payer|montant|المجموع|الإجمالي|الاجمالي|المبلغ",
        )
        .unwrap()
    })
}

fn not_total_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)sub\s*-?\s*total|sous\s*-?\s*total|total\s*(?:items?|qty|quantit|tva|vat|tax|articles?)|\b(?:tva|vat)\b")
            .unwrap()
    })
}

fn usd_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\$|\busd\b|\bdollars?\b|دولار").unwrap())
}

fn lbp_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\bl\.\s?l\.?|\bll\b|\blbp\b|\bl\.?b\.?p\b|ل\.\s?ل|ليرة|\blivres?\b").unwrap()
    })
}

fn rate_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)rate|taux|exchange|سعر|صرف|1\s*\$\s*=|usd\s*=").unwrap())
}

/// Converts Arabic-Indic and Persian digits and separators to ASCII.
pub fn normalize(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '\u{0660}'..='\u{0669}' => char::from(b'0' + (c as u32 - 0x0660) as u8),
            '\u{06F0}'..='\u{06F9}' => char::from(b'0' + (c as u32 - 0x06F0) as u8),
            '\u{066C}' => ',',
            '\u{066B}' => '.',
            _ => c,
        })
        .collect()
}

/// Parses one number token, deciding which separator is the decimal one.
fn parse_amount(token: &str) -> Option<Amount> {
    let seps: Vec<(usize, char)> = token
        .char_indices()
        .filter(|(_, c)| !c.is_ascii_digit())
        .collect();

    let (int_part, dec_part) = match seps.last() {
        Some((idx, sep)) if matches!(sep, '.' | ',') => {
            let tail = &token[idx + sep.len_utf8()..];
            if (1..=2).contains(&tail.len()) {
                (&token[..*idx], Some(tail))
            } else {
                (token, None)
            }
        }
        _ => (token, None),
    };

    let digits: String = int_part.chars().filter(|c| c.is_ascii_digit()).collect();
    let whole: i64 = digits.parse().ok()?;
    let cents = match dec_part {
        Some(d) if d.len() == 1 => d.parse::<i64>().ok()? * 10,
        Some(d) => d.parse::<i64>().ok()?,
        None => 0,
    };
    Some(Amount {
        hundredths: whole.checked_mul(100)? + cents,
        has_decimals: dec_part.is_some(),
    })
}

fn amounts(line: &str) -> Vec<Amount> {
    number_re()
        .find_iter(line)
        .filter_map(|m| parse_amount(m.as_str()))
        .collect()
}

/// Assigns the amounts of a total line to USD and/or LBP.
fn classify(line: &str, values: &[Amount]) -> (Option<i64>, Option<i64>) {
    let is_usd = usd_re().is_match(line);
    let is_lbp = lbp_re().is_match(line);
    let mut usd = None;
    let mut lbp = None;

    for amount in values {
        let looks_lbp = !amount.has_decimals && amount.whole() >= LBP_THRESHOLD;
        let currency = match (is_usd, is_lbp) {
            (true, false) => Currency::Usd,
            (false, true) => Currency::Lbp,
            _ if looks_lbp => Currency::Lbp,
            _ => Currency::Usd,
        };
        match currency {
            Currency::Usd => usd = usd.max(Some(amount.hundredths)),
            Currency::Lbp => lbp = lbp.max(Some(amount.whole())),
        }
    }
    (usd, lbp)
}

fn noise_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^(?:tel|t[ée]l[ée]phone|phone|fax|date|time|heure|ticket|receipt|facture|invoice|caisse|cashier|vat|tva|mof|www\.|http)|@|\d{2}[/.-]\d{2}[/.-]\d{2,4}").unwrap()
    })
}

/// Shop name: first of the top lines made mostly of letters.
fn merchant_of(lines: &[&str]) -> Option<String> {
    lines.iter().take(4).find_map(|line| {
        let letters = line.chars().filter(|c| c.is_alphabetic()).count();
        let digits = line.chars().filter(char::is_ascii_digit).count();
        let readable = letters >= 3 && digits * 3 <= letters && !noise_re().is_match(line);
        let not_amount = !total_re().is_match(line) && !rate_re().is_match(line);
        (readable && not_amount).then(|| title_case(line))
    })
}

/// "SPINNEYS ACHRAFIEH" -> "Spinneys Achrafieh", other scripts untouched.
fn title_case(line: &str) -> String {
    let shouting = line.chars().any(|c| c.is_uppercase()) && !line.chars().any(|c| c.is_lowercase());
    let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
    if !shouting {
        return line;
    }
    line.split(' ')
        .map(|word| {
            let mut chars = word.chars();
            chars.next().map_or(String::new(), |first| {
                first.to_uppercase().chain(chars.flat_map(char::to_lowercase)).collect()
            })
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn parse_receipt(text: &str) -> ReceiptGuess {
    let text = normalize(text);
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let mut guess = ReceiptGuess { merchant: merchant_of(&lines), ..Default::default() };

    for (i, line) in lines.iter().enumerate() {
        if rate_re().is_match(line) && guess.rate.is_none() {
            guess.rate = amounts(line)
                .into_iter()
                .map(Amount::whole)
                .filter(|v| RATE_RANGE.contains(v))
                .max()
                .map(|v| v as u32);
            continue;
        }

        if !total_re().is_match(line) || not_total_re().is_match(line) {
            continue;
        }

        // OCR often splits "TOTAL" and its amount on two lines.
        let mut source = line.to_string();
        let mut values = amounts(line);
        if values.is_empty() {
            if let Some(next) = lines.get(i + 1) {
                source = format!("{line} {next}");
                values = amounts(next);
            }
        }

        let (usd, lbp) = classify(&source, &values);
        guess.total_usd_cents = guess.total_usd_cents.max(usd);
        guess.total_lbp = guess.total_lbp.max(lbp);
    }

    if guess.rate.is_none() {
        if let (Some(usd), Some(lbp)) = (guess.total_usd_cents, guess.total_lbp) {
            guess.rate = implied_rate(usd, lbp);
            guess.rate_inferred = guess.rate.is_some();
        }
    }

    guess
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn amounts_with_separators() {
        let p = |s| parse_amount(s).unwrap().hundredths;
        assert_eq!(p("12.50"), 1_250);
        assert_eq!(p("12,5"), 1_250);
        assert_eq!(p("1,234,500"), 123_450_000);
        assert_eq!(p("1.234.500"), 123_450_000);
        assert_eq!(p("1 118 750"), 111_875_000);
        assert_eq!(p("1,234.75"), 123_475);
        assert_eq!(p("89500"), 8_950_000);
    }

    #[test]
    fn arabic_digits() {
        assert_eq!(normalize("٨٩٬٥٠٠"), "89,500");
    }

    #[test]
    fn dual_total_line() {
        let g = parse_receipt("TOTAL $ 12.50   L.L 1,118,750");
        assert_eq!(g.total_usd_cents, Some(1_250));
        assert_eq!(g.total_lbp, Some(1_118_750));
        assert_eq!(g.rate, Some(89_500));
        assert!(g.rate_inferred);
    }

    #[test]
    fn total_on_next_line_and_subtotal_ignored() {
        let g = parse_receipt("Sub Total 99.00\nTVA 11% 10.89\nTOTAL USD\n109.89\n");
        assert_eq!(g.total_usd_cents, Some(10_989));
        assert_eq!(g.total_lbp, None);
    }
}
