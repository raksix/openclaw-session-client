import { Elysia } from "elysia";
import { cookie } from "@elysiajs/cookie";

const authDerive = async (ctx: { cookie?: any }) => {
  console.log("[Test derive] called, cookie:", ctx.cookie?.access_token);
  return { user: { name: "test" } };
};

const inner = new Elysia()
  .get("/inner", ({ user }) => {
    return { inner: user };
  });

const app = new Elysia()
  .use(cookie())
  .derive(authDerive)
  .use(inner)
  .get("/outer", ({ user }) => {
    return { outer: user };
  });

console.log("Test /inner:", await (await app.handle(new Request("http://localhost/inner"))).json());
console.log("Test /outer:", await (await app.handle(new Request("http://localhost/outer"))).json());
