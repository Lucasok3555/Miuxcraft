# Base44 environment notes

- The project is a dependency-free static browser app; serve the repository root directly.
- `app.js` imports Three.js from jsDelivr at runtime, so browser access to that CDN is required for the 3D scene.
- Start with `docker compose -f docker-compose.base44.yml up -d`.
- Verify both `curl http://localhost:3000/` and `curl -H 'Host: external-preview.example.com' http://localhost:3000/` return `index.html`.
- There is no build step, database, migration, seed, or required secret.
- The static server reads from the bind-mounted source on every request; refresh the browser after source edits.
