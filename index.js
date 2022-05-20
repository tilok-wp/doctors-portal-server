const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access!' })
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.TOKEN_KEY_SECREATE, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access!' })
        }
        req.decoded = decoded
        next()
    });

}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9dn9g.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors-booking').collection('service')
        const bookingsCollection = client.db('doctors-booking').collection('booking')
        const userCollection = client.db('doctors-booking').collection('users')
        const doctorCollection = client.db('doctors-booking').collection('doctor')


        const verifyAdmin = async (req, res, next) => {
            const requesterEmail = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requesterEmail })
            if (requesterAccount.role === 'admin') {
                next()
            } else {
                return res.status(403).send({ message: 'Forbidden access!' })
            }
        }


        app.get('/services', async (req, res) => {
            const query = {}
            // const cursor = servicesCollection.find(query)
            const cursor = servicesCollection.find(query).project({ name: 1 })
            const services = await cursor.toArray()
            res.send(services)
        })


        app.get('/available', async (req, res) => {
            const date = req.query.date
            // console.log(date)

            // Get all services
            const services = await servicesCollection.find().toArray()

            // Get bookings of the day
            const query = { date: date }
            const bookings = await bookingsCollection.find(query).toArray()

            // For each service find bookings that service

            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatmentName === service.name);
                const booked = serviceBookings.map(s => s.slot)
                // service.booked = booked
                // service.booked = serviceBookings.map(s => s.slot);

                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available

            })
            res.send(services)
        })

        /**
         * API Naming Convention
         * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
         * app.get('/booking/:id') // get a specific booking 
         * app.post('/booking') // add a new booking
         * app.patch('/booking/:id) // One item update
         * app.delete('/booking/:id) //
        */
        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatmentName: booking.treatmentName, date: booking.date, paitentName: booking.paitentName }
            // const result = await bookingsCollection.insertOne(booking)
            const exists = await bookingsCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send({ success: true, booking: result })
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const email = req.query.email
            // const authorization = req.headers.authorization
            const decodedEmail = req.decoded.email
            if (decodedEmail === email) {
                const query = { paitentEmail: email }
                const bookings = await bookingsCollection.find(query).toArray()
                res.send(bookings)
            } else {
                return res.status(403).send({ message: 'Forbidden access!' })
            }
            // console.log(authorization)
        })

        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray()
            res.send(doctors)

        })

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            // console.log(email)
            const filter = { email: email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })

        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            // console.log(req.params)
            // const requesterEmail = req.decoded.email
            // const requesterAccount = await userCollection.findOne({ email: requesterEmail })
            // if (requesterAccount.role === 'admin') {
            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc,)
            res.send(result)
            // } else {
            //     res.status(403).send({ message: 'Forbidden access!' })
            // }
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options)
            const token = jwt.sign({ email: email }, process.env.TOKEN_KEY_SECREATE, { expiresIn: '12h' })
            // console.log(token)
            res.send({ result, accessToken: token })
        })
    }
    finally {

    }
}
run().catch(
    console.dir
)



app.get('/', (req, res) => {
    res.send('Doctors portal site is running port', port)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})