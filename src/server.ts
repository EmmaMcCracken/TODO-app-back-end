import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DbItem } from "./db";
import filePath from "./filePath";
import { Client } from "pg";
console.log(process.env.DATABASE_URL);
const config = {
  connectionString: process.env.DATABASE_URL,
  ssl: false,
};

const client = new Client(config);
console.log(require("pg/package.json").version);
const app = express();

/** Parses JSON data in a request automatically */
app.use(express.json());
/** To allow 'Cross-Origin Resource Sharing': https://en.wikipedia.org/wiki/Cross-origin_resource_sharing */
app.use(cors());

// read in contents of any environment variables in the .env file
dotenv.config();
client.connect((err) => {
  if (err) {
    console.error("connection error", err.stack);
  } else {
    console.log("connected");
  }
});
// use the environment variable PORT, or 4000 as a fallback
const PORT_NUMBER = process.env.PORT ?? 4000;

// API info page
app.get("/", (req, res) => {
  const pathToFile = filePath("../public/index.html");
  res.sendFile(pathToFile);
});

// GET /items
app.get("/items", async (req, res) => {
  console.log("fetching all items");
  const dbResult = await client.query("select * from items limit 100");
  console.log(dbResult, "dbResult");
  const allItems = dbResult.rows;
  console.log("allItems", allItems);
  res.status(200).json(allItems);
});

app.get("/items/completed", async (req, res) => {
  const dbResult = await client.query(
    "select * from items where isCompleted = true"
  );
  const completedItems = dbResult.rows;
  res.json(completedItems);
});

app.get("/items/incomplete", async (req, res) => {
  const dbResult = await client.query(
    "select * from items where isCompleted = false"
  );
  const incompleteItems = dbResult.rows;
  res.json(incompleteItems);
});

// POST /items
app.post<{}, {}, DbItem>("/items", async (req, res) => {
  // to be rigorous, ought to handle non-conforming request bodies
  // ... but omitting this as a simplification
  const { description } = req.body;
  const dbResult = await client.query(
    "insert into items (description) values ($1) returning *",
    [description]
  );
  const createdItem = dbResult.rows;
  res.status(201).json(createdItem);
});

// GET /items/:id
app.get<{ id: string }>("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const matchingItem = await client.query(
    "select * from items where id = ($1)",
    [id]
  );
  if (matchingItem.rows.length === 1) {
    res.status(200).json(matchingItem);
  } else {
    res.status(404).json(matchingItem);
  }
});

// DELETE /items/:id
app.delete<{ id: string }>("/items/:id", async (req, res) => {
  const id = parseInt(req.params.id); // params are string type

  const queryResult: any = await client.query("delete from items where id=$1", [
    id,
  ]);
  if (queryResult.rowCount === 1) {
    res.status(200).json(queryResult.rows);
  } else {
    res.status(404).json(queryResult.rows);
  }
});

// PUT /items/:id
app.put<{ id: string }, {}, Partial<DbItem>>("/items/:id", async (req, res) => {
  const { description, isCompleted } = req.body;
  const id = parseInt(req.params.id);

  if (typeof description === "string" || typeof isCompleted === "boolean") {
    if (typeof description === "string" && typeof isCompleted === "boolean") {
      const dbResponse = await client.query(
        "update items set description = $1, isCompleted = $2) where id = $3",
        [description, isCompleted, id]
      );
      res.status(200).json(dbResponse.rows);
    }
    if (typeof description === "string") {
      const dbResponse = await client.query(
        "update items set description = $1 where id = $2",
        [description, id]
      );
      res.status(200).json(dbResponse.rows);
    } else {
      const dbResponse = await client.query(
        "update items set isCompleted = $1 where id = $2",
        [isCompleted, id]
      );
      res.status(200).json(dbResponse.rows);
    }
  } else {
    res.status(400).json({
      status: "fail",
      data: {
        description:
          "A string value for description may be required in your JSON body",
        isCompleted:
          "A boolean value for isCompleted may be required in your JSON body",
      },
    });
  }
});

app.listen(PORT_NUMBER, () => {
  console.log(`Server is listening on port ${PORT_NUMBER}!`);
});
