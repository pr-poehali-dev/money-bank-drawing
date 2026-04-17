"""
Регистрация нового участника банка.
Создаёт запись участника и генерирует номер договора.
"""
import json
import os
import re
from datetime import datetime
import psycopg2

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
        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}

    body = json.loads(event.get("body") or "{}")
    name = (body.get("full_name") or "").strip()
    phone = (body.get("phone") or "").strip()
    email = (body.get("email") or "").strip()
    pay_type = body.get("pay_type", "annual")

    if not name or not phone or not email:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заполните все поля"})}

    if pay_type not in ("annual", "monthly"):
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверный тип оплаты"})}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    year = datetime.now().year

    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.participants WHERE contract_number LIKE 'БНК-{year}-%'")
    count = cur.fetchone()[0] + 1
    contract_number = f"БНК-{year}-{str(count).zfill(3)}"

    cur.execute(
        f"""INSERT INTO {SCHEMA}.participants (contract_number, full_name, phone, email, pay_type, status)
            VALUES (%s, %s, %s, %s, %s, 'pending') RETURNING id, contract_number""",
        (contract_number, name, phone, email, pay_type)
    )
    row = cur.fetchone()
    participant_id, contract = row[0], row[1]
    conn.commit()
    cur.close()
    conn.close()

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "participant_id": participant_id,
            "contract_number": contract,
            "pay_type": pay_type,
        })
    }
