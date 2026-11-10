import jwt, { JwtPayload } from "jsonwebtoken";
import { UserModel } from "../model/user.js";
import { message } from "../config/message.js";
import { errorMessage } from "../util/errorMessage.js";

const verifyToken = async (token: string) => {
    try {
        const secret = process.env.SECRET_KEY;
        if (!secret) {
            throw new Error("SECRET_KEY is not set");
        }
        const decode = jwt.verify(token, secret) as JwtPayload;

        //check user
        const user = await UserModel.findOne({ _id: decode._id });

        if (!user) {
            throw new Error(message.AUTH_FAILED);
        }

        return user;
    } catch (error) {
        throw new Error(errorMessage(error));
    }
};

export { verifyToken };
