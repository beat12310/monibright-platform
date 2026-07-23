-- Monibright: billing + portal designer (run once)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS portal_welcome TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS portal_logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_color TEXT;
-- Existing accounts get a fresh 14-day window from today
UPDATE tenants SET paid_until = NOW() + INTERVAL '14 days' WHERE plan = 'trial';
