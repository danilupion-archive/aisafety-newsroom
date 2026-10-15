# aisafety-newsroom

Capture, triage and publishing software for [aisafety-media](../aisafety-media):

- a Telegram bot that queues news from the phone;
- a worker that fetches each page and stores its text and metadata;
- an inbox API that aisafety-media's `/news` reads;
- a public Spanish site for approved short news and articles.

It runs on the the cluster cluster and follows [aiontheballot](../aiontheballot)'s
stack at a smaller scale. The content and its rules live in aisafety-media. This repo is
only the software. Deployment manifests live in `../gitops`.

Start with [SPEC.md](SPEC.md).
