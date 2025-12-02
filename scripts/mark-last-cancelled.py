#!/usr/bin/env python3
"""
One-time script to mark the last transaction as cancelled in the database

Usage: python scripts/mark-last-cancelled.py
"""

import sqlite3
import os
from pathlib import Path

# Try multiple possible database locations
possible_paths = [
    Path(os.environ.get('APPDATA', '')) / 'mutui-hologram-studio' / 'analytics.db',
    Path(os.environ.get('APPDATA', '')) / 'creative-mut-app' / 'analytics.db',
    Path(os.environ.get('LOCALAPPDATA', '')) / 'mutui-hologram-studio' / 'analytics.db',
    Path(os.environ.get('LOCALAPPDATA', '')) / 'creative-mut-app' / 'analytics.db',
    Path(__file__).parent.parent / 'analytics.db',  # Project root
]

db_path = None
for path in possible_paths:
    if path.exists():
        db_path = path
        break

if not db_path:
    print("[ERROR] analytics.db not found in any of these locations:")
    for path in possible_paths:
        print(f"  - {path}")
    print("\nPlease run the app first to create the database.")
    exit(1)

print(f"[DB] Opening database at: {db_path}")

try:
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Check if transaction_id column exists, add if not
    cursor.execute("PRAGMA table_info(payments)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'transaction_id' not in columns:
        print("[DB] Adding transaction_id column to payments table...")
        cursor.execute("ALTER TABLE payments ADD COLUMN transaction_id TEXT")
        conn.commit()
        print("[OK] transaction_id column added.")

    # Find the last approved payment
    cursor.execute("""
        SELECT id, session_id, amount, status, approval_number, sales_date, transaction_id
        FROM payments
        WHERE status = 'approved'
        ORDER BY payment_time DESC
        LIMIT 1
    """)

    last_payment = cursor.fetchone()

    if not last_payment:
        print("[DB] No approved payments found.")
        conn.close()
        exit(0)

    payment_id, session_id, amount, status, approval_number, sales_date, transaction_id = last_payment

    print("[DB] Last approved payment:")
    print(f"  - ID: {payment_id}")
    print(f"  - Session: {session_id}")
    print(f"  - Amount: {amount}")
    print(f"  - Approval Number: {approval_number or 'N/A'}")
    print(f"  - Sales Date: {sales_date or 'N/A'}")
    print(f"  - Transaction ID: {transaction_id or 'N/A'}")

    # Update the status to cancelled
    cursor.execute("UPDATE payments SET status = 'cancelled' WHERE id = ?", (payment_id,))
    conn.commit()

    if cursor.rowcount > 0:
        print(f"\n[OK] Successfully marked payment #{payment_id} as cancelled.")
    else:
        print("\n[WARN] No changes made.")

    conn.close()

except Exception as e:
    print(f"[ERROR] Failed to update database: {e}")
    exit(1)
