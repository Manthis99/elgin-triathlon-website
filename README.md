# Elgin Triathlon Concept Site

A static landing page for a simple $20 community triathlon in Elgin, Illinois.

## Files

- `index.html` - Page structure and event content
- `styles.css` - Responsive visual system and layout
- `script.js` - Mobile navigation and placeholder interest-form behavior

## Run Locally

```bash
node server.js
```

Then open `http://localhost:4173`.

Form submissions are saved locally to `data/interest.csv`, which is ignored by git so collected emails are not pushed.

## Replace Later

- Swap Unsplash image URLs with final event/local images.
- Confirm event date, swim venue, bike distance, run distance, and registration link.
- Connect the interest form to a real form provider or registration platform before publishing publicly.
