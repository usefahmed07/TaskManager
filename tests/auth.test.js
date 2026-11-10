import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";
import { UserModel } from "../src/model/user.js";

let mongod;

const user = {
  name: "Test",
  email: "test@example.com",
  phone: "1123138408",
  password: "password123"
};

const registerAndVerify = async () => {
  await request(app).post("/api/user/register").send(user);
  await UserModel.updateOne({ email: user.email }, { isVerified: true });
};

const login = (body = { email: user.email, password: user.password }) =>
  request(app).post("/api/user/login").send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
});

describe("auth", () => {
  it("health endpoint reports the database as connected", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.db).toBe("connected");
  });

  it("registers a user and stores a hashed password", async () => {
    const res = await request(app).post("/api/user/register").send(user);
    expect([200, 201]).toContain(res.status);
    const saved = await UserModel.findOne({ email: user.email });
    expect(saved).not.toBeNull();
    expect(saved.password).not.toBe(user.password);
    expect(saved.isVerified).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/user/register").send(user);
    const res = await request(app).post("/api/user/register").send(user);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await UserModel.countDocuments({ email: user.email })).toBe(1);
  });

  it("does not log in an unverified user", async () => {
    await request(app).post("/api/user/register").send(user);
    const res = await login();
    expect(res.status).not.toBe(200);
    expect(res.body.token).toBeUndefined();
  });

  it("logs in a verified user and returns a token", async () => {
    await registerAndVerify();
    const res = await login();
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects a wrong password with 401", async () => {
    await registerAndVerify();
    const res = await login({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("rejects NoSQL operator injection in login", async () => {
    await registerAndVerify();
    const res = await login({ email: { $gt: "" }, password: "x" });
    expect([400, 406]).toContain(res.status);
    expect(res.body.token).toBeUndefined();
  });

  it("protects /api/user without a token and allows it with one", async () => {
    await registerAndVerify();
    const denied = await request(app).get("/api/user");
    expect(denied.status).toBe(401);

    const { body } = await login();
    const ok = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${body.token}`);
    expect(ok.status).toBe(200);
  });
});
