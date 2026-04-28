# Architecture Deep Dive: Security, Auth & Multi-tenancy

## Summary

Security in Canvas.io is built on the principle of **Defensive Layering**. We use cryptographically signed tokens for identity, monotonic versioning for data integrity, and strict junction-table checks for room access.

## Identity & Authentication

### 1. JWT Strategy

Authentication is handled via **JSON Web Tokens (JWT)** stored in `HttpOnly` cookies.

- **Dual Token Model:** We use a short-lived `accessToken` for API requests and a long-lived `refreshToken` for session persistence.
- **Token Versioning:** Each user has a `tokenVersion` in the database. If a user changes their password or clicks "Logout from all devices," we increment this version. All existing tokens (which contain the old version) are instantly invalidated.

### 2. Cookie Security

To prevent CSRF and XSS attacks:

- **`HttpOnly`**: JavaScript cannot read the token, preventing theft via XSS.
- **`SameSite=Lax`**: Prevents the token from being sent in cross-site requests, mitigating CSRF.
- **`Secure`**: (In production) Ensures tokens are only sent over HTTPS.

## Multi-tenancy & Access Control

Canvas.io is a multi-tenant platform where users collaborate in private or public "Rooms."

### 1. Room Ownership

Every room has an `adminId`. The administrator has exclusive rights to:

- Rename or delete the room.
- Approve or reject access requests.
- Replace the full canvas snapshot via the REST API.

### 2. Member Access

Access to a room is verified at two levels:

- **The Request Layer:** A user can `POST /room/access/request`. This creates a pending record in the `RoomAccessRequest` table.
- **The Membership Layer:** Once approved, a record is added to the `RoomMember` junction table. All sensitive API calls (Shapes, Chat, WebSocket Join) check for this membership.

### 3. WebSocket Authorization

When a user connects to the WebSocket server:

1.  The server extracts the JWT from the cookie or query string.
2.  It verifies the user's identity.
3.  It checks if the user is a `Member` of the requested `roomId`.
4.  Only if both pass is the user allowed to receive real-time broadcasts.

## Internal System Security

Our distributed workers (like the `ai-worker`) need to communicate with the central API.

- **Internal Secret:** We use a high-entropy `INTERNAL_SECRET` shared via environment variables.
- **Protected Endpoints:** Endpoints like `/internal/ai/result` check for this secret in the `x-internal-secret` header. They bypass standard JWT auth but are inaccessible to external users.

## Data Integrity: Monotonic Guards

In a collaborative environment, an attacker could try to "roll back" the canvas by sending an old snapshot with a high version.

- **Optimistic Concurrency Control:** The Redis-backed authority checks that the incoming version is _exactly_ `current_version`.
- **Peer Validation:** Even if an invalid version reached a WebSocket node, the node's **Monotonic Guard** ensures it only broadcasts snapshots that are strictly newer than its local state.

## Trade-offs

- **Performance vs. Strictness:** Checking membership on every WebSocket message would be too slow.
  - _Trade-off:_ We check membership once during the `join_room` handshake. If a user's access is revoked while they are in the room, we rely on a "Revocation Broadcast" to disconnect them.
- **Token Revocation Latency:** Standard JWTs cannot be revoked until they expire.
  - _Trade-off:_ By including the `tokenVersion` in the JWT payload and checking it against the database (or a fast Redis cache), we achieve near-instant revocation at the cost of one DB/Redis lookup.

## Future Considerations

We plan to implement **Granular Permissions** (e.g., Viewer vs. Editor vs. Commenter). This will require moving from a simple membership check to a more complex Role-Based Access Control (RBAC) model.
