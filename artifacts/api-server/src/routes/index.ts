import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import authRouter from "./auth";
import rozgarRouter from "./rozgar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(authRouter);
router.use(rozgarRouter);

export default router;
