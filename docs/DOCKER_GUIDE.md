# Docker Configuration & Usage

The Indigo RAG POC requires **Docker** to be running to successfully host persistent state applications like PostgreSQL (for workflow tracking) and ChromaDB (for local AI Vector Storage).

## Essential Commands

### Booting the System
Bring up all the necessary backend data layers fully in detached (`-d`) background mode:
```bash
docker-compose up -d postgres chromadb dashboard
```

Alternatively, boot every service listed in the `docker-compose.yml` (including the worker, if built):
```bash
docker-compose up -d
```

### Stopping the System
Gracefully shut down all running containers to save RAM:
```bash
docker-compose down
```

*Note: Data will NOT be lost when you run `down`. Postgres data is stored in the `postgres_data` volume, and Chroma/SQLite data is stored in your local `/data` directory through volume mapping.*

### Tailing Logs
If something goes wrong (e.g., ChromaDB crashes, Postgres gets locked), stream the live execution logs:
```bash
# General cluster logs
docker-compose logs -f

# Specific container logs
docker-compose logs -f chromadb
docker-compose logs -f postgres
```

## Adding, Removing & Querying Data in Docker

Because PostgreSQL is running mapped inside Docker, you usually interact with it via `Prisma`. Ensure you have mapped Prisma to hit the local Docker instance via `.env`:
`DATABASE_URL="postgresql://indigo:password@localhost:5433/indigo_poc"`

**(Note: If running `prisma` outside Docker, map to port `5433`. If mapping inside Docker compose, link to `5432`.)**

### 1. Interacting with PostgreSQL (Via Prisma)
You can directly visualize, query, add, and delete data in the PostgreSQL database using Prisma Studio (a beautiful localhost visual editor):

```bash
npx prisma studio
```
This boots a UI on `http://localhost:5555`. 
- **To View Items**: Click `Complaint` model.
- **To Delete Items**: Check the boxes of the complaints and hit `Delete`.
- **To Mass Clear**: Run the explicit script `npx ts-node src/scripts/clear_database.ts`

### 2. Interacting with ChromaDB Containers
Because Chroma is configured dynamically as an external Vector instance on port `8000`, if you want to wipe it completely or interact with the vectors, you manipulate it via our custom scripts.

**To Mass Add/Reset Vector Data:**
1. You run `npx ts-node src/scripts/db_manager.ts seed`
2. Our backend script automatically deletes/overrides the old embeddings stored on `localhost:8000` via the Gemini Vector Embedder and pushes brand new ones!

**To See Which Vectors Currently Exist:**
The easiest way to explicitly test what Vectors exist is NOT via Docker commands, but by using `npx ts-node src/test_rag.ts`. Simply modify the hardcoded payload inside the script, run it, and it will physically output the closest semantic matches returned directly from the Chroma container!

### Resetting Docker State Completely (Nuclear Option)
If you corrupt the Postgres Database layout or completely mess up your Chroma indices, you can wipe all Docker cache and volumes completely:

```bash
docker-compose down -v
# This DESTROYS ALL data inside the postgres_data volume!

# Clean up any cached images (Optional)
docker system prune -f 
```
