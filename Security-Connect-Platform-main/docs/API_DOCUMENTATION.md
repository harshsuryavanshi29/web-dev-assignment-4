# Secure Connect API Documentation

Base URL: `http://localhost:5000`

All request and response bodies use JSON. For protected endpoints, send `Authorization: Bearer <JWT>`. The signup endpoint always creates a regular `user`; admin accounts are initialized from server environment variables.

## Health

### `GET /api/health`
- **Authentication:** None
- **Request body:** None
- **Success (`200`):** `{ "status": "ok", "database": "connected" }`
- **Errors:** `500` if the database cannot be reached.

## Authentication

### `POST /api/auth/signup`
- **Authentication:** None
- **Request body:** `{ "username": "victor", "email": "victor@example.com", "password": "secret123" }`
- **Success (`201`):** `{ "message": "User registered", "id": "...", "username": "victor", "email": "victor@example.com" }`
- **Errors:** `400` missing/invalid fields; `409` email already registered; `500` unexpected server/database error.

### `POST /api/auth/login`
- **Authentication:** None
- **Request body:** `{ "email": "victor@example.com", "password": "secret123" }`
- **Success (`200`):** `{ "message": "Login successful", "token": "<JWT>" }`
- **Errors:** `400` missing/invalid fields; `401` incorrect credentials.

### `GET /api/auth/me`
- **Authentication:** Required
- **Request body:** None
- **Success (`200`):** The authenticated user's ID, username, email, role, and timestamps; no password hash.
- **Errors:** `403` token missing; `401` invalid/expired token or deleted account; `404` user not found.

## Personal notes

All notes are scoped to the authenticated account. The owner is taken from the verified token, never from request JSON. An invalid note ID returns `400`; a missing note or a note owned by someone else returns `404`.

### `POST /api/notes`
- **Authentication:** Required
- **Request body:** `{ "title": "My First Note", "content": "Note text" }`
- **Success (`201`):** The saved note, including `_id`, owner ID, `createdAt`, and `updatedAt`.
- **Errors:** `400` missing/empty title or content; `403` missing token; `401` invalid/expired token.

### `GET /api/notes`
- **Authentication:** Required
- **Request body:** None
- **Success (`200`):** An array of the current user's notes, newest first. An account with no notes receives `[]`.
- **Errors:** `403` missing token; `401` invalid/expired token.

### `GET /api/notes/:id`
- **Authentication:** Required
- **Request body:** None
- **Success (`200`):** The requested note when it belongs to the current user.
- **Errors:** `400` invalid ID; `403` missing token; `401` invalid/expired token; `404` note missing or not owned by current user.

### `PUT /api/notes/:id`
- **Authentication:** Required
- **Request body:** `{ "title": "Updated title", "content": "Updated text" }`
- **Success (`200`):** The updated note. The owner cannot be changed and `updatedAt` is refreshed.
- **Errors:** `400` invalid ID or empty fields; `403` missing token; `401` invalid/expired token; `404` note missing or not owned by current user.

### `DELETE /api/notes/:id`
- **Authentication:** Required
- **Request body:** None
- **Success (`200`):** `{ "message": "Note deleted successfully" }`
- **Errors:** `400` invalid ID; `403` missing token; `401` invalid/expired token; `404` note missing or not owned by current user.

## Administrator

All admin endpoints require a valid JWT belonging to an account whose current database role is `admin`. Password hashes are excluded from user records.

### `GET /api/admin/users`
- **Authentication:** Admin
- **Request body:** None
- **Success (`200`):** An array of public user records.
- **Errors:** `403` missing token or insufficient role; `401` invalid/expired token.

### `GET /api/admin/users/:id`
- **Authentication:** Admin
- **Request body:** None
- **Success (`200`):** One public user record.
- **Errors:** `400` invalid ID; `403` missing token or insufficient role; `401` invalid/expired token; `404` user not found.

### `GET /api/admin/stats`
- **Authentication:** Admin
- **Request body:** None
- **Success (`200`):** `{ "users": 2, "notes": 5 }`
- **Errors:** `403` missing token or insufficient role; `401` invalid/expired token.

## Socket.IO chat

Connect to the same base URL with a JWT in the Socket.IO `auth` object: `{ auth: { token: "<JWT>" } }`. The server verifies the token and looks up the current username and role; it ignores client-supplied usernames.

Client events: `joinRoom` with `{ "room": "general" }`, `chatMessage` with `{ "room": "general", "message": "Hello" }`, and `leaveRoom` with `{ "room": "general" }`.

Server events: `roomJoined`, `userJoined`, `receiveMessage`, `userLeft`, and `errorMessage`. New authenticated connections join `general` automatically. Room names accept 1-40 letters, numbers, underscores, and hyphens; messages accept 1-2000 characters.
