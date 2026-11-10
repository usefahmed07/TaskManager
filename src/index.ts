import "dotenv/config";
import app from "./app.js";
import connectDB from "./db/conn.js";

const PORT = process.env.PORT || 8000;

const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`server is listening to the port: ${PORT}`);
    });
};

start().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
