require('dotenv').config();
const mongoose = require('mongoose');
const CertificateTemplate = require('../models/CertificateTemplate');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const templates = await CertificateTemplate.find();
  console.log(JSON.stringify(templates, null, 2));
  await mongoose.connection.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
