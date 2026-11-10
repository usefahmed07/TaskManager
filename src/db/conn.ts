import mongoose from "mongoose";
import { errorMessage } from "../util/errorMessage.js";

const connectDB = async (): Promise<void> => {
    const url = process.env.DB_URL;
    if (!url) {
        throw new Error("DB_URL is not set");
    }

    try {
        const conn = await mongoose.connect(url);

        if (conn) {
            console.log(`connection successfull to db.............`);
        }
    } catch (error) {
        throw new Error(errorMessage(error));
    }
};

export default connectDB;
