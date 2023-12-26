const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const jwt = require('jsonwebtoken');
const punycode = require('punycode/');
const morgan = require('morgan');
const port = process.env.Port || 5000;

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))


// validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  console.log(authorization);
  if(!authorization){
    return res.status(401).send({error: true, message: 'Unauthorized'});
  }
  const token = authorization.split(' ')[1];

  // token verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({error: true, message: 'Unauthorized access'})
    }
    req.decoded = decoded;
  })

  next();
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pow4m09.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const usersCollection = client.db('visafastbd').collection('users')
    const blogsCollection = client.db('visafastbd').collection('blogs')



    // Generate jwt token
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d'
      });
      res.send({token})
    })

    // warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'Admin'){
        return res.status(403).send({error: true, message:'forbidden access'})
      }
      next();
    }


    // User related API
    // Save user Email and role im DB
    app.put('/users/:email', async(req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email: email}
      const options = {upsert: true}
      const updateDoc = {
          $set: user
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result);
  })

  // Get all users
  app.get('/users',verifyJWT, verifyAdmin, async(req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  })

  // Get user
  app.get('/users/:email', async(req, res) => {
    const email = req.params.email;
    const query = {email: email};
    const result = await usersCollection.findOne(query)
    res.send(result);
})


  // make admin 
  app.patch('/users/admin/:id', verifyJWT, async(req, res) => {
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const updateDoc = {
      $set: {
        role: 'Admin'
      }
    };
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
  })

  // check admin
  app.get('/users/admin/:email', verifyJWT, async(req, res) => {
    const email = req.params.email;

    if(req.decoded.email !== email){
      res.send({Admin: false})
    }

    const query = {email}
    const user = await usersCollection.findOne(query);
    const result = {admin: user?.role == 'Admin'}
    res.send(result);
  })

  // delete user from db
app.delete('/users/:id',verifyJWT, async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await usersCollection.deleteOne(query)
  res.send(result);
})


// blog related API

// save blog to db
app .post('/blogs', verifyJWT, async(req, res) => {
  const blg =req.body;
      if(!blg){
        return res.status(404).send({message: "Data not found, Not Valid Request."})
      }
  const result = await blogsCollection.insertOne(blg)
  res.send(result)
})
// get all blogs from db
app.get('/blogs', async(req, res) => {
  const result = await blogsCollection.find().sort({_id:-1}).toArray()
  res.send(result);
})

// get 3 blogs from db
app.get('/blogs/fixed', async(req, res) => {
  const result = await blogsCollection.find().sort({_id:-1}).limit(3).toArray()
  res.send(result);
})

// get a blog from db
app.get('/blogDetails/:id', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await blogsCollection.findOne(query);
  res.send(result);
})

// delete a blog from db
app.delete('/blogs/:id', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await blogsCollection.deleteOne(query)
  res.send(result);
})
// get a blog from db for update
app.get('/blogs/:id', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await blogsCollection.findOne(query);
  res.send(result);
})

// update blog
app.put('/blogs/update/:id', verifyJWT, async (req, res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const options = {upsert: true};
  const updatedBlog = req.body;
  const updateDoc = {
    $set: {
      blogTitle: updatedBlog.blogTitle,
      image: updatedBlog.image,
      blogCategory: updatedBlog.blogCategory,
      date: updatedBlog.date,
      description: updatedBlog.description,
    }
  };
  const result = await blogsCollection.updateOne(filter, updateDoc, options);
  res.send(result)
});


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Visa Fast Server is running..')
})

app.listen(port, () => {
  console.log(`Visa Fast is running on port: ${port}`)
})