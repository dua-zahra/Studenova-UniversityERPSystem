const mongoose = require('mongoose')
const userSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            index:true
        },
       
        phone: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        }
    }, { timestamps: true }
)
module.exports = mongoose.model("users",userSchema)
