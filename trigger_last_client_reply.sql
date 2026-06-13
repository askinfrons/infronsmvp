-- Trigger to automatically update last_client_reply when client sends a message
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_last_client_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if sender is 'client'
  IF NEW.sender = 'client' THEN
    UPDATE clients
    SET last_client_reply = NEW.created_at
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_last_client_reply ON messages;

-- Create trigger
CREATE TRIGGER trigger_update_last_client_reply
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_client_reply();
