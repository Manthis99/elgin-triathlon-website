# Elgin Triathlon Concept Site

A static landing page for a simple $20 community triathlon in Elgin, Illinois.

## Files

- `index.html` - Page structure and event content
- `styles.css` - Responsive visual system and layout
- `script.js` - Mobile navigation and placeholder interest-form behavior

## Run Locally

```bash
npm install
npm start
```

Then open `http://localhost:4173`.

## Registration Storage

The form posts to `/api/interest`.

By default, submissions are saved locally to `data/interest.csv`, which is ignored by git so collected emails are not pushed.

To save submissions in Neon Postgres:

1. Create a Neon project.
2. Copy the pooled connection string from Neon.
3. Create `.env` from `.env.example`.
4. Set `DATABASE_URL` in `.env`.
5. Restart the server with `npm start`.

The server creates this table automatically on first submission:

```sql
CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  distance TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website'
);
```

## Replace Later

- Swap Unsplash image URLs with final event/local images.
- Confirm event date, swim venue, bike distance, run distance, and registration link.
- Connect the interest form to a real form provider or registration platform before publishing publicly.
