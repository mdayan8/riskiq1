import { MongoClient } from "mongodb";
import { env } from "../config/env.js";

let mongoClient;
let mongoDb;

export async function connectMongo() {
  mongoClient = new MongoClient(env.mongoUrl);
  await mongoClient.connect();
  mongoDb = mongoClient.db(env.mongoDb);
  await mongoDb.collection("documents").createIndex(
    { user_id: 1, file_hash: 1 },
    {
      unique: true,
      partialFilterExpression: { file_hash: { $type: "string" } }
    }
  );
}

export function getMongoDb() {
  if (!mongoDb) {
    throw new Error("MongoDB not initialized");
  }
  return mongoDb;
}

export async function closeMongo() {
  if (mongoClient) {
    await mongoClient.close();
  }
}
