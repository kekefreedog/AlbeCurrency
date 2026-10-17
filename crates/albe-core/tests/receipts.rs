//! Receipt parsing on realistic OCR outputs.

use albe_core::parse_receipt;

fn fixture(name: &str) -> String {
    std::fs::read_to_string(format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

#[test]
fn supermarket_dual_currency() {
    let g = parse_receipt(&fixture("supermarket_dual.txt"));
    assert_eq!(g.total_usd_cents, Some(777));
    assert_eq!(g.total_lbp, Some(695_415));
    assert_eq!(g.rate, Some(89_500));
    assert!(!g.rate_inferred);
    assert_eq!(g.merchant.as_deref(), Some("Spinneys Achrafieh"));
}

#[test]
fn snack_lbp_only() {
    let g = parse_receipt(&fixture("snack_lbp_only.txt"));
    assert_eq!(g.total_lbp, Some(290_000));
    assert_eq!(g.total_usd_cents, None);
    assert_eq!(g.rate, None);
    assert_eq!(g.merchant.as_deref(), Some("Snack Abou Ali"));
}

#[test]
fn pharmacy_arabic() {
    let g = parse_receipt(&fixture("pharmacy_arabic.txt"));
    assert_eq!(g.total_usd_cents, Some(450));
    assert_eq!(g.rate, Some(89_500));
    assert_eq!(g.merchant.as_deref(), Some("صيدلية النور"));
}
