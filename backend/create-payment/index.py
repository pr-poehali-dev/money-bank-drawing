"""
Создание платежа в ЮКассе для участника банка.
Возвращает ссылку на оплату.
"""
import json
import os
import uuid
import urllib.request
import base64
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p29537400_money_bank_drawing")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

AMOUNTS = {
    "annual": 1200000,   # 12000 ₽ в копейках
    "monthly": 100000,   # 1000 ₽ в копейках
}


def yookassa_request(method: str, path: str, data: dict) -> dict:
    shop_id = os.environ["YOOKASSA_SHOP_ID"]
    secret_key = os.environ["YOOKASSA_SECRET_KEY"]
    credentials = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()

    payload = json.dumps(data).encode()
    req = urllib.request.Request(
        f"https://api.yookassa.ru/v3{path}",
        data=payload,
        method=method,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
            "Idempotence-Key": str(uuid.uuid4()),
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}

    body = json.loads(event.get("body") or "{}")
    participant_id = body.get("participant_id")

    if not participant_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите participant_id"})}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(
        f"SELECT id, contract_number, full_name, email, pay_type FROM {SCHEMA}.participants WHERE id = %s AND status = 'pending'",
        (participant_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Участник не найден"})}

    pid, contract, name, email, pay_type = row
    amount_kopecks = AMOUNTS.get(pay_type, AMOUNTS["annual"])
    amount_rub = amount_kopecks / 100

    return_url = os.environ.get("SITE_URL", "https://poehali.dev") + "?payment=success"

    description = f"Взнос в банк {contract} ({'единовременно' if pay_type == 'annual' else 'ежемесячно'})"

    payment = yookassa_request("POST", "/payments", {
        "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description,
        "receipt": {
            "customer": {"email": email},
            "items": [{
                "description": description,
                "quantity": "1.00",
                "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
                "vat_code": 1,
                "payment_mode": "full_payment",
                "payment_subject": "service",
            }]
        },
        "metadata": {"participant_id": str(pid), "contract": contract},
    })

    payment_id = payment["id"]
    payment_url = payment["confirmation"]["confirmation_url"]

    cur.execute(
        f"""INSERT INTO {SCHEMA}.payments (participant_id, yookassa_payment_id, amount, status, payment_url)
            VALUES (%s, %s, %s, 'pending', %s)""",
        (pid, payment_id, amount_kopecks, payment_url)
    )
    conn.commit()
    cur.close()
    conn.close()

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"payment_url": payment_url, "payment_id": payment_id})
    }
