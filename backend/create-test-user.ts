import { createUser } from "./src/services/auth.service";
import { connectToDatabase } from "./src/db/mongodb";

async function main() {
  await connectToDatabase();
  
  const user = await createUser({
    username: "test",
    email: "test@test.com",
    password: "test123",
    role: "admin",
  });
  
  console.log("User created:", user.username);
  process.exit(0);
}

main();
