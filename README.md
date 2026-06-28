# System Hub Dashboard

A private creator workflow dashboard for video planning, production status, earning outlook, daily wellbeing signals, and evidence-based action recommendations.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Build

`npm run build`

The production output is generated in `dist/`.

## Data storage

The application uses Supabase email authentication and a row-level-secured cloud state record. Browser local storage remains available as a local backup.
