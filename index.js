const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
require("dotenv").config();
const crypto = require('crypto');

const jwt = require("jsonwebtoken");

const cors = require("cors");
const { emit } = require("process");


const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const verifyJWTToken = (req, res , next) =>{
  // console.log(req.headers);
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({message : 'Unauthorized access'});
  }
  const token = authorization.split(' ')[1];
  if(!token){
    return res.status(401).send({message : 'Unauthorized access'})
  }

   jwt.verify(token,process.env.JWT_SECRET, (err,decoded)=>{
     if(err){
      return res.status(401).send({message : 'Unauthorized access'})
     }
    console.log('after decoded ' , decoded);

    req.token_email = decoded.email;
    
     next();
   })


  
}


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
      // console.log(paymentInfo);
      
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
          tuitionId: paymentInfo.tuitionId,
          tuitionName: paymentInfo.tuitionTitle,
          tutorEmail : paymentInfo.tutorEmail
        },
        customer_email: paymentInfo.studentEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({url: session.url})
    });


     app.patch('/payment-success', async (req,res)=>{
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log('session ret ', session);

      // const transactionId = session.payment_intent;
      // const query = { transactionId: transactionId}
    //  console.log('payment success called   ');
     
     

      const trackingId = generateTrackingId();

      if(session.payment_status === 'paid'){
        console.log('payment success called   ');
         const id = session.metadata.tuitionId;
         console.log(id);
         
         const query = {tuitionId
 : id};
         const update = {
          $set: {
            status: 'Approved',
          }
         }
        //  console.log(await applicationCollections.findOne(query));
         
         const result = await applicationCollections.updateOne(query,update);
         console.log(result);
         
        
         const payment = {
            amount: session.amount_total/100,
            currency: session.currency,
            studentEmail: session.customer_email,
            tutorEmail : session.metadata.tutorEmail,
            tuitionId: session.metadata.tuitionId,
            tuitionName: session.metadata.tuitionName,
            transactionId : session.payment_intent,
            paymentStatus: session.payment_status,
            paidAt : new Date(),
            trackingId: trackingId
            

         }
        
        const queryPayment = {
          tuitionId : session.metadata.tuitionId
        }
        const isExistPayment = await paymentCollections.findOne(queryPayment);
        let resultPayment; 
        if(!isExistPayment){
         resultPayment  = await paymentCollections.insertOne(payment);
        }
         if(session.payment_status==='paid'){
          const isExist = await paymentCollections.findOne({
            transactionId : session.payment_intent,
          })
          if(isExist){
             return res.send({
                success:  true,
                modifyParcel: result,
                trackingId:trackingId,
                transactionId : session.payment_intent,
                paymentInfo: resultPayment
               })
            }
            
              
              return res.send({
                success:  true,
                modifyParcel: result,
                trackingId:trackingId,
                transactionId : session.payment_intent,
                paymentInfo: resultPayment
               })
         }



         
      }
      
     return res.send({success : false})
    })

    app.get('/payments/student/:email' ,verifyJWTToken, async(req,res)=>{
      const email = req.params.email;
      const query = {
        studentEmail: email
      }
      if(email!==req.token_email){
        return res.status(403).send({message : 'Forbidden access'})
      }

      const result = await paymentCollections.find(query).toArray();
      // console.log(result);
      res.send(result);
      
      
    })
    app.get('/payments/tutor/:email' ,verifyJWTToken, async(req,res)=>{
      const email = req.params.email;
      console.log(email);
      
      const query = {
        tutorEmail: email
      }
      if(email!==req.token_email){
        return res.status(403).send({message : 'Forbidden access'})
      }

      const result = await paymentCollections.find(query).toArray();
      console.log(result);
      res.send(result);
      
      
    })
    
    app.get('/payments' ,verifyJWTToken, async(req,res)=>{
      const result = await paymentCollections.find().toArray();
      res.send(result);
    })





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
    console.log(query);
    
      const result = await userCollections.findOne(query);
      console.log(result);
      
      
      res.send(result);
      
    })
    app.get('/users/profile/:email' , async(req,res) =>{
      const userEmail = req.params.email;
      // console.log(userEmail);
      const query = {
        email : userEmail
      }
      
      const result = await userCollections.find(query).toArray();
      res.send(result);
      
    })

    app.put('/users/profile/:email', async(req,res)=>{
      const userEmail = req.params.email;
      const updatedData = req.body;
      console.log(updatedData);
      
      console.log(userEmail);
      const query = {
        email : userEmail,

      }
       const update = {
      $set: {
        ...updatedData,
        updatedAt: new Date() 
      }
    };
      const result = await userCollections.updateOne(query,update);
      res.send(result);
      
      
    })

    // applications related apis
   app.get('/applications/tutor/:email', async(req,res)=>{
    const tutorEmail = req.params.email;
    const query = {
      tutorEmail : tutorEmail
    }
    const result = await applicationCollections.find(query).toArray();
    console.log(result);
    
    res.send(result);
    
   })
   app.delete('/applications/delete/:id', async(req,res)=>{
    const id = req.params.id;
    console.log('after delete call ', id);
     const query = { _id: new ObjectId(id) };
     const result = await applicationCollections.deleteOne(query);
     console.log(result);
     res.send(result);     
    
   })
   // Update application by ID
app.patch('/applications/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { qualifications, experience, expectedSalary, updatedAt } = req.body;

    const updateData = {
      qualifications,
      experience,
      expectedSalary: parseFloat(expectedSalary),
      updatedAt: updatedAt || new Date().toISOString()
    };

    const result = await applicationCollections.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'Application not found' });
    }

    res.status(200).send({ 
      message: 'Application updated successfully', 
      modifiedCount: result.modifiedCount 
    });

  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).send({ message: 'Failed to update application', error: error.message });
  }
});
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
      app.get('/applications/ongoing/:email', async(req,res)=>{
      const status = req.query.status;
      const email = req.params.email
      // console.log('email ',email);
      
      // console.log(status);
      const query = {
        status : 'Approved',
        tutorEmail: email
      }
      const result = await applicationCollections.find(query).sort({
        updatedAt : -1
      }).toArray();
      // console.log(result);
      
      res.send(result);
      
      
    })

    // jwt related apis

    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      console.log(loggedUser);

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
     app.get('/tuitions/student/:email', async(req,res)=>{
    const studentEmail = req.params.email;
    const query = {
      studentEmail : studentEmail
    }
    const result = await tuitionCollections.find(query).toArray();
    console.log(result);
    
    res.send(result);
    
   })
   app.delete('/tuitions/delete/:id', async(req,res)=>{
    const id = req.params.id;
    console.log('after delete call ', id);
     const query = { _id: new ObjectId(id) };
     const result = await tuitionCollections.deleteOne(query);
     console.log(result);
     res.send(result);     
    
   })
  app.patch('/tuitions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const query = { _id: new ObjectId(id) };
    const update = {
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    };
    
    const result = await tuitionCollections.updateOne(query, update);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Tuition not found' });
    }
    
    res.json({
      success: true,
      message: 'Tuition updated successfully',
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error updating tuition:', error);
    res.status(500).json({ error: error.message });
  }
});
     app.get('/tuitions/user/:email', verifyJWTToken, async(req,res)=>{
        
      const userEmail = req.params.email;
      console.log(userEmail);
      
      const query = {
        studentEmail : userEmail,
        status : 'Approved'

      };
       if(userEmail!==req.token_email){
        return res.status(403).send({message : 'Forbidden access'})
      }
      const result = await tuitionCollections.find(query).toArray();
      // console.log(result);
      
      
      res.send(result);
      
    })
    app.get('/tuitions', async(req,res)=>{
      const status = req.query.status;
      console.log(status);
      const query = {
        status : status
      }
      const result = await tuitionCollections.find(query).toArray();
      res.send(result);
      
      
    })
    app.get('/tuition-details/:id', async(req,res)=>{
      const tuitionId = req.params.id;
      const query = { _id: new ObjectId(tuitionId) };
      const result = await tuitionCollections.findOne(query);
      console.log(result);
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
        const query = {
          status : 'Approved'
        }
      const result = await tuitionCollections
        .find(query)
        .sort({
          createdAt: -1,
        })
        .limit(8)
        .toArray();

      res.send(result);
    });
    app.get("/all-tuitions", async (req, res) => {
      const query = {
        status : 'Approved'
      }
      const result = await tuitionCollections
        .find(query)
        .sort({
          createdAt: -1,
        })
        .toArray();

      res.send(result);
    });
    app.patch('/tuitions/:id' ,verifyJWTToken, async(req,res)=>{
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
    // app.patch('/remove-tuitions' , async(req,res)=>{
    //   const tuitionId = req.body;
    //   console.log(tuitionId);
    //    const query = { _id: new ObjectId(tuitionId) };
    //     const update = {
    //   $set: {
    //     status : 'Rejected',
    //     updatedAt: new Date() 
    //   }
    // };
      
    // })

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
