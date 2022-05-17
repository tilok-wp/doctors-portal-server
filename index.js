const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9dn9g.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors-booking').collection('service')
        const bookingsCollection = client.db('doctors-booking').collection('booking')
        const userCollection = client.db('doctors-booking').collection('users')



        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
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

        app.get('/booking', async (req, res) => {
            const email = req.query.email
            const query = { paitentEmail: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
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
            res.send(result)
        })
    }
    finally {

    }
}
run().catch(
    console.dir
)



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port} `)
})