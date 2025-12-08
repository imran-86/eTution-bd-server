const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();

const jwt = require('jsonwebtoken')

const cors = require("cors");

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gbmzdts.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();

    const db = client.db("eTuition-bd");

    const tuitionCollections = db.collection("tuitions");
    const tutorCollections = db.collection("tutors");



    // jwt related apis

   

    app.post("/tuitions", async (req, res) => {
      const tuition = req.body;
      const result = await tuitionCollections.insertOne(tuition);
    });
    app.get("/tutors", async (req, res) => {
      const result = await tutorCollections
        .find()
        .sort({
          submittedAt: -1,
        })
        .limit(8)
        .toArray();

      res.send(result);
    });
    app.get("/tuitions", async (req, res) => {
      const result = await tuitionCollections
        .find()
        .sort({
          createdAt: -1,
        })
        .limit(8)
        .toArray();

      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
app.get("/", (req, res) => {
  res.send("eTuitions working");
});
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
