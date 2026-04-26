# Core Concepts: State, Shapes & Rooms

This document explains the foundational concepts and data structures that drive the Canvas.io experience.

## 1. Action-Based State Management

The `canvas-engine` does not allow direct, scattered mutations of the canvas state. Instead, it follows a strict **Action-Dispatch** pattern (similar to Redux).

*   **Intent:** Predictability and traceability. By funneling all changes through a central `dispatch` function, we can easily implement features like Undo/Redo, WebSocket synchronization, and audit logging.
*   **The Store:** The `store.ts` acts as the "Gatekeeper." It receives actions (e.g., `MOVE_SHAPE`, `RESIZE_SHAPE`, `DELETE_SELECTION`) and applies the necessary logic to produce the next state.
*   **Decoupling:** This pattern decouples the *Interaction* (mouse/touch events) from the *State Logic*, making the engine highly testable and robust.

## 2. The Shape Model (JSON-based Props)

Every element on the canvas is a **Shape**. Shapes are defined by a flexible, JSON-compatible schema.

*   **Structure:**
    ```typescript
    {
      id: "uuid-v4",
      type: "rect" | "circle" | "arrow" | ...,
      x: number,
      y: number,
      width: number,
      height: number,
      props: {
        stroke: "#hex",
        fill: "#hex",
        strokeWidth: number,
        opacity: number,
        // ... type-specific properties like text content or arrow curvature
      }
    }
    ```
*   **Extensibility:** Because shapes are just JSON objects with a `type` discriminator, adding a new tool (e.g., a "Star" shape) only requires defining its drawing logic in the `renderer.ts` and its geometry logic in `geometry.ts`.
*   **Interoperability:** This JSON format is used across the entire stack: stored in PostgreSQL, cached in Redis, and transmitted over WebSockets.

## 3. Room-Based System: Slugs vs. RoomIDs

Canvas.io uses a two-tier identifier system for collaboration rooms to balance developer convenience with user-friendly URLs.

### Internal `roomId` (Integer)
*   **Purpose:** The primary key in the PostgreSQL database and the routing key for Redis/RabbitMQ.
*   **Why:** Integers are significantly more efficient for database indexing, join operations, and partition-based routing (e.g., `roomId % 16`) in the message queue.

### Public `slug` (String)
*   **Purpose:** Human-readable names used in URLs (e.g., `canvas.io/jane-doe/my-awesome-diagram`).
*   **IDOR Prevention:** Slugs are not globally unique. They are unique **per User** (`@@unique([adminId, slug])`). This prevents "Slug Squatting" and Insecure Direct Object Reference (IDOR) attacks. An attacker cannot guess a random slug to access a private room; they must also know the owner's handle, and the system still enforces strict membership checks.

### Resolution Flow
When a user visits a URL:
1.  The frontend extracts the `userHandle` and `slug`.
2.  The API resolves this pair to an internal `roomId`.
3.  All subsequent "hot" operations (WebSocket sync, real-time chat) use the optimized `roomId`.
