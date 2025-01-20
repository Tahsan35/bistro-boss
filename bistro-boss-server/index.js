//import express from "express";
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.inbfzqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware functions
const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  //if (!req.headers.authorization)
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};
// use verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {
    await client.connect();
    // Collections
    const db = client.db("bistroDb");
    const userCollection = db.collection("users");
    const menuCollection = db.collection("menu");
    const reviewCollection = db.collection("reviews");
    const cartCollection = db.collection("carts");
    const paymentCollection = db.collection("payments");

    // const userCollection = client.db("bistroDb").collection("users"); // collection name is us
    // const menuCollection = client.db("bistroDb").collection("menu");
    // const reviewCollection = client.db("bistroDb").collection("reviews");
    // const cartCollection = client.db("bistroDb").collection("carts");
    // const paymentCollection = client.db("bistroDb").collection("payments");

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
      res.send({ token });
    });

    // users related api
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });
    //   let admin = false;
    //   if (user) {
    //     admin = user?.role === "admin";
    //   }
    //   res.send({ admin });
    // });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      //const result = await userCollection.insertOne(user);
      //res.send(result.ops[0]);
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    // menu related apis
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(filter);
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    });

    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { name, category, price, recipe, image } = req.body;
      const id = req.params.id;
      // const filter = { _id: new ObjectId(id) };
      // const updatedDoc = {
      //   $set: {
      //     name: item.name,
      //     category: item.category,
      //     price: item.price,
      //     recipe: item.recipe,
      //     image: item.image,
      //   },
      // };
      //const result = await menuCollection.updateOne(filter, updatedDoc);
      const result = await menuCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { name, category, price, recipe, image },
        }
      );
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(filter);
      res.send(result);
    });

    // Review APIs
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // carts collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      //const query = { email: email };
      const result = await cartCollection.find({ email }).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(filter);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log("payment info", payment);
      // const query = {
      //   _id: {
      //     $in: payment.cartIds.map((id) => new ObjectId(id)),
      //   },
      // };

      const deleteResult = await cartCollection.deleteMany({
        _id: { $in: payment.cartIds.map((id) => new ObjectId(id)) },
      });

      res.send({ paymentResult, deleteResult });
    });

    // Test connection
    await client.db("admin").command({ ping: 1 });
    console.log("successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
