# aisafety-newsroom

Capture, triage and publishing software for aisafety-media:

- a Telegram bot that queues news from the phone;
- a worker that fetches each page and stores its text and metadata;
- an inbox API that aisafety-media's `/news` reads;
- a public site, in Spanish and English, for approved short news and articles.

It runs on Kubernetes with Argo CD and follows aiontheballot's stack at a smaller scale.
The content and its rules live in aisafety-media. This repo is only the software; the
deployment manifests live in a private gitops repo.

Start with [SPEC.md](SPEC.md).
