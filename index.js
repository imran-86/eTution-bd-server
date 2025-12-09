const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();

const jwt = require("jsonwebtoken");

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
    
    const userCollections = db.collection("users");
    
    // users related apis

    app.post('/user' , async(req,res)=>{
      const userData = req.body;
      const result = await userCollections.insertOne(userData);
      res.send(result)
      
    })
    app.get('/user', async(req,res)=>{
      const query = {};
      const {email} = req.query;
      // console.log(email);
      if(email){
        query.email = email;
      }
      const result = await userCollections.findOne(query);
      // console.log(result);
      
      
      res.send(result);
      
    })



    // jwt related apis

    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      // console.log(loggedUser);

      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token: token });
    });
    
    // tuitions related apis

    app.post("/tuitions", async (req, res) => {
      const tuition = req.body;
      // console.log("tuition data ", tuition);
      const result = await tuitionCollections.insertOne(tuition);
    });
     app.get('/tuitions', async(req,res)=>{
      const query = {};
      const {status} = req.query;
      // console.log(status);
      if(status){
        query.status = status;
      }
      const result = await tuitionCollections.find(query).toArray();
      // console.log(result);
      
      
      res.send(result);
      
    })

    app.patch('/tuitions/:id' , async(req,res)=>{
      const tuitionId = req.params.id;
      const status = req.body.status;
      console.log(tuitionId);
      console.log(status);
      
       const query = { _id: new ObjectId(tuitionId) };
    const update = {
      $set: {
        status, 
        updatedAt: new Date() 
      }
    };

    const result = await tuitionCollections.updateOne(query , update);
      
    })


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
    app.get("/latest-tuitions", async (req, res) => {
      const result = await tuitionCollections
        .find()
        .sort({
          createdAt: -1,
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
        .toArray();

      res.send(result);
    });
    app.get("/tutors", async (req, res) => {
      const result = await tutorCollections
        .find()
        .sort({
          submittedAt: -1,
        })
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
