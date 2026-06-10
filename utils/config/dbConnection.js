import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    throw new Error("Please define the mongodb connection string. Connection Failed!");
};

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null }
};

async function dbConnect() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        // REMOVE useNewUrlParser and useUnifiedTopology - they are DEPRECATED
        const options = {
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout
            socketTimeoutMS: 45000, // 45 seconds socket timeout
            maxPoolSize: 10, // Maximum connections
            minPoolSize: 1, // Minimum connections
        };

        cached.promise = mongoose.connect(MONGO_URI, options)
            .then((mongoose) => {
                console.log("✅ MongoDB Connected Successfully");
                return mongoose;
            })
            .catch((error) => {
                console.error("❌ MongoDB Connection Error:", error.message);
                // Clear the promise cache on error so we can retry
                cached.promise = null;
                throw error;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        throw error;
    }

    return cached.conn;
}

export default dbConnect;