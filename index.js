/* COMMANDS:
    npm run dev = run this program with automatic restarts on updates
    node index.js = run this program
    docker-compose up -d = runs docker in the background (deamon) & rebuilds containers (specified in docker-compose.yml)
    http://localhost:3001/boxes - address it is running on
*/

//require = import (import needs more steps to work)
//express is a framework for node.js
//it makes APIs - connects frontend to database backend

const { addOrderItem, updateOrderItem, getOrderItem, searchOrderItems } = require('./orderItems.js');
const { addOrder, getOrder } = require('./orderService.js');
const express = require('express');
const Redis = require('redis');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require("fs");//import the file system library
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json","utf8"));
const Ajv = require("ajv");
const ajv = new Ajv(); //create an ajv object to validate JSON

const options = {
    origin: 'http://localhost:3000' //allow frontend to call this URL for the backend
}

const redisClient = Redis.createClient({
    url : `redis://localhost:6379`
});

const app = express(); //creates an express application
const port = 3001;

app.use(bodyParser.json());
app.use(cors(options)); //allow frontend to call backend

app.listen(port, ()=>{
    redisClient.connect(); //connects to the redis database
    console.log(`API is listening on port ${port}`);
}); //listens for web requests from frontend on port 3000 (and doesn't stop)

/* Using an API:
    1. URL
    2. function to return boxes
    req = resquest from the browser
    res = response to the bowser
*/

app.get('/boxes', async (req,res) => {
    let boxes = await redisClient.json.get('boxes', {path:'$'}); //gets boxes; without 'await' it returns a Promise to the frontend (that's bad)
    res.json(boxes[0]); //convert boxes to a string and send to browser
}); //return boxes to user

app.post('/boxes', async (req,res) => {
    const newBox = req.body;
    newBox.id = parseInt(await redisClient.json.arrLen('boxes', '$')) + 1;
    await redisClient.json.arrAppend('boxes', '$', newBox); //saves the new JSON in Redis
    res.json(newBox);
});

/*CUSTOMERS*/
/*app.post('/customers', async (req,res) => {
    let newCustomer = req.body;
        response = await checkValidCustomer({redisClient, newCustomer});
        res.status(response.status).send(response.body);
});*/

/*ORDERS*/
//Add Order
app.post('/orders', async (req, res) => {
 let order = req.body;
 //order details, include product quantity and shipping address
 let responseStatus = order.productQuantity && order.shippingAddress ? 200 : 400;

 if(responseStatus === 200) {
   try {
   await addOrder({ redisClient, order});
   res.status(responseStatus).json(order);

   } catch(error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    return;
   }
 } else {
   res.status(responseStatus);
   res.send(`Missing one of the fields: ${order.productQuantity ? "" : "productQuantity"
   } ${order.shippingAddress ? "" : "ShippingAddress"}`);
 }

});

//Get Order
app.get("/orders/:orderId", async(req, res) => {
    //get the order from the database
    const orderId = req.params.orderId;
    let order = await getOrder({redisClient, orderId});
    if (order === null) {
        res.status(404).send("Order not found");
    } else {
        res.json(order);
    }
});

/*ORDER ITEM*/
//Add orderItem
app.post("/orderItems", async (req, res) => {
  try{
    console.log("Schema:", Schema);
    const validate = ajv.compile(Schema);
    const valid = validate(req.body);

    if(!valid){
      return res.status(400).json({error: "Invalid request body"});
    }
    console.log("Request Body:", req.body);

    //Calling addOrderItem function and storing the result
    const orderItemId = await addOrderItem({
      redisClient,
      orderItem: req.body,
    });

    //Responding with the result
    res
      .status(201)
      .json({orderItemId, message: "Order item added successfully"});
  } catch(error) {
    console.error("Error adding order item:", error);
    res.status(500).json({error: "Internal server error"});
  }
})

//Get orderItem
app.get("/orderItems/:orderItemId", async(req, res) => {
  try {
  const orderItemId  = req.params.orderItemId;
  const orderItem = await getOrderItem({ redisClient, orderItemId});
  res.json(orderItem);
  } catch (error) {
  console.error("Error getting order item:", error);
  res.status(500).json({error: "Internal server error"});
  }
});

/*CUSTOMERS*/
//Get Customer
app.get('/customers', async (req,res) => {
    let customers = await redisClient.json.get('customers', {path:'$'}); //gets boxes; without 'await' it returns a Promise to the frontend (that's bad)
    res.json(customers[0]); //convert boxes to a string and send to browser
}); //return boxes to user

//Post Customer
app.post('/customers', async (req, res) => {
    let newCustomer = req.body;
    try {
        // Assuming redisClient.json.set() returns a promise
        await redisClient.json.set(`customer:${newCustomer.phoneNumber}`, '.', newCustomer);
        res.status(200).send('Customer saved successfully');
    } catch (error) {
        console.error('Error saving customer to Redis:', error);
        res.status(500).send('Error saving customer');
    }
});

console.log("Hello World");