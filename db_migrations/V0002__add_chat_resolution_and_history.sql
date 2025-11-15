-- Add resolution_status to chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(50) CHECK (resolution_status IN ('solved', 'unsolved', NULL));

-- Create chat_history table for tracking changes
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  employee_id INTEGER REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add is_closed column to chats
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;