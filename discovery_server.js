import "dotenv/config";
import discoveryApp from "./discovery.js";

const PORT = parseInt(process.env.DISCOVERY_PORT || "3001", 10);
const ENABLED = (process.env.ENABLE_DISCOVERY || "true").toLowerCase() === "true";

if (ENABLED) {
  discoveryApp.listen(PORT, () => {
    console.log(`✨ Discovery server running on port ${PORT}`);
  });
} else {
  console.log("Discovery server disabled (ENABLE_DISCOVERY=false)");
}
