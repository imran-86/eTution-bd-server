const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();

const jwt = require("jsonwebtoken");

const cors = require("cors");


const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gbmzdts.mongodb.net/?appName=Cluster0`;
function generateTrackingId() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
 
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  return `TRK-${year}${month}${day}-${randomPart}`;
}
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
    const applicationCollections = db.collection("applications")
    
    const userCollections = db.collection("users");

    const paymentCollections = db.collection("payment");
    

    // Payment relate apis

      app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      
      const amount = parseInt(paymentInfo.price)*100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data : {
              currency: 'usd',
              unit_amount: amount,
              product_data: {
                name: `Please pay for : ${paymentInfo.tuitionTitle}`
              }
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.tuitionId,
          parcelName: paymentInfo.tuitionTitle
        },
        customer_email: paymentInfo.studentEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({url: session.url})
    });


    




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

    // applications related apis

    app.post('/applications' , async(req,res)=>{
      const data = req.body;
      // console.log(data);
      const result = await applicationCollections.insertOne(data);
      res.send(result)
      
    })
    app.get('/applications/student/:email' , async(req,res)=>{
      const studentEmail = req.params.email;
      // console.log(studentEmail);
      const query = {
        studentEmail: studentEmail
      }
      const result = await applicationCollections.find(query).toArray();
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

    // Users related apis

    app.get('/users', async(req,res)=>{
      const result = await userCollections.find().toArray();
      // console.log(result);;
      res.send(result);
      
    })
     app.put('/users/:id' , async(req,res)=>{
      const userId = req.params.id;
      const updatedInfo = req.body;
      // console.log(updatedInfo);
      const query = { _id: new ObjectId(userId) };
    const update = {
      $set: {
        ...updatedInfo,
        updatedAt: new Date() 
      }
    };

    const result = await userCollections.updateOne(query , update);
    
    
    res.send(result)
      
    })
    app.delete('/users/:id' , async(req,res)=>{
      const userId = req.params.id;
      console.log(userId);
       const query = { _id: new ObjectId(userId) };
      const result = await userCollections.deleteOne(query);
      res.send(result);
      
    })
   

    
    // Tuitions related apis

    app.post("/tuitions", async (req, res) => {
      const tuition = req.body;
      // console.log("tuition data ", tuition);
      const result = await tuitionCollections.insertOne(tuition);
    });
     app.get('/tuitions/user/:email', async(req,res)=>{
        
      const userEmail = req.params.email;
      // console.log(userEmail);
      
      const query = {
        studentEmail : userEmail,
        status : 'Approved'

      };
      const result = await tuitionCollections.find(query).toArray();
      // console.log(result);
      
      
      res.send(result);
      
    })
    app.get('/tuitions', async(req,res)=>{
      const status = req.query.status;
      console.log(status);
      const query = {
        status : 'Pending'
      }
      const result = await tuitionCollections.find(query).toArray();
      res.send(result);
      
      
    })
     app.get('/tuitions/ongoing', async(req,res)=>{
      const status = req.query.status;
      // console.log(status);
      const query = {
        status : 'Approved'
      }
      const result = await tuitionCollections.find(query).sort({
        updatedAt : -1
      }).toArray();
      // console.log(result);
      
      res.send(result);
      
      
    })
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
    app.get("/all-tuitions", async (req, res) => {
      const result = await tuitionCollections
        .find()
        .sort({
          createdAt: -1,
        })
        .toArray();

      res.send(result);
    });
    app.patch('/tuitions/:id' , async(req,res)=>{
      const tuitionId = req.params.id;
      const status = req.body.status;
      
      console.log(tuitionId);
      console.log(status);
      
       const query = { _id: new ObjectId(tuitionId) };
    const update = {
      $set: {
        paymentStatus : 'Make Payment',
        status, 
        updatedAt: new Date() 
      }
    };

    const result = await tuitionCollections.updateOne(query , update);
    res.send(result)
      
    })

    // Tutors related apis

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
  
    app.get("/tutors", async (req, res) => {
      const result = await tutorCollections
        .find()
        .sort({
          submittedAt: -1,
        })
        .toArray();

      res.send(result);
    });

    app.post("/tutors" , async(req,res)=>{
      const tutorsData = req.body;
      console.log(tutorsData);
      const result = await tutorCollections.insertOne(tutorsData);
      res.send(result);
      
    })
    

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
