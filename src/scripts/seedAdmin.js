require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { hashPassword } = require("../utils/hash");

async function seedAdmin() {
  await connectDB();

  const existing = await User.findOne({ username: "admin" });

  if (existing) {
    console.log("Admin already exists");
    process.exit();
  }

  const passwordHash = await hashPassword("Azha@123");

  await User.create({
    username: "admin",
    passwordHash,
    role: "admin",
    fullName: "System Administrator",
    gateName: "Main Gate",
    gateLocation: "HQ",
    status: "active"
  });

  console.log("✅ Admin user created");
  process.exit();
}

seedAdmin();