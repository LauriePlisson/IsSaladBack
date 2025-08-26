const request = require("Supertest");
const app = require("../app");

it("GET/users", async () => {
  const res = await request(app).get("/users/");

  expect(res.statusCode).toBe(200);
  expect(res.body.user).toEqual({ result: true, users: users });
});
