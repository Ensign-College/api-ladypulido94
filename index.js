const { addOrderItem, updateOrderItem, getOrderItemService, searchOrderItems } = require('./orderItems.js');
const { addOrder, getOrderService } = require('./orderservice.js');

const Redis = require('redis');
const Ajv = require("ajv");
const fs = require("fs");

const redisClient = Redis.createClient({
    url : `redis://localhost:6379`
});

const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json","utf8"));
const ajv = new Ajv();

exports.handler = async (event, context) => {
    // Extract the HTTP method and path from the event
    const { httpMethod, path } = event;

    // Initialize response object
    let response;

    try {
        switch (true) {
            case httpMethod === 'GET' && path === '/boxes':
                response = await getBoxes(event);
                break;
            case httpMethod === 'POST' && path === '/boxes':
                response = await postBoxes(event);
                break;
            case httpMethod === 'POST' && path === '/orders':
                response = await postOrders(event);
                break;
            case httpMethod === 'GET' && path.startsWith('/orders/'):
                response = await getOrder(event);
                break;
            case httpMethod === 'POST' && path === '/orderItems':
                response = await postOrderItem(event);
                break;
            case httpMethod === 'GET' && path.startsWith('/orderItems/'):
                response = await getOrderItem(event);
                break;
            case httpMethod === 'GET' && path === '/customers':
                response = await getCustomers(event);
                break;
            case httpMethod === 'POST' && path === '/customers':
                response = await postCustomer(event);
                break;
            default:
                response = { statusCode: 404, body: 'Not Found' };
        }
    } catch (error) {
        console.error('Error:', error);
        response = { statusCode: 500, body: 'Internal Server Error' };
    }

    return response;
};

/*     Boxes     */
/*---------------*/
//Get boxes from database
async function getBoxes(event) {
    const boxes = await redisClient.json.get('boxes', {path:'$'});
    return { statusCode: 200, body: JSON.stringify(boxes[0]) };
}

//Add boxes to database
async function postBoxes(event) {
    const newBox = JSON.parse(event.body);
    newBox.id = parseInt(await redisClient.json.arrLen('boxes', '$')) + 1;
    await redisClient.json.arrAppend('boxes', '$', newBox);
    return { statusCode: 200, body: JSON.stringify(newBox) };
}


/*      Orders       */
/*-------------------*/
//Add an order to database
async function postOrders(event) {
    const order = JSON.parse(event.body);
    const responseStatus = order.productQuantity && order.shippingAddress ? 200 : 400;

    if (responseStatus === 200) {
        try {
            await addOrder({ redisClient, order });
            return { statusCode: 200, body: JSON.stringify(order) };
        } catch (error) {
            console.error(error);
            return { statusCode: 500, body: 'Internal Server Error' };
        }
    } else {
        return { statusCode: responseStatus, body: `Missing one of the fields: ${order.productQuantity ? "" : "productQuantity"} ${order.shippingAddress ? "" : "ShippingAddress"}` };
    }
}

//Get an order from database
async function getOrder(event) {
    const orderId = event.pathParameters.orderId;
    const order = await getOrderService({ redisClient, orderId });
    if (order === null) {
        return { statusCode: 404, body: 'Order not found' };
    } else {
        return { statusCode: 200, body: JSON.stringify(order) };
    }
}

/*     Order Items     */
/*---------------------*/
//Add order item to database
async function postOrderItem(event) {
    try {
        const validate = ajv.compile(Schema);
        const valid = validate(req.body);
        if (!valid) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
        }
        const orderItemId = await addOrderItem({ redisClient, orderItem: JSON.parse(event.body) });
        return { statusCode: 201, body: JSON.stringify({ orderItemId, message: "Order item added successfully" }) };
    } catch (error) {
        console.error("Error adding order item:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
}

//Get order item from database
async function getOrderItem(event) {
    const orderItemId = event.pathParameters.orderItemId;
    try {
        const orderItem = await getOrderItemService({ redisClient, orderItemId });
        return { statusCode: 200, body: JSON.stringify(orderItem) };
    } catch (error) {
        console.error("Error getting order item:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
}

/*     Customers     */
/*------------------*/
//Get customer from database
async function getCustomers(event) {
    const customers = await redisClient.json.get('customers', { path: '$' });
    return { statusCode: 200, body: JSON.stringify(customers[0]) };
}

//Add customer to database
async function postCustomer(event) {
    const newCustomer = JSON.parse(event.body);
    try {
        await redisClient.json.set(`customer:${newCustomer.phoneNumber}`, '.', newCustomer);
        return { statusCode: 200, body: 'Customer saved successfully' };
    } catch (error) {
        console.error('Error saving customer to Redis:', error);
        return { statusCode: 500, body: 'Error saving customer' };
    }
}