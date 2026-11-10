import type { verifyToken } from "../service/verifyToken.js";

declare global {
    namespace Express {
        interface Request {
            user?: Awaited<ReturnType<typeof verifyToken>>;
        }
    }
}

export {};
