const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iipillt.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    // console.log('token', req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {

    try {
        const orderOptionsCollection = client.db('packageBox').collection('orderOptions');
        const buyingsCollection = client.db('packageBox').collection('buyings');
        const usersCollection = client.db('packageBox').collection('users');

        app.get('/orderOptions', async (req, res) => {
            //
            // const date = req.query.date;
            // console.log(date);
            //
            const query = {};
            const options = await orderOptionsCollection.find(query).toArray();
            //
            // const buyingQuery = { orderDate: date }
            // const alreadyBuyed = await buyingsCollection.find(buyingQuery).toArray();
            // options.forEach(option => {
            //     const optionBuyed = alreadyBuyed.filter(buy => buy.pack === option.name);
            //     const buyedSlots = optionBuyed.map(buy => buy.slot);
            //     const remainingSlots = option.slots.filter(slot => !buyedSlots.includes(slot));
            //     option.slots = remainingSlots;
            //     // console.log(date, option.name, buyedSlots);
            // })
            //
            res.send(options);
        });

        // app.post('/buyings', async (req, res) => {
        //     const buying = req.body;
        //     // console.log(buying);
        //     const result = await buyingsCollection.insertOne(buying);
        //     res.send(result);
        // })

        app.post('/buyings', async (req, res) => {
            const buying = req.body;
            console.log(buying);
            const query = {
                // orderStartDate: buying.orderStartDate,
                email: buying.email,
            }

            const alreadyBuyed = await buyingsCollection.find(query).toArray();
            console.log(alreadyBuyed);
            if (alreadyBuyed.length > 0) {
                let alreadyBooked = 0;
                const found = alreadyBuyed.map(order => {
                    const startDate = new Date(order.orderStartDate);
                    const endDate = new Date(order.orderEndDate);

                    const newDate = new Date(buying.orderStartDate);
                    const newDate2 = new Date(buying.orderEndDate);

                    if (startDate < newDate && endDate < newDate) {
                        console.log('Can buy 1 ');
                    }
                    else if (startDate > newDate && endDate > newDate) {
                        if (startDate > newDate2) {
                            console.log('Can buy 2');
                        }
                    }
                    else {
                        alreadyBooked = 1;
                        console.log('cannot buy');
                    }
                })
                console.log(alreadyBooked);
                if (alreadyBooked === 0) {
                    const result = await buyingsCollection.insertOne(buying);
                    return res.send(result);
                }
                else {
                    const message = `you already buy this package on ${buying.orderStartDate}`
                    return res.send({ acknowledged: false, message })
                }
            }
            else {
                const result = await buyingsCollection.insertOne(buying);
                return res.send(result);
            }

        });

        //buyers orders
        app.get('/buyings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const buyings = await buyingsCollection.find(query).toArray();
            res.send(buyings);
        });

        //users history

        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //JWT (for token generate)
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
                return res.send({ accessToken: token });
            }
            // console.log(user);
            res.status(403).send({ accessToken: '' })
        })

        //on dashboard allusers
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        // make admin
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            //jwt
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            //
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        //check particular user admin or not

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        //add package part

        app.get('/orderPackage', async (req, res) => {
            const query = {}
            const result = await orderOptionsCollection.find(query).project({ name: 1, slots: 3 }).toArray();
            res.send(result);
        })

        //client to backend
        app.post('/orderOptions', async (req, res) => {
            const package = req.body;
            const result = await orderOptionsCollection.insertOne(package);
            res.send(result);
        });

        //delete packages

        app.delete('/orderOptions/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderOptionsCollection.deleteOne(filter);
            res.send(result);
        })

    }
    finally {

    }

}
run().catch(console.log);


app.get('/', async (req, res) => {
    res.send('server is running');
})

app.listen(port, () => console.log(`portal running on ${port}`));