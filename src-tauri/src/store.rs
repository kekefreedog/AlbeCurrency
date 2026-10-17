//! SQLite persistence: transaction history, cached rate and settings.

use std::path::Path;

use albe_core::{Rate, Settings, Transaction};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};

const KEY_RATE: &str = "rate";
const KEY_SETTINGS: &str = "settings";

pub struct Store {
    conn: Connection,
}

pub type StoreResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl Store {
    pub fn open(path: &Path) -> StoreResult<Self> {
        let conn = Connection::open(path).map_err(err)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                body TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS transactions_created_at ON transactions(created_at DESC);
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )
        .map_err(err)?;
        Ok(Self { conn })
    }

    fn get<T: DeserializeOwned>(&self, key: &str) -> StoreResult<Option<T>> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM kv WHERE key = ?1", [key], |r| r.get(0))
            .optional()
            .map_err(err)?;
        // a value that no longer deserializes falls back to the default
        Ok(raw.and_then(|v| serde_json::from_str(&v).ok()))
    }

    fn put<T: Serialize>(&self, key: &str, value: &T) -> StoreResult<()> {
        let json = serde_json::to_string(value).map_err(err)?;
        self.conn
            .execute(
                "INSERT INTO kv (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, json],
            )
            .map_err(err)?;
        Ok(())
    }

    pub fn rate(&self) -> StoreResult<Rate> {
        Ok(self.get(KEY_RATE)?.unwrap_or_default())
    }

    pub fn set_rate(&self, rate: &Rate) -> StoreResult<()> {
        self.put(KEY_RATE, rate)
    }

    pub fn settings(&self) -> StoreResult<Settings> {
        Ok(self.get(KEY_SETTINGS)?.unwrap_or_default())
    }

    pub fn set_settings(&self, settings: &Settings) -> StoreResult<()> {
        self.put(KEY_SETTINGS, settings)
    }

    pub fn list(&self) -> StoreResult<Vec<Transaction>> {
        let mut stmt = self
            .conn
            .prepare("SELECT body FROM transactions ORDER BY created_at DESC")
            .map_err(err)?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
        let mut out = Vec::new();
        for row in rows {
            if let Ok(tx) = serde_json::from_str(&row.map_err(err)?) {
                out.push(tx);
            }
        }
        Ok(out)
    }

    pub fn save(&self, tx: &Transaction) -> StoreResult<()> {
        let body = serde_json::to_string(tx).map_err(err)?;
        self.conn
            .execute(
                "INSERT INTO transactions (id, created_at, body) VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at, body = excluded.body",
                params![tx.id, tx.created_at, body],
            )
            .map_err(err)?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> StoreResult<()> {
        self.conn
            .execute("DELETE FROM transactions WHERE id = ?1", [id])
            .map_err(err)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use albe_core::{Bill, BillCounts, Money};

    #[test]
    fn roundtrip() {
        let store = Store::open(Path::new(":memory:")).unwrap();
        assert_eq!(store.rate().unwrap().lbp_per_usd, 89_500);

        let mut paid = BillCounts::new();
        paid.add(Bill::usd(20), 1);
        let tx = Transaction {
            id: "a".into(),
            created_at: 10,
            label: Some("Snack".into()),
            category: None,
            total: Money::usd(12),
            rate: Rate::default(),
            paid,
            returned: BillCounts::new(),
        };
        store.save(&tx).unwrap();
        store.save(&tx).unwrap();
        assert_eq!(store.list().unwrap(), vec![tx]);
        store.delete("a").unwrap();
        assert!(store.list().unwrap().is_empty());
    }
}
