import transporter from "../config/email.js";
import { errorMessage } from "../util/errorMessage.js";

type Recipient = string | { email: string };

const sendingMail = async (user: Recipient, type: "VERIFY" | "OTP", data: string): Promise<void> => {
    try {
        const to = typeof user === "string" ? user : user.email;

        if (type === "VERIFY") {
            console.log("sending mail");
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject: "Verify",
                text: "",
                html: `<h2>click here to verify:</h2><p>click this link to activate your account.</p><h4 style="color:blue"><a href='${data}'>click here</a></h4>`
            });
            return;
        }
        if (type === "OTP") {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject: "OTP",
                text: "",
                html: `<h2>Verify Otp:</h2><p>Use this otp to update your email.</p><h4 style="color:blue">${data}</h4>`
            });
            return;
        }
    } catch (error) {
        console.log(error);
        throw new Error(errorMessage(error));
    }
};

export { sendingMail };
