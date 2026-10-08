-- ============================================
-- BET LEADERBOARD V3 MIGRATION
-- Run in Supabase SQL Editor with: SET ROLE postgres;
-- ============================================

-- ============================================
-- 1. PENDING BETS (Session 2 rebuild)
-- Add 'pending' to outcome, add settled_at column
-- ============================================

-- Drop the existing CHECK constraint on outcome
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_outcome_check;

-- Add new CHECK constraint allowing 'win', 'loss', 'pending'
ALTER TABLE bets ADD CONSTRAINT bets_outcome_check
  CHECK (outcome IN ('win', 'loss', 'pending'));

-- Add settled_at timestamp (NULL for pending bets, set when settled)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS settled_at timestamptz;

-- Backfill settled_at for existing bets (all are already settled)
UPDATE bets SET settled_at = created_at WHERE settled_at IS NULL AND outcome IN ('win', 'loss');

-- Allow users to UPDATE their own bets (for settling pending bets)
CREATE POLICY "Users can update own bets"
  ON bets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. ADMIN REVIEW QUEUE
-- Add flagging columns directly to bets table
-- ============================================

-- Admin can flag a bet (excludes from leaderboard until resolved)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS flag_reason text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS flagged_at timestamptz;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES profiles(id);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_reviewed boolean DEFAULT false;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ============================================
-- 3. SHARED BETS
-- Independent from bet logging (no FK to bets)
-- ============================================

CREATE TABLE IF NOT EXISTS shared_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_code text NOT NULL,
  num_games integer,
  odds decimal(10,2),
  screenshot_url text NOT NULL,
  -- Owner can mark outcome after result
  owner_outcome text CHECK (owner_outcome IN ('win', 'loss')),
  result_screenshot_url text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for shared_bets
ALTER TABLE shared_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shared bets"
  ON shared_bets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own shared bets"
  ON shared_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared bets"
  ON shared_bets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Community confirmations on shared bets
CREATE TABLE IF NOT EXISTS shared_bet_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_bet_id uuid NOT NULL REFERENCES shared_bets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('win', 'loss')),
  created_at timestamptz DEFAULT now(),
  -- One vote per user per shared bet
  UNIQUE(shared_bet_id, user_id)
);

-- RLS for shared_bet_confirmations
ALTER TABLE shared_bet_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view confirmations"
  ON shared_bet_confirmations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own confirmations"
  ON shared_bet_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. NOTIFICATIONS
-- In-app notifications for users
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bet_flagged', 'flag_resolved', 'rank_overtake', 'pending_reminder')),
  message text NOT NULL,
  reference_id uuid, -- optional: bet_id or shared_bet_id for context
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin needs to insert notifications for other users
-- Use a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION insert_notification(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, message, reference_id)
  VALUES (p_user_id, p_type, p_message, p_reference_id);
END;
$$;

-- Grant execute to authenticated users (admin checks happen in app code)
GRANT EXECUTE ON FUNCTION insert_notification TO authenticated;

-- ============================================
-- 5. INDEXES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bets_user_outcome ON bets(user_id, outcome);
CREATE INDEX IF NOT EXISTS idx_bets_is_flagged ON bets(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_bets_is_reviewed ON bets(is_reviewed) WHERE is_reviewed = false;
CREATE INDEX IF NOT EXISTS idx_shared_bets_created ON shared_bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_bets_user ON shared_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ============================================
-- 6. ADMIN POLICY: Allow admin to update any bet (for flagging/reviewing)
-- ============================================

-- Helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- Admin can update any bet (for flagging, reviewing, outcome changes)
CREATE POLICY "Admin can update any bet"
  ON bets FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admin can insert notifications for any user
CREATE POLICY "Admin can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (is_admin());
