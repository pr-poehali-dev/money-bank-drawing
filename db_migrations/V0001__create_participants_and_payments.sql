
CREATE TABLE t_p29537400_money_bank_drawing.participants (
  id SERIAL PRIMARY KEY,
  contract_number VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  pay_type VARCHAR(10) NOT NULL CHECK (pay_type IN ('annual', 'monthly')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p29537400_money_bank_drawing.payments (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES t_p29537400_money_bank_drawing.participants(id),
  yookassa_payment_id VARCHAR(100) UNIQUE,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled')),
  payment_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON t_p29537400_money_bank_drawing.payments(participant_id);
CREATE INDEX ON t_p29537400_money_bank_drawing.participants(status);
