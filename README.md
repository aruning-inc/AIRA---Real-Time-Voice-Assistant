# React AI Voice Assistant

This project is a React-based AI Voice Assistant using the `@google/genai` Live API. It connects directly from the browser to the Gemini Live API over WebSockets.

## Setup & Deployment (Vercel)

1. Clone or import this repository to Vercel.
2. In your Vercel project settings, add the following environment variable:
   - **Name:** `VITE_GEMINI_API_KEY`
   - **Value:** Your Google Gemini API Key

**Note:** The application uses Vite, so environment variables must be prefixed with `VITE_`.

## Local Development

1. Create a `.env` file based on `.env.example`.
2. Add `VITE_GEMINI_API_KEY=your_key`.
3. Run `npm install`.
4. Run `npm run dev`.