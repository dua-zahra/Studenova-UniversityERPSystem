const mongoose = require('mongoose')
const colors=require('colors')
require('dotenv').config();  

const dbConnection = () =>{
    try {
        // mongoose.connect("mongodb://127.0.0.1:27017/UniverityERP")
        mongoose.connect(process.env.MONGODB_URI)
        console.log(`Database connected successfully on`.bgCyan)
    } catch (error) {
        console.log("Error in DB connection", error)
    }
}

module.exports = dbConnection