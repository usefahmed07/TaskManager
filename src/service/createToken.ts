import jwt from "jsonwebtoken";
import { errorMessage } from "../util/errorMessage.js";

interface TokenUser {
    _id: unknown;
}

const signToken = (user: TokenUser): string => {
    const secret = process.env.SECRET_KEY;
    if (!secret) {
        throw new Error("SECRET_KEY is not set");
    }
    return jwt.sign({ _id: user._id, date: Date.now() / 1000 }, secret, { expiresIn: "1h" });
};

const generateToken = async (user: TokenUser): Promise<string> => {
    try {
        return signToken(user);
    } catch (error) {
        throw new Error(errorMessage(error));
    }
};

const verifyToken = async (user: TokenUser): Promise<string> => {
    try {
        return signToken(user);
    } catch (error) {
        throw new Error(errorMessage(error));
    }
};

export { generateToken, verifyToken };
