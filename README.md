# Card Orchestrator

A scalable Node.js service for generating personalized Ramadan cards
using:

-   Adobe InDesign Data Merge API
-   Custom cc-s3 asset storage
-   Redis + BullMQ for async job processing
-   Worker-based architecture for controlled rate limiting

------------------------------------------------------------------------

## Architecture

### Sync Flow

POST /generate\
Blocks until Adobe merge completes.

### Async Flow

POST /generate-async\
Returns jobId immediately.

GET /jobs/:jobId\
Poll for job status.

Worker processes jobs from Redis queue.

------------------------------------------------------------------------

## Installation

``` bash
npm install
```

Create your environment file:

``` bash
cp .env.example .env
```

Fill in:

-   S3_API_KEY
-   ADOBE_CLIENT_ID
-   ADOBE_CLIENT_SECRET

------------------------------------------------------------------------

## Running Locally

### Start Redis (Docker)

``` bash
docker run --name redis -p 6379:6379 -d redis:7
```

### Start API

``` bash
node src/server.js
```

### Start Worker

``` bash
node src/worker/worker.js
```

------------------------------------------------------------------------

## Environment Tuning

### Worker Rate Limiting

-   WORKER_LIMITER_MAX → jobs per duration
-   WORKER_LIMITER_DURATION_MS → window size
-   WORKER_CONCURRENCY → parallel jobs

Example:

``` env
WORKER_CONCURRENCY=5
WORKER_LIMITER_MAX=150
WORKER_LIMITER_DURATION_MS=60000
```

------------------------------------------------------------------------

## Scaling

-   API can scale horizontally.
-   Worker can scale with replicas.
-   If using replicas, remember limiter applies per worker instance
    unless you implement a global Redis token bucket.

------------------------------------------------------------------------

## Production Notes

-   Use managed Redis in production.
-   Enable S3 object versioning for config safety.
-   Monitor Adobe API 429 responses.
-   Keep headroom below API RPM limits.

------------------------------------------------------------------------

## License

Internal / Private Project
