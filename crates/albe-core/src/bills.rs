//! Banknotes and the "piano keyboard" counts.

use serde::{Deserialize, Serialize};

use crate::money::{Currency, Money, Rate};

/// A banknote, its face value is in major units (dollars or pounds).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Bill {
    pub currency: Currency,
    pub value: u32,
}

impl Bill {
    pub const fn usd(value: u32) -> Self {
        Self { currency: Currency::Usd, value }
    }

    pub const fn lbp(value: u32) -> Self {
        Self { currency: Currency::Lbp, value }
    }

    pub fn money(self) -> Money {
        Money {
            currency: self.currency,
            minor: self.value as i64 * self.currency.minor_per_major(),
        }
    }
}

/// Banknotes shown as keys, sorted ascending per currency.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Denominations {
    pub usd: Vec<u32>,
    pub lbp: Vec<u32>,
}

impl Default for Denominations {
    fn default() -> Self {
        Self {
            usd: vec![1, 2, 5, 10, 20, 50, 100],
            // 1 000 LL is no longer used in practice
            lbp: vec![5_000, 10_000, 20_000, 50_000, 100_000],
        }
    }
}

impl Denominations {
    pub fn bills(&self) -> impl Iterator<Item = Bill> + '_ {
        self.usd
            .iter()
            .map(|v| Bill::usd(*v))
            .chain(self.lbp.iter().map(|v| Bill::lbp(*v)))
    }

    pub fn smallest_lbp(&self) -> u32 {
        self.lbp.iter().copied().min().unwrap_or(1)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillCount {
    pub bill: Bill,
    pub count: u32,
}

/// How many of each banknote were handed over, kept sorted and without zeros.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BillCounts(Vec<BillCount>);

impl BillCounts {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn entries(&self) -> &[BillCount] {
        &self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn count(&self, bill: Bill) -> u32 {
        self.0.iter().find(|e| e.bill == bill).map_or(0, |e| e.count)
    }

    /// Adds `delta` (may be negative) notes, never going below zero.
    pub fn add(&mut self, bill: Bill, delta: i32) {
        let next = (self.count(bill) as i64 + delta as i64).max(0) as u32;
        self.set(bill, next);
    }

    pub fn set(&mut self, bill: Bill, count: u32) {
        self.0.retain(|e| e.bill != bill);
        if count > 0 {
            self.0.push(BillCount { bill, count });
            self.0.sort_by_key(|e| e.bill);
        }
    }

    /// Sum of one currency only, in minor units.
    pub fn sum(&self, currency: Currency) -> i64 {
        self.0
            .iter()
            .filter(|e| e.bill.currency == currency)
            .map(|e| e.bill.money().minor * e.count as i64)
            .sum()
    }

    /// Total of both currencies expressed in LBP.
    pub fn total_lbp(&self, rate: &Rate) -> i64 {
        Money::usd_cents(self.sum(Currency::Usd)).to_lbp(rate) + self.sum(Currency::Lbp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_remove() {
        let mut counts = BillCounts::new();
        counts.add(Bill::usd(20), 1);
        counts.add(Bill::lbp(100_000), 2);
        counts.add(Bill::usd(20), 1);
        assert_eq!(counts.count(Bill::usd(20)), 2);
        counts.add(Bill::usd(20), -5);
        assert_eq!(counts.count(Bill::usd(20)), 0);
        assert_eq!(counts.entries().len(), 1);
    }

    #[test]
    fn totals() {
        let mut counts = BillCounts::new();
        counts.add(Bill::usd(10), 1);
        counts.add(Bill::lbp(50_000), 1);
        assert_eq!(counts.sum(Currency::Usd), 1_000);
        assert_eq!(counts.total_lbp(&Rate::default()), 945_000);
    }

    #[test]
    fn serializes_as_list() {
        let mut counts = BillCounts::new();
        counts.add(Bill::usd(5), 3);
        let json = serde_json::to_string(&counts).unwrap();
        assert_eq!(json, r#"[{"bill":{"currency":"usd","value":5},"count":3}]"#);
    }
}
