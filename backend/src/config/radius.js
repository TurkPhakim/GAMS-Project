require("dotenv").config();

const RADIUS_HOST = process.env.RADIUS_HOST || "freeradius";
const RADIUS_PORT = process.env.RADIUS_PORT || 1812;
const RADIUS_SECRET = process.env.RADIUS_SECRET || "testing123";

module.exports = {
  host: RADIUS_HOST,
  port: RADIUS_PORT,
  secret: RADIUS_SECRET,
};
