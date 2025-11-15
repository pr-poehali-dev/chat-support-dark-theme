-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  login VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operator')),
  status VARCHAR(50) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'break')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'closed')),
  assigned_to INTEGER REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('user', 'operator')),
  sender_id INTEGER REFERENCES employees(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin
INSERT INTO employees (login, password, name, role, status) 
VALUES ('123', '123', 'Администратор', 'admin', 'offline')
ON CONFLICT (login) DO NOTHING;