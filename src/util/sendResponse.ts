import type { Response } from "express";

const sendResponse = (res: Response, status: number, message: string) => {
    return res.status(status).json({ status, message });
};

export { sendResponse };
