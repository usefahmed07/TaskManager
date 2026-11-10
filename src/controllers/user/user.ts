import crypto from "crypto";
import type { Request, Response } from "express";
import { UserModel } from "../../model/user.js";
import { status } from "../../config/status.js";
import { message } from "../../config/message.js";
import { encryptPass, decryptPass } from "../../service/encryptDecryptPass.js";
import { generateToken } from "../../service/createToken.js";
import { sendingMail } from "../../service/verificationMail.js";
import { generateOtp } from "../../util/generateOtp.js";
import { sendResponse } from "../../util/sendResponse.js";
import { errorMessage } from "../../util/errorMessage.js";

type UserDoc = InstanceType<typeof UserModel>;

const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const hash = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const mailConfigured = (): boolean => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const PHONE_REGEX = /^\d{10,15}$/;
const MIN_PASSWORD = 8;

const hashPassword = async (password: string): Promise<string> => {
    const hashed = await encryptPass(password);
    if (!hashed) {
        throw new Error("PASSWORD HASHING FAILED.");
    }
    return hashed;
};

const publicUser = (user: UserDoc) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isVerified: user.isVerified,
    createdAt: user.createdAt
});

const sendVerification = async (user: UserDoc): Promise<void> => {
    const token = crypto.randomBytes(32).toString("hex");
    user.token = hash(token);
    user.tokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const baseUrl = process.env.BASE_URL || "http://localhost:8000";
    const link = `${baseUrl}/api/user/verify/${token}`;

    if (!mailConfigured()) {
        console.log(`Mail is not configured. Verification link: ${link}`);
        return;
    }
    await sendingMail(user, "VERIFY", link);
};

const checkOtp = (user: UserDoc, otp: unknown): string | null => {
    if (!isText(otp)) return message.EMPTY_FIELD;
    if (!user.otp || !user.otpExpiry || user.otpExpiry < new Date()) return message.OTP_EXPIRED;

    const given = Buffer.from(hash(otp.trim()));
    const saved = Buffer.from(user.otp);
    if (given.length !== saved.length || !crypto.timingSafeEqual(given, saved)) {
        return message.AUTH_FAILED;
    }
    return null;
};

class MyUser {
    register = async (req: Request, res: Response) => {
        try {
            const { name, email, phone, password } = req.body;

            if (!isText(name) || !isText(email) || !isText(phone) || !isText(password)) {
                return sendResponse(res, status.NOT_ACCEPTABLE, message.EMPTY_FIELD);
            }
            if (!PHONE_REGEX.test(phone.trim())) {
                return sendResponse(res, status.BAD_REQUEST, "PHONE MUST BE 10 TO 15 DIGITS.");
            }
            if (password.length < MIN_PASSWORD) {
                return sendResponse(res, status.BAD_REQUEST, `PASSWORD MUST BE AT LEAST ${MIN_PASSWORD} CHARACTERS.`);
            }

            const normalizedEmail = email.trim().toLowerCase();
            const exist = await UserModel.findOne({ email: normalizedEmail });
            if (exist) {
                return sendResponse(res, status.BAD_REQUEST, message.ALREADY_REGISTERED);
            }

            const user = await UserModel.create({
                name: name.trim(),
                email: normalizedEmail,
                phone: phone.trim(),
                password: await hashPassword(password)
            });

            await sendVerification(user);
            return sendResponse(res, status.CREATED, message.REGISTER_SUCCESS);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    verifyUser = async (req: Request, res: Response) => {
        try {
            const user = await UserModel.findOne({ token: hash(String(req.params.token)) });

            if (!user) {
                return sendResponse(res, status.BAD_REQUEST, message.INVALID_URL);
            }
            if (!user.tokenExpires || user.tokenExpires < new Date()) {
                return sendResponse(res, status.BAD_REQUEST, message.TOKEN_EXPIRED);
            }

            user.isVerified = true;
            user.token = undefined;
            user.tokenExpires = undefined;
            await user.save();

            return sendResponse(res, status.SUCCESS, message.VERIFIED_SUCCESS);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;

            if (!isText(email) || !isText(password)) {
                return sendResponse(res, status.NOT_ACCEPTABLE, message.EMPTY_FIELD);
            }

            const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
            if (!user || !(await decryptPass(password, user))) {
                return sendResponse(res, status.UNAUTHORIZED, message.LOGIN_FAILED);
            }

            if (!user.isVerified) {
                await sendVerification(user);
                return sendResponse(res, status.UNAUTHORIZED, message.SENDING_LINK);
            }

            const token = await generateToken(user);
            return res.status(200).json({ status: status.SUCCESS, message: message.LOGIN_SUCCESS, token });
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    getUser = async (req: Request, res: Response) => {
        return res.status(200).json({ status: status.SUCCESS, data: publicUser(req.user!) });
    };

    updateUser = async (req: Request, res: Response) => {
        try {
            const { name, phone } = req.body;
            const updates: Record<string, string> = {};

            if (name !== undefined) {
                if (!isText(name)) return sendResponse(res, status.BAD_REQUEST, message.EMPTY_FIELD);
                updates.name = name.trim();
            }
            if (phone !== undefined) {
                if (!isText(phone) || !PHONE_REGEX.test(phone.trim())) {
                    return sendResponse(res, status.BAD_REQUEST, "PHONE MUST BE 10 TO 15 DIGITS.");
                }
                updates.phone = phone.trim();
            }
            if (Object.keys(updates).length === 0) {
                return sendResponse(res, status.NOT_ACCEPTABLE, message.EMPTY_FIELD);
            }

            await UserModel.updateOne({ _id: req.user!._id }, { $set: updates }, { runValidators: true });
            return sendResponse(res, status.SUCCESS, message.USER_UPDATE);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    updateEmailUsingOtp = async (req: Request, res: Response) => {
        try {
            const user = req.user!;
            const otp = generateOtp(6);

            user.otp = hash(otp);
            user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            if (mailConfigured()) {
                await sendingMail(user.email, "OTP", otp);
            } else {
                console.log(`Mail is not configured. OTP: ${otp}`);
            }

            return sendResponse(res, status.SUCCESS, message.OTP_SENT);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    updateEmail = async (req: Request, res: Response) => {
        try {
            const user = req.user!;
            const { otp, email } = req.body;

            if (!isText(email)) {
                return sendResponse(res, status.NOT_ACCEPTABLE, message.EMPTY_FIELD);
            }
            const otpError = checkOtp(user, otp);
            if (otpError) {
                return sendResponse(res, status.BAD_REQUEST, otpError);
            }

            const normalizedEmail = email.trim().toLowerCase();
            const exist = await UserModel.findOne({ email: normalizedEmail });
            if (exist) {
                return sendResponse(res, status.BAD_REQUEST, message.ALREADY_REGISTERED);
            }

            user.email = normalizedEmail;
            user.isVerified = false;
            user.otp = undefined;
            user.otpExpiry = undefined;
            await sendVerification(user);

            return sendResponse(res, status.SUCCESS, message.EMAIL_UPDATE);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };

    updatePassword = async (req: Request, res: Response) => {
        try {
            const user = req.user!;
            const { otp, password, confirmPassword } = req.body;

            if (!isText(password) || !isText(confirmPassword)) {
                return sendResponse(res, status.NOT_ACCEPTABLE, message.EMPTY_FIELD);
            }
            if (password !== confirmPassword) {
                return sendResponse(res, status.BAD_REQUEST, message.PASSWORD_MISMATCH);
            }
            if (password.length < MIN_PASSWORD) {
                return sendResponse(res, status.BAD_REQUEST, `PASSWORD MUST BE AT LEAST ${MIN_PASSWORD} CHARACTERS.`);
            }

            const otpError = checkOtp(user, otp);
            if (otpError) {
                return sendResponse(res, status.BAD_REQUEST, otpError);
            }
            if (await decryptPass(password, user)) {
                return sendResponse(res, status.BAD_REQUEST, message.PASSWORD_SAME);
            }

            user.password = await hashPassword(password);
            user.otp = undefined;
            user.otpExpiry = undefined;
            await user.save();

            return sendResponse(res, status.SUCCESS, message.PASSWORD_UPDATE);
        } catch (error) {
            return sendResponse(res, status.BAD_REQUEST, errorMessage(error));
        }
    };
}

const userObj = new MyUser();
export { userObj };
