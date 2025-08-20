// const app = require("./App");
// import { jest, test, fetchDataFromApi, expect } from '@jest/globals';

// global.fetch = jest.fn(() => 
//   Promise.resolve({
//     json: () => Promise.resolve({ teams: 'teams' }),
//     result: true,
//     status: 200
//   })
// );

// test("fetch all teams, GET/teams, returns true & list of teams :", async () => {
// 	const mockData = new Request(app).get("/teams/");
// 	// const res = await request(app).get("/teams/");

// 	const data = await fetch('/teams/');
// 	expect(data).toEqual(mockData);
// 	expect(fetch).toHaveBeenCalledWith('/teams/');
// });

const app = require("../app");
const request = require("supertest");

it("GET/teams", async () => {
	const res = await request(app).get("/teams/");

	expect(res.statusCode).toBe(200);
	expect(res.body.teams).toEqual({ result: true, teams: teams });
});