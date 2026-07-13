import "dotenv/config";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { assertRequiredServerEnv, getMongoUri } from "./config/env.js";

const port = process.env.PORT || 5000;

assertRequiredServerEnv();

connectDb(getMongoUri())
  .then(() => {
    app.listen(port, () => console.log(`API listening on port ${port}`));
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
