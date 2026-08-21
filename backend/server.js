const express = require("express");
const prisma = require("./prismaClient");

const app = express();

app.use(express.json());

const PORT = 3000;

app.post("/deliveries", async (req, res) => {
    try {
        const delivery = await prisma.delivery.create({
            data: {
                customerName: req.body.customerName,
                address: req.body.address,
                latitude: req.body.latitude,
                longitude: req.body.longitude
            }
        });

        res.status(201).json(delivery);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create delivery"
        });
    }
});

