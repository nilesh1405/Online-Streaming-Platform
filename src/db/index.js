import { DB_NAME } from "../constants.js";
import mongoose from "mongoose";

const connectDb=async() => {
    try{
        const connect = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log(`MongoDB connected: ${connect.connection.host}`);
    }catch(error){
        console.error("Error connecting to the database:", error);
        process.exit(1);
    }
}

export default connectDb;
// This code connects to a MongoDB database using Mongoose.