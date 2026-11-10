import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";
import { UserModel } from "../src/model/user.js";
import Project from "../src/model/taskSchedule.js";
import Task from "../src/model/task.js";

let mongod;
let alice;
let bob;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const makeUser = async (email) => {
  await request(app).post("/api/user/register").send({
    name: "User",
    email,
    phone: "1123138408",
    password: "password123"
  });
  await UserModel.updateOne({ email }, { isVerified: true });
  const res = await request(app).post("/api/user/login").send({ email, password: "password123" });
  return res.body.token;
};

const createProject = async (token, name = "Project") => {
  const res = await request(app)
    .post("/api/project")
    .set(auth(token))
    .send({ projectName: name, projectDescription: "desc" });
  return res.body.data._id;
};

const createTask = (token, projectId, overrides = {}) =>
  request(app)
    .post(`/api/task/${projectId}`)
    .set(auth(token))
    .send({
      taskName: "Task",
      taskDescription: "desc",
      dueDate: "2026-12-01",
      taskStatus: "PENDING",
      ...overrides
    });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  alice = await makeUser("alice@example.com");
  bob = await makeUser("bob@example.com");
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Project.deleteMany({});
  await Task.deleteMany({});
});

describe("projects", () => {
  it("creates and reads a project", async () => {
    const id = await createProject(alice, "Demo");
    const res = await request(app).get(`/api/project/${id}`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.data.projectName).toBe("Demo");
  });

  it("rejects a project with missing fields", async () => {
    const res = await request(app).post("/api/project").set(auth(alice)).send({ projectName: "x" });
    expect(res.status).toBe(406);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/project");
    expect(res.status).toBe(401);
  });

  it("hides a project from other users (read, update, delete)", async () => {
    const id = await createProject(alice);

    const read = await request(app).get(`/api/project/${id}`).set(auth(bob));
    expect(read.status).toBe(404);

    const update = await request(app)
      .patch(`/api/project/${id}`)
      .set(auth(bob))
      .send({ projectName: "hacked" });
    expect(update.status).toBe(404);

    const del = await request(app).delete(`/api/project/${id}`).set(auth(bob));
    expect(del.status).toBe(404);

    const still = await Project.findById(id);
    expect(still.projectName).toBe("Project");
  });

  it("lists only the caller's projects with pagination", async () => {
    await createProject(alice, "A1");
    await createProject(alice, "A2");
    await createProject(alice, "A3");
    await createProject(bob, "B1");

    const page1 = await request(app).get("/api/project?page=1&limit=2").set(auth(alice));
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const page2 = await request(app).get("/api/project?page=2&limit=2").set(auth(alice));
    expect(page2.body.data).toHaveLength(1);
  });

  it("deletes a project together with its tasks", async () => {
    const id = await createProject(alice);
    await createTask(alice, id);
    await createTask(alice, id, { taskName: "Second" });
    expect(await Task.countDocuments({ projectId: id })).toBe(2);

    const res = await request(app).delete(`/api/project/${id}`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(await Task.countDocuments({ projectId: id })).toBe(0);
  });
});

describe("tasks", () => {
  it("creates a task in an owned project", async () => {
    const id = await createProject(alice);
    const res = await createTask(alice, id);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("rejects an invalid taskStatus", async () => {
    const id = await createProject(alice);
    const res = await createTask(alice, id, { taskStatus: "WRONG" });
    expect(res.status).toBe(400);
  });

  it("does not allow creating a task in someone else's project", async () => {
    const id = await createProject(alice);
    const res = await createTask(bob, id);
    expect(res.status).toBe(404);
    expect(await Task.countDocuments({ projectId: id })).toBe(0);
  });

  it("filters tasks by status", async () => {
    const id = await createProject(alice);
    await createTask(alice, id, { taskName: "One", taskStatus: "PENDING" });
    await createTask(alice, id, { taskName: "Two", taskStatus: "COMPLETED" });

    const res = await request(app).get(`/api/task/${id}?status=COMPLETED`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].taskName).toBe("Two");

    const bad = await request(app).get(`/api/task/${id}?status=NOPE`).set(auth(alice));
    expect(bad.status).toBe(400);
  });

  it("searches tasks by name, case-insensitively", async () => {
    const id = await createProject(alice);
    await createTask(alice, id, { taskName: "Buy milk" });
    await createTask(alice, id, { taskName: "Write report" });

    const res = await request(app).get(`/api/task/${id}?search=MILK`).set(auth(alice));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].taskName).toBe("Buy milk");
  });

  it("sorts tasks by due date", async () => {
    const id = await createProject(alice);
    await createTask(alice, id, { taskName: "first", dueDate: "2026-12-01" });
    await createTask(alice, id, { taskName: "third", dueDate: "2026-12-03" });
    await createTask(alice, id, { taskName: "second", dueDate: "2026-12-02" });

    const res = await request(app)
      .get(`/api/task/${id}?sortBy=dueDate&order=desc`)
      .set(auth(alice));
    expect(res.body.data.map((t) => t.taskName)).toEqual(["third", "second", "first"]);
  });

  it("updates and deletes a task, but not for other users", async () => {
    const id = await createProject(alice);
    const created = await createTask(alice, id);
    const taskId = created.body.data._id;

    const foreign = await request(app)
      .patch(`/api/task/${id}/${taskId}`)
      .set(auth(bob))
      .send({ taskStatus: "COMPLETED" });
    expect(foreign.status).toBe(404);

    const update = await request(app)
      .patch(`/api/task/${id}/${taskId}`)
      .set(auth(alice))
      .send({ taskStatus: "COMPLETED" });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe("COMPLETED");

    const del = await request(app).delete(`/api/task/${id}/${taskId}`).set(auth(alice));
    expect(del.status).toBe(200);

    const again = await request(app).delete(`/api/task/${id}/${taskId}`).set(auth(alice));
    expect(again.status).toBe(404);
  });
});
