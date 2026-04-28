# Persistence Layer: Data Storage & Recovery

## Summary

Canvas.io uses a tiered persistence model to balance real-time performance with long-term data durability. **PostgreSQL** serves as the cold, durable storage for all shapes, chat, and metadata.

## 1. Shape Storage Strategy

Shapes are stored in the `Shape` table in PostgreSQL.

- **JSONB Storage:** We store the visual properties of a shape (colors, size, stroke) in a `props` JSON column. This allows the schema to remain flexible even as we add new, complex tools (like sticky notes or images) without requiring database migrations.
- **Monotonic Versions:** While the database stores the list of shapes, the current **Room Version** is managed as an integer in the `Room` table. This version is incremented with every accepted bulk update.

## 2. Update & Delete Strategy (Soft Delete)

To prevent accidental data loss and maintain a history of actions, Canvas.io employs a **Soft Delete** strategy for shapes.

- **The `deleted` Flag:** When a user "deletes" a shape, the system does not execute a `DELETE` SQL command. Instead, it sets the `deleted` column to `true`.
- **Filtering:** All read operations automatically filter out shapes where `deleted: true`.
- **Intent:** This approach allows us to implement "Undo Delete" features and provides a valuable audit trail for recovering diagrams if a user makes a mistake.

## 3. Data Recovery & Refresh Flow

When a user refreshes their browser or joins a room for the first time, the system follows this recovery hierarchy:

1.  **Redis Cache (Hot):** The system first checks Redis for a serialized snapshot of the room. This is the fastest path ($<2ms$).
2.  **PostgreSQL Rebuild (Cold):** If the Redis cache is empty (e.g., after a cache eviction or long inactivity), the WebSocket server:
    - Queries the `Shape` table for all non-deleted shapes matching the `roomId`.
    - Reconstructs the full JSON snapshot.
    - Re-populates the Redis cache to speed up subsequent joins.
3.  **Client Hydration:** The server sends a `room_joined` event containing the full shape array to the client. The client's `canvas-engine` then calls `hydrateShapes()` to populate the local store.

## 4. Background Persistence Jobs

WebSocket nodes are optimized for real-time traffic. They do not write to PostgreSQL on every mouse movement.

- **RabbitMQ Persist Queue:** When a node accepts a final snapshot (e.g., when a user stops dragging), it enqueues a "Persist Job" in RabbitMQ.
- **Worker Execution:** A background worker consumes these jobs and performs a batch `upsert` in PostgreSQL. This decoupling protects the database from being overwhelmed by high-frequency updates during active collaboration.

## Future Improvements: Operational Transforms (OT)

Currently, we persist the full state. In the future, we will transition to persisting individual **Deltas** (JSON patches). This will further reduce database I/O and allow for infinite "Time Travel" through the diagram's history.
