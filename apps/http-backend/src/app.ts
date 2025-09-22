import express from "express"

const app = express()

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}`);
    
})