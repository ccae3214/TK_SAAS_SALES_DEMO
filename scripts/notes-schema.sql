CREATE TABLE IF NOT EXISTS note_folders (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_email, name)
);

CREATE TABLE IF NOT EXISTS user_notes (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  folder_id BIGINT REFERENCES note_folders(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notes_owner_updated ON user_notes(user_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS user_notes_search ON user_notes USING GIN (to_tsvector('simple', title || ' ' || content));
