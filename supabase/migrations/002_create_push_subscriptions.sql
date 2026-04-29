-- Push Subscriptions table for Web Push Notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  tipo_jogo TEXT[] DEFAULT '{}',
  last_notified_contest JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active subscriptions lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions (active) WHERE active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (anyone can subscribe)
CREATE POLICY "Anyone can subscribe" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Allow anonymous select (needed for cron to read subscriptions)
CREATE POLICY "Anyone can read subscriptions" ON push_subscriptions
  FOR SELECT USING (true);

-- Allow anonymous updates (to toggle active / update games)
CREATE POLICY "Anyone can update own subscription" ON push_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anonymous deletes (unsubscribe)
CREATE POLICY "Anyone can delete own subscription" ON push_subscriptions
  FOR DELETE USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_push_subscription_timestamp
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();
