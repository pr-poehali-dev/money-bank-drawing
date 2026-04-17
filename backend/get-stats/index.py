"""
Публичная статистика банка — сумма, количество участников, список.
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p29537400_money_bank_drawing")
PRIZE_PER_WINNER = 5_500_000

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(f"""
        SELECT p.contract_number, p.full_name, p.pay_type, p.created_at,
               COALESCE(SUM(CASE WHEN py.status = 'succeeded' THEN py.amount ELSE 0 END), 0) as total_paid
        FROM {SCHEMA}.participants p
        LEFT JOIN {SCHEMA}.payments py ON py.participant_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id, p.contract_number, p.full_name, p.pay_type, p.created_at
        ORDER BY p.created_at ASC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    participants = []
    total_bank = 0
    for row in rows:
        contract, name, pay_type, created_at, paid_kopecks = row
        paid_rub = int(paid_kopecks) // 100
        total_bank += paid_rub
        participants.append({
            "contract": contract,
            "name": name,
            "pay_type": pay_type,
            "paid": paid_rub,
            "date": created_at.strftime("%d.%m.%Y"),
        })

    winners_count = total_bank // PRIZE_PER_WINNER

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "total_bank": total_bank,
            "participants_count": len(participants),
            "winners_count": winners_count,
            "prize_per_winner": PRIZE_PER_WINNER,
            "participants": participants,
        })
    }
