import connect from '@/utils/config/dbConnection';
import User from '@/utils/models/User';
import bcryptjs from 'bcryptjs';
import { NextResponse } from "next/server";

const DEFAULT_PROFILE_IMAGE =
    "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

export async function POST(request) {
    console.log("=== /api/register START ===");

    try {
        console.log("1. Testing MongoDB connection...");
        await connect();
        console.log("✅ MongoDB connection successful");

        console.log("2. Parsing request body...");
        const { name, email, password } = await request.json();
        console.log("Received:", { name, email, password: password ? "***" : "MISSING" });

        console.log("3. Checking if user exists...");
        const user = await User.findOne({ email });

        if (user) {
            console.log("❌ User already exists");
            return NextResponse.json({
                error: "User has already an account"
            }, { status: 400 });
        }

        console.log("4. Hashing password...");
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        console.log("5. Creating new user...");
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            profileImage: DEFAULT_PROFILE_IMAGE
        });

        console.log("6. Saving user to database...");
        const saveUser = await newUser.save();
        console.log("✅ User saved:", saveUser._id);

        console.log("=== /api/register SUCCESS ===");
        return NextResponse.json({
            message: "User created successfully",
            success: true,
            saveUser
        });

    } catch (error) {
        console.error("=== /api/register ERROR ===");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Error code:", error.code);
        console.error("Error name:", error.name);

        return NextResponse.json({
            error: error.message,
            details: "Check server logs for more information"
        }, { status: 500 });
    }
}