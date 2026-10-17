//! Transaction model, change verification and change suggestion.

use serde::{Deserialize, Serialize};

use crate::bills::{Bill, BillCounts, Denominations};
use crate::money::{Currency, Money, Rate};

/// Default tolerance when comparing the change, small LBP is rarely given back.
pub const DEFAULT_TOLERANCE_LBP: i64 = 5_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    /// Unix timestamp (seconds).
    pub created_at: i64,
    /// What the transaction was for, read from the receipt or typed.
    #[serde(alias = "merchant")]
    pub label: Option<String>,
    /// Id of a [`crate::Category`] from the settings.
    #[serde(default)]
    pub category: Option<String>,
    pub total: Money,
    pub rate: Rate,
    pub paid: BillCounts,
    pub returned: BillCounts,
}

impl Transaction {
    pub fn verdict(&self, tolerance_lbp: i64) -> Verdict {
        check(self.total, &self.rate, &self.paid, &self.returned, tolerance_lbp)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    /// The change matches within tolerance.
    Ok,
    /// The seller gave back less than due.
    Missing,
    /// The seller gave back more than due.
    Surplus,
    /// What was paid does not cover the total.
    Underpaid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verdict {
    pub status: Status,
    pub total_lbp: i64,
    pub paid_lbp: i64,
    /// `paid - total`, negative when underpaid.
    pub due_change_lbp: i64,
    pub returned_lbp: i64,
    /// `returned - due_change`, negative when change is missing.
    pub gap_lbp: i64,
    pub gap_usd_cents: i64,
    pub due_change_usd_cents: i64,
}

pub fn check(
    total: Money,
    rate: &Rate,
    paid: &BillCounts,
    returned: &BillCounts,
    tolerance_lbp: i64,
) -> Verdict {
    let total_lbp = total.to_lbp(rate);
    let paid_lbp = paid.total_lbp(rate);
    let returned_lbp = returned.total_lbp(rate);
    let due_change_lbp = paid_lbp - total_lbp;
    let gap_lbp = returned_lbp - due_change_lbp;
    let tolerance = tolerance_lbp.abs();

    let status = if due_change_lbp < -tolerance {
        Status::Underpaid
    } else if gap_lbp.abs() <= tolerance {
        Status::Ok
    } else if gap_lbp < 0 {
        Status::Missing
    } else {
        Status::Surplus
    };

    Verdict {
        status,
        total_lbp,
        paid_lbp,
        due_change_lbp,
        returned_lbp,
        gap_lbp,
        gap_usd_cents: rate.lbp_to_usd_cents(gap_lbp),
        due_change_usd_cents: rate.lbp_to_usd_cents(due_change_lbp),
    }
}

/// Ideal change for `due_lbp`, using as few notes as possible.
///
/// With `prefer = Usd` whole dollars are given first and the remainder in
/// LBP, rounded to the smallest LBP note. With `prefer = Lbp` everything is
/// given in LBP.
pub fn suggest_change(
    due_lbp: i64,
    rate: &Rate,
    denominations: &Denominations,
    prefer: Currency,
) -> BillCounts {
    let mut out = BillCounts::new();
    if due_lbp <= 0 {
        return out;
    }

    let rate_lbp = rate.lbp_per_usd as i64;
    let mut remaining_lbp = due_lbp;

    if prefer == Currency::Usd {
        let mut dollars = due_lbp / rate_lbp;
        remaining_lbp -= dollars * rate_lbp;
        dollars = greedy(dollars, &denominations.usd, Bill::usd, &mut out);
        remaining_lbp += dollars * rate_lbp;
    }

    let step = denominations.smallest_lbp() as i64;
    let rounded = (remaining_lbp + step / 2) / step * step;
    greedy(rounded, &denominations.lbp, Bill::lbp, &mut out);
    out
}

/// Greedy split of `amount`, returns what could not be expressed.
fn greedy(mut amount: i64, values: &[u32], make: fn(u32) -> Bill, out: &mut BillCounts) -> i64 {
    let mut sorted = values.to_vec();
    sorted.sort_unstable_by(|a, b| b.cmp(a));
    for value in sorted {
        let value_i = value as i64;
        if value_i == 0 {
            continue;
        }
        let n = amount / value_i;
        if n > 0 {
            out.add(make(value), n as i32);
            amount -= n * value_i;
        }
    }
    amount
}

#[cfg(test)]
mod tests {
    use super::*;

    fn counts(items: &[(Bill, u32)]) -> BillCounts {
        let mut c = BillCounts::new();
        for (bill, n) in items {
            c.add(*bill, *n as i32);
        }
        c
    }

    #[test]
    fn mixed_change_is_ok() {
        // 12 $ paid with a 20 $ note, change 5 $ + 3 $ in LBP (268 500 -> 270 000)
        let rate = Rate::default();
        let paid = counts(&[(Bill::usd(20), 1)]);
        let returned = counts(&[
            (Bill::usd(5), 1),
            (Bill::lbp(100_000), 2),
            (Bill::lbp(50_000), 1),
            (Bill::lbp(20_000), 1),
        ]);
        let v = check(Money::usd(12), &rate, &paid, &returned, DEFAULT_TOLERANCE_LBP);
        assert_eq!(v.due_change_lbp, 716_000);
        assert_eq!(v.returned_lbp, 717_500);
        assert_eq!(v.status, Status::Ok);
    }

    #[test]
    fn missing_change() {
        let rate = Rate::default();
        let paid = counts(&[(Bill::usd(20), 1)]);
        let returned = counts(&[(Bill::usd(5), 1)]);
        let v = check(Money::usd(12), &rate, &paid, &returned, DEFAULT_TOLERANCE_LBP);
        assert_eq!(v.status, Status::Missing);
        assert_eq!(v.gap_usd_cents, -300);
        assert_eq!(v.gap_lbp, -268_500);
    }

    #[test]
    fn surplus_and_underpaid() {
        let rate = Rate::default();
        let paid = counts(&[(Bill::lbp(100_000), 1)]);
        let v = check(Money::lbp(50_000), &rate, &paid, &counts(&[(Bill::lbp(100_000), 1)]), 0);
        assert_eq!(v.status, Status::Surplus);
        let v = check(Money::usd(5), &rate, &paid, &BillCounts::new(), DEFAULT_TOLERANCE_LBP);
        assert_eq!(v.status, Status::Underpaid);
    }

    #[test]
    fn suggestion_prefers_usd() {
        let rate = Rate::default();
        let due = Money::usd(8).to_lbp(&rate) + 30_000;
        let s = suggest_change(due, &rate, &Denominations::default(), Currency::Usd);
        assert_eq!(s.count(Bill::usd(5)), 1);
        assert_eq!(s.count(Bill::usd(2)), 1);
        assert_eq!(s.count(Bill::usd(1)), 1);
        assert_eq!(s.count(Bill::lbp(20_000)), 1);
        assert_eq!(s.count(Bill::lbp(10_000)), 1);
    }

    #[test]
    fn suggestion_in_lbp_rounds() {
        // smallest note in use is 5 000 LL
        let rate = Rate::default();
        let s = suggest_change(268_500, &rate, &Denominations::default(), Currency::Lbp);
        assert_eq!(s.sum(Currency::Lbp), 270_000);
    }
}
