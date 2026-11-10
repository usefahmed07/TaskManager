import { randomInt } from "crypto";

const generateOtp = (length: number): string => {
    let otp = "";

    for (let i = 0; i < length; i++) {
        otp += randomInt(0, 10);
    }
    return otp;
};

export { generateOtp };
