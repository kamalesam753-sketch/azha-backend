const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

require("dotenv").config();

const connectDB = require("../config/db");
const Permit = require("../models/Permit");

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) {
      return String(row[name]).trim();
    }
  }
  return "";
}

function normalizeValidity(statusArabic, paymentArabic) {
  const status = String(statusArabic || "").trim();
  const payment = String(paymentArabic || "").trim();

  if (status.includes("انته")) {
    return {
      validityClass: "invalid",
      validityText: "التصريح منتهي",
      validityNote: "لا يسمح بالمرور إلا بعد مراجعة الإدارة."
    };
  }

  if (payment.includes("لم يتم الدفع")) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "يرجى مراجعة حالة السداد قبل السماح بالمرور."
    };
  }

  if (status.includes("لم يبدأ") || status.includes("يبدا") || status.includes("يبدأ")) {
    return {
      validityClass: "warning",
      validityText: "التصريح لم يبدأ بعد",
      validityNote: "يرجى مراجعة تاريخ بداية التصريح."
    };
  }

  return {
    validityClass: "valid",
    validityText: "صالح للدخول",
    validityNote: "يسمح بالمرور بعد مطابقة البيانات."
  };
}

async function importCSV() {
  await connectDB();

  const filePath = path.join(__dirname, "../../data/permits.csv");
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      const permitId = pick(row, ["Permit id", "Permit ID", "permitId", "permit id"]);
      if (!permitId) return;

      const statusArabic = pick(row, ["status", "Status", "الحالة"]);
      const paymentArabic = pick(row, ["payment status", "Payment Status", "paymentArabic", "السداد"]);
      const validity = normalizeValidity(statusArabic, paymentArabic);

      results.push({
        permitId,
        unit: pick(row, ["Unit number", "Unit Number", "unit", "Unit"]),
        ownerName: pick(row, ["owner name", "Owner Name", "ownerName"]),
        statusArabic,
        startDate: pick(row, ["Start date", "Start Date", "startDate"]),
        endDate: pick(row, ["End date", "End Date", "endDate"]),
        tenant: pick(row, ["Tenants Names", "Tenant", "tenant", "Tenant Name"]),
        tenantCount: pick(row, ["Number of tenant", "Tenant Count", "tenantCount"]),
        phone: pick(row, ["phone number", "Phone Number", "phone"]),
        paymentArabic,
        carPlate: pick(row, ["Car Plate", "carPlate", "Vehicle"]),
        validityClass: validity.validityClass,
        validityText: validity.validityText,
        validityNote: validity.validityNote,
        source: "csv_import"
      });
    })
    .on("end", async () => {
      try {
        await Permit.deleteMany({});
        await Permit.insertMany(results, { ordered: false });

        console.log("✅ Data Imported Successfully:", results.length);
        process.exit(0);
      } catch (err) {
        console.error("❌ Import Error:", err.message);
        process.exit(1);
      }
    });
}

importCSV();