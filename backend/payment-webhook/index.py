"""
Вебхук от ЮКассы — подтверждение оплаты.
Активирует участника после успешного платежа.
"""
import json
import os
import psycopg2
from datetime import datetime

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p29537400_money_bank_drawing")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    event_type = body.get("event")
    payment_obj = body.get("object", {})

    if event_type != "payment.succeeded":
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"status": "ignored"})}

    yookassa_payment_id = payment_obj.get("id")
    if not yookassa_payment_id:
        return {"statusCode": 400, "headers": CORS, "body": ""}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(
        f"SELECT id, participant_id FROM {SCHEMA}.payments WHERE yookassa_payment_id = %s",
        (yookassa_payment_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"status": "not_found"})}

    payment_db_id, participant_id = row

    cur.execute(
        f"UPDATE {SCHEMA}.payments SET status = 'succeeded', paid_at = NOW() WHERE id = %s",
        (payment_db_id,)
    )
    cur.execute(
        f"UPDATE {SCHEMA}.participants SET status = 'active' WHERE id = %s",
        (participant_id,)
    )
    conn.commit()
    cur.close()
    conn.close()

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"status": "ok"})
    }