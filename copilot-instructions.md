# Copilot Repository Instructions

This repository is a local PDF-to-XML conversion app. The main goal is to keep the implementation simple, local, and free of external AI services.

## Key rules

- Always prefer local PDF processing.
- Do not add AI services, Gemini, OpenAI, or any external ML APIs.
- Avoid dependencies not needed for PDF parsing, Express, React, Vite, or XML handling.
- Use `pdf-parse` for PDF text extraction and local XML parsing logic.
- For Vercel or serverless flows, prefer binary PDF upload with `Content-Type: application/pdf`.
- Do not use base64 JSON file payloads for PDF upload when binary upload is available.
- Preserve the existing app architecture: `server.ts`, `api/pdf-to-xml.ts`, `src/components/pdf-to-xml-converter.tsx`, `src/lib/*`.

## Code style and behavior

- Keep changes minimal and practical.
- Prefer updating existing files rather than creating large new scaffolding.
- If a deployment fix is requested, focus on API handler payload handling, request parsing, and correct `fetch` usage.
- Keep responses concise, with a short summary and headings when giving explanations.
- When the user writes in Portuguese, respond in Portuguese.

## Git and deployment

- If asked to push changes, use the existing git workflow and `env -u GITHUB_TOKEN` if needed.
- Do not modify the repository structure unnecessarily.

## When unsure

- Ask a clarifying question if the task is not clearly about the local PDF-to-XML flow.
- Do not invent new features that rely on AI or cloud services.
