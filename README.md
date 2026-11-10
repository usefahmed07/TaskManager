# Task Manager API

A RESTful backend for managing projects and tasks, built with Node.js, Express and MongoDB. Users register, verify their email, log in with a JWT and manage their own projects and tasks, with filtering, search, sorting and pagination.

## Features

- User registration with email verification and JWT authentication (1 hour tokens)
- Profile updates, plus OTP-protected email and password changes
- Projects and tasks scoped to their owner: no user can read or modify another user's data
- Task filtering by status, search by name, sorting and pagination
- Input validation, including protection against NoSQL operator injection
- Verification tokens and OTPs stored as SHA-256 hashes, passwords hashed with bcrypt
- Security headers (`helmet`) and rate limiting (`express-rate-limit`)
- Health check endpoint and consistent JSON error responses

## Tech Stack

| Area | Tools |
| --- | --- |
| Runtime | Node.js, TypeScript (ES modules) |
| Framework | Express 4 |
| Database | MongoDB with Mongoose 7 |
| Auth | JSON Web Tokens, bcryptjs |
| Email | Nodemailer (Gmail) |
| Security | helmet, express-rate-limit |

## Getting Started

### Prerequisites

- Node.js 18 or later
- A MongoDB instance (the command below uses Docker)

### Installation

```bash
git clone https://github.com/usefahmed07/TaskManagerAPI.git
cd TaskManagerAPI
npm install
cp .env.example .env
docker run -d --name mongo -p 27017:27017 -v mongo-data:/data/db mongo:7
```

Edit `.env` and set a strong `SECRET_KEY`. You can generate one with:

```bash
openssl rand -hex 32
```

### Run

```bash
npm run dev     # development with tsx, restarts on file changes
npm run build   # compile TypeScript to dist/
npm start       # run the compiled build
```

The server listens on `http://localhost:8000` by default. Check it with:

```bash
curl http://localhost:8000/health
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port to listen on (default `8000`) |
| `DB_URL` | Yes | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/taskmanager` |
| `SECRET_KEY` | Yes | Secret used to sign JWTs |
| `BASE_URL` | No | Public URL used to build verification links (default `http://localhost:8000`) |
| `EMAIL_USER` | No | Gmail address used to send verification emails and OTPs |
| `EMAIL_PASS` | No | Gmail app password for `EMAIL_USER` |

If `EMAIL_USER` and `EMAIL_PASS` are not set, no email is sent. The verification link and OTP are printed to the server log instead, which is convenient for local development.

## Authentication

Protected routes expect a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

A new account must be verified before it can log in. Logging in with an unverified account sends a fresh verification link.

## API Reference

All responses are JSON. Successful list responses include `data` and `pagination`; other responses include `status` and `message`.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Service and database status |

### Users

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/user/register` | No | Create an account (`name`, `email`, `phone`, `password`) |
| GET | `/api/user/verify/:token` | No | Verify an email address |
| POST | `/api/user/login` | No | Log in (`email`, `password`), returns a JWT |
| GET | `/api/user` | Yes | Get the current user |
| PATCH | `/api/user/update` | Yes | Update `name` and/or `phone` |
| POST | `/api/user/otp` | Yes | Send an OTP to the registered email (valid 10 minutes) |
| PATCH | `/api/user/otp/update/email` | Yes | Change email (`otp`, `email`), requires re-verification |
| PATCH | `/api/user/otp/update/pin` | Yes | Change password (`otp`, `password`, `confirmPassword`) |

### Projects

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/project` | Create a project (`projectName`, `projectDescription`, optional `dueDate`) |
| GET | `/api/project` | List projects (`page`, `limit`) |
| GET | `/api/project/:id` | Get a project |
| PATCH | `/api/project/:id` | Update a project |
| DELETE | `/api/project/:id` | Delete a project and all of its tasks |

### Tasks

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/task/:projectId` | Create a task (`taskName`, `taskDescription`, `dueDate`, `taskStatus`) |
| GET | `/api/task/:projectId` | List tasks in a project |
| PATCH | `/api/task/:projectId/:taskId` | Update a task |
| DELETE | `/api/task/:projectId/:taskId` | Delete a task |

`taskStatus` must be one of `PENDING`, `INPROGRESS` or `COMPLETED`.

Query parameters for listing tasks:

| Parameter | Description |
| --- | --- |
| `status` | Filter by `PENDING`, `INPROGRESS` or `COMPLETED` |
| `search` | Case-insensitive match on the task name |
| `sortBy` | `dueDate` or `taskName` (default: creation order) |
| `order` | `asc` (default) or `desc` |
| `page` | Page number, starting at 1 |
| `limit` | Items per page, 1 to 100 (default 10) |

## Example

```bash
# Register, then open the verification link printed in the server log
curl -X POST http://localhost:8000/api/user/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","phone":"1123138408","password":"password123"}'

# Log in
TOKEN=$(curl -s -X POST http://localhost:8000/api/user/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Create a project
curl -X POST http://localhost:8000/api/project \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"projectName":"Demo","projectDescription":"First project","dueDate":"2026-12-31"}'

# Create a task, then list pending tasks sorted by due date
curl -X POST http://localhost:8000/api/task/<projectId> \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"taskName":"First task","taskDescription":"Try the API","dueDate":"2026-12-01","taskStatus":"PENDING"}'

curl "http://localhost:8000/api/task/<projectId>?status=PENDING&sortBy=dueDate&order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Example list response:

```json
{
  "status": 200,
  "data": [
    {
      "_id": "...",
      "projectId": "...",
      "taskName": "First task",
      "taskDescription": "Try the API",
      "dueDate": "2026-12-01T00:00:00.000Z",
      "status": "PENDING"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

## Error Responses

Errors use the same shape as other responses:

```json
{ "status": 404, "message": "NOT FOUND." }
```

| Code | Meaning |
| --- | --- |
| 400 | Invalid input or malformed JSON |
| 401 | Missing, invalid or expired token, or failed login |
| 404 | Resource not found, or not owned by the caller |
| 406 | A required field is missing |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

Rate limits per IP: 300 requests per 15 minutes on `/api`, and 20 per 15 minutes on login and register.

## Project Structure

```
src/
  app.ts          Express app: middleware, routes, error handling
  index.ts        Entry point: connects to MongoDB, starts the server
  auth/           JWT authentication middleware
  config/         Status codes, messages, mail transport
  controllers/    Request handlers for users, projects and tasks
  db/             MongoDB connection
  model/          Mongoose models
  router/         Route definitions
  service/        Password hashing, tokens, email
  util/           OTP generation, response helper
```

## Roadmap

- Automated tests for authentication and task endpoints
- Dockerfile and Docker Compose for the API and database
- OpenAPI documentation

## License

ISC
