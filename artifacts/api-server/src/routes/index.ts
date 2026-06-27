import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import aiRouter from "./ai.js";
import authRouter from "./auth.js";
import rozgarRouter from "./rozgar.js";
import profileRouter from "./profile.js";
import sessionsRouter from "./sessions.js";
import savedJobsRouter from "./saved-jobs.js";
import historyItemsRouter from "./history-items.js";
import resumeRouter from "./resume.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(authRouter);
router.use(rozgarRouter);
router.use(profileRouter);
router.use(sessionsRouter);
router.use(savedJobsRouter);
router.use(historyItemsRouter);
router.use(resumeRouter);

export default router;
