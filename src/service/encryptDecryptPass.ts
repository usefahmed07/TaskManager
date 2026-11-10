import bcryptjs from "bcryptjs";

const encryptPass = async (pass: string): Promise<string | undefined> => {
    try {
        const hashPass = await bcryptjs.hash(pass, 12);
        return hashPass;
    } catch (error) {
        return undefined;
    }
};

const decryptPass = async (pass: string, { password }: { password: string }): Promise<boolean | undefined> => {
    try {
        const compPass = await bcryptjs.compare(pass, password);
        return compPass;
    } catch (error) {
        return undefined;
    }
};

export { encryptPass, decryptPass };
