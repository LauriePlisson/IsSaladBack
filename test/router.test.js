const request = require("supertest");
const app = require("./app");

it("POST /users/signin", async () => {
  const res = await request(app)
    .post("/users/signin")
    .send({ username: "john", password: "1234" });

  expect(res.statusCode).toEqual(200);
  expect(res.body.result).toBe(false);
});

it("POST /users/signin", async () => {
  const res = await request(app)
    .post("/users/signin")
    .send({ username: "AlNasser", password: "Jojo1995" });

  expect(res.statusCode).toEqual(200);
  expect(res.body.result).toBe(true);
});
